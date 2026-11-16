'use client';

export interface LocalUserProfile {
  username?: string; // e.g. "aurostron"
  usernameClaimsCount?: number; // Total claims performed (max 2: initial claim + 1 change)
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  ownerSecret?: string;
  createdAt: number;
  hasCompletedWelcome: boolean;
}

export const USER_PROFILE_STORAGE_KEY = 'openlyryc_user_profile_v1';
export const USER_SECRET_STORAGE_KEY = 'openlyryc_user_owner_secret';
export const COLLAB_NAME_KEY = 'openlyrics_collab_name';
export const MAX_USERNAME_CLAIMS = 2; // Strict limit: 1 initial claim + 1 change allowed

const DEFAULT_PROFILE: LocalUserProfile = {
  displayName: 'Lyricist',
  createdAt: Date.now(),
  hasCompletedWelcome: false,
};

/**
 * Returns or generates a persistent, random device owner secret.
 * Used to verify ownership when updating a claimed profile in Turso.
 */
export function getUserOwnerSecret(): string {
  if (typeof window === 'undefined') return '';
  try {
    let secret = localStorage.getItem(USER_SECRET_STORAGE_KEY);
    if (!secret) {
      const bytes = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      secret = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem(USER_SECRET_STORAGE_KEY, secret);
    }
    return secret;
  } catch {
    return '';
  }
}

/**
 * Retrieves the local user profile from localStorage.
 */
export function getLocalUserProfile(): LocalUserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    const ownerSecret = getUserOwnerSecret();

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalUserProfile>;
      const rawUser = parsed.username?.trim().toLowerCase().replace(/^@+/, '') || undefined;
      // Default claims count: if username already exists, count is at least 1, otherwise 0
      const claimsCount = typeof parsed.usernameClaimsCount === 'number'
        ? parsed.usernameClaimsCount
        : (rawUser ? 1 : 0);

      return {
        username: rawUser,
        usernameClaimsCount: claimsCount,
        displayName: parsed.displayName?.trim() || 'Lyricist',
        bio: parsed.bio || '',
        avatarUrl: parsed.avatarUrl || '',
        avatarSeed: parsed.avatarSeed || parsed.displayName?.trim() || 'L',
        ownerSecret: parsed.ownerSecret || ownerSecret,
        createdAt: parsed.createdAt || Date.now(),
        hasCompletedWelcome: Boolean(parsed.hasCompletedWelcome),
      };
    }

    // Fallback check: sync with legacy collab name if set
    const legacyCollabName = localStorage.getItem(COLLAB_NAME_KEY);
    if (legacyCollabName?.trim()) {
      const initial: LocalUserProfile = {
        displayName: legacyCollabName.trim(),
        ownerSecret,
        createdAt: Date.now(),
        hasCompletedWelcome: true,
      };
      saveLocalUserProfile(initial);
      return initial;
    }

    return { ...DEFAULT_PROFILE, ownerSecret };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Saves the local user profile and keeps collab name in sync.
 */
export function saveLocalUserProfile(profile: Partial<LocalUserProfile>): LocalUserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const current = getLocalUserProfile();
    const ownerSecret = profile.ownerSecret || current.ownerSecret || getUserOwnerSecret();

    const updated: LocalUserProfile = {
      ...current,
      ...profile,
      username: profile.username !== undefined ? profile.username.trim().toLowerCase().replace(/^@+/, '') : current.username,
      usernameClaimsCount: profile.usernameClaimsCount !== undefined ? profile.usernameClaimsCount : current.usernameClaimsCount,
      displayName: (profile.displayName ?? current.displayName).trim() || 'Lyricist',
      avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : current.avatarUrl,
      ownerSecret,
    };

    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updated));

    // Keep collaboration name in sync
    localStorage.setItem(COLLAB_NAME_KEY, updated.displayName);

    // Dispatch custom event for real-time reactive UI updates
    window.dispatchEvent(
      new CustomEvent('openlyryc-profile-updated', { detail: updated })
    );

    return updated;
  } catch (err) {
    console.error('Failed to save local user profile:', err);
    return DEFAULT_PROFILE;
  }
}
