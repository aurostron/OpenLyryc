import { Hono } from 'hono';
import type {
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  SongSearchResult,
} from '@openlyryc/schema';
import * as schema from '@openlyryc/schema';
const computeHammingDistance = (schema as any).computeHammingDistance;

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const dedupRouter = new Hono<{ Bindings: Env }>();

// Seed database records for lookup and demo fallback
const CATALOG_RECORDS: SongSearchResult[] = [
  {
    id: 's_m83_midnight',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    duration: 243,
    hasWordSync: true,
    qualityScore: 0.98,
    revisionHash: '0x3a9f81b2c4',
    updatedAt: '2026-08-01T18:30:00Z',
    canonicalKey: 'yt:kJQP7kiw5Fk',
    lyricsSimhash: 'a9b2c3d4e5f60718',
    platformLinks: [
      { platform: 'youtube', platformId: 'kJQP7kiw5Fk', isPrimary: true },
      { platform: 'spotify', platformId: '1eyzqe2QqGZUmfcPZtrIyt', isPrimary: false }
    ]
  },
  {
    id: 's_fleetwood_chain',
    title: 'The Chain',
    artist: 'Fleetwood Mac',
    album: 'Rumours',
    duration: 270,
    hasWordSync: true,
    qualityScore: 0.96,
    revisionHash: '0x7b2c01d9f8',
    updatedAt: '2026-07-20T10:00:00Z',
    canonicalKey: 'spotify:5e9TFTobahGZxaOytAcj8S',
    lyricsSimhash: '8f7e6d5c4b3a2910',
    platformLinks: [
      { platform: 'spotify', platformId: '5e9TFTobahGZxaOytAcj8S', isPrimary: true },
      { platform: 'youtube', platformId: 'JDG2m5hN1vo', isPrimary: false }
    ]
  },
  {
    id: 's_weeknd_blinding',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    hasWordSync: true,
    qualityScore: 0.99,
    revisionHash: '0xe88a104c92',
    updatedAt: '2026-08-10T14:00:00Z',
    canonicalKey: 'spotify:0VjIjW4GlUZAMYd2vXMi3b',
    lyricsSimhash: 'e4f3a2b1c0d98765',
    platformLinks: [
      { platform: 'spotify', platformId: '0VjIjW4GlUZAMYd2vXMi3b', isPrimary: true },
      { platform: 'youtube', platformId: '4NRXx6U8ABQ', isPrimary: false }
    ]
  }
];

export function addCatalogRecord(record: SongSearchResult) {
  const existingIdx = CATALOG_RECORDS.findIndex(
    r => r.id === record.id || (record.canonicalKey && r.canonicalKey === record.canonicalKey)
  );
  if (existingIdx >= 0) {
    CATALOG_RECORDS[existingIdx] = record;
  } else {
    CATALOG_RECORDS.unshift(record);
  }
}

export function getCatalogRecords(): SongSearchResult[] {
  return CATALOG_RECORDS;
}

dedupRouter.post('/check', async (c) => {
  const body = await c.req.json<DuplicateCheckRequest>();
  const { platform, platformId, canonicalKey, lyricsSimhash, artist, title } = body;

  const catalog = CATALOG_RECORDS;

  // 1. Exact platform ID lookup (via platformLinks or canonicalKey)
  if (platformId) {
    const platformMatch = catalog.find((s) => {
      if (s.canonicalKey && (s.canonicalKey === `spotify:${platformId}` || s.canonicalKey === `yt:${platformId}` || s.canonicalKey === `isrc:${platformId}`)) {
        return true;
      }
      return s.platformLinks?.some(
        (link) => link.platformId.toLowerCase() === platformId.toLowerCase()
      );
    });

    if (platformMatch) {
      return c.json<DuplicateCheckResponse>({
        isDuplicate: true,
        matchType: 'exact_platform',
        matchedSong: platformMatch,
        message: `An official entry already exists for this ${platform || 'platform'} track: "${platformMatch.title}" by ${platformMatch.artist}.`
      });
    }
  }

  // 2. Canonical key direct match
  if (canonicalKey) {
    const keyMatch = catalog.find((s) => s.canonicalKey === canonicalKey);
    if (keyMatch) {
      return c.json<DuplicateCheckResponse>({
        isDuplicate: true,
        matchType: 'exact_platform',
        matchedSong: keyMatch,
        message: `An official entry already exists with canonical key ${canonicalKey}.`
      });
    }
  }

  // 3. 64-bit SimHash near-duplicate scan
  if (lyricsSimhash && lyricsSimhash.length === 16) {
    let closestSong: SongSearchResult | undefined = undefined;
    let minDistance = 64;

    for (const song of catalog) {
      if (song.lyricsSimhash && song.lyricsSimhash.length === 16) {
        const dist = computeHammingDistance(lyricsSimhash, song.lyricsSimhash);
        if (dist < minDistance) {
          minDistance = dist;
          closestSong = song;
        }
      }
    }

    if (closestSong && minDistance <= 3) {
      return c.json<DuplicateCheckResponse>({
        isDuplicate: true,
        matchType: minDistance === 0 ? 'exact_lyrics' : 'fuzzy_lyrics',
        matchedSong: closestSong,
        hammingDistance: minDistance,
        message:
          minDistance === 0
            ? `Identical lyric text already exists under "${closestSong.title}" by ${closestSong.artist}.`
            : `Near-identical lyric text (${100 - minDistance * 3}% match) found under "${closestSong.title}" by ${closestSong.artist}.`
      });
    }
  }

  // 4. Normalized Artist + Title slug match
  if (artist && title) {
    const normA = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normT = title.toLowerCase().replace(/[^a-z0-9]/g, '');

    const slugMatch = catalog.find((s) => {
      const sNormA = s.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sNormT = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normA.length > 2 && normT.length > 2 && sNormA === normA && sNormT === normT;
    });

    if (slugMatch) {
      return c.json<DuplicateCheckResponse>({
        isDuplicate: true,
        matchType: 'slug_match',
        matchedSong: slugMatch,
        message: `A track titled "${slugMatch.title}" by ${slugMatch.artist} is already registered.`
      });
    }
  }

  return c.json<DuplicateCheckResponse>({
    isDuplicate: false,
    matchType: 'none',
    message: 'No duplicate records found.'
  });
});
