'use client';

export interface AvatarItem {
  id: string;
  name: string;
  url: string;
  category: string;
  animated: boolean;
}

let cachedCatalog: AvatarItem[] | null = null;
let inFlightCatalogPromise: Promise<AvatarItem[]> | null = null;

// The avatar images are not included in this repository. See docs/ASSETS.md.
// Deployments can add their own files under public/avatars and serve catalog.json.
export const STARTER_AVATARS: AvatarItem[] = [];

/**
 * Loads the complete avatar catalog (463 meme pictures and animated GIFs).
 * Cached in memory after first load.
 */
export async function getAvatarCatalog(): Promise<AvatarItem[]> {
  if (cachedCatalog) return cachedCatalog;
  if (inFlightCatalogPromise) return inFlightCatalogPromise;

  inFlightCatalogPromise = (async () => {
    try {
      const res = await fetch('/avatars/catalog.json');
      if (!res.ok) throw new Error('Catalog request failed');
      const data = (await res.json()) as AvatarItem[];
      cachedCatalog = data;
      return data;
    } catch (err) {
      console.warn('Avatar catalog is not available:', err);
      return [];
    } finally {
      inFlightCatalogPromise = null;
    }
  })();

  return inFlightCatalogPromise;
}
