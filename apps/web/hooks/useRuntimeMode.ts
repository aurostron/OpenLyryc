'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getRuntimeMode,
  setRuntimeMode as persistRuntimeMode,
  isTauriEnvironment,
  type RuntimeMode,
} from '@/lib/runtimeMode';

/**
 * Reactive wrapper around the persisted runtime mode.
 * Syncs across components via the `openlyryc:runtime-mode-change` event
 * (same-tab) plus the native `storage` event (multi-tab).
 *
 * `isTauri` gates the whole mode UI: outside the desktop shell the mode
 * system stays dormant and the website renders exactly as before.
 */
export function useRuntimeMode() {
  const [mode, setModeState] = useState<RuntimeMode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // Mount gate: localStorage is client-only, so hydrate on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(getRuntimeMode());
    setIsReady(true);
    setIsTauri(isTauriEnvironment());

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<RuntimeMode | null>).detail ?? null;
      setModeState(detail);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'openlyryc_runtime_mode_v1') {
        setModeState(getRuntimeMode());
      }
    };

    window.addEventListener('openlyryc:runtime-mode-change', handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('openlyryc:runtime-mode-change', handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const selectMode = useCallback((next: RuntimeMode) => {
    persistRuntimeMode(next);
    setModeState(next);
  }, []);

  const clearMode = useCallback(() => {
    persistRuntimeMode(null);
    setModeState(null);
  }, []);

  return { mode, isReady, isTauri, selectMode, clearMode };
}
