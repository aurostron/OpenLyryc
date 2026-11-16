'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import type { RuntimeMode } from '@/lib/runtimeMode';

interface WelcomeModeScreenProps {
  onSelect: (mode: RuntimeMode) => void;
  /** Shown when the picker was opened from the switcher (a mode already exists). */
  onClose?: () => void;
}

/**
 * First-run welcome gate: pick Offline (max performance, private) or
 * Cloudflare Live (always-latest website). Reused as the switch dialog
 * so the choice is changeable anytime.
 */
export function WelcomeModeScreen({ onSelect, onClose }: WelcomeModeScreenProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-[#08080a]/95 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-[#0d0d11] shadow-[0_32px_90px_rgba(0,0,0,0.85)] p-6 sm:p-10"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Back to studio"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}

        <div className="flex flex-col items-center text-center space-y-4">
          <OpenLyrycLogo className="h-7 w-auto text-white" />
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-white">
            How do you want to run OpenLyryc?
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
            Pick once — switch anytime from the mode pill in the studio header.
            Your projects and drafts stay on this device either way.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-8">
          {/* Offline card */}
          <button
            type="button"
            onClick={() => onSelect('offline')}
            className="group text-left rounded-2xl border border-amber-400/40 bg-amber-400/[0.04] hover:bg-amber-400/[0.08] hover:border-amber-300/60 transition-all p-6 flex flex-col gap-4 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30">
                <span className="material-symbols-outlined text-xl text-amber-300">bolt</span>
              </span>
              <div>
                <div className="text-sm font-semibold text-white">Offline</div>
                <div className="text-[11px] font-sans uppercase tracking-wider text-amber-300/80">
                  Max performance
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Local-only studio. No cloud lyric search, no auto-detect, no cover-art
              lookups. Fastest scrubbing, fully private, works with zero network.
            </p>
            <div className="text-[11px] font-sans text-zinc-500 space-y-1">
              <div>✓ Local audio + manual YouTube IDs</div>
              <div>✓ IndexedDB projects & drafts</div>
              <div>✕ Cloud search / collab disabled</div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-200 group-hover:gap-2.5 transition-all">
              <span>Run offline</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </span>
          </button>

          {/* Cloudflare card */}
          <button
            type="button"
            onClick={() => onSelect('cloudflare')}
            className="group text-left rounded-2xl border border-emerald-500/50 bg-emerald-400/[0.05] hover:bg-emerald-400/[0.09] hover:border-emerald-300/70 transition-all p-6 flex flex-col gap-4 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-400/15 border border-emerald-400/30">
                <span className="material-symbols-outlined text-xl text-emerald-300">cloud</span>
              </span>
              <div>
                <div className="text-sm font-semibold text-white">Cloudflare Live</div>
                <div className="text-[11px] font-sans uppercase tracking-wider text-emerald-300/80">
                  Always latest
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Loads the latest website from Cloudflare. Cloud lyric search,
              YouTube auto-detect, cover art, publishing and collab all enabled.
            </p>
            <div className="text-[11px] font-sans text-zinc-500 space-y-1">
              <div>✓ Live UI, no reinstall to update</div>
              <div>✓ Cloud search / publish / collab</div>
              <div>· Needs network, slightly heavier</div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200 group-hover:gap-2.5 transition-all">
              <span>Launch live site</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </span>
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] font-sans text-zinc-600">
          Stored locally as openlyryc_runtime_mode_v1 · changeable anytime
        </p>
      </motion.div>
    </div>
  );
}
