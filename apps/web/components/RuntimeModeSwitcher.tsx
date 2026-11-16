'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { RuntimeMode } from '@/lib/runtimeMode';

interface RuntimeModeSwitcherProps {
  mode: RuntimeMode;
  onClick: () => void;
}

/**
 * Compact header pill showing the active runtime mode.
 * Clicking re-opens the welcome picker so the choice is switchable anytime.
 */
export function RuntimeModeSwitcher({ mode, onClick }: RuntimeModeSwitcherProps) {
  const isLive = mode === 'cloudflare';
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      title={isLive ? 'Cloudflare Live — click to switch mode' : 'Offline — click to switch mode'}
      className={`hidden sm:flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
        isLive
          ? 'border-emerald-500/40 bg-emerald-400/[0.08] hover:bg-emerald-400/[0.14] text-emerald-200'
          : 'border-amber-500/40 bg-amber-400/[0.08] hover:bg-amber-400/[0.14] text-amber-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`}
      />
      <span className="material-symbols-outlined text-[15px]">
        {isLive ? 'cloud' : 'bolt'}
      </span>
      <span>{isLive ? 'Live' : 'Offline'}</span>
      <span className="material-symbols-outlined text-[13px] opacity-60">swap_horiz</span>
    </motion.button>
  );
}
