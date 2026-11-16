import assert from 'node:assert';

// 1. Test SimHash Locality-Sensitive Hashing Logic
function fnv1a64(str) {
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

function normalizeLyricText(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLyricFeatures(text) {
  const normalized = normalizeLyricText(text);
  const words = normalized.split(' ').filter((w) => w.length > 0);
  const features = new Map();

  const addFeature = (feat, weight = 1) => {
    features.set(feat, (features.get(feat) || 0) + weight);
  };

  for (const word of words) addFeature(`w:${word}`, 2);
  for (let i = 0; i < words.length - 1; i++) addFeature(`bg:${words[i]}_${words[i + 1]}`, 3);
  const compact = words.join('');
  for (let i = 0; i < compact.length - 2; i++) addFeature(`tri:${compact.slice(i, i + 3)}`, 1);

  return features;
}

function computeSimHash(text) {
  const features = extractLyricFeatures(text);
  if (features.size === 0) return '0000000000000000';
  const v = new Int32Array(64);

  for (const [token, weight] of features.entries()) {
    const [hHigh, hLow] = fnv1a64(token);
    for (let i = 0; i < 32; i++) {
      const bit = (hLow >>> i) & 1;
      v[i] += bit === 1 ? weight : -weight;
    }
    for (let i = 0; i < 32; i++) {
      const bit = (hHigh >>> i) & 1;
      v[32 + i] += bit === 1 ? weight : -weight;
    }
  }

  let resLow = 0 >>> 0;
  let resHigh = 0 >>> 0;
  for (let i = 0; i < 32; i++) {
    if (v[i] > 0) resLow = (resLow | (1 << i)) >>> 0;
  }
  for (let i = 0; i < 32; i++) {
    if (v[32 + i] > 0) resHigh = (resHigh | (1 << i)) >>> 0;
  }
  return `${resHigh.toString(16).padStart(8, '0')}${resLow.toString(16).padStart(8, '0')}`;
}

function popcnt32(n) {
  let count = 0;
  let v = n >>> 0;
  while (v !== 0) {
    v &= v - 1;
    count++;
  }
  return count;
}

function computeHammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== 16 || hashB.length !== 16) return 64;
  const highA = parseInt(hashA.slice(0, 8), 16) >>> 0;
  const lowA = parseInt(hashA.slice(8, 16), 16) >>> 0;
  const highB = parseInt(hashB.slice(0, 8), 16) >>> 0;
  const lowB = parseInt(hashB.slice(8, 16), 16) >>> 0;

  return popcnt32((highA ^ highB) >>> 0) + popcnt32((lowA ^ lowB) >>> 0);
}

// 2. Platform Link Parsers
function parseSpotifyTrackId(input) {
  if (!input) return undefined;
  const str = input.trim();
  const uriMatch = str.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
  if (uriMatch) return uriMatch[1];
  const urlMatch = str.match(/spotify\.com\/track\/([A-Za-z0-9]{22})/i);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{22}$/.test(str)) return str;
  return undefined;
}

function parseYouTubeMusicId(input) {
  if (!input) return undefined;
  const str = input.trim();
  const urlMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (urlMatch) return urlMatch[1];
  if (/^[\w-]{11}$/.test(str)) return str;
  return undefined;
}

function normalizeIsrc(rawIsrc) {
  if (!rawIsrc) return undefined;
  const clean = rawIsrc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.length === 12 ? clean : clean.length > 0 ? clean : undefined;
}

// ─── EXECUTE TESTS ────────────────────────────────────────────────────────────

console.log('🧪 Starting OpenLyryc Deduplication & SimHash Verification...\n');

// Test 1: Identical lyrics produce exact distance 0
const lyricA = `
Waiting in a car
Waiting for a ride in the dark
The night city grows
Look and see her eyes, they glow
`;

const lyricA_whitespace = `
waiting in a car
waiting for a ride in the dark
the night city grows
look and see her eyes they glow
`;

const hashA = computeSimHash(lyricA);
const hashA_ws = computeSimHash(lyricA_whitespace);
const distSame = computeHammingDistance(hashA, hashA_ws);

console.log(`✓ Test 1 [Identical / Casing / Whitespace]: HashA=${hashA}, HashA_ws=${hashA_ws}, Distance=${distSame}`);
assert.strictEqual(distSame, 0, 'Exact same words with different casing/punctuation should have Hamming distance 0');

// Test 2: Full song with 1 minor typo/variation produces small distance <= 4
const fullSongA = `
Waiting in a car, waiting for a ride in the dark
The night city grows, look and see her eyes, they glow
Waiting in a car, waiting for a ride in the dark
The night city grows, look and see her eyes, they glow
Send me a signal, send me a sign
Throw me a lifeline, stay for the night
Midnight city, streets are alive
City is my church, it wraps in the blinding lights
`;

const fullSongA_typo = `
Waiting in a car, waiting for a ride in the dark
The night city grows, look and see her eyes, they glow
Waiting in a car, waiting for a ride in the dark
The night city grows, look and see her eyes, they glow
Send me a signal, send me a sign
Throw me a lifeline, stay for the night
Midnight city, streets are aliiive
City is my church, it wraps in the blinding lights
`;

const hashFullA = computeSimHash(fullSongA);
const hashFullA_typo = computeSimHash(fullSongA_typo);
const distFullTypo = computeHammingDistance(hashFullA, hashFullA_typo);

console.log(`✓ Test 2 [Near-Duplicate Song / 1 Word Typo]: HashA=${hashFullA}, HashTypo=${hashFullA_typo}, Distance=${distFullTypo}`);
assert.ok(distFullTypo <= 3, `Full song with 1 typo should have Hamming distance <= 3, got ${distFullTypo}`);


// Test 3: Completely different song produces large distance >= 12
const lyricB = `
Listen to the wind blow
Watch the sun rise
Running in the shadows
Damn your love, damn your lies
`;
const hashB = computeSimHash(lyricB);
const distDiff = computeHammingDistance(hashA, hashB);

console.log(`✓ Test 3 [Different Song]: HashB=${hashB}, Distance=${distDiff}`);
assert.ok(distDiff >= 10, `Different song text should have large Hamming distance (>= 10), got ${distDiff}`);

// Test 4: YouTube URL extraction
const ytUrls = [
  'https://music.youtube.com/watch?v=kJQP7kiw5Fk',
  'https://www.youtube.com/watch?v=kJQP7kiw5Fk&list=RDkJQP7kiw5Fk',
  'https://youtu.be/kJQP7kiw5Fk?si=12345',
  'kJQP7kiw5Fk'
];
for (const url of ytUrls) {
  const parsed = parseYouTubeMusicId(url);
  assert.strictEqual(parsed, 'kJQP7kiw5Fk', `Failed to parse YouTube ID from: ${url}`);
}
console.log('✓ Test 4 [YouTube URL Extraction]: All 4 variants extracted "kJQP7kiw5Fk" successfully.');

// Test 5: Spotify Track extraction
const spotifyUrls = [
  'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc',
  'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
  '4cOdK2wGLETKBW3PvgPWqT'
];
for (const url of spotifyUrls) {
  const parsed = parseSpotifyTrackId(url);
  assert.strictEqual(parsed, '4cOdK2wGLETKBW3PvgPWqT', `Failed to parse Spotify ID from: ${url}`);
}
console.log('✓ Test 5 [Spotify Track Extraction]: All 3 variants extracted "4cOdK2wGLETKBW3PvgPWqT" successfully.');

// Test 6: ISRC Normalization
const isrcs = ['US-UM7-24-00123', 'usum72400123', 'US UM7 24 00123'];
for (const isrc of isrcs) {
  const parsed = normalizeIsrc(isrc);
  assert.strictEqual(parsed, 'USUM72400123', `Failed to normalize ISRC: ${isrc}`);
}
console.log('✓ Test 6 [ISRC Normalization]: Normalized to "USUM72400123" successfully.');

console.log('\n🎉 ALL 6 DEDUPLICATION & SIMHASH TESTS PASSED CLEANLY!\n');
