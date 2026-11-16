'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSettings, FramerateTarget, VideoDisplayMode } from '@/types/settings';
import { OpenLyricsDocument } from '@/types/lyrics';
import {
  ArrowLeft,
  Search,
  Tv,
  Gauge,
  Volume2,
  FlaskConical,
  Check,
  RotateCcw,
  Image as ImageIcon,
  Type,
  Coffee,
} from 'lucide-react';
import { BackdropControls } from './BackdropControls';
import { StageFontControls } from './StageFontControls';
import { InterfaceFontControls } from './InterfaceFontControls';

export type SettingsCategory = 'video' | 'typography' | 'custom' | 'performance' | 'wellness' | 'audio' | 'experimental';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onBack: () => void;
  activeCategory?: SettingsCategory;
  onSelectCategory?: (category: SettingsCategory) => void;
  precisionMode?: boolean;
  onTogglePrecision?: () => void;
  audioOffset?: number;
  onUpdateOffset?: (offset: number) => void;
  document?: OpenLyricsDocument;
  onDownloadFile?: (content: string, filename: string, mimeType: string) => void;
  songTitle?: string;
  onUploadBackdrop?: (file: File) => void;
  onOpenBpmModal?: () => void;
  currentBpm?: number | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  activeCategory: controlledCategory,
  onSelectCategory,
  precisionMode,
  onTogglePrecision,
  audioOffset = 0,
  onUpdateOffset,
  document: doc,
  songTitle,
  onUploadBackdrop,
  onOpenBpmModal,
  currentBpm,
}) => {
  const [internalCategory, setInternalCategory] = useState<SettingsCategory>('video');
  const activeCategory = controlledCategory || internalCategory;

  const setActiveCategory = (cat: SettingsCategory) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    } else {
      setInternalCategory(cat);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentOpacity = settings.videoBackdropOpacity ?? 0.35;
  const currentBlur = settings.videoBackdropBlur ?? 12;
  const currentVideoMode: VideoDisplayMode = settings.videoDisplayMode ?? 'pip';

  const categories = [
    { id: 'video' as const, label: 'Video & Canvas', icon: Tv, desc: 'Backdrop, floating video, opacity and blur' },
    { id: 'typography' as const, label: 'Typography & Text', icon: Type, desc: 'Font family, weight, text size, and X/Y positioning' },
    { id: 'custom' as const, label: 'Customization', icon: ImageIcon, desc: 'Global app backdrop image, dimming, blur, sizing' },
    { id: 'performance' as const, label: 'Display & Framerate', icon: Gauge, desc: 'Target FPS, hardware acceleration, counters' },
    { id: 'wellness' as const, label: 'Digital Wellbeing', icon: Coffee, desc: 'Continuous screentime break rules and eye rest' },
    { id: 'audio' as const, label: 'Audio & Sync', icon: Volume2, desc: 'Timecode precision and latency calibration' },
    { id: 'experimental' as const, label: 'Experimental Labs', icon: FlaskConical, desc: 'Timeline editor and preview features' },
  ];

  const query = searchQuery.trim().toLowerCase();
  const matchesSearch = (text: string) => {
    if (!query) return true;
    return text.toLowerCase().includes(query);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-13 bg-[#111115] border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.25]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <h1 className="text-sm font-bold text-white tracking-tight">Studio Settings</h1>
        </div>

        {/* Global Filter Search Input */}
        <div className="relative w-64 max-w-full">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#17171d] border border-white/[0.08] focus:border-white/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none transition-all"
          />
        </div>
      </header>

      {/* Horizontal Category Strip (No Vertical Deck!) */}
      <nav
        className="px-6 py-2.5 bg-[#0e0e12] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 studio-chrome"
        aria-label="Settings categories"
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id && !query;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Full-Screen Body (Centered max-w-4xl) */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 1. APPEARANCE & VIDEO */}
          {(activeCategory === 'video' || query) && matchesSearch('Appearance Video Backdrop Floating PiP Brightness Blur Resolution') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Appearance & Video</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure the video canvas, floating picture-in-picture player, and backdrop brightness.
                </p>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                {/* Video Mode Selection */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Display Mode</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ videoDisplayMode: 'pip' })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        currentVideoMode === 'pip'
                          ? 'bg-white text-zinc-950 border-white font-bold shadow-md'
                          : 'bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">picture_in_picture_alt</span>
                      <div>
                        <div className="text-xs font-bold">Floating PiP</div>
                        <div className={`text-[11px] ${currentVideoMode === 'pip' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                          Corner player during editing
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ videoDisplayMode: 'backdrop' })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        currentVideoMode === 'backdrop'
                          ? 'bg-white text-zinc-950 border-white font-bold shadow-md'
                          : 'bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">wallpaper</span>
                      <div>
                        <div className="text-xs font-bold">Backdrop Canvas</div>
                        <div className={`text-[11px] ${currentVideoMode === 'backdrop' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                          Behind synchronized lyrics
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Brightness / Opacity Slider */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Backdrop Brightness</div>
                      <div className="text-[11px] text-zinc-500">Dimming level behind text</div>
                    </div>
                    <span className="text-xs font-serif text-white font-bold tabular-nums">
                      {Math.round(currentOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.05"
                    value={currentOpacity}
                    onChange={(e) => onUpdateSettings({ videoBackdropOpacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-serif">
                    <span>10% (Dim)</span>
                    <span>35% (Recommended)</span>
                    <span>80% (Vivid)</span>
                  </div>
                </div>

                {/* Blur Presets */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-xs font-medium text-zinc-200">Backdrop Blur</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Off', blur: 0 },
                      { label: '4px (Soft)', blur: 4 },
                      { label: '12px (Smooth)', blur: 12 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onUpdateSettings({ videoBackdropBlur: preset.blur })}
                        className={`py-2 px-3 rounded-lg border text-xs transition-all cursor-pointer text-center font-medium ${
                          currentBlur === preset.blur
                            ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Resolution */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-xs font-medium text-zinc-200">Video Resolution</div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { label: 'Auto', val: 'default' },
                      { label: '1080p', val: 'hd1080' },
                      { label: '720p', val: 'hd720' },
                      { label: '480p', val: 'large' },
                      { label: '360p', val: 'medium' },
                      { label: '240p', val: 'small' },
                    ].map((q) => (
                      <button
                        key={q.val}
                        type="button"
                        onClick={() => onUpdateSettings({ videoQualityPreference: q.val as any })}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center ${
                          (settings.videoQualityPreference ?? 'default') === q.val
                            ? 'bg-white text-zinc-950 font-bold border-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 1.5. TYPOGRAPHY & TEXT PREFERENCES */}
          {(activeCategory === 'typography' || query) && matchesSearch('Typography Text Font Weight Scale Size Position X Y Ridge Mountain Height') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Stage Typography</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Global font family and weight across Flowy, Karaoke, Kinetic, Elegant, Alve, and Peak modes.
                  </p>
                </div>
                <span className="text-[11px] font-serif text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  Global
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <StageFontControls
                  fontFamily={settings.stageFontFamily ?? 'poppins'}
                  fontWeight={settings.stageFontWeight ?? '500'}
                  showPositionControls={false}
                  onChange={(patch) => onUpdateSettings(patch)}
                />
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-tight">Interface Font</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Studio UI only. Defaults to Geist. Loads on demand.
                    </p>
                  </div>
                </div>
                <InterfaceFontControls
                  value={settings.interfaceFontFamily ?? 'geist'}
                  onChange={(id) => onUpdateSettings({ interfaceFontFamily: id })}
                />
              </div>

              {/* Dedicated Mountain Peak Layout Controls */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">terrain</span>
                    <h3 className="text-xs font-bold text-white tracking-tight">Positioning & Scale</h3>
                  </div>
                </div>

                {/* Text Size */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Text Size</span>
                    <span className="font-serif text-white text-[10px]">{(settings.peakFontSize ?? 1.0).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.6}
                    step={0.05}
                    value={settings.peakFontSize ?? 1.0}
                    onChange={(e) => onUpdateSettings({ peakFontSize: Number(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-serif text-zinc-500">
                    <span>0.7x (Smaller)</span>
                    <span>1.0x (Default)</span>
                    <span>1.6x (Larger)</span>
                  </div>
                </div>

                {/* Horizontal Position X */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Position X (Horizontal)</span>
                    <span className="font-serif text-white text-[10px]">
                      {(settings.peakTextX ?? 0) === 0 ? 'Center (0%)' : (settings.peakTextX ?? 0) > 0 ? `+${settings.peakTextX}% Right` : `${settings.peakTextX}% Left`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    step={1}
                    value={settings.peakTextX ?? 0}
                    onChange={(e) => onUpdateSettings({ peakTextX: Number(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-serif text-zinc-500">
                    <span>Left (-40%)</span>
                    <span>Center (0%)</span>
                    <span>Right (+40%)</span>
                  </div>
                </div>

                {/* Vertical Position Y */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400 font-medium">Position Y (Ridge Height)</span>
                    <span className="font-serif text-white text-[10px]">{settings.peakTextY ?? 16}% from top</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={35}
                    step={1}
                    value={settings.peakTextY ?? 16}
                    onChange={(e) => onUpdateSettings({ peakTextY: Number(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-serif text-zinc-500">
                    <span>Higher (5%)</span>
                    <span>Ridge (16%)</span>
                    <span>Lower (35%)</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. CUSTOMIZATION (global Studio backdrop) */}
          {(activeCategory === 'custom' || query) && matchesSearch('Customization Backdrop Wallpaper Image Background Dim Blur Size Cover') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Customization</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Global Studio backdrop — drop any image anywhere, or set one here. Embeds, Stage modes and text stay on top.
                </p>
              </div>
              <BackdropControls
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onUploadBackdrop={onUploadBackdrop}
              />
            </section>
          )}

          {/* 3. DISPLAY & FRAMERATE */}
          {(activeCategory === 'performance' || query) && matchesSearch('Display Framerate FPS Hardware acceleration performance') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Display & Framerate</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Match your monitor refresh rate and optimize rendering power.
                </p>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Target Refresh Rate</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'max' as const, label: 'Native (Max Hz)', desc: '144Hz / 240Hz' },
                      { id: '60' as const, label: '60 FPS', desc: 'Balanced studio' },
                      { id: '30' as const, label: '30 FPS', desc: 'Battery saver' },
                    ].map((fps) => (
                      <button
                        key={fps.id}
                        type="button"
                        onClick={() => onUpdateSettings({ framerateTarget: fps.id })}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          settings.framerateTarget === fps.id
                            ? 'bg-white text-zinc-950 border-white font-bold shadow-md'
                            : 'bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="text-xs font-bold">{fps.label}</div>
                        <div className={`text-[10px] mt-0.5 ${settings.framerateTarget === fps.id ? 'text-zinc-700' : 'text-zinc-500'}`}>
                          {fps.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-white/[0.06] rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  {/* FPS Counter Toggle */}
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Show FPS Counter</div>
                      <div className="text-[11px] text-zinc-500">Displays real-time frame timing in the transport bar</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ showFpsCounter: !settings.showFpsCounter })}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.showFpsCounter ? 'bg-white' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full transition-transform absolute top-1 left-1 ${
                          settings.showFpsCounter ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Hardware Acceleration Toggle */}
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Hardware Acceleration</div>
                      <div className="text-[11px] text-zinc-500">Use GPU layers for word sweep animations</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ hardwareAcceleration: !settings.hardwareAcceleration })}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.hardwareAcceleration ? 'bg-white' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full transition-transform absolute top-1 left-1 ${
                          settings.hardwareAcceleration ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4. WELLNESS & SCREENTIME BREAK RULE */}
          {(activeCategory === 'wellness' || query) && matchesSearch('Wellness Break Screentime Rest Timer Health Eye Strain Pause') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white tracking-tight">Mindful Screentime Break</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Always Active
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Helps prevent eye strain and fatigue during long lyric timing sessions. Whenever continuous active screentime reaches your target, OpenLyryc gently blurs the studio for a peaceful 30-second break.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-zinc-300">Screentime Reminder</label>
                    <span className="text-xs font-serif font-medium text-white px-2 py-0.5 rounded bg-white/[0.06]">
                      {settings.breakIntervalMinutes ?? 30} minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={settings.breakIntervalMinutes ?? 30}
                    onChange={(e) => onUpdateSettings({ breakIntervalMinutes: Number(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5">
                    <span>10 min (Min)</span>
                    <span>30 min (Default)</span>
                    <span>60 min (Max 1 hr)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Rule Policy</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      This health rule cannot be disabled. Duration can be set between 10 minutes and 1 hour.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).triggerBreak) {
                        (window as any).triggerBreak();
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white border border-white/[0.1] transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                  >
                    Test Break (30s)
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 5. AUDIO & SYNC */}
          {(activeCategory === 'audio' || query) && matchesSearch('Audio Sync Offset Precision Millisecond Latency') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Audio & Sync</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Calibrate audio latency and timecode format precision.
                </p>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                {/* Millisecond Precision Toggle */}
                {onTogglePrecision && (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Millisecond Precision</div>
                      <div className="text-[11px] text-zinc-500">
                        {precisionMode ? '3 decimal places (00:00.000)' : '2 decimal places (00:00.00)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onTogglePrecision}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        precisionMode ? 'bg-white' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full transition-transform absolute top-1 left-1 ${
                          precisionMode ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Global Audio Latency Offset */}
                {onUpdateOffset && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white">Audio Sync Offset (ms)</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Compensate for hardware output lag, Bluetooth latency, or vocal lead-in.
                        </div>
                      </div>
                      <span className="text-sm font-serif font-bold text-white tabular-nums px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                        {audioOffset > 0 ? `+${audioOffset}ms` : `${audioOffset}ms`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        value={audioOffset}
                        onChange={(e) => onUpdateOffset(parseInt(e.target.value, 10) || 0)}
                        className="w-28 bg-[#18181f] border border-white/[0.08] focus:border-white/30 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-serif tabular-nums"
                      />

                      {/* Quick Stepper Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[-50, -10, 10, 50].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => onUpdateOffset((audioOffset || 0) + step)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-serif font-medium text-zinc-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
                          >
                            {step > 0 ? `+${step}ms` : `${step}ms`}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => onUpdateOffset(0)}
                          disabled={audioOffset === 0}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-30 text-xs text-zinc-400 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
                        >
                          Reset to 0ms
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Track Tempo & Colors Rhythm Sync */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Track Tempo & Rhythm Sync</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {currentBpm ? `Current tempo: ${currentBpm} BPM` : 'No custom tempo set · Auto-detected during playback'}
                    </div>
                  </div>
                  {onOpenBpmModal && (
                    <button
                      type="button"
                      onClick={onOpenBpmModal}
                      className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shadow-sm"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Find Tempo</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 5. LABS & EXPERIMENTAL */}
          {(activeCategory === 'experimental' || query) && matchesSearch('Labs Experimental Timeline DAW Track Editor Features') && (
            <section className="bg-[#141418] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Experimental Labs</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Preview experimental studio capabilities before they become default.
                </p>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <div className="text-xs font-semibold text-white">Audio Timeline Track Editor</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Horizontal multitrack timeline with interactive draggable lyric timing clips.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ enableTimelineEditor: !settings.enableTimelineEditor })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-4 ${
                      settings.enableTimelineEditor ? 'bg-white' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full transition-transform absolute top-1 left-1 ${
                        settings.enableTimelineEditor ? 'translate-x-5 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
