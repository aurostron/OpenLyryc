'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Volume2,
  Clock,
  Split,
  Laptop,
  Keyboard,
  X,
} from 'lucide-react';

interface ShortcutsViewProps {
  onBack: () => void;
}

export const ShortcutsView: React.FC<ShortcutsViewProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');

  const shortcutGroups = [
    {
      category: 'Audio Playback',
      icon: Volume2,
      items: [
        { key: 'Space', desc: 'Toggle audio play and pause' },
        { key: 'Left / Right', desc: 'Nudge playhead by 100ms' },
        { key: 'Shift + Left / Right', desc: 'Fine nudge playhead by 10ms' },
        { key: '[ / ]', desc: 'Calibrate global latency: nudge ±10ms' },
        { key: 'Shift + [ / ]', desc: 'Calibrate global latency: nudge ±50ms' },
      ],
    },
    {
      category: 'Line Timing & Stamping',
      icon: Clock,
      items: [
        { key: 'Tab', desc: 'Stamp active line start time and advance' },
        { key: 'Shift + Tab', desc: 'Stamp active line end time' },
        { key: 'Up / Down', desc: 'Move active line selection cursor' },
        { key: 'Enter', desc: 'Split line at cursor or insert new line' },
        { key: 'Delete / Backspace', desc: 'Delete line when empty' },
      ],
    },
    {
      category: 'Word-Level Synchronization',
      icon: Split,
      items: [
        { key: 'A', desc: 'Stamp active word token start and advance to next token' },
        { key: 'D', desc: 'Step word token cursor forward without stamping' },
        { key: 'Shift + A', desc: 'Step word token cursor backward' },
        { key: 'W', desc: 'Toggle word token emphasis (bold / accent)' },
        { key: 'Backspace', desc: 'Clear timestamp on current word token' },
      ],
    },
    {
      category: 'Editing & History',
      icon: Laptop,
      items: [
        { key: 'Ctrl + Z', desc: 'Undo last change' },
        { key: 'Ctrl + Y / Ctrl + Shift + Z', desc: 'Redo last change' },
        { key: 'Esc', desc: 'Return to lyric editor / close active view' },
        { key: 'Ctrl + Shift + O', desc: 'Replay intro sequence' },
      ],
    },
    {
      category: 'Timeline & Multi-Track',
      icon: Keyboard,
      items: [
        { key: 'V', desc: 'Select / Move Clip tool' },
        { key: 'C', desc: 'Razor / Split tool' },
        { key: 'S', desc: 'Toggle magnetic grid snapping' },
        { key: 'L', desc: 'Toggle loop playback on selected clip' },
      ],
    },
  ];

  const filteredGroups = shortcutGroups
    .map((grp) => ({
      ...grp,
      items: grp.items.filter(
        (item) =>
          item.key.toLowerCase().includes(query.toLowerCase()) ||
          item.desc.toLowerCase().includes(query.toLowerCase()) ||
          grp.category.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((grp) => grp.items.length > 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#0e0e12] border-b border-white/[0.08] px-6 md:px-8 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.1] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <h1 className="text-sm font-semibold text-white tracking-tight">Keyboard Shortcuts</h1>
        </div>

        <div className="text-xs text-zinc-500 font-sans hidden sm:inline">
          Esc to close
        </div>
      </header>

      {/* Main Full-Screen Body */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Prominent Centered Filter Search Bar */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search shortcuts by action or key (e.g. Space, Tab, Split)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#131318] border border-white/[0.12] focus:border-white/40 rounded-xl pl-11 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 space-y-2">
              <p className="text-sm font-medium text-zinc-400">No shortcuts matched &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-zinc-600">Try &ldquo;space&rdquo;, &ldquo;tab&rdquo;, or &ldquo;word sync&rdquo;.</p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const Icon = group.icon;
              return (
                <section
                  key={group.category}
                  className="bg-[#121217] border border-white/[0.08] rounded-xl p-5 md:p-6 space-y-3"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
                    <Icon className="w-4 h-4 text-zinc-400" />
                    <h2 className="text-xs font-semibold text-white tracking-wider uppercase">
                      {group.category}
                    </h2>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {group.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="py-2.5 flex items-center justify-between gap-4 text-xs"
                      >
                        <span className="text-zinc-300 font-normal leading-relaxed">
                          {item.desc}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.key.split(' / ').map((subKey, sIdx, arr) => (
                            <React.Fragment key={subKey}>
                              <kbd className="px-2 py-1 rounded bg-[#0b0b0e] border border-white/[0.12] text-[11px] font-sans font-medium text-zinc-200 shadow-xs">
                                {subKey}
                              </kbd>
                              {sIdx < arr.length - 1 && (
                                <span className="text-[10px] text-zinc-500 font-sans">or</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default ShortcutsView;
