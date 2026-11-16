'use client';

/**
 * Global app-backdrop helpers (Studio only).
 *
 * - Dropped/uploaded images are downscaled + JPEG-compressed to a data URL so
 *   the backdrop survives reloads inside localStorage settings. GIFs keep a
 *   session object URL instead (canvas would freeze them on frame one).
 * - Anything that can't persist small enough also falls back to a session
 *   object URL with `persisted: false` so the caller can note it.
 */

const MAX_EDGE = 1920;
const MAX_DATA_URL_CHARS = 1_800_000;

export function isBackdropImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name);
}

export function isBackdropVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|mkv|ogg|ogv|m4v|avi)$/i.test(file.name);
}

export function isBackdropMediaFile(file: File): boolean {
  return isBackdropImageFile(file) || isBackdropVideoFile(file);
}

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  const cleanUrl = url.split('?')[0].split('#')[0];
  return /\.(mp4|webm|mov|mkv|ogg|ogv|m4v|avi)$/i.test(cleanUrl);
}

import { saveAppBackdropBlob, getActiveAppBackdrop, clearAppBackdropBlob } from './db';

export { getActiveAppBackdrop, clearAppBackdropBlob };

export async function persistBackdropMedia(
  file: File
): Promise<{ url: string; mediaType: 'image' | 'video'; persisted: boolean }> {
  const mediaType: 'image' | 'video' = isBackdropVideoFile(file) ? 'video' : 'image';
  try {
    const url = await saveAppBackdropBlob(file, mediaType, file.name);
    return { url, mediaType, persisted: true };
  } catch (err) {
    console.warn('[Backdrop] Failed to persist media in Dexie:', err);
    return { url: URL.createObjectURL(file), mediaType, persisted: false };
  }
}

export async function createVideoBackdrop(
  file: File
): Promise<{ url: string; persisted: boolean }> {
  const res = await persistBackdropMedia(file);
  return { url: res.url, persisted: res.persisted };
}

export async function persistBackdropFile(
  file: File
): Promise<{ url: string; persisted: boolean }> {
  const res = await persistBackdropMedia(file);
  return { url: res.url, persisted: res.persisted };
}
