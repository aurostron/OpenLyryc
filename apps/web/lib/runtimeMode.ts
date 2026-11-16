/**
 * RuntimeMode — Offline (max performance, local) vs Cloudflare Live (latest website).
 *
 * Single source of truth shared by the web app today and the Tauri desktop
 * shell tomorrow. No React imports here so Rust-side tooling and plain
 * modules can use it too.
 */

export type RuntimeMode = 'offline' | 'cloudflare';

export const RUNTIME_MODE_STORAGE_KEY = 'openlyryc_runtime_mode_v1';

/**
 * True only inside the Tauri desktop shell (WebView2 with the IPC bridge).
 * The mode system (welcome picker, Live/Offline pill, Cloudflare frame) is
 * dormant everywhere else, so the production website renders zero changes.
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

/** Canonical live site. Cloudflare mode iframes / links here. */
export const CLOUDFLARE_LIVE_ORIGIN = 'https://openlyryc.pages.dev';
export const CLOUDFLARE_LIVE_STUDIO_PATH = '/studio';
export const CLOUDFLARE_UPDATER_JSON_PATH = '/updater/latest.json';

const DEFAULT_WORKER_API = 'https://openlyryc-core.aurostronyee1.workers.dev';

function readStoredMode(): RuntimeMode | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RUNTIME_MODE_STORAGE_KEY);
    if (raw === 'offline' || raw === 'cloudflare') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: RuntimeMode | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (mode === null) {
      localStorage.removeItem(RUNTIME_MODE_STORAGE_KEY);
    } else {
      localStorage.setItem(RUNTIME_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function getRuntimeMode(): RuntimeMode | null {
  return readStoredMode();
}

export function setRuntimeMode(mode: RuntimeMode | null): void {
  writeStoredMode(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<RuntimeMode | null>('openlyryc:runtime-mode-change', { detail: mode })
    );
  }
}

export function isOfflineMode(mode: RuntimeMode | null | undefined): boolean {
  return mode === 'offline';
}

export function isCloudflareMode(mode: RuntimeMode | null | undefined): boolean {
  return mode === 'cloudflare';
}

/**
 * Worker API base URL honoring the runtime mode.
 * Returns null when offline so callers fall back to local-only behavior.
 */
export function getApiBaseUrl(mode?: RuntimeMode | null): string | null {
  const effective = mode !== undefined ? mode : getRuntimeMode();
  if (effective === 'offline') return null;
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return DEFAULT_WORKER_API;
}

/** Whether live lyric providers (Musixmatch / Binimum / LRCLIB / lrc.red) may be queried. */
export function shouldUseOnlineLyrics(mode?: RuntimeMode | null): boolean {
  const effective = mode !== undefined ? mode : getRuntimeMode();
  return effective !== 'offline';
}

/** Whether cover-art lookups (iTunes / lrc.red / LRCLIB) may run. */
export function shouldFetchArtwork(mode?: RuntimeMode | null): boolean {
  const effective = mode !== undefined ? mode : getRuntimeMode();
  return effective !== 'offline';
}

/** Whether YouTube auto-detect (Worker proxy) may run. Manual video IDs still work offline. */
export function shouldUseYouTubeAutoDetect(mode?: RuntimeMode | null): boolean {
  const effective = mode !== undefined ? mode : getRuntimeMode();
  return effective !== 'offline';
}

export function getCloudflareStudioUrl(): string {
  return `${CLOUDFLARE_LIVE_ORIGIN}${CLOUDFLARE_LIVE_STUDIO_PATH}?embed=desktop-cloudflare`;
}
