'use client';

import React, { useState, useEffect } from 'react';
import { ColorPalette } from '@/lib/colorExtractor';

interface AmbientBackgroundProps {
  palette: ColorPalette;
  enabled?: boolean;
  lowPower?: boolean;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = React.memo(({
  palette,
  enabled = true,
  lowPower = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!enabled || !mounted) {
    return <div className="absolute inset-0 bg-[#09090b] -z-10 pointer-events-none" suppressHydrationWarning />;
  }

  if (lowPower) {
    return (
      <div
        className="absolute inset-0 overflow-hidden -z-10 pointer-events-none select-none bg-[#050508]"
        suppressHydrationWarning
      >
        {/* Low-power static radial ambient gradient without expensive live blur filters */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${palette.primary} 0%, transparent 60%), radial-gradient(circle at 70% 80%, ${palette.secondary} 0%, transparent 60%)`,
          }}
          suppressHydrationWarning
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508]/80" suppressHydrationWarning />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden -z-10 pointer-events-none select-none bg-[#09090b]"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
      suppressHydrationWarning
    >
      {/* GPU Accelerated Ambient Blob 1 (Top Left) */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full opacity-25 transition-all duration-1000 ease-out will-change-transform"
        style={{
          background: `radial-gradient(circle, ${palette.primary} 0%, transparent 70%)`,
          filter: 'blur(90px)',
          transform: 'translate3d(0, 0, 0)',
        }}
        suppressHydrationWarning
      />

      {/* GPU Accelerated Ambient Blob 2 (Bottom Right) */}
      <div
        className="absolute -bottom-[15%] -right-[10%] w-[50vw] h-[50vw] rounded-full opacity-20 transition-all duration-1000 ease-out will-change-transform"
        style={{
          background: `radial-gradient(circle, ${palette.secondary} 0%, transparent 70%)`,
          filter: 'blur(100px)',
          transform: 'translate3d(0, 0, 0)',
        }}
        suppressHydrationWarning
      />

      {/* GPU Accelerated Ambient Blob 3 (Center Accent) */}
      <div
        className="absolute top-[25%] left-[30%] w-[40vw] h-[40vw] rounded-full opacity-15 transition-all duration-1000 ease-out will-change-transform"
        style={{
          background: `radial-gradient(circle, ${palette.accent} 0%, transparent 65%)`,
          filter: 'blur(110px)',
          transform: 'translate3d(0, 0, 0)',
        }}
        suppressHydrationWarning
      />

      {/* Deep Minimalist Vignette Shield for Perfect Contrast & Legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-[#09090b]/80" suppressHydrationWarning />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#09090b]/40 to-[#09090b]/95" suppressHydrationWarning />
    </div>
  );
});

AmbientBackground.displayName = 'AmbientBackground';
