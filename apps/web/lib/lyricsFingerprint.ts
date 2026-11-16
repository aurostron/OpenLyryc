import { LyricLine } from '@/types/lyrics';
import { computeSimHash, computeHammingDistance, isSimHashDuplicate } from '@openlyryc/schema';

export { computeSimHash, computeHammingDistance, isSimHashDuplicate };

/**
 * Normalizes lyric text for hashing — strips punctuation, lowercases,
 * collapses whitespace, strips accents via unicode decomposition.
 */
export function normalizeForHashing(text: string): string {
  return text
    .normalize('NFD')                     // Decompose accents: é → e + ́
    .replace(/[\u0300-\u036f]/g, '')      // Strip combining accent marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')         // Strip punctuation
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .trim();
}

/**
 * Computes a SHA-256 hash of the normalized lyrics text content.
 * Ignores timestamps — purely content-addressed.
 *
 * Returns a hex string like "e3b0c44298fc1c149..."
 */
export async function computeLyricsHash(lines: LyricLine[]): Promise<string> {
  const normalized = lines
    .map((l) => normalizeForHashing(l.text))
    .filter(Boolean)
    .join('\n');

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to FNV fallback
    }
  }

  // FNV-1a fallback
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0').padEnd(64, '0');
}

/**
 * Computes a 64-bit SimHash hex string from lyric lines.
 */
export function computeLyricsSimHash(lines: LyricLine[]): string {
  const fullText = lines
    .map((l) => l.text)
    .filter(Boolean)
    .join('\n');
  return computeSimHash(fullText);
}
