import { ytAuthSnapshot } from './auth';
import { getInnertube, getSignedInnertube } from './innertube';
import { resolvePlayer, UnplayableError, type ResolvedPlayer } from './resolver';
import { getBridge } from './session';
import { withTimeout } from './timeout';

/**
 * Downloads a YouTube Music track straight into the Studio as bytes, deciphered
 * and ready to ingest — the Connect path's answer to "the waveform is empty".
 *
 * Two rules keep this honest:
 *
 * 1. **The extension downloads the bytes.** `fetch(googlevideoUrl)` from the
 *    page depends on the extension's declarativeNetRequest header rewrite; if
 *    that rule doesn't match (a port, a redirect, a new googlevideo host), the
 *    request stalls without an error and the UI spins forever. The extension
 *    has host permission for `*.googlevideo.com`, so `yt.fetch` reads the file
 *    itself, CORS-free, and returns it base64. The page only falls back to a
 *    direct fetch when no bridge is registered.
 *
 * 2. **Every stage has a deadline** (timeout.ts). A player request, a manifest
 *    render, or a download that never answers rejects with a named
 *    StageTimeoutError instead of hanging.
 *
 * The result is a File the Studio treats exactly like a dropped local file —
 * real peaks, real Web Audio clock, real scrubbing.
 */

export class ConnectFetchError extends Error {
  override readonly name = 'ConnectFetchError';
}

export interface ResolvedTrackFile {
  file: File;
  /** From the player response, for the toast. */
  title: string;
  author: string | null;
  /** Seconds (0 when the response doesn't say). */
  durationSec: number;
}

/**
 * The best audio for a dropped file this page: the opus/webm AdaptationSet if there is one,
 * otherwise the highest-bandwidth one. `mimeType`/`contentType` are on the AdaptationSet in
 * youtubei.js's manifests; the Representation carries bandwidth and codecs.
 */
function pickAudioUrl(manifest: string): { url: string; mimeType: string } | null {
  try {
    const parse = new DOMParser();
    const doc = parse.parseFromString(manifest, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const candidates: { url: string; mimeType: string; bandwidth: number; opus: boolean }[] = [];
    for (const set of doc.querySelectorAll('AdaptationSet')) {
      const contentType = (set.getAttribute('contentType') ?? '').toLowerCase();
      const setMime = (set.getAttribute('mimeType') ?? '').toLowerCase();
      if (contentType !== 'audio' && !setMime.startsWith('audio/')) continue;
      for (const rep of set.querySelectorAll('Representation')) {
        const url = rep.querySelector('BaseURL')?.textContent?.trim();
        if (!url) continue;
        const repMime = (rep.getAttribute('mimeType') ?? setMime).toLowerCase();
        const bandwidth = Number(rep.getAttribute('bandwidth') ?? '0');
        const codecs = (rep.getAttribute('codecs') ?? '').toLowerCase();
        candidates.push({ url, mimeType: repMime, bandwidth, opus: codecs.includes('opus') });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => Number(b.opus) - Number(a.opus) || b.bandwidth - a.bandwidth);
    const best = candidates[0];
    return best ? { url: best.url, mimeType: best.mimeType } : null;
  } catch {
    return null;
  }
}

/** Session bootstrap, player request, manifest render, media download. */
const SESSION_TIMEOUT_MS = 20_000;
const RESOLVE_TIMEOUT_MS = 45_000;
const MANIFEST_TIMEOUT_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
/** Below this, googlevideo answered with an error page rather than a song. */
const MIN_AUDIO_BYTES = 64 * 1024;

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Each range is capped: a bridge reply carries the bytes as base64, and one
 * 2 MB chunk stays around 2.7 MB of JSON, well inside the messaging limits.
 */
const CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Reads one byte range. Through the extension when it's there (host permission,
 * no CORS), directly otherwise (the DNR rules clear googlevideo's CORS).
 */
async function readRange(
  url: string,
  offset: number,
  end: number,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; total: number | null }> {
  const headers = { Range: `bytes=${offset}-${end}` };
  const bridge = getBridge();

  if (!bridge) {
    const response = await withTimeout(
      fetch(url, { signal, headers }),
      DOWNLOAD_TIMEOUT_MS,
      'Downloading the audio',
    );
    if (response.status < 200 || response.status >= 300) {
      throw new ConnectFetchError(`googlevideo answered HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(
      await withTimeout(response.arrayBuffer(), DOWNLOAD_TIMEOUT_MS, 'Downloading the audio'),
    );
    return { bytes, total: totalFromContentRange(response.headers.get('content-range')) };
  }

  const response = await bridge.call(
    'yt.fetch',
    { url, method: 'GET', headers },
    { timeoutMs: DOWNLOAD_TIMEOUT_MS + 5_000, ...(signal && { signal }) },
  );
  if (response.status < 200 || response.status >= 300) {
    throw new ConnectFetchError(`googlevideo answered HTTP ${response.status} through the extension`);
  }
  const bytes =
    response.bodyEncoding === 'base64' ? decodeBase64(response.body) : new TextEncoder().encode(response.body);
  const total =
    totalFromContentRange(response.headers['content-range'] ?? null) ??
    (response.headers['content-length'] ? Number(response.headers['content-length']) : null);
  return { bytes, total };
}

function totalFromContentRange(value: string | null): number | null {
  const match = value ? /bytes\s+\d+-\d+\/(\d+)/i.exec(value) : null;
  return match ? Number(match[1]) : null;
}

/**
 * Reads the whole audio file in ranges.
 *
 * Every request carries `Range: bytes=<offset>-<end>`. googlevideo throttles a
 * plain full-file GET hard (measured 33 KB/s: a 3.6 MB track took ~110 s — the
 * user-facing "Connecting…" forever), while the same bytes over a range
 * request arrive at ~1 MB/s (~4 s). A 206 can also stop short of the total, so
 * the loop keeps reading until Content-Range says the file is complete.
 */
async function downloadAudio(url: string, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let total: number | null = null;

  for (let attempt = 0; attempt < 32; attempt++) {
    const chunk = await readRange(url, received, received + CHUNK_BYTES - 1, signal);
    if (chunk.bytes.byteLength === 0) break;
    parts.push(chunk.bytes);
    received += chunk.bytes.byteLength;
    total = chunk.total ?? total;
    // No total (server ignored Range and sent the file whole) or complete.
    if (total === null || received >= total) break;
  }

  if (total !== null && received < total) {
    throw new ConnectFetchError(`googlevideo sent ${received} of ${total} bytes`);
  }
  if (received < MIN_AUDIO_BYTES) {
    throw new ConnectFetchError(`googlevideo answered a stub (${received} bytes)`);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.byteLength;
  }
  return buffer;
}

const SAFE_NAME = /[\\/:*?"<>|]/g;

export async function fetchTrackFile(videoId: string, signal?: AbortSignal): Promise<ResolvedTrackFile> {
  let yt = await withTimeout(getInnertube(), SESSION_TIMEOUT_MS, 'Starting the YouTube session');
  let resolved: ResolvedPlayer;
  try {
    resolved = await withTimeout(resolvePlayer(yt, videoId), RESOLVE_TIMEOUT_MS, 'Resolving the track');
  } catch (error) {
    // An age gate is a verdict on the visitor, not the track: ask again as
    // the signed-in user, like the old engine did.
    if (!(error instanceof UnplayableError && error.ageGated) || !ytAuthSnapshot().signedIn) throw error;
    yt = await withTimeout(getSignedInnertube(), SESSION_TIMEOUT_MS, 'Starting the signed-in YouTube session');
    resolved = await withTimeout(resolvePlayer(yt, videoId, new Set(), true), RESOLVE_TIMEOUT_MS, 'Resolving the signed-in track');
  }

  const info = resolved.info;
  const basic = info.basic_info;
  const title = basic.title ?? 'Track';
  const author = basic.author ?? null;
  const durationSec = typeof basic.duration === 'number' ? basic.duration : 0;

  // Render the deciphered manifest once; its best audio Representation is the
  // file the old player would have buffered.
  const manifest = await withTimeout(
    info.toDash({
      format_filter: (format) => format.has_video || !format.has_audio,
      manifest_options: { include_thumbnails: false },
    }),
    MANIFEST_TIMEOUT_MS,
    'Rendering the audio manifest',
  );
  const audio = pickAudioUrl(manifest);
  if (!audio) {
    throw new ConnectFetchError(
      'This track only offers adaptive (SABR) streaming — it has no downloadable audio file. Use the YouTube embed or the Companion instead.',
    );
  }

  const buffer = await downloadAudio(audio.url, signal);

  const base = `${author ? `${author} - ` : ''}${title}`.replace(SAFE_NAME, '_').trim().slice(0, 120) || 'track';
  const ext = audio.mimeType.includes('mp4') || audio.mimeType.includes('m4a') ? 'm4a' : audio.mimeType.includes('webm') ? 'webm' : 'audio';
  const file = new File([buffer], `${base}.${ext}`, { type: audio.mimeType || 'audio/webm' });
  return { file, title, author, durationSec };
}
