'use client';

import { useEffect, useState } from 'react';
import { rescanStudioConnect, type DetectedExtension } from '@/lib/studioConnect';

export interface StudioConnectState {
  /** undefined while the first detection is in flight. */
  detected: DetectedExtension | null | undefined;
  /** True once the extension answered a ping with the yt capability. */
  available: boolean;
}

let cached: DetectedExtension | null | undefined;

async function detect(): Promise<DetectedExtension | null> {
  const result = await rescanStudioConnect(1200).catch(() => null);
  cached = result;
  return result;
}

/**
 * Whether the OpenLyryc Studio Connect extension is installed and reachable.
 * Re-pings on window focus so installing it mid-session picks up without a
 * reload. Deliberately quiet when absent: the Studio is fully functional with
 * local files and embeds, Connect just adds a source.
 */
export function useStudioConnect(): StudioConnectState {
  const [detected, setDetected] = useState<DetectedExtension | null | undefined>(cached);

  useEffect(() => {
    let alive = true;

    if (cached === undefined) {
      detect().then((result) => {
        if (alive) setDetected(result);
      });
    }

    const onFocus = () => {
      detect().then((result) => {
        if (alive) setDetected(result);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return {
    detected,
    available: Boolean(detected?.info.capabilities.includes('yt')),
  };
}
