'use client';

import React, { useEffect } from 'react';
import {
  STAGE_FONT_OPTIONS,
  STAGE_WEIGHT_OPTIONS,
  buildStageFontStack,
  stageFontWeightValue,
  ensureStageFontLoaded,
} from '@/lib/stageFonts';

export interface StageFontControlsPatch {
  stageFontFamily?: string;
  stageFontWeight?: string;
  peakFontSize?: number;
  peakTextX?: number;
  peakTextY?: number;
}

interface StageFontControlsProps {
  fontFamily: string;
  fontWeight: string;
  fontSize?: number; // 0.7 to 1.6, default 1.0
  textX?: number; // -40 to 40, default 0
  textY?: number; // 5 to 35, default 16
  showPositionControls?: boolean; // false for other view modes, true only for Mountain Peak
  onChange: (patch: StageFontControlsPatch) => void;
}

/**
 * Shared Stage typography controls: Google Font picker + font weight.
 * Positioning and sizing controls are strictly guarded by showPositionControls
 * so other stage modes (Flowy, Karaoke, Kinetic, Elegant, Alve) are never affected.
 */
export const StageFontControls: React.FC<StageFontControlsProps> = ({
  fontFamily,
  fontWeight,
  fontSize = 1.0,
  textX = 0,
  textY = 16,
  showPositionControls = false,
  onChange,
}) => {
  useEffect(() => {
    ensureStageFontLoaded(fontFamily);
  }, [fontFamily]);

  const previewStack = buildStageFontStack(fontFamily) ?? 'inherit';
  const previewWeight = stageFontWeightValue(fontWeight) ?? 500;

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* 1. Font Family & Weight (Applies to All Modes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => onChange({ stageFontFamily: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none cursor-pointer focus:border-white/40"
          >
            {STAGE_FONT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">Font Weight</label>
          <select
            value={fontWeight}
            onChange={(e) => onChange({ stageFontWeight: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none cursor-pointer focus:border-white/40"
          >
            {STAGE_WEIGHT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Positioning & Size Controls */}
      {showPositionControls && (
        <div className="pt-2 border-t border-white/[0.08] space-y-3">
          {/* Text Size (Scale Multiplier) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Text Size</span>
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-white text-[10px]">{fontSize.toFixed(2)}x</span>
                {fontSize !== 1.0 && (
                  <button
                    type="button"
                    onClick={() => onChange({ peakFontSize: 1.0 })}
                    className="text-[9px] font-sans text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Reset to 1.0x"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={fontSize}
              onChange={(e) => onChange({ peakFontSize: Number(e.target.value) })}
              className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-sans text-zinc-500">
              <span>0.7x (Smaller)</span>
              <span>1.0x (Default)</span>
              <span>1.6x (Larger)</span>
            </div>
          </div>

          {/* Horizontal Position (X Axis) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Position X (Horizontal)</span>
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-white text-[10px]">
                  {textX === 0 ? 'Center (0%)' : textX > 0 ? `+${textX}% Right` : `${textX}% Left`}
                </span>
                {textX !== 0 && (
                  <button
                    type="button"
                    onClick={() => onChange({ peakTextX: 0 })}
                    className="text-[9px] font-sans text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Center text"
                  >
                    Center
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={textX}
              onChange={(e) => onChange({ peakTextX: Number(e.target.value) })}
              className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-sans text-zinc-500">
              <span>Left (-40%)</span>
              <span>Center (0%)</span>
              <span>Right (+40%)</span>
            </div>
          </div>

          {/* Vertical Position (Y Axis / Ridge) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Position Y (Vertical / Ridge)</span>
              <div className="flex items-center gap-1.5">
                <span className="font-sans text-white text-[10px]">{textY}% from top</span>
                {textY !== 16 && (
                  <button
                    type="button"
                    onClick={() => onChange({ peakTextY: 16 })}
                    className="text-[9px] font-sans text-zinc-400 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Reset to 16%"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={5}
              max={35}
              step={1}
              value={textY}
              onChange={(e) => onChange({ peakTextY: Number(e.target.value) })}
              className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-sans text-zinc-500">
              <span>Higher (5%)</span>
              <span>Ridge (16%)</span>
              <span>Lower (35%)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Preview */}
      <div className="rounded-xl bg-black/50 border border-white/[0.08] p-3 overflow-hidden">
        <div className="text-[10px] text-zinc-500 font-sans mb-1 flex items-center justify-between">
          <span>Live Typography Preview</span>
          {showPositionControls && (
            <span className="font-sans text-zinc-400">{Math.round(fontSize * 100)}%</span>
          )}
        </div>
        <div
          className="text-white truncate transition-all duration-100"
          style={{
            fontFamily: previewStack,
            fontWeight: previewWeight,
            fontSize: showPositionControls ? `${1.25 * fontSize}rem` : '1.25rem',
            lineHeight: 1.2,
            transform: showPositionControls && textX ? `translateX(${textX * 0.5}%)` : undefined,
          }}
        >
          {showPositionControls ? 'Lyrics go behind the peak' : 'I feel love for the first time'}
        </div>
      </div>
    </div>
  );
};
