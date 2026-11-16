import { Hono } from 'hono';
import { SearchResponse, SongSearchResult } from '@openlyryc/schema';
import { searchYouTubeInnerTube } from './youtube.js';
import { sanitizeSongQuery } from '../lib/lyricsResolver.js';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const searchRouter = new Hono<{ Bindings: Env }>();

const SEED_CATALOG: SongSearchResult[] = [
  {
    id: 's_m83_midnight',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    duration: 243,
    hasWordSync: true,
    hasLineSync: true,
    qualityScore: 0.98,
    revisionHash: '0x3a9f81b2c4',
    source: 'openlyryc',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's_fleetwood_chain',
    title: 'The Chain',
    artist: 'Fleetwood Mac',
    album: 'Rumours',
    duration: 270,
    hasWordSync: true,
    hasLineSync: true,
    qualityScore: 0.96,
    revisionHash: '0x7b2c01d9f8',
    source: 'openlyryc',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's_daft_around',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    duration: 429,
    hasWordSync: false,
    hasLineSync: true,
    qualityScore: 0.91,
    revisionHash: '0xf1a89c2e4b',
    source: 'openlyryc',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's_weeknd_blinding',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    hasWordSync: true,
    hasLineSync: true,
    qualityScore: 0.99,
    revisionHash: '0xe88a104c92',
    source: 'openlyryc',
    updatedAt: new Date().toISOString(),
  },
];

async function searchLrcRed(q: string): Promise<SongSearchResult[]> {
  try {
    const url = `https://lrc.red/match.json?title=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)' },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const hits: any[] = data?.hits || [];

    return hits.map((hit) => ({
      id: `lrcred_${hit.isrc || hit.id || Math.random().toString(36).slice(2)}`,
      title: hit.title,
      artist: hit.artist,
      album: hit.album,
      duration: Math.round(hit.duration || 0),
      hasWordSync: true,
      hasLineSync: true,
      source: 'lrcred' as const,
      qualityScore: 0.98,
      coverArt: hit.cover,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

async function searchLrclib(q: string): Promise<SongSearchResult[]> {
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
        'Lrclib-Client': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
      },
    });
    if (!res.ok) return [];
    const list: any[] = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((item) => ({
      id: `lrc_${item.id}`,
      title: item.trackName,
      artist: item.artistName,
      album: item.albumName,
      duration: Math.round(item.duration || 0),
      hasWordSync: Boolean(item.syncedLyrics && item.syncedLyrics.includes('<')),
      hasLineSync: Boolean(item.syncedLyrics),
      source: 'lrclib' as const,
      qualityScore: item.syncedLyrics ? (item.syncedLyrics.includes('<') ? 0.95 : 0.85) : 0.5,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

searchRouter.get('/', async (c) => {
  const rawQ = c.req.query('q') || '';
  const q = rawQ.toLowerCase().trim();
  const source = (c.req.query('source') || c.req.query('type') || '').toLowerCase().trim();
  const rawLimit = parseInt(c.req.query('limit') || '20', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;

  c.header('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');

  // Direct YouTube proxy search mode
  if (source === 'youtube' && q) {
    try {
      const ytData = await searchYouTubeInnerTube(rawQ);
      const ytResults: SongSearchResult[] = ytData.candidates.map((cand) => ({
        id: `yt_${cand.videoId}`,
        title: cand.title,
        artist: cand.channelTitle,
        duration: cand.durationSeconds,
        hasWordSync: false,
        hasLineSync: false,
        qualityScore: Math.round(Math.max(0.2, Math.min(1.0, (cand.score + 200) / 400)) * 100) / 100,
        revisionHash: `0x${cand.videoId.slice(0, 8)}`,
        source: 'youtube' as any,
        updatedAt: new Date().toISOString(),
      }));

      return c.json({
        query: rawQ,
        total: ytResults.length,
        results: ytResults.slice(0, limit),
        source: 'youtube',
        bestMatch: ytData.bestMatch,
      });
    } catch (err: any) {
      return c.json({ error: 'YouTube search failed: ' + (err?.message || err) }, 502);
    }
  }

  if (!q) {
    return c.json<SearchResponse>({
      query: '',
      total: SEED_CATALOG.length,
      results: SEED_CATALOG.slice(0, limit),
    });
  }

  // 1. Check local seed catalog
  const localMatches = SEED_CATALOG.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.artist.toLowerCase().includes(q) ||
      (item.album && item.album.toLowerCase().includes(q))
  );

  // 2. Piggyback online providers in parallel (lrc.red Apple Music TTML + LRCLIB)
  const [lrcRedHits, lrclibHits] = await Promise.all([
    searchLrcRed(rawQ),
    searchLrclib(rawQ),
  ]);

  // 3. Deduplicate across sources by normalized artist + title
  const seenKeys = new Set<string>();
  const combined: SongSearchResult[] = [];

  const addUnique = (song: SongSearchResult) => {
    const key = `${(song.artist || '').toLowerCase().trim()}::${(song.title || '').toLowerCase().trim()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      combined.push(song);
    }
  };

  // Seed / local curated catalog first
  for (const song of localMatches) addUnique(song);

  // lrc.red (high quality Apple Music syllable sync) second
  for (const song of lrcRedHits) addUnique(song);

  // lrclib community synced lyrics third
  for (const song of lrclibHits) addUnique(song);

  // Sort by sync fidelity: Word-sync first, then line-sync
  combined.sort((a, b) => {
    const aWord = a.hasWordSync ? 2 : a.hasLineSync ? 1 : 0;
    const bWord = b.hasWordSync ? 2 : b.hasLineSync ? 1 : 0;
    return bWord - aWord;
  });

  return c.json<SearchResponse>({
    query: rawQ,
    total: combined.length,
    results: combined.slice(0, limit),
  });
});
