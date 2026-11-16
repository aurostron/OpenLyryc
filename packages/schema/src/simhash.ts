/**
 * 64-bit SimHash (Locality-Sensitive Hashing) Engine for Lyric Text
 * Detects identical and near-identical lyric documents with fast bitwise Hamming distance.
 */

// 64-bit FNV-1a hash function for strings, returning [high32, low32] unsigned ints
function fnv1a64(str: string): [number, number] {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x84222325 >>> 0;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 = (h1 ^ code) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;

    h2 = (h2 ^ (code + (i % 7))) >>> 0;
    h2 = Math.imul(h2, 0x5bd1e995) >>> 0;
  }

  return [h1, h2];
}

/**
 * Normalizes lyric lines or raw text into a standard stream for SimHash.
 */
export function normalizeLyricText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts weighted feature tokens (word unigrams + bigrams + character trigrams)
 */
export function extractLyricFeatures(text: string): Map<string, number> {
  const normalized = normalizeLyricText(text);
  const words = normalized.split(' ').filter((w) => w.length > 0);
  const features = new Map<string, number>();

  const addFeature = (feat: string, weight = 1) => {
    features.set(feat, (features.get(feat) || 0) + weight);
  };

  // 1. Word unigrams (weight: 2)
  for (const word of words) {
    addFeature(`w:${word}`, 2);
  }

  // 2. Word bigrams (weight: 3)
  for (let i = 0; i < words.length - 1; i++) {
    addFeature(`bg:${words[i]}_${words[i + 1]}`, 3);
  }

  // 3. Character trigrams for typo-resilience (weight: 1)
  const compact = words.join('');
  for (let i = 0; i < compact.length - 2; i++) {
    addFeature(`tri:${compact.slice(i, i + 3)}`, 1);
  }

  return features;
}

/**
 * Computes a 64-bit SimHash hex string (16 hex chars) from lyric text.
 */
export function computeSimHash(text: string): string {
  const features = extractLyricFeatures(text);
  if (features.size === 0) {
    return '0000000000000000';
  }

  // 64 accumulator buckets
  const v = new Int32Array(64);

  for (const [token, weight] of features.entries()) {
    const [hHigh, hLow] = fnv1a64(token);

    // Process low 32 bits (bits 0..31)
    for (let i = 0; i < 32; i++) {
      const bit = (hLow >>> i) & 1;
      v[i] += bit === 1 ? weight : -weight;
    }

    // Process high 32 bits (bits 32..63)
    for (let i = 0; i < 32; i++) {
      const bit = (hHigh >>> i) & 1;
      v[32 + i] += bit === 1 ? weight : -weight;
    }
  }

  // Construct 64-bit result as two 32-bit unsigned integers
  let resLow = 0 >>> 0;
  let resHigh = 0 >>> 0;

  for (let i = 0; i < 32; i++) {
    if (v[i] > 0) {
      resLow = (resLow | (1 << i)) >>> 0;
    }
  }

  for (let i = 0; i < 32; i++) {
    if (v[32 + i] > 0) {
      resHigh = (resHigh | (1 << i)) >>> 0;
    }
  }

  const highHex = resHigh.toString(16).padStart(8, '0');
  const lowHex = resLow.toString(16).padStart(8, '0');
  return `${highHex}${lowHex}`;
}

/**
 * Counts the number of set bits (population count) in a 32-bit integer.
 */
function popcnt32(n: number): number {
  let count = 0;
  let v = n >>> 0;
  while (v !== 0) {
    v &= v - 1;
    count++;
  }
  return count;
}

/**
 * Computes the Hamming distance (0..64) between two 16-character 64-bit SimHash hex strings.
 *
 * Distance interpretations:
 * - 0: Exactly identical text
 * - 1..3: Extremely close match (>= 90% text similarity, minor punctuation or 1-word edit)
 * - 4..7: Probable variation (same song with different verses or alternate bridge)
 * - >= 8: Dissimilar songs
 */
export function computeHammingDistance(hashA?: string, hashB?: string): number {
  if (!hashA || !hashB || hashA.length !== 16 || hashB.length !== 16) {
    return 64;
  }

  const highA = parseInt(hashA.slice(0, 8), 16) >>> 0;
  const lowA = parseInt(hashA.slice(8, 16), 16) >>> 0;

  const highB = parseInt(hashB.slice(0, 8), 16) >>> 0;
  const lowB = parseInt(hashB.slice(8, 16), 16) >>> 0;

  const xorHigh = (highA ^ highB) >>> 0;
  const xorLow = (lowA ^ lowB) >>> 0;

  return popcnt32(xorHigh) + popcnt32(xorLow);
}

/**
 * Returns true if two SimHashes indicate a duplicate song text (distance <= maxDistance, default 3).
 */
export function isSimHashDuplicate(hashA?: string, hashB?: string, maxDistance = 3): boolean {
  return computeHammingDistance(hashA, hashB) <= maxDistance;
}
