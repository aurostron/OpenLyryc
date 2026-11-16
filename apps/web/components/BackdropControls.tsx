'use client';

import React, { useRef } from 'react';
import { AppSettings, AppBackdropFit } from '@/types/settings';
import { isVideoUrl } from '@/lib/appBackdrop';

interface BackdropControlsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUploadBackdrop?: (file: File) => void;
}

/**
 * Shared global-backdrop controls (Studio only): image/video URL / upload / clear,
 * dimming, blur, sizing. Used by SettingsView (Customization) and the
 * SettingsModal Customization tab — one source of truth.
 */
export const BackdropControls: React.FC<BackdropControlsProps> = ({
  settings,
  onUpdateSettings,
  onUploadBackdrop,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = settings.appBackdropUrl ?? '';
  const type = settings.appBackdropType ?? 'auto';
  const dim = settings.appBackdropDim ?? 0.6;
  const blur = settings.appBackdropBlur ?? 10;
  const fit = settings.appBackdropFit ?? 'cover';

  const isVideo =
    Boolean(url) &&
    (type === 'video' || (type !== 'image' && isVideoUrl(url)));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-zinc-300 mb-2">App Backdrop (Image or Video)</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => onUpdateSettings({ appBackdropUrl: e.target.value })}
            placeholder="https://…/wallpaper.jpg or .mp4, or drop image/video anywhere"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none focus:border-white/40"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white transition-all cursor-pointer shrink-0"
          >
            Upload
          </button>
          {url ? (
            <button
              type="button"
              onClick={() => onUpdateSettings({ appBackdropUrl: '', appBackdropType: 'auto' })}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.1] text-xs font-bold text-zinc-300 hover:text-red-300 transition-all cursor-pointer shrink-0"
            >
              Clear
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onUploadBackdrop) onUploadBackdrop(f);
            e.target.value = '';
          }}
        />
        {url ? (
          <div className="mt-2.5 rounded-lg overflow-hidden border border-white/[0.1] bg-black/40">
            {isVideo ? (
              <video
                src={url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-24 object-cover"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" className="w-full h-24 object-cover" />
            )}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 font-sans mt-1.5">
            Bottom layer of the whole Studio — dimmed + blurred. Embeds, Stage modes and text stay on top untouched.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-300 font-medium">Dimming</span>
          <span className="text-xs font-sans text-white font-semibold">{Math.round(dim * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.9}
          step={0.05}
          value={dim}
          onChange={(e) => onUpdateSettings({ appBackdropDim: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-300 font-medium">Blur</span>
          <span className="text-xs font-sans text-white font-semibold">{blur === 0 ? 'Off' : `${blur}px`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={blur}
          onChange={(e) => onUpdateSettings({ appBackdropBlur: parseInt(e.target.value, 10) })}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>

      <div>
        <div className="text-xs text-zinc-300 font-medium mb-2">Sizing</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'Cover', val: 'cover' },
            { label: 'Contain', val: 'contain' },
            { label: 'Fill', val: 'fill' },
          ] as Array<{ label: string; val: AppBackdropFit }>).map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => onUpdateSettings({ appBackdropFit: preset.val })}
              className={`px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer text-center ${
                fit === preset.val
                  ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
