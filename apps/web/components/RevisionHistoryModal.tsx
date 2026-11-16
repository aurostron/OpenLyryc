'use client';

import React, { useState, useEffect } from 'react';
import { RevisionHistoryResponse, OpenLyricsDocument } from '@/types/lyrics';
import { fetchRevisionHistory } from '@/lib/apiClient';

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId?: string;
  songTitle?: string;
  currentDocument?: OpenLyricsDocument;
}

export const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({
  isOpen,
  onClose,
  songId = '',
  songTitle = 'Untitled Track',
  currentDocument
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RevisionHistoryResponse | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (songId) {
      loadHistory();
    } else {
      setHistory({
        songId: '',
        songTitle: songTitle || 'Untitled Track',
        artistName: '',
        currentRevisionHash: '0x0000000000',
        revisions: []
      });
    }
  }, [isOpen, songId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchRevisionHistory(songId);
      setHistory(data);
      if (data.revisions.length > 0) {
        setSelectedHash(data.revisions[0].hash);
      }
    } catch (err) {
      console.warn('[RevisionHistoryModal] history fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentRevisions = history?.revisions || [];
  const selectedRevision = currentRevisions.find(r => r.hash === selectedHash) || currentRevisions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl glass-modal-3d rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-zinc-100 font-sans overflow-hidden animate-modal-pop-3d">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white text-xl">account_tree</span>
            <div>
              <h2 className="font-bold text-white text-base tracking-tight">Revision History</h2>
              <p className="text-xs text-zinc-400">{songTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Commit History List */}
          <div className="w-1/2 border-r border-white/[0.06] overflow-y-auto p-4 space-y-3 bg-white/[0.01] custom-scrollbar">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2">
              Revisions
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-zinc-400">
                <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
              </div>
            ) : currentRevisions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mx-auto">
                  <span className="material-symbols-outlined text-xl">commit</span>
                </div>
                <p className="text-xs font-semibold text-zinc-300">No revisions yet</p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Publish this track to record your first revision.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentRevisions.map((rev) => {
                  const isSelected = rev.hash === selectedHash;
                  return (
                    <div
                      key={rev.hash}
                      onClick={() => setSelectedHash(rev.hash)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/30 text-white shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-300 hover:bg-white/[0.05] hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between font-sans text-[11px] mb-1.5">
                        <span className="text-emerald-400 font-bold">{rev.hash}</span>
                        <span className="text-zinc-500 font-sans">{new Date(rev.createdAt).toLocaleDateString()}</span>
                      </div>

                      <p className="font-semibold text-white mb-2 line-clamp-1">
                        {rev.commitMessage}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>by <strong className="text-zinc-200">{rev.authorHandle}</strong></span>
                        <span className="text-emerald-400 font-semibold tabular-nums">
                          Quality: {((rev.qualityScore ?? 0.98) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Revision Details & Line Diff View */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {selectedRevision ? (
              <>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 mb-2">
                    Commit Summary
                  </h4>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Hash:</span>
                      <span className="text-emerald-400 font-sans font-bold">{selectedRevision.hash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Author:</span>
                      <span className="text-white font-medium">{selectedRevision.authorHandle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sync Mode:</span>
                      <span className="text-white font-medium">{selectedRevision.hasWordSync ? 'Word Sync' : 'Line Sync'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Quality Score:</span>
                      <span className="text-emerald-400 font-bold tabular-nums">{((selectedRevision.qualityScore ?? 0.98) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 mb-2">
                    Line Diff Preview
                  </h4>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-2">
                    {currentDocument?.lines.map((line, idx) => (
                      <div key={line.id || idx} className="flex items-center gap-2.5 py-1 border-b border-white/[0.04] text-xs">
                        <span className="text-emerald-400 font-bold font-sans">+</span>
                        <span className="text-zinc-500 tabular-nums font-sans text-[11px]">[{line.start.toFixed(2)}]</span>
                        <span className="text-zinc-100 flex-1 font-medium">{line.text}</span>
                        {line.tokens && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            {line.tokens.length} words
                          </span>
                        )}
                      </div>
                    )) || (
                      <p className="text-zinc-500 italic text-xs">Load a song in the studio to preview line diffs.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-500">
                Select a revision commit to inspect details.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.02] flex justify-between items-center text-xs text-zinc-400">
          <span>Git-Style SHA-256 Immutable Tree</span>
          <button onClick={onClose} className="hover:text-white transition-colors cursor-pointer font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};
