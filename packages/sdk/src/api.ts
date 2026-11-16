import type { OpenLyricsDocument } from '@openlyryc/schema';

export interface FetchLyricsOptions {
  title: string;
  artist: string;
  duration?: number;
  isrc?: string;
  format?: 'json' | 'compact' | 'lrc';
  apiBaseUrl?: string;
  signal?: AbortSignal;
}

export const DEFAULT_API_BASE_URL = 'https://openlyryc-core.aurostronyee1.workers.dev';

/**
 * Fetch synchronized lyrics document from OpenLyryc Edge API (with automatic LRCLIB/multi-source fallback).
 */
export async function fetchLyrics(options: FetchLyricsOptions): Promise<OpenLyricsDocument | null> {
  const {
    title,
    artist,
    duration,
    isrc,
    format = 'json',
    apiBaseUrl = DEFAULT_API_BASE_URL,
    signal,
  } = options;

  const url = new URL(`${apiBaseUrl}/api/v1/lyrics`);
  url.searchParams.set('title', title);
  url.searchParams.set('artist', artist);
  if (duration && duration > 0) url.searchParams.set('duration', String(Math.round(duration)));
  if (isrc) url.searchParams.set('isrc', isrc);
  if (format && format !== 'json') url.searchParams.set('format', format);

  try {
    const res = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as OpenLyricsDocument;
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err;
    console.error('OpenLyryc SDK: Failed to fetch lyrics', err);
    return null;
  }
}

/**
 * Construct embed URL for OpenLyryc Cinema & Kinetic Preview stage
 */
export function buildEmbedUrl(options: {
  baseUrl?: string;
  query?: string;
  title?: string;
  artist?: string;
  trackId?: string;
  transitionMode?: 'pivot' | 'cube' | 'whip';
  backgroundVideo?: boolean;
  font?: string;
  weight?: string;
}): string {
  const {
    baseUrl = 'https://openlyryc.pages.dev/preview',
    query,
    title,
    artist,
    trackId,
    transitionMode,
    backgroundVideo = false,
    font = 'poppins',
    weight = '500',
  } = options;

  const url = new URL(baseUrl);
  url.searchParams.set('embed', 'true');
  url.searchParams.set('pure', 'true');

  if (query) {
    url.searchParams.set('q', query);
  } else if (title && artist) {
    url.searchParams.set('q', `${artist} - ${title}`);
  } else if (title) {
    url.searchParams.set('q', title);
  }

  if (trackId) url.searchParams.set('id', trackId);
  if (transitionMode) url.searchParams.set('mode', transitionMode);
  if (backgroundVideo) url.searchParams.set('bg', 'true');
  if (font && font !== 'poppins') url.searchParams.set('font', font);
  if (weight && weight !== '500') url.searchParams.set('weight', weight);

  return url.toString();
}
