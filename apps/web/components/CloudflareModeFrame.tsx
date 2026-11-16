'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getCloudflareStudioUrl } from '@/lib/runtimeMode';

interface CloudflareModeFrameProps {
  onSwitchOffline: () => void;
  onChangeMode: () => void;
}

/**
 * Online mode (desktop app only): the live website full-bleed, exactly as
 * deployed — no control bars, no labels, no chrome. A single small floating
 * button returns to the mode picker; an offline fallback covers no-network.
 * Same component the Tauri shell reuses for its online window.
 */
export function CloudflareModeFrame({ onSwitchOffline, onChangeMode }: CloudflareModeFrameProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine)
  );
  const studioUrl = getCloudflareStudioUrl();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setHasError(false);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If the live site never fires load within 15s, surface the fallback.
  useEffect(() => {
    if (hasLoaded || hasError) return;
    const timer = window.setTimeout(() => {
      if (!hasLoaded) setHasError(true);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [hasLoaded, hasError, iframeKey]);

  const handleReload = useCallback(() => {
    setHasError(false);
    setHasLoaded(false);
    setIframeKey((k) => k + 1);
  }, []);

  const showFallback = hasError || !isOnline;

  return (
    <div className="fixed inset-0 bg-[#08080a] text-zinc-100">
      {!showFallback ? (
        <>
          {!hasLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <span className="material-symbols-outlined text-4xl animate-pulse">cloud</span>
              <div className="text-xs font-medium">Loading latest site…</div>
            </div>
          )}
          <iframe
            key={iframeKey}
            src={studioUrl}
            title="OpenLyryc Live"
            className="absolute inset-0 w-full h-full border-0 bg-[#08080a]"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-presentation allow-downloads"
            onLoad={() => {
              setHasLoaded(true);
              setHasError(false);
            }}
            onError={() => setHasError(true)}
          />
          {/* Single floating exit back to the mode picker */}
          <button
            type="button"
            onClick={onChangeMode}
            title="Switch mode (offline / live)"
            className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 text-zinc-400 hover:text-white opacity-40 hover:opacity-100 backdrop-blur-md transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          </button>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0d0d11] p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-4xl text-zinc-500">
              {!isOnline ? 'wifi_off' : 'cloud_off'}
            </span>
            <h2 className="text-lg font-light text-white">
              {!isOnline ? 'You are offline' : 'Live site unreachable'}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {!isOnline
                ? 'Online mode needs a network connection. Your local projects are safe — switch to Offline to keep working at full speed.'
                : 'The live site did not respond in time. Check your connection, retry, or drop into Offline mode — same projects, zero network.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleReload}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Retry live site
              </button>
              <button
                type="button"
                onClick={onSwitchOffline}
                className="px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Switch to Offline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
