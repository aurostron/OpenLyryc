'use client';

import React, { useEffect } from 'react';
import {
  INTERFACE_FONT_OPTIONS,
  buildInterfaceFontStack,
  ensureInterfaceFontLoaded,
} from '@/lib/interfaceFonts';

interface InterfaceFontControlsProps {
  value: string;
  onChange: (id: string) => void;
}

/**
 * Studio UI font picker. Pure UI — only ever re-sets --font-ui on the Studio
 * root; lowercase 'i' in "UI" reflects the compact settings-row style.
 */
export const InterfaceFontControls: React.FC<InterfaceFontControlsProps> = ({
  value,
  onChange,
}) => {
  useEffect(() => {
    ensureInterfaceFontLoaded(value);
  }, [value]);

  const previewStack = buildInterfaceFontStack(value);

  const active = INTERFACE_FONT_OPTIONS.find((o) => o.id === value) ?? INTERFACE_FONT_OPTIONS[0];

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {INTERFACE_FONT_OPTIONS.map((opt) => {
          const isActive = opt.id === value;
          const stack = (opt.id === 'geist'
            ? 'var(--font-geist)'
            : opt.id === 'geist-mono'
            ? 'var(--font-geist_mono)'
            : opt.family || 'inherit') + ', system-ui, sans-serif';
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                ensureInterfaceFontLoaded(opt.id);
                onChange(opt.id);
              }}
              className={`px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-zinc-950 font-semibold border-white'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="block text-xs font-medium truncate" style={{ fontFamily: stack }}>
                {opt.label}
              </span>
              <span
                className={`block text-[10px] mt-0.5 truncate ${
                  isActive ? 'text-zinc-500' : 'text-zinc-500'
                }`}
                style={{ fontFamily: stack }}
              >
                Interface
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-[11px] text-zinc-400">
          Active: <span className="text-white font-medium">{active.label}</span>
          <span className="ml-2 text-zinc-500">·</span>
          <span className="text-zinc-500">Preview:</span>
        </p>
        <p
          className="text-sm text-white mt-1 truncate"
          style={{ fontFamily: previewStack }}
          aria-hidden="true"
        >
          OpenLyryc Studio — word-by-word lyric sync
        </p>
      </div>
    </div>
  );
};

export default InterfaceFontControls;
