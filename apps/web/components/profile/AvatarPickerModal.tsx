'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Smile,
  Image as ImageIcon,
  Film,
  Check,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import {
  getAvatarCatalog,
  STARTER_AVATARS,
  AvatarItem,
} from '@/lib/avatarCatalog';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onSelectAvatar: (url: string) => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onSelectAvatar,
}) => {
  const [catalog, setCatalog] = useState<AvatarItem[]>(STARTER_AVATARS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'memes' | 'gifs'>('all');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [, startTransition] = useTransition();

  // Load full catalog when modal opens
  useEffect(() => {
    if (isOpen) {
      getAvatarCatalog().then((items) => {
        setCatalog(items);
      });
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Client-side instant filter (0 network queries)
  const filteredAvatars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (selectedCategory === 'memes' && item.animated) return false;
      if (selectedCategory === 'gifs' && !item.animated) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }, [catalog, searchQuery, selectedCategory]);

  const handleSelect = (url: string) => {
    onSelectAvatar(url);
    onClose();
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (trimmed) {
      handleSelect(trimmed);
    }
  };

  const handleRemoveAvatar = () => {
    onSelectAvatar('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="relative w-full max-w-2xl bg-[#09090b] border border-white/[0.09] rounded-3xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden font-sans text-zinc-100"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#0d0d11]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-white">
              <Smile className="w-4 h-4 text-zinc-200" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white tracking-tight">
                Profile Pictures
              </h3>
              <p className="text-xs text-zinc-400">
                Choose a classic meme or animated GIF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentAvatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-2.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-red-400 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Remove current picture"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 sm:px-6 border-b border-white/[0.06] bg-[#0c0c10]/60 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  startTransition(() => {
                    setSearchQuery(val);
                  });
                }}
                placeholder="Search pictures (e.g. cat, doge, dance)..."
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 shrink-0 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({catalog.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('memes')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'memes'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>Memes (363)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('gifs')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'gifs'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Film className="w-3 h-3" />
                <span>GIFs (100)</span>
              </button>
            </div>
          </div>

          {/* Custom Link Toggle */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
            <span>Click any picture to select it immediately</span>
            <button
              type="button"
              onClick={() => setShowCustomInput((prev) => !prev)}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer underline underline-offset-4"
            >
              <LinkIcon className="w-3 h-3" />
              <span>{showCustomInput ? 'Hide link input' : 'Paste custom image link'}</span>
            </button>
          </div>

          {/* Collapsible Custom URL Input */}
          {showCustomInput && (
            <form onSubmit={handleApplyCustomUrl} className="flex gap-2 pt-1">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.gif"
                className="flex-1 h-8 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!customUrlInput.trim()}
                className="h-8 px-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                Use Link
              </button>
            </form>
          )}
        </div>

        {/* Gallery Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto min-h-[300px] max-h-[56vh]">
          {filteredAvatars.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
              {catalog.length === 0 ? (
                <>
                  <p>Profile picture images are not included in this repository.</p>
                  <p>See docs/ASSETS.md for the asset policy and add your own under public/avatars.</p>
                </>
              ) : (
                <>
                  <p>No pictures match "{searchQuery}"</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-zinc-300 hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
              {filteredAvatars.map((item) => {
                const isSelected = currentAvatarUrl === item.url;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.url)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                    className={`group relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-white shadow-lg shadow-white/10'
                        : 'border border-white/[0.08] hover:border-white/30'
                    }`}
                    title={item.name}
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover select-none transition-transform duration-200 group-hover:scale-105"
                    />

                    {/* Subtle label overlay on hover */}
                    <div className="absolute inset-x-0 bottom-0 py-1 px-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-white font-medium truncate max-w-full text-center">
                        {item.name}
                      </span>
                    </div>

                    {/* Animated GIF badge */}
                    {item.animated && (
                      <span className="absolute top-1 left-1 px-1 py-0.2 rounded-md bg-black/70 backdrop-blur-xs text-[8px] font-sans uppercase text-zinc-300 pointer-events-none">
                        GIF
                      </span>
                    )}

                    {/* Selection Checkmark */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-[#0c0c10] flex items-center justify-between text-xs text-zinc-400">
          <span>{filteredAvatars.length} pictures available</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
