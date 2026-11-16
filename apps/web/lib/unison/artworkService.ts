'use client';

import { useState, useEffect } from 'react';

export interface SongArtworkData {
  artworkUrl: string | null;
  fallbackUrl: string | null;
}

const artworkCache = new Map<string, SongArtworkData>();
const inFlightRequests = new Map<string, Promise<SongArtworkData | null>>();

export async function fetchSquareArtwork(videoId: string): Promise<SongArtworkData | null> {
  if (!videoId) return null;
  if (artworkCache.has(videoId)) {
    return artworkCache.get(videoId)!;
  }
  if (inFlightRequests.has(videoId)) {
    return inFlightRequests.get(videoId)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`https://unison.betterlyrics.org/artwork?v=${encodeURIComponent(videoId)}&size=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: SongArtworkData = {
        artworkUrl: json.data?.artworkUrl || null,
        fallbackUrl: json.data?.fallbackUrl || null,
      };
      if (data.artworkUrl || data.fallbackUrl) {
        artworkCache.set(videoId, data);
        return data;
      }
    } catch {
      // ignore
    } finally {
      inFlightRequests.delete(videoId);
    }
    return null;
  })();

  inFlightRequests.set(videoId, promise);
  return promise;
}

export function useSongArtwork(videoId: string | undefined): SongArtworkData | null {
  const [artData, setArtData] = useState<SongArtworkData | null>(() => {
    if (!videoId) return null;
    return artworkCache.get(videoId) || null;
  });

  useEffect(() => {
    if (!videoId) {
      setArtData(null);
      return;
    }
    const cached = artworkCache.get(videoId);
    if (cached) {
      setArtData(cached);
      return;
    }

    let active = true;
    fetchSquareArtwork(videoId).then((data) => {
      if (active && data) {
        setArtData(data);
      }
    });

    return () => {
      active = false;
    };
  }, [videoId]);

  return artData;
}
