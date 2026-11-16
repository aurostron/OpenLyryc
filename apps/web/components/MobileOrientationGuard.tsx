'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface MobileOrientationGuardProps {
  /** Optional override to force show the overlay for development/testing */
  forceShow?: boolean;
}

export const MobileOrientationGuard: React.FC<MobileOrientationGuardProps> = ({ forceShow = false }) => {
  const [isMobileVertical, setIsMobileVertical] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const checkOrientation = useCallback(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect if the client is a mobile device / touch environment
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    const isMobileUA =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Viewport check (phones/tablets in portrait typically under 900px wide)
    const isNarrowViewport = window.innerWidth <= 900;
    const isMobile = (isTouchDevice || isMobileUA) && isNarrowViewport;

    // 2. Detect vertical (portrait) orientation
    let isVertical = false;
    if (window.screen?.orientation?.type) {
      isVertical = window.screen.orientation.type.startsWith('portrait');
    } else if (window.matchMedia) {
      isVertical = window.matchMedia('(orientation: portrait)').matches;
    } else {
      isVertical = window.innerHeight > window.innerWidth;
    }

    // 3. Update state
    if (forceShow) {
      setIsMobileVertical(true);
    } else if (isMobile && isVertical) {
      setIsMobileVertical(true);
    } else {
      setIsMobileVertical(false);
      // Reset dismissed state once rotated to landscape so returning to portrait will re-prompt
      setIsDismissed(false);
    }
  }, [forceShow]);

  useEffect(() => {
    checkOrientation();

    // Listen to resize, orientation changes, and media queries
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    let orientationQuery: MediaQueryList | null = null;
    if (window.matchMedia) {
      orientationQuery = window.matchMedia('(orientation: portrait)');
      try {
        orientationQuery.addEventListener('change', checkOrientation);
      } catch {
        // Fallback for older browsers
        orientationQuery.addListener?.(checkOrientation);
      }
    }

    if (window.screen?.orientation) {
      try {
        window.screen.orientation.addEventListener('change', checkOrientation);
      } catch {
        // Fallback
      }
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (orientationQuery) {
        try {
          orientationQuery.removeEventListener('change', checkOrientation);
        } catch {
          orientationQuery.removeListener?.(checkOrientation);
        }
      }
      if (window.screen?.orientation) {
        try {
          window.screen.orientation.removeEventListener('change', checkOrientation);
        } catch {
          // Fallback
        }
      }
    };
  }, [checkOrientation]);

  if (!isMobileVertical || isDismissed) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Screen orientation advisory"
      className="fixed inset-0 z-[60] bg-[#09090b]/92 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none font-sans animate-in fade-in duration-300"
    >
      <div className="max-w-sm w-full bg-[#101014] border border-white/[0.1] rounded-2xl p-7 shadow-2xl flex flex-col items-center gap-5 relative overflow-hidden text-zinc-100">
        {/* Subtle Ambient Radial Glow */}
        <div
          aria-hidden="true"
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-white/[0.03] rounded-full blur-2xl pointer-events-none"
        />

        {/* Animated Wireframe Phone Illustration */}
        <div className="relative w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shadow-inner">
          <div className="w-7 h-12 rounded-md border-2 border-white/70 flex flex-col items-center justify-between py-1 shadow-sm animate-phone-rotate">
            {/* Top speaker slit */}
            <div className="w-2.5 h-0.5 rounded-full bg-white/40" />
            {/* Screen rotation glyph */}
            <span className="material-symbols-outlined text-[10px] text-zinc-400">
              screen_rotation
            </span>
            {/* Bottom home indicator */}
            <div className="w-2.5 h-0.5 rounded-full bg-white/40" />
          </div>
        </div>

        {/* Text Details */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[10px] font-sans uppercase tracking-widest text-zinc-500">
            Stage Viewport
          </div>
          <h2 className="text-base font-semibold text-white tracking-tight">
            Rotate to Landscape
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-[260px] pt-1">
            OpenLyryc Stage is designed for widescreen panoramic viewing. Rotate your device horizontally in order to continue.
          </p>
        </div>

        {/* Continue / Bypass Action for Accessibility */}
        <div className="pt-2 border-t border-white/[0.06] w-full flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-[11px] font-sans text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-white/[0.04] flex items-center gap-1.5 active:scale-95"
          >
            <span>Continue in portrait</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

MobileOrientationGuard.displayName = 'MobileOrientationGuard';
