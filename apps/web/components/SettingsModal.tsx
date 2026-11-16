'use client';

import React, { useState } from 'react';
import { AppSettings, FramerateTarget, VideoDisplayMode } from '@/types/settings';
import { StageFontControls } from './StageFontControls';
import { BackdropControls } from './BackdropControls';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUploadBackdrop?: (file: File) => void;
}

type SettingsTab = 'video' | 'typography' | 'custom' | 'performance' | 'experimental';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onUploadBackdrop,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('video');

  if (!isOpen) return null;

  const currentOpacity = settings.videoBackdropOpacity ?? 0.35;
  const currentBlur = settings.videoBackdropBlur ?? 0;
  const currentVideoMode = settings.videoDisplayMode ?? 'pip';

  const navItems = [
    { id: 'video' as const, label: 'Video & Backdrop', icon: 'wallpaper' },
    { id: 'typography' as const, label: 'Typography & Text', icon: 'text_fields' },
    { id: 'custom' as const, label: 'Customization', icon: 'image' },
    { id: 'performance' as const, label: 'Display & Framerate', icon: 'speed' },
    { id: 'experimental' as const, label: 'Labs', icon: 'science' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 glass-modal-3d-backdrop animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* Native Desktop Window Frame */}
      <div
        className="w-full max-w-3xl h-[500px] max-h-[85vh] bg-[#0c0c11]/95 backdrop-blur-2xl text-zinc-100 rounded-2xl border border-white/[0.12] shadow-2xl shadow-black/80 flex flex-col relative overflow-hidden font-sans animate-modal-pop-3d"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Title Bar */}
        <div className="h-11 px-4 bg-white/[0.03] border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 transition-all cursor-pointer flex items-center justify-center group"
                title="Close"
              >
                <span className="material-symbols-outlined text-[8px] text-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                  close
                </span>
              </button>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]/80" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]/80" />
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-white">Preferences</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">
              Early Beta
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Master-Detail Multi-Pane Window Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Sidebar */}
          <aside className="w-52 bg-white/[0.02] border-r border-white/[0.06] p-3 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-zinc-950 font-bold shadow-md shadow-black/20'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg ${
                        isActive ? 'text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-xs font-medium truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Detail Pane */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* ── TAB: VIDEO & BACKDROP ── */}
            {activeTab === 'video' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-white tracking-tight">Video Display</h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ videoDisplayMode: 'pip' })}
                    className={`p-3.5 rounded-xl border flex flex-col text-left transition-all cursor-pointer ${
                      currentVideoMode === 'pip'
                        ? 'bg-white text-zinc-950 border-white shadow-lg font-bold'
                        : 'bg-white/[0.03] text-zinc-300 border-white/[0.07] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl mb-1">picture_in_picture_alt</span>
                    <span className="text-xs font-semibold">Floating PiP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ videoDisplayMode: 'backdrop' })}
                    className={`p-3.5 rounded-xl border flex flex-col text-left transition-all cursor-pointer ${
                      currentVideoMode === 'backdrop'
                        ? 'bg-white text-zinc-950 border-white shadow-lg font-bold'
                        : 'bg-white/[0.03] text-zinc-300 border-white/[0.07] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl mb-1">wallpaper</span>
                    <span className="text-xs font-semibold">Backdrop</span>
                  </button>
                </div>

                {/* Backdrop Sliders */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-300 font-medium">Brightness</span>
                      <span className="text-xs font-sans text-white font-semibold">
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
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-sans">
                      <span>10%</span>
                      <span>35%</span>
                      <span>80%</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-300 font-medium">Blur</span>
                      <span className="text-xs font-sans text-white font-semibold">
                        {currentBlur === 0 ? 'Off' : `${currentBlur}px`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Off', blur: 0 },
                        { label: '4px', blur: 4 },
                        { label: '12px', blur: 12 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onUpdateSettings({ videoBackdropBlur: preset.blur })}
                          className={`px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer text-center ${
                            currentBlur === preset.blur
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

                {/* Resolution */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                  <div className="text-xs text-zinc-300 font-medium">Resolution</div>
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
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-sans transition-all cursor-pointer ${
                          (settings.videoQualityPreference ?? 'default') === q.val
                            ? 'bg-white text-zinc-950 font-bold border-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: STAGE TYPOGRAPHY & TEXT ── */}
            {activeTab === 'typography' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Stage Typography</h3>
                  <span className="text-[11px] font-sans text-zinc-400">All View Modes</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <StageFontControls
                    fontFamily={settings.stageFontFamily ?? 'poppins'}
                    fontWeight={settings.stageFontWeight ?? '500'}
                    showPositionControls={false}
                    onChange={(patch) => onUpdateSettings(patch)}
                  />
                </div>

                {/* Dedicated Mountain Peak Layout Controls */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-emerald-400">terrain</span>
                      <h4 className="text-xs font-bold text-white tracking-tight">Positioning & Scale</h4>
                    </div>
                  </div>

                  {/* Text Size */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">Text Size</span>
                      <span className="font-sans text-white text-[10px]">{(settings.peakFontSize ?? 1.0).toFixed(2)}x</span>
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
                  </div>

                  {/* Horizontal Position X */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">Position X (Horizontal)</span>
                      <span className="font-sans text-white text-[10px]">
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
                  </div>

                  {/* Vertical Position Y */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">Position Y (Ridge Height)</span>
                      <span className="font-sans text-white text-[10px]">{settings.peakTextY ?? 16}% from top</span>
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
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: PERFORMANCE & DISPLAY ── */}
            {activeTab === 'performance' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-white tracking-tight">Display & Framerate</h3>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ framerateTarget: 'max' })}
                    className={`p-3 rounded-xl border flex flex-col text-center items-center transition-all cursor-pointer ${
                      settings.framerateTarget === 'max'
                        ? 'bg-white text-zinc-950 border-white shadow-lg font-bold'
                        : 'bg-white/[0.03] text-zinc-300 border-white/[0.07] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg mb-1">bolt</span>
                    <span className="text-xs font-semibold">Max (Native)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ framerateTarget: '60' })}
                    className={`p-3 rounded-xl border flex flex-col text-center items-center transition-all cursor-pointer ${
                      settings.framerateTarget === '60'
                        ? 'bg-white text-zinc-950 border-white shadow-lg font-bold'
                        : 'bg-white/[0.03] text-zinc-300 border-white/[0.07] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg mb-1">speed</span>
                    <span className="text-xs font-semibold">60 FPS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ framerateTarget: '30' })}
                    className={`p-3 rounded-xl border flex flex-col text-center items-center transition-all cursor-pointer ${
                      settings.framerateTarget === '30'
                        ? 'bg-white text-zinc-950 border-white shadow-lg font-bold'
                        : 'bg-white/[0.03] text-zinc-300 border-white/[0.07] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg mb-1">energy_savings_leaf</span>
                    <span className="text-xs font-semibold">30 FPS</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-xs font-medium text-zinc-200">Show FPS counter</span>
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

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-xs font-medium text-zinc-200">Hardware acceleration</span>
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
            )}

            {/* ── TAB: CUSTOMIZATION (global Studio backdrop) ── */}
            {activeTab === 'custom' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-white tracking-tight">Customization</h3>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <BackdropControls
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                    onUploadBackdrop={onUploadBackdrop}
                  />
                </div>
              </div>
            )}

            {/* ── TAB: LABS ── */}
            {activeTab === 'experimental' && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-white tracking-tight">Labs</h3>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div>
                    <div className="text-xs font-semibold text-white">Audio timeline track editor</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Visual audio timeline with draggable timing clips.
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
            )}
          </main>
        </div>

        {/* Window Footer Action Bar */}
        <div className="h-12 px-5 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

