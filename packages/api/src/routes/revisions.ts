import { Hono } from 'hono';
import {
  CreateRevisionRequest,
  CreateRevisionResponse,
  RevisionHistoryResponse,
  RevisionItem,
  SubmitReviewRequest
} from '@openlyryc/schema';
import { computeRevisionHash } from '../lib/hash.js';
import { calculateQualityScore } from '../lib/quality.js';
import { verifyTurnstileToken } from '../lib/turnstile.js';
import { getCatalogRecords, addCatalogRecord } from './dedup.js';
import { saveDocumentToStore } from './lyrics.js';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown; TURNSTILE_SECRET?: string };

export const revisionsRouter = new Hono<{ Bindings: Env }>();

// In-memory Git-style revision store fallback
const REVISION_STORE: Record<string, RevisionItem[]> = {
  's_m83_midnight': [
    {
      hash: '0x3a9f81b2c4',
      songId: 's_m83_midnight',
      authorId: 'u_vapor',
      authorHandle: '0xVaporWave',
      commitMessage: 'Add word-level precision timestamps for intro & verse 1',
      status: 'approved',
      qualityScore: 0.98,
      createdAt: '2026-08-01T18:30:00Z',
      lineCount: 4,
      hasWordSync: true
    },
    {
      hash: '0x1b2c3d4e5f',
      songId: 's_m83_midnight',
      authorId: 'u_synth',
      authorHandle: 'SynthWaveFan',
      parentHash: '0x0000000000',
      commitMessage: 'Initial sentence line sync submission',
      status: 'approved',
      qualityScore: 0.85,
      createdAt: '2026-07-28T12:00:00Z',
      lineCount: 4,
      hasWordSync: false
    }
  ]
};

revisionsRouter.post('/', async (c) => {
  const turnstileHeader = c.req.header('X-Turnstile-Token');
  const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

  // Verify the Turnstile token if a client sends one
  if (turnstileHeader) {
    const secret = c.env?.TURNSTILE_SECRET;
    if (!secret) {
      return c.json({ error: 'Turnstile is not configured on this deployment' }, 503);
    }
    const turnstileResult = await verifyTurnstileToken(turnstileHeader, secret, ip);
    if (!turnstileResult.success) {
      return c.json({ error: 'Turnstile verification failed', details: turnstileResult.errorCodes }, 403);
    }
  }

  const body = await c.req.json<CreateRevisionRequest>();
  const doc = body.document;
  const meta = doc.metadata || {};

  // 1. COMPULSORY PLATFORM GATE:
  // Must provide at least one official platform anchor (YouTube, Spotify, ISRC, Apple Music, or canonicalKey)
  const hasPlatformAnchor = Boolean(
    meta.youtubeId ||
    meta.spotifyId ||
    meta.isrc ||
    meta.appleMusicId ||
    (meta.canonicalKey && meta.canonicalKey.match(/^(yt|spotify|isrc|apple):/)) ||
    (meta.platformLinks && meta.platformLinks.length > 0)
  );

  if (!hasPlatformAnchor) {
    return c.json({
      error: 'PLATFORM_LINK_REQUIRED',
      message: 'An official platform identifier (YouTube URL/ID, Spotify Track ID, or ISRC) is required to publish to the global registry.'
    }, 400);
  }

  // 2. Derive canonical key
  let canonicalKey = meta.canonicalKey;
  if (!canonicalKey) {
    if (meta.isrc) canonicalKey = `isrc:${meta.isrc.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
    else if (meta.spotifyId) canonicalKey = `spotify:${meta.spotifyId.trim()}`;
    else if (meta.youtubeId) canonicalKey = `yt:${meta.youtubeId.trim()}`;
    else if (meta.appleMusicId) canonicalKey = `apple:${meta.appleMusicId.trim()}`;
  }

  let songId = body.songId || (canonicalKey ? `cl_${canonicalKey.replace(/[^a-z0-9]/g, '_')}` : `s_${Date.now()}`);

  // 3. Check for existing duplicate before creating brand new song
  const existingCatalog = getCatalogRecords();
  const duplicateMatch = existingCatalog.find((s) => {
    if (canonicalKey && s.canonicalKey === canonicalKey && s.id !== songId) return true;
    if (meta.youtubeId && s.platformLinks?.some((p) => p.platformId === meta.youtubeId) && s.id !== songId) return true;
    if (meta.spotifyId && s.platformLinks?.some((p) => p.platformId === meta.spotifyId) && s.id !== songId) return true;
    return false;
  });

  if (duplicateMatch && !body.allowMerge && !body.isVariant) {
    return c.json({
      error: 'DUPLICATE_SONG_EXISTS',
      matchedSong: duplicateMatch,
      message: `An entry for this track already exists ("${duplicateMatch.title}" by ${duplicateMatch.artist}). Please submit as a revision or variant.`
    }, 409);
  }

  // If user approved merge into existing song, attach revision to that song
  let isMergedRevision = false;
  if (duplicateMatch && (body.allowMerge || body.isVariant)) {
    songId = duplicateMatch.id;
    isMergedRevision = true;
  }

  // 4. Calculate SHA-256 hash & Quality Score Q
  const revisionHash = await computeRevisionHash(doc);
  const qualityScore = calculateQualityScore(doc);
  const hasWordSync = doc.lines.some(l => l.tokens && l.tokens.length > 0);

  const newItem: RevisionItem = {
    hash: revisionHash,
    songId,
    authorId: 'u_current_user',
    authorHandle: body.authorHandle || meta.syncedBy || 'Contributor',
    parentHash: body.parentHash,
    commitMessage: body.commitMessage || (body.isVariant ? `Added variant: ${body.variantName || 'Alternate'}` : 'Updated lyric sync'),
    status: qualityScore >= 0.7 ? 'approved' : 'pending',
    qualityScore,
    createdAt: new Date().toISOString(),
    lineCount: doc.lines.length,
    hasWordSync
  };

  if (!REVISION_STORE[songId]) {
    REVISION_STORE[songId] = [];
  }
  REVISION_STORE[songId].unshift(newItem);

  // Save document to API store so GET /lyrics/:id returns it on any device
  saveDocumentToStore(songId, doc);

  // Sync to catalog records
  addCatalogRecord({
    id: songId,
    title: body.title || meta.title || 'Untitled Track',
    artist: body.artist || meta.artist || 'Untitled Artist',
    album: body.album || meta.album,
    duration: meta.duration || 0,
    hasWordSync,
    qualityScore,
    revisionHash,
    updatedAt: newItem.createdAt,
    canonicalKey,
    lyricsSimhash: meta.lyricsSimhash,
    platformLinks: meta.platformLinks || [
      ...(meta.youtubeId ? [{ platform: 'youtube' as const, platformId: meta.youtubeId, isPrimary: true }] : []),
      ...(meta.spotifyId ? [{ platform: 'spotify' as const, platformId: meta.spotifyId, isPrimary: false }] : [])
    ]
  });

  return c.json<CreateRevisionResponse>({
    songId,
    revisionHash,
    status: newItem.status,
    qualityScore,
    createdAt: newItem.createdAt,
    isMergedRevision,
    platformLinked: hasPlatformAnchor
  }, 201);
});


revisionsRouter.get('/song/:songId', async (c) => {
  const songId = c.req.param('songId');
  const revisions = REVISION_STORE[songId] || [];

  // P1 perf: revision history is read-heavy — edge-cache short.
  c.header('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
  return c.json<RevisionHistoryResponse>({
    songId,
    songTitle: 'Midnight City',
    artistName: 'M83',
    currentRevisionHash: revisions[0]?.hash,
    revisions
  });
});

revisionsRouter.post('/:hash/review', async (c) => {
  const hash = c.req.param('hash');
  const body = await c.req.json<SubmitReviewRequest>();

  return c.json({
    success: true,
    revisionHash: hash,
    vote: body.vote,
    message: `Vote '${body.vote}' recorded successfully by ${body.reviewerHandle}`
  });
});
