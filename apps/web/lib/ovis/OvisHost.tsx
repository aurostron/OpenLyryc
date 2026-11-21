'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type { RendererViewMode } from '@/types/editor';
import type { OvisRenderProps, OvisModule } from '@/types/ovis';
import { loadOvisModule, getLoadedOvisModule } from './ovisLoader';

interface OvisHostProps extends OvisRenderProps {
  mode: RendererViewMode;
  onFallback?: (failedMode: RendererViewMode) => void;
}

/**
 * OpenLyryc Visuals Host Harness
 * Dynamically mounts either the embedded core renderer (flow.ovis) or
 * asynchronously streamed remote renderers (*.ovis) with zero layout thrash.
 */
export const OvisHost: React.FC<OvisHostProps> = ({
  mode,
  onFallback,
  ...renderProps
}) => {
  const [activeModule, setActiveModule] = useState<OvisModule | null>(() => getLoadedOvisModule(mode));
  const [isLoading, setIsLoading] = useState<boolean>(!getLoadedOvisModule(mode));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const existing = getLoadedOvisModule(mode);
    if (existing) {
      setActiveModule(existing);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);
    setLoadError(null);

    loadOvisModule(mode)
      .then((mod) => {
        if (!isSubscribed) return;
        startTransition(() => {
          setActiveModule(mod);
          setIsLoading(false);
        });
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error(`[OvisHost] Failed to mount "${mode}.ovis":`, err);
        setLoadError(err.message || 'Failed to load visualizer');
        setIsLoading(false);
        onFallback?.(mode);
      });

    return () => {
      isSubscribed = false;
    };
  }, [mode, onFallback]);

  // If a module is active, render it directly
  if (activeModule?.default) {
    const VisualComponent = activeModule.default;
    return <VisualComponent {...renderProps} />;
  }

  // Loading skeleton while streaming .ovis package
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none bg-[#09090b]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-3 animate-pulse">
        <span className="material-symbols-outlined text-2xl">motion_mode</span>
      </div>
      <p className="text-xs font-mono text-zinc-400 tracking-wider uppercase">
        {loadError ? 'Visualizer Offline' : `Streaming ${mode}.ovis...`}
      </p>
    </div>
  );
};
