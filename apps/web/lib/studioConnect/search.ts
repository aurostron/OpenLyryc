import type { YouTubeSearchResult } from '@/lib/youtubeAutoDetector';
import { rankYouTubeCandidates, type YouTubeCandidate } from '@/lib/youtubeSearchRank';
import { getBridge } from './session';

/**
 * YouTube Music search through the extension's signed session. Returns null
 * whenever the extension isn't there, is signed out, is too old to speak
 * `yt.search`, or failed — the caller then uses the server-side proxies.
 */
export async function searchYouTubeViaExtension(
  query: string,
  durationSeconds?: number
): Promise<YouTubeSearchResult | null> {
  const bridge = getBridge();
  if (!bridge) return null;

  try {
    const result = await bridge.call(
      'yt.search',
      { query, ...(durationSeconds ? { duration: durationSeconds } : {}) },
      { timeoutMs: 12_000 }
    );
    const candidates = (result.candidates ?? []) as YouTubeCandidate[];
    if (candidates.length === 0) return null;

    const ranked = rankYouTubeCandidates(candidates, query, durationSeconds);
    return {
      bestMatch: ranked.bestMatch ? toDetected(ranked.bestMatch) : null,
      candidates: ranked.candidates.map(toDetected),
    };
  } catch {
    return null;
  }
}

function toDetected(candidate: YouTubeCandidate): YouTubeSearchResult['candidates'][number] {
  return {
    videoId: candidate.videoId,
    title: candidate.title,
    channelTitle: candidate.channelTitle,
    duration: candidate.durationSeconds || undefined,
  };
}
