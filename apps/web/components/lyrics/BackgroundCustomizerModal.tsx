'use client';

import React, { useState } from 'react';
import { 
  X, 
  Palette, 
  Image as ImageIcon, 
  Video, 
  Square, 
  RotateCcw, 
  Check, 
  Sliders, 
  SunMedium, 
  Eye,
  Link as LinkIcon
} from 'lucide-react';

export type BackgroundPresetType = 
  | 'obsidian' 
  | 'ambient-glow' 
  | 'grid' 
  | 'pitch-black' 
  | 'graphite' 
  | 'custom-link';

export interface BackgroundConfig {
  type: BackgroundPresetType;
  customUrl?: string;
  blur: number; // 0 to 40 px
  dim: number; // 0.1 to 0.9 opacity
}

export const DEFAULT_BG_CONFIG: BackgroundConfig = {
  type: 'ambient-glow',
  customUrl: '',
  blur: 16,
  dim: 0.55,
};

interface BackgroundCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BackgroundConfig;
  coverArt?: string;
  onSaveConfig: (cfg: BackgroundConfig) => void;
}

export const BackgroundCustomizerModal: React.FC<BackgroundCustomizerModalProps> = ({
  isOpen,
  onClose,
  config,
  coverArt,
  onSaveConfig,
}) => {
  const [tempConfig, setTempConfig] = useState<BackgroundConfig>(config);
  const [urlInput, setUrlInput] = useState<string>(config.customUrl || '');

  // Reset local state whenever modal opens with new config
  React.useEffect(() => {
    if (isOpen) {
      setTempConfig(config);
      setUrlInput(config.customUrl || '');
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleApply = () => {
    const updated = {
      ...tempConfig,
      customUrl: urlInput.trim(),
    };
    onSaveConfig(updated);
    onClose();
  };

  const handleReset = () => {
    setTempConfig(DEFAULT_BG_CONFIG);
    setUrlInput('');
    onSaveConfig(DEFAULT_BG_CONFIG);
  };

  const isVideoUrl = urlInput.match(/\.(mp4|webm|mov)(\?.*)?$/i) || urlInput.includes('youtube.com') || urlInput.includes('youtu.be');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Palette className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Change Background & Atmosphere</h2>
              <p className="text-[11px] text-zinc-400">Choose monochrome presets or paste your own custom background link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Preset Theme Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2.5">
              Preset Styles
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'obsidian', label: 'Obsidian Minimal', icon: Square, desc: 'Clean default monochrome (#09090b)' },
                { id: 'ambient-glow', label: 'Fluid Kawarp', icon: ImageIcon, desc: 'Animated Apple Music fluid cover art' },
                { id: 'grid', label: 'Tech Dot Grid', icon: Sliders, desc: 'Subtle engineering dot pattern' },
                { id: 'pitch-black', label: 'Pitch Black OLED', icon: Eye, desc: 'True pure #000000 OLED deep' },
                { id: 'graphite', label: 'Graphite Charcoal', icon: SunMedium, desc: 'Muted slate gradient (#121316)' },
                { id: 'custom-link', label: 'Custom Link', icon: LinkIcon, desc: 'Your image or video URL' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = tempConfig.type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTempConfig((prev) => ({ ...prev, type: item.id as BackgroundPresetType }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-zinc-950 border-white font-medium shadow-md'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className="w-4 h-4" />
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Link Section (Always accessible, highlighted when custom-link is selected) */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Custom Background Link (Image or Video)</span>
              </label>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans">
                {isVideoUrl ? 'Video Detected' : 'Image / URL'}
              </span>
            </div>

            <input
              type="url"
              placeholder="Paste Image URL (Unsplash, Imgur, direct .png/.jpg) or Video URL (.mp4)"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setTempConfig((prev) => ({ ...prev, type: 'custom-link' }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-white/30 transition-colors"
            />
            <p className="text-[11px] text-zinc-500">
              Paste direct image URLs (.jpg, .png, .webp, Unsplash) or direct video files (.mp4, .webm).
            </p>

            {/* Quick Sample Links */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 mr-1">Quick ideas:</span>
              {[
                { name: 'Tokyo Neon', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1920&q=80' },
                { name: 'Deep Nebula', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80' },
                { name: 'Minimal Architecture', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1920&q=80' },
              ].map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => {
                    setUrlInput(sample.url);
                    setTempConfig((prev) => ({ ...prev, type: 'custom-link' }));
                  }}
                  className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white text-[10px] transition-colors cursor-pointer"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders: Blur and Dimming */}
          <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">Background Blur</span>
                <span className="text-zinc-500 font-sans">{tempConfig.blur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={tempConfig.blur}
                onChange={(e) => setTempConfig((prev) => ({ ...prev, blur: Number(e.target.value) }))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">Darkness Veil (Dimming)</span>
                <span className="text-zinc-500 font-sans">{Math.round(tempConfig.dim * 100)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={Math.round(tempConfig.dim * 100)}
                onChange={(e) => setTempConfig((prev) => ({ ...prev, dim: Number(e.target.value) / 100 }))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          {/* Mini Live Preview Box */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Live Preview</span>
            <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 bg-[#09090b] flex items-center justify-center">
              {/* Background Layer */}
              {tempConfig.type === 'custom-link' && urlInput ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                  style={{
                    backgroundImage: `url(${urlInput})`,
                    filter: `blur(${tempConfig.blur / 2}px)`,
                  }}
                />
              ) : tempConfig.type === 'ambient-glow' && coverArt ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-all duration-300 scale-125"
                  style={{
                    backgroundImage: `url(${coverArt})`,
                    filter: `blur(${tempConfig.blur}px)`,
                  }}
                />
              ) : tempConfig.type === 'grid' ? (
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
              ) : null}

              {/* Dark Overlay */}
              <div 
                className="absolute inset-0 bg-black transition-opacity" 
                style={{ opacity: tempConfig.dim }}
              />

              {/* Foreground Sample Lyrics */}
              <div className="relative z-10 text-center px-4">
                <p className="text-xs font-bold text-white tracking-tight">OpenLyryc Synchronized Typography</p>
                <p className="text-[10px] text-zinc-400">Crisp high-contrast lyrics readability guaranteed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
            >
              Apply Background
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
