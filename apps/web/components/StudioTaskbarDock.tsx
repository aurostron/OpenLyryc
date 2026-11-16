'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Undo2,
  Redo2,
  History,
  Search,
  ClipboardPaste,
  FileUp,
  Download,
  Users2,
  Settings2,
  Command,
  Puzzle,
  ArrowLeft,
  Edit3,
  SlidersHorizontal,
  Music,
  User,
  Radio,
} from 'lucide-react';
import { BetterLyricsLogo } from './unison/BetterLyricsLogo';
import { FramerateTarget } from '@/types/settings';
import { ViewTab } from '@/types/editor';

interface StudioTaskbarDockProps {
  onBackToEditor: () => void;
  onOpenProjects: () => void;
  onOpenMetadata?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenRevisions: () => void;
  onOpenCloudSearch: () => void;
  onOpenPasteLyrics: () => void;
  onTriggerImport: () => void;
  onOpenExport: () => void;
  onOpenCollab: () => void;
  collabConnected: boolean;
  collabPeerCount: number;
  onOpenPlugins?: () => void;
  onOpenSettings: () => void;
  onOpenKeybindings: () => void;
  onOpenUserProfile?: () => void;
  onOpenUnisonHub?: () => void;
  isUnisonConnected?: boolean;
  userDisplayName?: string;
  userAvatarUrl?: string;
  onToggleTimeline?: () => void;
  isTimelineOpen?: boolean;
  isTimelineEnabled?: boolean;
  framerateTarget?: FramerateTarget;
  activeView?: ViewTab;
  activeCategory?: string;
  activeHashView?: string;
}

export const StudioTaskbarDock: React.FC<StudioTaskbarDockProps> = ({
  onBackToEditor,
  onOpenProjects,
  onOpenMetadata,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenRevisions,
  onOpenCloudSearch,
  onOpenPasteLyrics,
  onTriggerImport,
  onOpenExport,
  onOpenCollab,
  collabConnected,
  collabPeerCount,
  onOpenPlugins,
  onOpenSettings,
  onOpenKeybindings,
  onOpenUserProfile,
  onOpenUnisonHub,
  isUnisonConnected = false,
  userDisplayName,
  userAvatarUrl,
  onToggleTimeline,
  isTimelineOpen,
  isTimelineEnabled = false,
  activeView,
  activeCategory,
  activeHashView,
}) => {
  // Determine which dock slot is active
  const activeDockSlot = React.useMemo(() => {
    if (activeHashView && activeHashView !== 'editor') {
      return activeHashView;
    }
    if (activeView === 'projects') return 'projects';
    if (activeView === 'settings') {
      if (activeCategory === 'revisions') return 'revisions';
      if (activeCategory === 'export') return 'export';
      if (activeCategory === 'plugins') return 'plugins';
      if (activeCategory === 'shortcuts') return 'shortcuts';
      return 'settings';
    }
    return 'editor';
  }, [activeHashView, activeView, activeCategory]);

  const isInSubView = activeDockSlot !== 'editor';
  const [avatarError, setAvatarError] = React.useState(false);

  React.useEffect(() => {
    setAvatarError(false);
  }, [userAvatarUrl]);

  return (
    <aside
      className="hidden md:flex flex-col items-center justify-between w-14 h-full bg-[#0a0a0d] border-r border-white/[0.08] py-3.5 select-none z-50 shrink-0 shadow-2xl studio-chrome"
      aria-label="Studio Actions Dock"
    >
      {/* Top Group: Back to Editor / Projects & Undo/Redo */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.button
          onClick={onBackToEditor}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title={isInSubView ? 'Back to Editor (Esc)' : 'Lyric Editor'}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer group text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'editor' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            {isInSubView ? (
              <ArrowLeft className="w-5 h-5 stroke-[2.25] text-zinc-200 group-hover:text-white transition-colors" />
            ) : (
              <Edit3 className="w-5 h-5 stroke-[2.25] text-zinc-200 group-hover:text-white transition-colors" />
            )}
          </span>
        </motion.button>

        <motion.button
          onClick={onOpenProjects}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Projects Library"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer group text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'projects' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <FolderOpen className="w-5 h-5 stroke-[2.25] text-zinc-300 group-hover:text-white transition-colors" />
          </span>
        </motion.button>

        {onOpenMetadata && (
          <motion.button
            onClick={onOpenMetadata}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            title="Track Metadata & Media"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer group text-zinc-400 hover:text-white"
          >
            {activeDockSlot === 'metadata' && (
              <motion.div
                layoutId="activeDockIndicator"
                className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
                transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              />
            )}
            <span className="relative z-10">
              <Music className="w-5 h-5 stroke-[2.25] text-zinc-300 group-hover:text-white transition-colors" />
            </span>
          </motion.button>
        )}

        <div className="w-6 h-[1px] bg-white/[0.08] my-1" />

        <motion.button
          onClick={onUndo}
          disabled={!canUndo}
          whileHover={canUndo ? { scale: 1.08 } : undefined}
          whileTap={canUndo ? { scale: 0.9 } : undefined}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Undo (Ctrl+Z)"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
        >
          <Undo2 className="w-5 h-5 stroke-[2.25]" />
        </motion.button>

        <motion.button
          onClick={onRedo}
          disabled={!canRedo}
          whileHover={canRedo ? { scale: 1.08 } : undefined}
          whileTap={canRedo ? { scale: 0.9 } : undefined}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Redo (Ctrl+Y)"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
        >
          <Redo2 className="w-5 h-5 stroke-[2.25]" />
        </motion.button>

        <motion.button
          onClick={onOpenRevisions}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Revision History"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'revisions' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <History className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>
      </div>

      {/* Middle Group: Search, Ingestion, Export & Workstation */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.button
          onClick={onOpenCloudSearch}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Lyrics search"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'search' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <Search className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>

        <motion.button
          onClick={onOpenPasteLyrics}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Paste Lyrics"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'paste' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <ClipboardPaste className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>

        <motion.button
          onClick={onTriggerImport}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Import Audio / LRC File"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <FileUp className="w-5 h-5 stroke-[2.25]" />
        </motion.button>

        <motion.button
          data-tutorial="dock-export"
          onClick={onOpenExport}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Export Lyrics"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'export' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <Download className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>

        {isTimelineEnabled && onToggleTimeline && (
          <motion.button
            onClick={onToggleTimeline}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            title={isTimelineOpen ? 'Collapse timeline' : 'Expand timeline'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isTimelineOpen
                ? 'bg-white/10 text-white ring-1 ring-white/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2.25]" />
          </motion.button>
        )}

        <motion.button
          onClick={onOpenCollab}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title={collabConnected ? `Connected (${collabPeerCount})` : 'Live Collaboration'}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            collabConnected
              ? 'bg-white/10 text-white ring-1 ring-white/15'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {activeDockSlot === 'collab' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <Users2 className="w-5 h-5 stroke-[2.25]" />
          </span>
          {collabConnected && (
            <span className="absolute top-2 right-2 flex h-2 w-2 z-20">
              <motion.span
                animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 ring-2 ring-[#0a0a0d]" />
            </span>
          )}
        </motion.button>
      </div>

      {/* Bottom Group: Unison, Profile, Plugins, Settings, Shortcuts */}
      <div className="flex flex-col items-center gap-1.5">
        {onOpenUnisonHub && (
          <motion.button
            onClick={onOpenUnisonHub}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            title="Unison (#unison)"
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              activeHashView === 'unison'
                ? 'bg-white/[0.1] text-white shadow-inner'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center">
              <BetterLyricsLogo size={20} variant="color" className="drop-shadow-sm transition-transform group-hover:scale-105" />
            </span>
            {activeHashView === 'unison' && (
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#F20C32] rounded-r-full" />
            )}
          </motion.button>
        )}

        {onOpenUserProfile && (
          <motion.button
            onClick={onOpenUserProfile}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            title={`Profile (${userDisplayName || 'Lyricist'})`}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white group"
          >
            {userAvatarUrl && !avatarError ? (
              <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/15 group-hover:ring-white/40 transition-all select-none shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName || 'Profile'}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-white/[0.08] ring-1 ring-white/10 group-hover:ring-white/20 transition-all flex items-center justify-center text-xs font-medium text-zinc-300 group-hover:text-white select-none">
                <User className="w-4 h-4 stroke-[2]" />
              </div>
            )}
            {isUnisonConnected && (
              <span className="absolute top-1 right-1 flex h-2 w-2 z-20" title="Unison Connected">
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#09090b]" />
              </span>
            )}
          </motion.button>
        )}

        {onOpenPlugins && (
          <motion.button
            onClick={onOpenPlugins}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
            title="Plugins & Add-ons"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
          >
            {activeDockSlot === 'plugins' && (
              <motion.div
                layoutId="activeDockIndicator"
                className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
                transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              />
            )}
            <span className="relative z-10">
              <Puzzle className="w-5 h-5 stroke-[2.25]" />
            </span>
          </motion.button>
        )}

        <motion.button
          onClick={onOpenSettings}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Studio Settings"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'settings' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <Settings2 className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>

        <motion.button
          onClick={onOpenKeybindings}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          title="Keyboard Shortcuts (?)"
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-zinc-400 hover:text-white"
        >
          {activeDockSlot === 'shortcuts' && (
            <motion.div
              layoutId="activeDockIndicator"
              className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/20 shadow-sm"
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            />
          )}
          <span className="relative z-10">
            <Command className="w-5 h-5 stroke-[2.25]" />
          </span>
        </motion.button>
      </div>
    </aside>
  );
};
