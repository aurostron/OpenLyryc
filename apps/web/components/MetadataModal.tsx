'use client';

import React, { useState } from 'react';
import { LyricMetadata } from '@/types/lyrics';
import {
  isCompanionPaired,
  getStoredPairCode,
  pairWithCompanion,
  unpairCompanion,
} from '@/lib/companionBridge';

interface MetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: LyricMetadata;
  onSave: (metadata: Partial<LyricMetadata>) => void;
}

export const MetadataModal: React.FC<MetadataModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onSave,
}) => {
  const [form, setForm] = useState<LyricMetadata>({ ...metadata });
  const [isPaired, setIsPaired] = useState(() => isCompanionPaired());
  const [pairCode] = useState(() => {
    const existing = getStoredPairCode();
    if (existing) return existing;
    return Math.floor(1000 + Math.random() * 9000).toString();
  });
  const [inputCode, setInputCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f0f12] p-6 shadow-2xl space-y-4 font-sans text-zinc-100">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <span className="material-symbols-outlined text-lg">tag</span>
            <span>Track Metadata</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Song Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Artist Name</label>
            <input
              type="text"
              value={form.artist}
              onChange={(e) => setForm({ ...form, artist: e.target.value })}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Album Title</label>
            <input
              type="text"
              value={form.album || ''}
              onChange={(e) => setForm({ ...form, album: e.target.value })}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Synced By</label>
            <input
              type="text"
              value={form.syncedBy}
              onChange={(e) => setForm({ ...form, syncedBy: e.target.value })}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white focus:outline-none focus:border-white/40"
            />
          </div>

          {/* Desktop Companion Link */}
          <div className="pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Desktop Companion</span>
              {isPaired ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Linked
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
                  Not Linked
                </span>
              )}
            </div>

            {isPaired ? (
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
                <span className="text-[11px] font-sans text-zinc-400">127.0.0.1:4040</span>
                <button
                  type="button"
                  onClick={async () => {
                    await unpairCompanion();
                    setIsPaired(false);
                  }}
                  className="px-2 py-1 text-[11px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition cursor-pointer"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Pairing Code:</span>
                  <span className="font-sans font-bold text-white tracking-widest bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    {pairCode}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={4}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter code"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-center font-sans text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    disabled={isLinking || (!inputCode && !pairCode)}
                    onClick={async () => {
                      const code = inputCode.trim() || pairCode;
                      setIsLinking(true);
                      setLinkMsg(null);
                      const res = await pairWithCompanion(code);
                      setIsLinking(false);
                      if (res.ok && res.paired) {
                        setIsPaired(true);
                        setLinkMsg('Linked!');
                      } else {
                        setLinkMsg(res.message || 'Link failed');
                      }
                    }}
                    className="px-3 py-1 bg-white text-zinc-950 hover:bg-zinc-200 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                  >
                    {isLinking ? 'Linking...' : 'Link'}
                  </button>
                </div>
                {linkMsg && (
                  <p className="text-[11px] text-zinc-400">{linkMsg}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-zinc-200 text-zinc-950 transition shadow-md shadow-white/10 cursor-pointer"
            >
              Save Metadata
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
