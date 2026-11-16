import { getTursoClient } from './turso';

export interface PublicUserProfile {
  username: string; // e.g. "aurostron" (normalized lowercase alphanumeric + hyphens/underscores)
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  unisonKeyId?: string;
  unisonHandle?: string;
  links?: {
    github?: string;
    twitter?: string;
    website?: string;
  };
  featuredTrackIds?: string[];
  createdAt?: number;
  updatedAt?: number;
  lastActiveAt?: number;
}

export interface ProfileTrackInfo {
  videoId: string;
  title: string;
  artist: string;
  format: 'ttml' | 'lrc';
  syncType: 'richsync' | 'linesync';
  wordsCount?: number;
  linesCount?: number;
  humanTimed?: boolean;
  score?: number;
}

// ----------------------------------------------------------------------------
// Static Seed Profiles (Tier 0 Cache: 0 Turso Reads & Instant Render)
// ----------------------------------------------------------------------------
export const STATIC_PROFILES: Record<string, PublicUserProfile> = {
  aurostron: {
    username: 'aurostron',
    displayName: 'aurostron',
    bio: 'Curating word-by-word synced lyrics on OpenLyryc.',
    unisonKeyId: '7bea96e64dd07e88dd6e5501535d6ee7ae22cc3d6ac2668fa47dc2dc77ab2cba',
    unisonHandle: 'aurostron',
    links: {
      github: 'https://github.com/aurostron',
    },
    featuredTrackIds: ['FA_J8XwpCaQ', 'MR3uP7IYz44'],
    createdAt: 1730419200,
  },
};

// Known track metadata for instant zero-latency rendering of featured tracks
export const KNOWN_FEATURED_TRACKS: Record<string, ProfileTrackInfo> = {
  FA_J8XwpCaQ: {
    videoId: 'FA_J8XwpCaQ',
    title: 'Tu Jaane Na',
    artist: 'Atif Aslam, Pritam',
    format: 'ttml',
    syncType: 'richsync',
    wordsCount: 294,
    linesCount: 77,
    humanTimed: true,
    score: 12,
  },
  MR3uP7IYz44: {
    videoId: 'MR3uP7IYz44',
    title: 'Lady (Hear Me Tonight)',
    artist: 'Modjo',
    format: 'ttml',
    syncType: 'richsync',
    wordsCount: 215,
    linesCount: 42,
    humanTimed: true,
    score: 18,
  },
};

// ----------------------------------------------------------------------------
// Multi-Tier Client Cache (0 Turso reads for repeat visitors)
// ----------------------------------------------------------------------------
interface CachedProfile {
  profile: PublicUserProfile;
  timestamp: number;
}

const memoryProfileCache = new Map<string, CachedProfile>();
const inFlightProfileRequests = new Map<string, Promise<PublicUserProfile | null>>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Availability check cache (prevents duplicate queries while typing)
interface CachedAvailability {
  available: boolean;
  error?: string;
  timestamp: number;
}
const availabilityCache = new Map<string, CachedAvailability>();
const inFlightAvailabilityChecks = new Map<string, Promise<{ available: boolean; error?: string; isCurrent?: boolean }>>();

const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'studio',
  'unison',
  'preview',
  'settings',
  'account',
  'profile',
  'explore',
  'about',
  'help',
  'docs',
  'openlyryc',
  'system',
  'root',
  'login',
  'signup',
  'auth',
]);

export function normalizeUsername(username: string): string {
  return (username || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Validates username syntax without any network calls (0 queries).
 */
export function validateUsernameSyntax(username: string): { valid: boolean; error?: string } {
  const clean = normalizeUsername(username);
  if (!clean) {
    return { valid: false, error: 'Enter a username' };
  }
  if (clean.length < 3) {
    return { valid: false, error: 'Must be at least 3 characters' };
  }
  if (clean.length > 24) {
    return { valid: false, error: 'Must be 24 characters or less' };
  }
  if (!/^[a-z0-9]/.test(clean) || !/[a-z0-9]$/.test(clean)) {
    return { valid: false, error: 'Must start and end with a letter or number' };
  }
  if (!/^[a-z0-9_-]+$/.test(clean)) {
    return { valid: false, error: 'Only letters, numbers, hyphens, and underscores' };
  }
  if (RESERVED_USERNAMES.has(clean)) {
    return { valid: false, error: 'This username is reserved' };
  }
  return { valid: true };
}

type ProfilePatch = Partial<PublicUserProfile>;

function compactProfile<T extends object>(obj?: T | null): Partial<T> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

function getStaticSeed(cleanUser: string): PublicUserProfile | null {
  const seed = STATIC_PROFILES[cleanUser];
  return seed
    ? {
        ...seed,
        links: seed.links ? { ...seed.links } : undefined,
        featuredTrackIds: seed.featuredTrackIds ? [...seed.featuredTrackIds] : undefined,
      }
    : null;
}

function mergeProfiles(
  base: PublicUserProfile | null | undefined,
  patch?: ProfilePatch | null
): PublicUserProfile | null {
  const username = normalizeUsername(patch?.username || base?.username || '');
  const seed = username ? getStaticSeed(username) : null;
  const seedPart = compactProfile(seed);
  const basePart = compactProfile(base);
  const patchPart = compactProfile(patch);

  if (!seed && !base && !patch?.username) return null;
  const merged = { ...seedPart, ...basePart, ...patchPart } as PublicUserProfile;
  if (!merged.username) merged.username = username;
  if (!merged.displayName) merged.displayName = merged.username;

  const links = {
    ...(seed?.links || {}),
    ...(base?.links || {}),
    ...(compactProfile(patch?.links) || {}),
  };
  merged.links = Object.keys(links).length > 0 ? links : undefined;

  if (patch && patch.featuredTrackIds === undefined) {
    merged.featuredTrackIds = base?.featuredTrackIds ?? seed?.featuredTrackIds;
  }
  if (merged.featuredTrackIds && !Array.isArray(merged.featuredTrackIds)) {
    merged.featuredTrackIds = undefined;
  }

  return merged;
}

function removeProfileCache(cleanUser: string): void {
  memoryProfileCache.delete(cleanUser);
  availabilityCache.delete(cleanUser);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`openlyryc_pub_profile_${cleanUser}`);
    } catch {
      // ignore
    }
  }
}

function saveMergedProfileCache(
  cleanUser: string,
  patch: ProfilePatch,
  sourceProfile?: PublicUserProfile | null
): PublicUserProfile | null {
  const source = sourceProfile ?? getFromProfileCache(cleanUser);
  const seed = getStaticSeed(cleanUser);
  const base = source ?? seed;
  const merged = mergeProfiles(base, { ...patch, username: cleanUser });
  if (merged) {
    saveToProfileCache(cleanUser, merged);
  }
  return merged;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return aDay === bDay;
}

export function getLastActiveLabel(lastActiveAt?: number | string | null): string | null {
  const timestamp = Number(lastActiveAt || 0);
  const lastActiveMs = timestamp > 1 ? timestamp * 1000 : timestamp;
  const lastActive = Number.isFinite(lastActiveMs) ? new Date(lastActiveMs) : null;
  if (!lastActive || Number.isNaN(lastActive.getTime())) return null;

  const now = new Date();
  const dayMs = 86_400_000;
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDifference = Math.max(0, Math.floor((startOfDay(now) - startOfDay(lastActive)) / dayMs));

  if (dayDifference <= 0) return 'Last active today';

  const units = [
    { days: dayDifference, text: 'day' },
    { days: Math.floor(dayDifference / 7), text: 'week' },
    { days: Math.floor(dayDifference / 30), text: 'month' },
    { days: Math.floor(dayDifference / 365), text: 'year' },
  ].filter((unit) => unit.days >= 1);

  const unit = units[units.length - 1];
  const label = unit.text === 'day'
    ? `${unit.days} day${unit.days === 1 ? '' : 's'} ago`
    : `${unit.days} ${unit.text}${unit.days === 1 ? '' : 's'} ago`;
  return `Last active ${label}`;
}

export async function touchUserLastActive(params: {
  username: string;
  ownerSecret: string;
  unisonKeyId?: string;
}): Promise<boolean> {
  const cleanUser = normalizeUsername(params.username);
  if (!cleanUser || !params.ownerSecret) return false;

  // One DB write per local day per device to keep the free-tier quota low.
  let shouldTouch = true;
  try {
    const localLast = Number(localStorage.getItem(`openlyryc_last_active_touch_${cleanUser}`) || 0);
    if (localLast && isSameLocalDay(new Date(localLast), new Date())) {
      shouldTouch = false;
    }
  } catch {
    shouldTouch = false;
  }

  if (!shouldTouch) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  const updateSql = `
      UPDATE user_profiles
      SET last_active_at = unixepoch()
      WHERE username = ?
        AND (owner_secret = ? OR owner_secret IS NULL OR (unison_key_id IS NOT NULL AND unison_key_id = ?));
    `;
  const storeTouchMarker = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`openlyryc_last_active_touch_${cleanUser}`, String(nowSec * 1000));
      }
    } catch {
      // Ignore local storage failures; the DB may still be updated.
    }
  };

  const runTouch = async (): Promise<boolean> => {
    const client = getTursoClient();
    const res = await client.execute({
      sql: updateSql,
      args: [cleanUser, params.ownerSecret, params.unisonKeyId || params.ownerSecret],
    });
    storeTouchMarker();
    saveMergedProfileCache(cleanUser, { username: cleanUser, lastActiveAt: nowSec, updatedAt: nowSec });
    return res.rowsAffected > 0;
  };

  try {
    const touchedNow = await runTouch();
    return touchedNow;
  } catch {
    // Fresh installs may not have had the schema initialized yet.
    await initProfileSchema();
    const client = getTursoClient();
    const res = await client.execute({
      sql: updateSql,
      args: [cleanUser, params.ownerSecret, params.unisonKeyId || params.ownerSecret],
    });
    storeTouchMarker();
    saveMergedProfileCache(cleanUser, { username: cleanUser, lastActiveAt: nowSec, updatedAt: nowSec });
    return res.rowsAffected > 0;
  }
}

function getFromProfileCache(cleanUser: string): PublicUserProfile | null {
  // 1. In-memory cache
  const mem = memoryProfileCache.get(cleanUser);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mergeProfiles(getStaticSeed(cleanUser), mem.profile);
  }

  // 2. LocalStorage cache
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`openlyryc_pub_profile_${cleanUser}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedProfile;
        if (parsed?.profile && Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS) {
          memoryProfileCache.set(cleanUser, parsed);
          return mergeProfiles(getStaticSeed(cleanUser), parsed.profile);
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function saveToProfileCache(cleanUser: string, profile: PublicUserProfile): void {
  const item: CachedProfile = { profile, timestamp: Date.now() };
  memoryProfileCache.set(cleanUser, item);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`openlyryc_pub_profile_${cleanUser}`, JSON.stringify(item));
    } catch {
      // ignore
    }
  }
}

// ----------------------------------------------------------------------------
// Turso Schema Initialization
// ----------------------------------------------------------------------------
let profileSchemaInitialized = false;

export async function initProfileSchema(): Promise<void> {
  if (profileSchemaInitialized) return;
  try {
    const client = getTursoClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        username TEXT PRIMARY KEY,
        display_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        unison_key_id TEXT,
        unison_handle TEXT,
        owner_secret TEXT,
        links_json TEXT,
        featured_track_ids TEXT,
        created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH()),
        updated_at INTEGER NOT NULL DEFAULT (UNIXEPOCH()),
        last_active_at INTEGER
      );
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_unison_key ON user_profiles(unison_key_id);
    `);
    profileSchemaInitialized = true;
  } catch (err) {
    console.warn('Failed to verify user_profiles schema in Turso:', err);
  }
}

// ----------------------------------------------------------------------------
// Check Username Availability (Ultra-Lightweight Point Lookup)
// ----------------------------------------------------------------------------
export async function checkUsernameAvailability(
  rawUsername: string,
  currentUsername?: string,
  currentUnisonKeyId?: string,
  currentOwnerSecret?: string
): Promise<{ available: boolean; error?: string; isCurrent?: boolean; ownedByCurrentUser?: boolean }> {
  const clean = normalizeUsername(rawUsername);
  if (!clean) {
    return { available: false, error: 'Enter a username' };
  }

  // Check if it's the current user's existing username (0 queries)
  if (currentUsername && clean === normalizeUsername(currentUsername)) {
    return { available: true, isCurrent: true, ownedByCurrentUser: true };
  }

  // Client-side syntax validation (0 queries)
  const syntax = validateUsernameSyntax(clean);
  if (!syntax.valid) {
    return { available: false, error: syntax.error };
  }

  // Cache key accounting for user session context
  const cacheKey = `${clean}:${currentUnisonKeyId || ''}:${currentOwnerSecret || ''}`;
  const pending = inFlightAvailabilityChecks.get(cacheKey);
  if (pending) {
    return pending;
  }

  const checkPromise = (async () => {
    try {
      await initProfileSchema();
      const client = getTursoClient();

      // Rule: Different usernames cannot be bound to the same Unison account.
      // If current user is logged into Unison, check if their key is already bound to a different username.
      if (currentUnisonKeyId) {
        const boundRes = await client.execute({
          sql: 'SELECT username FROM user_profiles WHERE unison_key_id = ? LIMIT 1;',
          args: [currentUnisonKeyId],
        });
        if (boundRes.rows && boundRes.rows.length > 0) {
          const boundUser = String(boundRes.rows[0].username);
          if (boundUser !== clean) {
            return {
              available: false,
              error: `Your Unison account is already linked to @${boundUser}. Only one username can be linked.`,
            };
          }
        }
      }

      // Check if username exists in database
      const res = await client.execute({
        sql: 'SELECT username, unison_key_id, owner_secret FROM user_profiles WHERE username = ? LIMIT 1;',
        args: [clean],
      });

      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        const rowKey = row.unison_key_id ? String(row.unison_key_id) : undefined;
        const rowSecret = row.owner_secret ? String(row.owner_secret) : undefined;

        // If the username in DB has the same Unison key or owner secret as current user, it's THEIRS!
        const isOwner = Boolean(
          (currentUnisonKeyId && rowKey && currentUnisonKeyId === rowKey) ||
          (currentOwnerSecret && rowSecret && currentOwnerSecret === rowSecret)
        );

        if (isOwner) {
          return { available: true, isCurrent: true, ownedByCurrentUser: true };
        }

        return { available: false, error: 'Username is taken' };
      }

      return { available: true };
    } catch (err) {
      console.warn('Turso availability check error:', err);
      // On network failure, fallback gracefully
      return { available: true };
    } finally {
      inFlightAvailabilityChecks.delete(cacheKey);
    }
  })();

  inFlightAvailabilityChecks.set(cacheKey, checkPromise);
  return checkPromise;
}

// ----------------------------------------------------------------------------
// Fetch Profile By Connected Unison Key (Auto-Sync on Connect)
// ----------------------------------------------------------------------------
export async function fetchProfileByUnisonKey(
  unisonKeyId: string
): Promise<(PublicUserProfile & { ownerSecret?: string }) | null> {
  if (!unisonKeyId) return null;
  try {
    await initProfileSchema();
    const client = getTursoClient();
    const res = await client.execute({
      sql: `
        SELECT username, display_name, bio, avatar_url, banner_url,
               unison_key_id, unison_handle, owner_secret, links_json,
               featured_track_ids, created_at, updated_at, last_active_at
        FROM user_profiles
        WHERE unison_key_id = ?
        LIMIT 1;
      `,
      args: [unisonKeyId],
    });

    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];

    let links: PublicUserProfile['links'] = undefined;
    try {
      if (row.links_json) {
        links = JSON.parse(String(row.links_json));
      }
    } catch {}

    let featuredTrackIds: string[] | undefined = undefined;
    try {
      if (row.featured_track_ids) {
        const parsed = JSON.parse(String(row.featured_track_ids));
        if (Array.isArray(parsed)) featuredTrackIds = parsed;
      }
    } catch {}

    const profile: PublicUserProfile = {
      username: String(row.username),
      displayName: String(row.display_name || row.username),
      bio: row.bio == null ? undefined : String(row.bio),
      avatarUrl: row.avatar_url == null ? undefined : String(row.avatar_url),
      bannerUrl: row.banner_url == null ? undefined : String(row.banner_url),
      unisonKeyId: row.unison_key_id ? String(row.unison_key_id) : undefined,
      unisonHandle: row.unison_handle ? String(row.unison_handle) : undefined,
      links,
      featuredTrackIds,
      createdAt: Number(row.created_at || 0) || undefined,
      updatedAt: Number(row.updated_at || row.created_at || 0),
      lastActiveAt: row.last_active_at == null ? undefined : Number(row.last_active_at),
    };
    const ownerSecret = row.owner_secret ? String(row.owner_secret) : undefined;
    saveMergedProfileCache(profile.username, profile);
    return ownerSecret ? { ...profile, ownerSecret } : profile;
  } catch (err) {
    console.warn('Failed to fetch profile by Unison key:', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Fetch Public Profile (Optimized for 0 reads via Tiered Cache + Coalescing)
// ----------------------------------------------------------------------------
export async function fetchPublicUserProfile(
  rawUsername: string
): Promise<PublicUserProfile | null> {
  const cleanUser = normalizeUsername(rawUsername);
  if (!cleanUser) return null;

  // 1. Check Multi-Tier Cache first (0 Turso reads!)
  const cached = getFromProfileCache(cleanUser);
  if (cached) {
    return cached;
  }

  // 2. Request Coalescing (Prevents stampeding / duplicate network queries)
  const pending = inFlightProfileRequests.get(cleanUser);
  if (pending) {
    return pending;
  }

  // 3. Query Turso point-lookup by primary key
  const fetchPromise = (async (): Promise<PublicUserProfile | null> => {
    try {
      await initProfileSchema();
      const client = getTursoClient();
      const result = await client.execute({
        sql: `
          SELECT username, display_name, bio, avatar_url, banner_url,
                 unison_key_id, unison_handle, links_json, featured_track_ids,
                 created_at, updated_at, last_active_at
          FROM user_profiles
          WHERE username = ?
          LIMIT 1
        `,
        args: [cleanUser],
      });

      const seedProfile = getStaticSeed(cleanUser);

      if (!result.rows || result.rows.length === 0) {
        // If not found in DB but matches static seed, return seed
        return seedProfile;
      }

      const row = result.rows[0];
      let links: PublicUserProfile['links'] = undefined;
      try {
        if (row.links_json) {
          links = JSON.parse(String(row.links_json));
        }
      } catch {}

      let featuredTrackIds: string[] | undefined = undefined;
      try {
        if (row.featured_track_ids) {
          const parsed = JSON.parse(String(row.featured_track_ids));
          if (Array.isArray(parsed) && parsed.length > 0) featuredTrackIds = parsed;
        }
      } catch {}

      const dbProfile: PublicUserProfile = {
        username: String(row.username),
        displayName: String(row.display_name || row.username),
        bio: row.bio == null ? undefined : String(row.bio),
        avatarUrl: row.avatar_url == null ? undefined : String(row.avatar_url),
        bannerUrl: row.banner_url == null ? undefined : String(row.banner_url),
        unisonKeyId: row.unison_key_id ? String(row.unison_key_id) : undefined,
        unisonHandle: row.unison_handle ? String(row.unison_handle) : undefined,
        links,
        featuredTrackIds,
        createdAt: Number(row.created_at || 0) || undefined,
        updatedAt: Number(row.updated_at || row.created_at || 0) || undefined,
        lastActiveAt: row.last_active_at == null ? undefined : Number(row.last_active_at),
      };

      // Merge over the static seed so a DB row with sparse fields does not
      // erase seeded defaults (links, featured tracks, bio, etc.).
      const profile = mergeProfiles(seedProfile, dbProfile) as PublicUserProfile;
      saveToProfileCache(cleanUser, profile);
      return profile;
    } catch (err) {
      console.warn(`Failed to fetch profile for @${cleanUser} from Turso:`, err);
      return getStaticSeed(cleanUser);
    } finally {
      inFlightProfileRequests.delete(cleanUser);
    }
  })();

  inFlightProfileRequests.set(cleanUser, fetchPromise);
  return fetchPromise;
}

// ----------------------------------------------------------------------------
// Claim / Save Public Profile (Atomic Upsert with Ownership Check & Strict Limit)
// ----------------------------------------------------------------------------
export async function claimPublicUserProfile(params: {
  username: string;
  previousUsername?: string;
  currentClaimsCount?: number;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  unisonKeyId?: string;
  ownerSecret: string;
}): Promise<{ success: boolean; error?: string }> {
  const cleanUser = normalizeUsername(params.username);
  const syntax = validateUsernameSyntax(cleanUser);
  if (!syntax.valid) {
    return { success: false, error: syntax.error };
  }

  // Strict claim limit check: maximum 2 total claims per device (initial + 1 change)
  if (typeof params.currentClaimsCount === 'number' && params.currentClaimsCount >= 2) {
    return { success: false, error: 'You have reached the maximum limit of 2 username claims.' };
  }

  try {
    await initProfileSchema();
    const client = getTursoClient();

    // Rule: Different usernames cannot be bound to the same Unison account.
    if (params.unisonKeyId) {
      const existingBound = await client.execute({
        sql: 'SELECT username FROM user_profiles WHERE unison_key_id = ? AND username != ? LIMIT 1;',
        args: [params.unisonKeyId, cleanUser],
      });
      if (existingBound.rows && existingBound.rows.length > 0) {
        const otherUser = String(existingBound.rows[0].username);
        return {
          success: false,
          error: `Your Unison account is already linked to @${otherUser}. Only one username can be linked per Unison account.`,
        };
      }
    }

    // If changing from an existing username to a new one, attempt atomic rename
    const prevUser = params.previousUsername ? normalizeUsername(params.previousUsername) : undefined;
    if (prevUser && prevUser !== cleanUser) {
      // First check if destination username is already claimed by someone else
      const destCheck = await client.execute({
        sql: 'SELECT username, unison_key_id, owner_secret FROM user_profiles WHERE username = ? LIMIT 1;',
        args: [cleanUser],
      });
      if (destCheck.rows && destCheck.rows.length > 0) {
        const destRow = destCheck.rows[0];
        const isDestOwner = Boolean(
          (params.unisonKeyId && destRow.unison_key_id && params.unisonKeyId === destRow.unison_key_id) ||
          (params.ownerSecret && destRow.owner_secret && params.ownerSecret === destRow.owner_secret)
        );
        if (!isDestOwner) {
          return { success: false, error: 'This username is already claimed by someone else.' };
        }
      }

      // Atomically update username for this owner secret or matching unison key
      const renameRes = await client.execute({
        sql: `
          UPDATE user_profiles
          SET username = ?, display_name = ?, bio = coalesce(?, bio),
              avatar_url = ?, unison_key_id = coalesce(?, unison_key_id),
              owner_secret = coalesce(?, owner_secret),
              updated_at = unixepoch(),
              last_active_at = unixepoch()
          WHERE username = ?
            AND (owner_secret = ? OR owner_secret IS NULL OR (unison_key_id IS NOT NULL AND unison_key_id = ?));
        `,
        args: [
          cleanUser,
          params.displayName || cleanUser,
          params.bio || null,
          params.avatarUrl || null,
          params.unisonKeyId || null,
          params.ownerSecret || null,
          prevUser,
          params.ownerSecret || null,
          params.unisonKeyId || null,
        ],
      });

      if (renameRes.rowsAffected > 0) {
        // Carry links/featured tracks over from the old username's cache before clearing it
        const carriedProfile = getFromProfileCache(prevUser);
        removeProfileCache(prevUser);

        const now = Math.floor(Date.now() / 1000);
        saveMergedProfileCache(
          cleanUser,
          {
            username: cleanUser,
            displayName: params.displayName || cleanUser,
            bio: params.bio,
            avatarUrl: params.avatarUrl,
            unisonKeyId: params.unisonKeyId,
            createdAt: carriedProfile?.createdAt,
            updatedAt: now,
          },
          carriedProfile
        );
        availabilityCache.set(cleanUser, { available: false, timestamp: Date.now() });

        return { success: true };
      }
    }

    // Atomic insert-or-update with ownership lock
    const res = await client.execute({
      sql: `
        INSERT INTO user_profiles (
          username, display_name, bio, avatar_url, unison_key_id, owner_secret, updated_at, last_active_at
        ) VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        ON CONFLICT(username) DO UPDATE SET
          display_name = excluded.display_name,
          bio = coalesce(excluded.bio, user_profiles.bio),
          avatar_url = excluded.avatar_url,
          unison_key_id = coalesce(excluded.unison_key_id, user_profiles.unison_key_id),
          owner_secret = excluded.owner_secret,
          updated_at = unixepoch()
        WHERE user_profiles.owner_secret = excluded.owner_secret
           OR user_profiles.owner_secret IS NULL
           OR (excluded.unison_key_id IS NOT NULL AND user_profiles.unison_key_id = excluded.unison_key_id);
      `,
      args: [
        cleanUser,
        params.displayName || cleanUser,
        params.bio || null,
        params.avatarUrl || null,
        params.unisonKeyId || null,
        params.ownerSecret || null,
      ],
    });

    if (res.rowsAffected === 0) {
      return { success: false, error: 'This username is already claimed by someone else.' };
    }

    saveMergedProfileCache(cleanUser, {
      username: cleanUser,
      displayName: params.displayName || cleanUser,
      bio: params.bio,
      avatarUrl: params.avatarUrl,
      unisonKeyId: params.unisonKeyId,
      updatedAt: Math.floor(Date.now() / 1000),
    });

    availabilityCache.set(cleanUser, { available: false, timestamp: Date.now() });

    return { success: true };
  } catch (err: any) {
    console.error('Turso DB claim profile error:', err);
    return { success: false, error: err?.message || 'Could not save profile' };
  }
}
