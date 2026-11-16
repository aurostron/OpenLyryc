/**
 * OpenLyryc Official Song Platform Linker & Canonical Key Resolver
 * Standardizes external music platform IDs (ISRC, Spotify, YouTube Music)
 * to guarantee single-master deduplication.
 */

export interface ParsedPlatformLinks {
  isrc?: string;
  spotifyId?: string;
  youtubeId?: string;
  appleMusicId?: string;
  canonicalKey: string;
}

/**
 * Normalizes an ISRC code by removing dashes and spaces.
 * e.g. "US-UM7-24-00123" -> "USUM72400123"
 */
export function normalizeIsrc(rawIsrc?: string): string | undefined {
  if (!rawIsrc) return undefined;
  const clean = rawIsrc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.length === 12 ? clean : clean.length > 0 ? clean : undefined;
}

/**
 * Extracts a Spotify Track ID from a URL, URI, or raw ID.
 * Supports:
 * - https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
 * - spotify:track:4cOdK2wGLETKBW3PvgPWqT
 * - 4cOdK2wGLETKBW3PvgPWqT
 */
export function parseSpotifyTrackId(input?: string): string | undefined {
  if (!input) return undefined;
  const str = input.trim();

  // Match URI
  const uriMatch = str.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
  if (uriMatch) return uriMatch[1];

  // Match Web URL
  const urlMatch = str.match(/spotify\.com\/track\/([A-Za-z0-9]{22})/i);
  if (urlMatch) return urlMatch[1];

  // Match raw 22-char Base62 ID
  if (/^[A-Za-z0-9]{22}$/.test(str)) {
    return str;
  }

  return str.length > 0 ? str : undefined;
}

/**
 * Extracts a YouTube / YouTube Music Video/Track ID.
 * Supports:
 * - https://music.youtube.com/watch?v=kJQP7kiw5Fk
 * - https://www.youtube.com/watch?v=kJQP7kiw5Fk
 * - https://youtu.be/kJQP7kiw5Fk
 * - kJQP7kiw5Fk
 */
export function parseYouTubeMusicId(input?: string): string | undefined {
  if (!input) return undefined;
  const str = input.trim();

  const urlMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=)([\w-]{11})/i);
  if (urlMatch) return urlMatch[1];

  if (/^[\w-]{11}$/.test(str)) {
    return str;
  }

  return undefined;
}

/**
 * Parses Apple Music URL to track ID.
 * e.g. https://music.apple.com/us/album/song-name/123456789?i=987654321
 */
export function parseAppleMusicTrackId(input?: string): string | undefined {
  if (!input) return undefined;
  const str = input.trim();
  const match = str.match(/i=(\d+)/i) || str.match(/\/album\/[^\/]+\/\d+\?i=(\d+)/i);
  if (match) return match[1];
  if (/^\d{6,15}$/.test(str)) return str;
  return undefined;
}

/**
 * Extracts a normalized SoundCloud track URL.
 * Supports:
 * - https://soundcloud.com/artist-name/track-name
 * - https://m.soundcloud.com/artist-name/track-name
 * - https://on.soundcloud.com/abcde
 */
export function parseSoundCloudTrackUrl(input?: string): string | undefined {
  if (!input) return undefined;
  const str = input.trim();
  const match = str.match(/(?:https?:\/\/)?(?:www\.|m\.)?(soundcloud\.com\/[\w-]+\/[\w-]+|on\.soundcloud\.com\/[\w-]+)/i);
  if (match) {
    return `https://${match[1]}`;
  }
  return undefined;
}

export interface PlatformValidationResult {
  valid: boolean;
  platform?: 'youtube' | 'spotify' | 'isrc' | 'applemusic' | 'soundcloud';
  id?: string;
  label?: string;
  canonicalKey?: string;
  error?: string;
}

/**
 * Validates arbitrary user input string (URL, URI, or ID) for publish gate.
 */
export function validateAndExtractPlatformLink(input?: string): PlatformValidationResult {
  if (!input || !input.trim()) {
    return {
      valid: false,
      error: 'An official platform link (YouTube, Spotify, or SoundCloud) is required to publish to the global registry.',
    };
  }

  const str = input.trim();

  // 1. Check YouTube
  const ytId = parseYouTubeMusicId(str);
  if (ytId) {
    return {
      valid: true,
      platform: 'youtube',
      id: ytId,
      label: `YouTube (${ytId})`,
      canonicalKey: `yt:${ytId}`,
    };
  }

  // 2. Check Spotify
  const spotifyId = parseSpotifyTrackId(str);
  if (spotifyId) {
    return {
      valid: true,
      platform: 'spotify',
      id: spotifyId,
      label: `Spotify Track (${spotifyId.slice(0, 8)}...)`,
      canonicalKey: `spotify:${spotifyId}`,
    };
  }

  // 3. Check ISRC
  const isrc = normalizeIsrc(str);
  if (isrc) {
    return {
      valid: true,
      platform: 'isrc',
      id: isrc,
      label: `ISRC (${isrc})`,
      canonicalKey: `isrc:${isrc}`,
    };
  }

  // 4. Check Apple Music
  const appleId = parseAppleMusicTrackId(str);
  if (appleId) {
    return {
      valid: true,
      platform: 'applemusic',
      id: appleId,
      label: `Apple Music (${appleId})`,
      canonicalKey: `apple:${appleId}`,
    };
  }

  // 5. Check SoundCloud
  const scUrl = parseSoundCloudTrackUrl(str);
  if (scUrl) {
    return {
      valid: true,
      platform: 'soundcloud',
      id: scUrl,
      label: `SoundCloud (${scUrl.replace('https://soundcloud.com/', '')})`,
      canonicalKey: `sc:${scUrl.replace('https://soundcloud.com/', '')}`,
    };
  }

  return {
    valid: false,
    error: 'Unrecognized link. Please enter a valid YouTube/YouTube Music URL, Spotify Track URL/URI, SoundCloud track URL, or ISRC code.',
  };
}

/**
 * Generates the deterministic Canonical Key for single-source-of-truth registry lookup.
 */
export function resolveCanonicalSongKey(params: {
  isrc?: string;
  spotifyId?: string;
  youtubeId?: string;
  appleMusicId?: string;
  audioHash?: string;
  artist?: string;
  title?: string;
}): string {
  const isrc = normalizeIsrc(params.isrc);
  if (isrc) return `isrc:${isrc}`;

  const spotify = parseSpotifyTrackId(params.spotifyId);
  if (spotify) return `spotify:${spotify}`;

  const yt = parseYouTubeMusicId(params.youtubeId);
  if (yt) return `yt:${yt}`;

  const apple = parseAppleMusicTrackId(params.appleMusicId);
  if (apple) return `apple:${apple}`;

  if (params.audioHash) {
    const raw = params.audioHash.replace(/^sha256:/, '');
    return `audio:${raw.slice(0, 16)}`;
  }

  const artistNorm = (params.artist || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const titleNorm = (params.title || 'untitled').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `song:${artistNorm}:${titleNorm}`;
}

