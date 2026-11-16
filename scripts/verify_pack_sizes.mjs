import Database from 'better-sqlite3';
import zlib from 'zlib';

const db = new Database('D:/OpenLyryc DB/Data dump/db.sqlite3', { readonly: true });

console.log('=== REAL-WORLD PACK MEASUREMENTS (1,000 SONGS) ===\n');

const query = db.prepare(`
  SELECT 
    t.id, t.name, t.artist_name, t.album_name, t.duration,
    l.synced_lyrics
  FROM tracks t
  JOIN lyrics l ON l.id = t.last_lyrics_id
  WHERE l.has_synced_lyrics = 1
    AND (l.instrumental = 0 OR l.instrumental IS NULL)
    AND LENGTH(l.synced_lyrics) > 50
  LIMIT 1000
`);

const rows = query.all();
console.log(`Extracted ${rows.length} real synced track records.`);

// 1. Standard JSON with full keys { id, title, artist, album, duration, lrc }
const fullRecords = rows.map(r => ({
  id: r.id,
  title: r.name,
  artist: r.artist_name,
  album: r.album_name || '',
  duration: Math.round(r.duration || 0),
  lrc: r.synced_lyrics,
}));
const fullJson = JSON.stringify(fullRecords);
const fullGzip = zlib.gzipSync(Buffer.from(fullJson, 'utf8'), { level: 9 });
const fullBrotli = zlib.brotliCompressSync(Buffer.from(fullJson, 'utf8'));

console.log('\n--- 1. Full JSON Object Format ---');
console.log(`  Raw uncompressed: ${(fullJson.length / 1024).toFixed(1)} KB (avg: ${(fullJson.length / rows.length).toFixed(0)} bytes/song)`);
console.log(`  Gzip (level 9):   ${(fullGzip.length / 1024).toFixed(1)} KB (avg: ${(fullGzip.length / rows.length).toFixed(0)} bytes/song)`);
console.log(`  Brotli:           ${(fullBrotli.length / 1024).toFixed(1)} KB (avg: ${(fullBrotli.length / rows.length).toFixed(0)} bytes/song)`);

// 2. Compact Array Format [id, title, artist, album, duration, lrc]
const compactRecords = rows.map(r => [
  r.id,
  r.name,
  r.artist_name,
  r.album_name || '',
  Math.round(r.duration || 0),
  r.synced_lyrics,
]);
const compactJson = JSON.stringify(compactRecords);
const compactGzip = zlib.gzipSync(Buffer.from(compactJson, 'utf8'), { level: 9 });
const compactBrotli = zlib.brotliCompressSync(Buffer.from(compactJson, 'utf8'));

console.log('\n--- 2. Compact Array Format [id, title, artist, album, duration, lrc] ---');
console.log(`  Raw uncompressed: ${(compactJson.length / 1024).toFixed(1)} KB (avg: ${(compactJson.length / rows.length).toFixed(0)} bytes/song)`);
console.log(`  Gzip (level 9):   ${(compactGzip.length / 1024).toFixed(1)} KB (avg: ${(compactGzip.length / rows.length).toFixed(0)} bytes/song)`);
console.log(`  Brotli:           ${(compactBrotli.length / 1024).toFixed(1)} KB (avg: ${(compactBrotli.length / rows.length).toFixed(0)} bytes/song)`);

// 3. Ultra-Safe Conservative Projections
console.log('\n=== CONSERVATIVE PACK CAPACITY CALCULATIONS ===');
const SAFE_FILE_LIMIT_BYTES = 24 * 1024 * 1024; // 24 MiB (safety margin below 25 MiB CF limit)

// Let's use the CONSERVATIVE Gzip number from Compact Format (~820 bytes/song)
const bytesPerSongSafe = compactGzip.length / rows.length;
console.log(`Safe benchmark per song (compact Gzip): ${bytesPerSongSafe.toFixed(1)} bytes`);

const maxSongsPer24MB = Math.floor(SAFE_FILE_LIMIT_BYTES / bytesPerSongSafe);
console.log(`Max songs in a single 24 MiB pack: ${maxSongsPer24MB.toLocaleString()} songs`);

// Calculate for various catalog sizes
const catalogTiers = [
  1000,
  10000,
  50000,
  100000,
  500000,
  1000000,
  5000000,
  10000000,
  16867000, // full deduped catalog
];

console.log('\n| Catalog Tier | Songs | Total Size (Gzip) | 24MB Packs Needed | CF 20,000 File Limit % |');
console.log('|---|---|---|---|---|');
for (const songs of catalogTiers) {
  const totalMB = (songs * bytesPerSongSafe) / (1024 * 1024);
  const totalGB = totalMB / 1024;
  const packs = Math.ceil(songs / maxSongsPer24MB);
  const cfPct = ((packs / 20000) * 100).toFixed(2);
  const sizeStr = totalGB >= 1 ? `${totalGB.toFixed(2)} GB` : `${totalMB.toFixed(1)} MB`;
  console.log(`| ${songs.toLocaleString()} | ${songs.toLocaleString()} | ${sizeStr} | ${packs} | ${cfPct}% |`);
}

db.close();
