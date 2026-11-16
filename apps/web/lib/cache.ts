import { OpenLyricsDocument } from '@/types/lyrics';
import { db } from './db';

// 7-day TTL  entries rewrite their timestamp on every set, so only
// genuinely stale (unopened for 7d) docs are evicted on read.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCachedDocument(songId: string): Promise<OpenLyricsDocument | null> {
  if (typeof window === 'undefined') return null;
  try {
    const entry = await db.lyrics_cache.get(songId);
    if (entry && entry.document) {
      // Lazy TTL eviction: drop stale entries instead of serving them.
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        db.lyrics_cache.delete(songId).catch(() => {});
        return null;
      }
      return entry.document;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setCachedDocument(songId: string, document: OpenLyricsDocument): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await db.lyrics_cache.put({
      songId,
      document,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore cache write errors
  }
}
