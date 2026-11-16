/**
 * OpenLyryc Companion Bridge Client
 * Connects browser OpenLyryc Studio directly to the local Tauri Companion daemon at 127.0.0.1:4040.
 * Enables zero-video, raw-fidelity Web Audio loading from YouTube (Opus/AAC).
 */

export interface CompanionStatus {
  ok: boolean;
  status: string;
  port: number;
  version: string;
  ytdlp: boolean;
  cacheDir?: string;
}

export interface CompanionSearchResult {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  durationFormatted?: string;
  thumbnail?: string;
}

export interface CompanionDownloadResult {
  ok: boolean;
  filename: string;
  streamUrl: string;
  format: string;
  error?: string;
}

export interface CompanionLibraryItem {
  filename: string;
  title: string;
  size_bytes: number;
  size_formatted: string;
}

export interface CompanionPairResponse {
  ok: boolean;
  paired: boolean;
  code?: string;
  message?: string;
}

export const COMPANION_BRIDGE_ORIGIN = 'http://127.0.0.1:4040';

const STORAGE_KEY_PAIRED = 'openlyryc_companion_paired';
const STORAGE_KEY_CODE = 'openlyryc_companion_code';

export function isCompanionPaired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_PAIRED) === 'true';
  } catch {
    return false;
  }
}

export function setCompanionPaired(paired: boolean, code?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (paired) {
      localStorage.setItem(STORAGE_KEY_PAIRED, 'true');
      if (code) localStorage.setItem(STORAGE_KEY_CODE, code);
    } else {
      localStorage.removeItem(STORAGE_KEY_PAIRED);
      localStorage.removeItem(STORAGE_KEY_CODE);
    }
    window.dispatchEvent(new CustomEvent('openlyryc:companion-paired', { detail: { paired, code } }));
  } catch {}
}

export function getStoredPairCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY_CODE) || '';
  } catch {
    return '';
  }
}

export async function checkCompanionPairStatus(): Promise<CompanionPairResponse | null> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/pair`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      return (await res.json()) as CompanionPairResponse;
    }
  } catch {}
  return null;
}

export async function pairWithCompanion(code: string): Promise<CompanionPairResponse> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as CompanionPairResponse;
      if (data.ok && data.paired) {
        setCompanionPaired(true, code.trim());
      }
      return data;
    }
  } catch (err: any) {
    return { ok: false, paired: false, message: err?.message || 'Connection failed' };
  }
  return { ok: false, paired: false, message: 'Invalid pairing response' };
}

export async function unpairCompanion(): Promise<boolean> {
  setCompanionPaired(false);
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/unpair`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return true;
  }
}

/**
 * Checks if the OpenLyryc Native Companion is currently running on localhost:4040
 */
export async function checkCompanionBridge(): Promise<CompanionStatus | null> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/health`, {
      signal: AbortSignal.timeout(900),
    });
    if (res.ok) {
      return (await res.json()) as CompanionStatus;
    }
  } catch {
    // Companion offline or not launched
  }
  return null;
}

/**
 * Search YouTube through the local companion's fast yt-dlp flat-playlist metadata probe
 */
export async function searchCompanionBridge(
  query: string
): Promise<CompanionSearchResult[]> {
  try {
    const res = await fetch(
      `${COMPANION_BRIDGE_ORIGIN}/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      return (data.results || []) as CompanionSearchResult[];
    }
  } catch (err) {
    console.warn('[CompanionBridge] Search failed:', err);
  }
  return [];
}

/**
 * Download highest-quality audio via companion bridge and get local stream URL
 */
export async function downloadViaCompanionBridge(
  urlOrId: string,
  format: 'opus' | 'm4a' | 'mp3' = 'opus',
  title?: string
): Promise<CompanionDownloadResult | null> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlOrId, format, title }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      return (await res.json()) as CompanionDownloadResult;
    }
  } catch (err) {
    console.error('[CompanionBridge] Download failed:', err);
  }
  return null;
}

/**
 * Lists cached audio files downloaded on the companion
 */
export async function getCompanionLibrary(): Promise<CompanionLibraryItem[]> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/library`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.items || []) as CompanionLibraryItem[];
    }
  } catch (err) {
    console.warn('[CompanionBridge] Failed to fetch library:', err);
  }
  return [];
}

/**
 * Tells the companion to reveal the audio cache folder in Explorer/Finder
 */
export async function openCompanionAudioFolder(): Promise<boolean> {
  try {
    const res = await fetch(`${COMPANION_BRIDGE_ORIGIN}/open-cache`, {
      method: 'POST',
    });
    return res.ok;
  } catch {
    return false;
  }
}
