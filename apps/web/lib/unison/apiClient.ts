'use client';

import { UNISON_API_BASE, loadUnisonSession } from './authService';
import { generateRandomNonce, signPayload } from './crypto';
import type {
  UnisonApiEnvelope,
  UnisonMostWantedSong,
  UnisonSubmitPayload,
  UnisonSubmitResponse,
  UnisonSubmissionsResponse,
  UnisonUserGamification,
  UnisonUserStats,
  UnisonCurator,
  UnisonBadgeCatalogResponse,
  UnisonUserBadgesResponse,
  UnisonFeedEntry,
} from './types';

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${UNISON_API_BASE}${endpoint}`;
  const session = loadUnisonSession();

  const headers = new Headers(options.headers || {});
  if (session?.sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.sessionToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errMsg = errJson.error;
      else if (errJson?.message) errMsg = errJson.message;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const envelope = (await res.json()) as UnisonApiEnvelope<T>;
  if (!envelope.success) {
    throw new Error(envelope.error || 'Request failed');
  }
  return envelope.data;
}

/**
 * Fetches contribution and fulfillment statistics for a given user keyId.
 */
export async function fetchUnisonUserStats(keyId: string): Promise<UnisonUserStats> {
  return fetchJson<UnisonUserStats>(`/users/${encodeURIComponent(keyId)}/stats`);
}

/**
 * Fetches unlocked badges and gamification data for a given user keyId.
 */
export async function fetchUnisonUserBadges(keyId: string): Promise<UnisonUserGamification> {
  return fetchJson<UnisonUserGamification>(`/users/${encodeURIComponent(keyId)}/badges`);
}

/**
 * Fetches submitted lyrics history for a user.
 */
export async function fetchUnisonUserSubmissions(
  keyId: string,
  params: {
    limit?: number;
    cursor?: string;
    q?: string;
    syncType?: 'richsync' | 'linesync' | 'plain';
    sort?: 'newest' | 'oldest' | 'most_votes' | 'least_votes';
  } = {}
): Promise<UnisonSubmissionsResponse> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.q) qs.set('q', params.q);
  if (params.syncType) qs.set('syncType', params.syncType);
  if (params.sort) qs.set('sort', params.sort);

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson<UnisonSubmissionsResponse>(
    `/users/${encodeURIComponent(keyId)}/submissions${queryStr}`
  );
}

/**
 * Fetches user rank on the curator leaderboard.
 */
export async function fetchUnisonUserRank(keyId: string): Promise<{
  rank: number;
  score: number;
  tier?: string;
}> {
  return fetchJson<{ rank: number; score: number; tier?: string }>(
    `/leaderboard/users/${encodeURIComponent(keyId)}`
  );
}

/**
 * Fetches the "Most Wanted" songs list from Unison (songs requested by users needing lyrics).
 */
export async function fetchUnisonMostWanted(
  cursor: string = '',
  limit: number = 20
): Promise<{ items: UnisonMostWantedSong[]; nextCursor: string | null }> {
  const url = `${UNISON_API_BASE}/leaderboard/songs?cursor=${encodeURIComponent(cursor)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching Most Wanted`);

  const body = (await res.json()) as UnisonApiEnvelope<UnisonMostWantedSong[]> & {
    nextCursor?: string | null;
  };

  if (!body.success) throw new Error(body.error || 'Failed to fetch songs');
  return {
    items: body.data || [],
    nextCursor: body.nextCursor ?? null,
  };
}

/**
 * Fetches tracks sealed / approved by the Better Lyrics Council.
 */
export async function fetchUnisonSealed(limit: number = 12): Promise<{ items: UnisonFeedEntry[]; nextCursor: string | null }> {
  const url = `${UNISON_API_BASE}/feed?sealed=1&sort=recently-sealed&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sealed songs`);

  const body = (await res.json()) as UnisonApiEnvelope<UnisonFeedEntry[]> & {
    nextCursor?: string | null;
  };

  if (!body.success) throw new Error(body.error || 'Failed to fetch sealed songs');
  return {
    items: body.data || [],
    nextCursor: body.nextCursor ?? null,
  };
}

/**
 * Fetches feed grid songs ('top-rated' or 'newest').
 */
export async function fetchUnisonFeedGrid(
  sort: 'top-rated' | 'newest',
  limit: number = 8
): Promise<{ items: UnisonFeedEntry[]; nextCursor: string | null }> {
  const url = `${UNISON_API_BASE}/feed?sort=${sort}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching feed grid`);

  const body = (await res.json()) as UnisonApiEnvelope<UnisonFeedEntry[]> & {
    nextCursor?: string | null;
  };

  if (!body.success) throw new Error(body.error || 'Failed to fetch feed grid');
  return {
    items: body.data || [],
    nextCursor: body.nextCursor ?? null,
  };
}

/**
 * Searches the Unison corpus for matching songs/lyrics.
 */
export async function searchUnisonLyrics(params: {
  q?: string;
  song?: string;
  artist?: string;
}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.song) qs.set('song', params.song);
  if (params.artist) qs.set('artist', params.artist);

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson<any[]>(`/lyrics/search${queryStr}`);
}

/**
 * Fetches lyrics for a specific YouTube video ID.
 */
export async function fetchUnisonLyricsByVideo(videoId: string): Promise<any> {
  return fetchJson<any>(`/lyrics?v=${encodeURIComponent(videoId)}`);
}

/**
 * Fetches a specific lyrics variant by ID.
 */
export async function fetchUnisonLyricsVariant(id: number): Promise<any> {
  return fetchJson<any>(`/lyrics/${id}`);
}

/**
 * Fetches high-resolution artwork for a video.
 */
export async function fetchUnisonArtwork(videoId: string, size?: number): Promise<string | null> {
  const sized = size !== undefined ? `&size=${size}` : '';
  try {
    const data = await fetchJson<{ artworkUrl: string | null }>(
      `/artwork?v=${encodeURIComponent(videoId)}${sized}`
    );
    return data.artworkUrl;
  } catch {
    return null;
  }
}

/**
 * Submits lyrics to Unison with ECDSA P-256 signature.
 */
export async function submitLyricsToUnison(
  payloadData: UnisonSubmitPayload,
  privateKey: JsonWebKey,
  keyId: string,
  publicKey?: JsonWebKey
): Promise<UnisonSubmitResponse> {
  const nonce = generateRandomNonce(24);
  const timestamp = Date.now();

  const payload: Record<string, unknown> = {
    keyId,
    timestamp,
    nonce,
    videoId: payloadData.videoId,
    song: payloadData.song,
    artist: payloadData.artist,
    duration: Math.round(payloadData.duration),
    lyrics: payloadData.lyrics,
    format: payloadData.format,
    syncType: payloadData.syncType,
  };

  if (payloadData.album) payload.album = payloadData.album;
  if (payloadData.isrc) payload.isrc = payloadData.isrc;
  if (payloadData.language) payload.language = payloadData.language;

  const signature = await signPayload(payload, privateKey);

  const reqBody: {
    payload: Record<string, unknown>;
    signature: string;
    publicKey?: JsonWebKey;
  } = {
    payload,
    signature,
  };
  if (publicKey) {
    reqBody.publicKey = publicKey;
  }

  const res = await fetch(`${UNISON_API_BASE}/lyrics/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    let errCode = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.hint) errCode = `${err.error || 'Submission rejected'}: ${err.hint}`;
      else if (err?.error) errCode = err.error;
    } catch {}
    throw new Error(errCode);
  }

  const result = (await res.json()) as UnisonApiEnvelope<{ id: number }>;
  return {
    id: result.data.id,
    status: 'published',
    message: 'Lyrics submitted successfully to Unison!',
  };
}

/**
 * Soft deletes / hides a user's submitted lyrics from Unison.
 * Requires ownership (acting user matches submitter).
 */
export async function deleteUnisonSubmission(
  lyricsId: number
): Promise<{ success: boolean }> {
  const session = loadUnisonSession();
  if (!session?.sessionToken && !session?.privateKeyJwk) {
    throw new Error('Sign-in required to delete submissions.');
  }

  const url = `${UNISON_API_BASE}/lyrics/${encodeURIComponent(lyricsId)}`;

  const options: RequestInit = {
    method: 'DELETE',
  };

  if (session.sessionToken) {
    // Bearer token: NO body, NO Content-Type header (sending Content-Type with no body causes 400)
    options.headers = new Headers({
      'Authorization': `Bearer ${session.sessionToken}`,
    });
  } else if (session.privateKeyJwk && session.publicKeyJwk) {
    // Signed payload fallback when no session token
    const nonce = generateRandomNonce();
    const payload = {
      timestamp: Date.now(),
      nonce,
      keyId: session.keyId,
      lyricsId,
    };
    const signature = await signPayload(payload, session.privateKeyJwk);
    const body = JSON.stringify({
      payload,
      signature,
      publicKey: session.publicKeyJwk,
    });
    options.headers = new Headers({ 'Content-Type': 'application/json' });
    options.body = body;
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `Failed to delete submission (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error === 'not_owner') {
        errMsg = 'You can only delete your own submissions.';
      } else if (errJson?.error === 'not_found') {
        errMsg = 'Submission not found or already deleted.';
      } else if (errJson?.message) {
        errMsg = errJson.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return (await res.json()) as { success: boolean };
}

/**
 * Fetches the full curators leaderboard from Unison.
 */
export async function fetchUnisonCuratorsLeaderboard(): Promise<UnisonCurator[]> {
  try {
    const data = await fetchJson<{ curators: UnisonCurator[] }>('/leaderboard/users');
    return data.curators || [];
  } catch (err) {
    console.warn('[UnisonApiClient] Failed to fetch curators:', err);
    return [];
  }
}

/**
 * Fetches specific curator details by keyId.
 */
export async function fetchUnisonCuratorByKeyId(keyId: string): Promise<UnisonCurator | null> {
  try {
    const data = await fetchJson<UnisonCurator>(`/leaderboard/users/${encodeURIComponent(keyId)}`);
    return data;
  } catch (err) {
    console.warn(`[UnisonApiClient] Failed to fetch curator ${keyId}:`, err);
    return null;
  }
}

/**
 * Fetches the complete badges catalogue.
 */
export async function fetchUnisonBadgeCatalog(): Promise<UnisonBadgeCatalogResponse | null> {
  try {
    const data = await fetchJson<UnisonBadgeCatalogResponse>('/badges');
    return data;
  } catch (err) {
    console.warn('[UnisonApiClient] Failed to fetch badge catalogue:', err);
    return null;
  }
}

/**
 * Fetches user badges progress and XP details.
 */
export async function fetchUnisonUserBadgesDetail(keyId: string): Promise<UnisonUserBadgesResponse | null> {
  try {
    const data = await fetchJson<UnisonUserBadgesResponse>(`/users/${encodeURIComponent(keyId)}/badges`);
    return data;
  } catch (err) {
    console.warn(`[UnisonApiClient] Failed to fetch badges for ${keyId}:`, err);
    return null;
  }
}

/**
 * Resolves a curator's keyId from their username/handle (e.g. "aurostron").
 */
export async function fetchUnisonKeyIdByHandle(handle: string): Promise<string | null> {
  try {
    const data = await fetchJson<{ keyId: string }>(`/users/by-handle/${encodeURIComponent(handle)}`);
    return data.keyId || null;
  } catch (err) {
    console.warn(`[UnisonApiClient] Failed to resolve handle @${handle}:`, err);
    return null;
  }
}

/**
 * Resolves the full URL for a badge image, handling relative paths from the Unison API.
 */
export function getUnisonBadgeImageUrl(badgeKey: string, relativePath?: string): string {
  if (relativePath) {
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    return `${UNISON_API_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
  }
  return `${UNISON_API_BASE}/badges/${encodeURIComponent(badgeKey)}/image.svg?variant=color&v=2`;
}
