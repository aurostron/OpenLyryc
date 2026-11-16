'use client';

import React, { useState } from 'react';

interface PasteLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportText: (text: string) => void;
}

export const PasteLyricsModal: React.FC<PasteLyricsModalProps> = ({
  isOpen,
  onClose,
  onImportText,
}) => {
  const [text, setText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onImportText(text);
      setText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg glass-modal-3d rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-zinc-100 animate-modal-pop-3d">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <span className="material-symbols-outlined text-lg">text_snippet</span>
            <span>Paste Lyrics (LRC, TTML, Text)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-zinc-400">
            Paste plain lyrics, timestamped LRC, or Apple Music / W3C TTML XML below:
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={`Waiting in a car\nWaiting for a ride in the dark\n\nOr paste [00:12.34] Timestamped LRC / <tt> TTML XML`}
            className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl outline-none p-3.5 text-xs font-sans text-zinc-100 placeholder:text-zinc-600 custom-scrollbar resize-none transition-all"
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-all cursor-pointer shadow-md shadow-white/10"
            >
              Import Lyrics
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
