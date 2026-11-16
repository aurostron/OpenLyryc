'use client';

import { useEffect } from 'react';
import { getLocalUserProfile, getUserOwnerSecret } from '@/lib/userProfile';
import { touchUserLastActive } from '@/lib/profiles';
import { loadUnisonSession } from '@/lib/unison/authService';

/**
 * Marks the local owner as active on OpenLyryc without firing DB writes while
 * the same local day is still active. Public viewers never reach this branch.
 */
export default function LastActivePing() {
  useEffect(() => {
    const run = () => {
      try {
        const profile = getLocalUserProfile();
        const ownerSecret = profile.ownerSecret || getUserOwnerSecret();
        if (!profile.username || !ownerSecret) return;

        const session = loadUnisonSession();
        void touchUserLastActive({
          username: profile.username,
          ownerSecret,
          unisonKeyId: session?.keyId,
        }).catch(() => {});
      } catch {
        // Skip activity writes when local storage is unavailable.
      }
    };

    run();
  }, []);

  return null;
}
