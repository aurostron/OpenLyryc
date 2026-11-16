'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, LogIn, ChevronDown, ArrowLeft, LogOut, User } from 'lucide-react';
import { BetterLyricsLogo } from './BetterLyricsLogo';
import type { UnisonStoredSession } from '@/lib/unison/types';

export type UnisonTabId = 'songs' | 'leaderboard' | 'about' | 'profile';

interface UnisonHeaderProps {
  activeTab: UnisonTabId;
  onTabChange: (tab: UnisonTabId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  session: UnisonStoredSession | null;
  onOpenAuth: () => void;
  onBack: () => void;
  curatorHandle?: string | null;
}

export const UnisonHeader: React.FC<UnisonHeaderProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  session,
  onOpenAuth,
  onBack,
  curatorHandle,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl + / or Cmd + / to focus search, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          onSearchChange('');
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, onSearchChange, onBack]);

  // Click outside listener for user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const navTabs: Array<{ id: UnisonTabId; label: string }> = [
    { id: 'songs', label: 'Songs' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'about', label: 'About' },
  ];

  const handleName = curatorHandle || session?.displayName || (session?.keyId ? `${session.keyId.slice(0, 8)}…` : null);

  return (
    <header className="sticky top-0 z-40 w-full bg-black/15 backdrop-blur-xl border-b border-white/[0.05] transition-colors select-none">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* ── 1. Unison Brand Logo (Identical to official Unison) ── */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('songs')}
            className="flex items-center gap-2.5 transition-transform active:scale-95 cursor-pointer"
            title="Unison by Better Lyrics"
          >
            <BetterLyricsLogo size={22} variant="color" />
            <span className="text-base font-medium text-white tracking-tight">Unison Hub</span>
          </button>
        </div>

        {/* ── 2. Glass Capsule Navigation Tabs (Official Unison layout: Songs, Leaderboard, About) ── */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-lg">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white/12 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── 3. Search Lyrics Pill (Ctrl / shortcut) ── */}
        <div className="flex-1 max-w-xs md:max-w-sm relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search lyrics"
            className="w-full h-9 pl-9 pr-14 rounded-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border border-white/[0.08] focus:border-white/20 text-xs text-white placeholder:text-zinc-500 outline-none transition-all shadow-inner font-normal"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-normal text-zinc-500 bg-white/[0.06] border border-white/[0.08]">
              Ctrl /
            </kbd>
          </div>
        </div>

        {/* ── 4. Right Controls: Exact Unison Curator Pill + Menu ── */}
        <div className="flex items-center gap-2 shrink-0">
          {session ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => onTabChange('profile')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                title={`${handleName} — Click to view profile`}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-white/15 border-white/25 text-white shadow-md'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300 hover:text-white'
                }`}
              >
                <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  {session.avatarUrl ? (
                    <img src={session.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-medium text-white">
                      {(session.displayName || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="max-w-[110px] truncate text-white font-medium">
                  {handleName}
                </span>
                <ChevronDown
                  className="w-3 h-3 text-zinc-400 hover:text-white ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                />
              </button>

              {/* Curator Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#141219]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-normal">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onTabChange('profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-normal text-zinc-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>View Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onBack();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-normal text-zinc-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Back to Studio</span>
                    </div>
                    <kbd className="text-[10px] text-zinc-500">Esc</kbd>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5 text-zinc-400" />
              <span>Connect</span>
            </button>
          )}

          {/* Minimal Esc Indicator / Back to Studio button */}
          <button
            type="button"
            onClick={onBack}
            title="Return to Studio (Esc)"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-normal text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <span>Studio</span>
            <kbd className="text-[9px] px-1 py-0.2 bg-white/[0.06] rounded border border-white/[0.08]">Esc</kbd>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Tabs Bar */}
      <div className="md:hidden flex items-center justify-around px-4 py-2 border-t border-white/[0.05] overflow-x-auto gap-2">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                isActive ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
