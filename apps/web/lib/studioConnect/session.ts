import { detectExtension, type Bridge, type DetectedExtension } from './client';

/**
 * Where the detected extension lives. `useStudioConnect` fills this in on
 * mount and on window focus; the player engine reads it synchronously when a
 * track loads. Kept at module scope (no React state) so the engine can call
 * it outside the render tree.
 */

/**
 * The Chromium extension id, pinned by the extension's committed dev key so an
 * unpacked development build is always addressable without configuration.
 * A Chrome Web Store build would set NEXT_PUBLIC_STUDIO_CONNECT_CHROMIUM_ID
 * to the store-assigned id instead.
 */
export const STUDIO_CONNECT_CHROMIUM_EXTENSION_ID =
  process.env.NEXT_PUBLIC_STUDIO_CONNECT_CHROMIUM_ID ?? 'hplnfnjcflelkgldlfodfcnfgpllbhpm';

let active: DetectedExtension | null = null;

export function getBridge(): Bridge | null {
  return active?.bridge ?? null;
}

export function getStudioConnect(): DetectedExtension | null {
  return active;
}

export function setStudioConnect(detected: DetectedExtension | null): void {
  active = detected;
}

/** Ping both transports and remember the answer; null when the extension is absent. */
export async function rescanStudioConnect(timeoutMs = 1500): Promise<DetectedExtension | null> {
  const detected = await detectExtension({ chromiumExtensionId: STUDIO_CONNECT_CHROMIUM_EXTENSION_ID, timeoutMs });
  active = detected;
  return detected;
}
