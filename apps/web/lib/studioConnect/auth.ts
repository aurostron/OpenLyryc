import type { YtAuthState } from './bridge';
import { getBridge } from './session';

/**
 * Who the Studio Connect player asks YouTube as — names only, cached from the
 * last read. The extension is the source of truth; this is just a local copy
 * so the playback engine can check `signedIn` synchronously (it mirrors the
 * web player's useYtAuth snapshot).
 */

const EMPTY: YtAuthState = {
  browserSignedIn: false,
  connected: false,
  signedIn: false,
  accounts: [],
  active: null,
  problem: null,
};

let snapshot: YtAuthState = EMPTY;

export function ytAuthSnapshot(): YtAuthState {
  return snapshot;
}

export function adoptYtAuth(state: YtAuthState): void {
  snapshot = state;
}

/** Re-read the state from the extension; null when it isn't there. */
export async function refreshYtAuth(refresh = false): Promise<YtAuthState | null> {
  const bridge = getBridge();
  if (!bridge) return null;
  try {
    snapshot = await bridge.call('yt.authState', { refresh }, { timeoutMs: 20_000 });
    return snapshot;
  } catch (error) {
    console.warn('[StudioConnect] reading the YouTube session failed:', error);
    return null;
  }
}

/** The first read is lazy; the cache serves afterwards. */
export async function ensureYtAuth(): Promise<YtAuthState | null> {
  if (snapshot !== EMPTY) return snapshot;
  return refreshYtAuth();
}

/**
 * Keeps the snapshot in sync with the extension's pushes (sign-in elsewhere in
 * the browser). Returns the unsubscribe.
 */
export function subscribeYtAuth(): () => void {
  const bridge = getBridge();
  if (!bridge) return () => {};
  return bridge.subscribe((event) => {
    if (event.event === 'yt.authState') adoptYtAuth(event.data);
  });
}
