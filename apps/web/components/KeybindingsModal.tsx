'use client';

import React from 'react';

interface KeybindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeybindingsModal: React.FC<KeybindingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Toggle audio play / pause' },
    { key: 'Tab', desc: 'Stamp start time for active line & advance' },
    { key: 'Shift + Tab', desc: 'Stamp end time for active line' },
    { key: 'A', desc: 'Stamp active word token start & step forward' },
    { key: 'D', desc: 'Advance word token focus forward' },
    { key: 'Shift + A', desc: 'Step word token focus backward' },
    { key: 'Up / Down', desc: 'Move active line focus cursor' },
    { key: 'Left / Right', desc: 'Nudge playhead by 100ms (Hold Shift for 10ms)' },
    { key: '[ / ]', desc: 'Live sync calibration nudge: ±10ms (Hold Shift for ±50ms)' },
    { key: 'Ctrl + Z', desc: 'Undo last timestamp or edit action' },
    { key: 'Ctrl + Shift + Z', desc: 'Redo last undone action' },
    { key: 'V / C', desc: 'Classic Mode: Select Tool (V) / Razor Split Tool (C)' },
    { key: 'S', desc: 'Classic Mode: Toggle snapping on clips & playhead' },
    { key: 'L', desc: 'Classic Mode: Toggle loop region on selected clip' },
    { key: 'Esc', desc: 'Unfocus input fields & return focus to hotkeys' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl glass-modal-3d p-6 shadow-2xl space-y-4 font-sans text-zinc-100 animate-modal-pop-3d">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <span className="material-symbols-outlined text-lg">keyboard</span>
            <span>Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <span className="text-xs font-medium text-zinc-300">{item.desc}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10 text-zinc-200 font-sans text-[11px] font-semibold">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-md shadow-white/10 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
