'use client';

import React, { useState, useEffect } from 'react';
import { RevisionHistoryResponse, OpenLyricsDocument } from '@/types/lyrics';
import { fetchRevisionHistory } from '@/lib/apiClient';
import {
  ArrowLeft,
  History,
  GitCommit,
  Clock,
  RotateCcw,
  CheckCircle2,
  FileText,
  User,
  Hash,
  Loader2,
} from 'lucide-react';

interface RevisionHistoryViewProps {
  onBack: () => void;
  songId?: string;
  songTitle?: string;
  currentDocument?: OpenLyricsDocument;
  onRestoreRevision?: (rev: any) => void;
}

export const RevisionHistoryView: React.FC<RevisionHistoryViewProps> = ({
  onBack,
  songId = '',
  songTitle = 'Untitled Track',
  currentDocument,
  onRestoreRevision,
}) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RevisionHistoryResponse | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  useEffect(() => {
    if (songId) {
      loadHistory();
    } else {
      setHistory({
        songId: '',
        songTitle: songTitle || 'Untitled Track',
        artistName: '',
        currentRevisionHash: '0x0000000000',
        revisions: [],
      });
    }
  }, [songId, songTitle]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchRevisionHistory(songId);
      setHistory(data);
      if (data.revisions.length > 0) {
        setSelectedHash(data.revisions[0].hash);
      }
    } catch (err) {
      // Never let a network failure escape: this runs inside useEffect and an
      // unhandled rejection here tears down the whole studio tree.
      console.warn('[RevisionHistory] history fetch failed, showing local revisions:', err);
      setHistory({
        songId: '',
        songTitle: songTitle || 'Untitled Track',
        artistName: '',
        currentRevisionHash: '0x0000000000',
        revisions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const currentRevisions = history?.revisions || [];
  const selectedRevision = currentRevisions.find((r) => r.hash === selectedHash) || currentRevisions[0];

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
          <h1 className="text-sm font-semibold text-white tracking-tight">Revision History</h1>
          <span className="text-xs text-zinc-500 font-sans hidden sm:inline">
            · {songTitle}
          </span>
        </div>

        <div className="text-xs text-zinc-500 font-sans hidden sm:inline">
          Esc to close
        </div>
      </header>

      {/* Main Full-Screen Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Revision Timeline */}
        <div className="w-full md:w-[380px] bg-[#0e0e12] border-b md:border-b-0 md:border-r border-white/[0.08] p-5 overflow-y-auto custom-scrollbar flex flex-col shrink-0 gap-4 studio-chrome">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Saved Versions</h2>
            <span className="text-xs text-zinc-500 font-sans">
              {currentRevisions.length} {currentRevisions.length === 1 ? 'version' : 'versions'}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Fetching revisions...</span>
            </div>
          ) : currentRevisions.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mx-auto">
                <GitCommit className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-zinc-300">No revisions yet</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                Publish this track to record your first permanent revision checkpoint.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentRevisions.map((rev, index) => {
                const isSelected = rev.hash === selectedHash;
                const isLatest = index === 0;
                return (
                  <button
                    key={rev.hash}
                    type="button"
                    onClick={() => setSelectedHash(rev.hash)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-white/[0.08] border-white/30 ring-1 ring-white/20'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-xs font-bold text-white font-sans">
                          {rev.hash.substring(0, 8)}
                        </span>
                      </div>
                      {isLatest && (
                        <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-300 truncate">
                      {rev.commitMessage || 'Sync checkpoint snapshot'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-sans pt-1 border-t border-white/[0.04]">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{rev.authorHandle || 'Anonymous'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Recent'}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Revision Details & Lyrics Preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070709]">
          {selectedRevision ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] bg-[#0c0c10] space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Revision Details</span>
                    <span className="text-[11px] font-sans text-zinc-500">({selectedRevision.hash})</span>
                  </div>
                  {onRestoreRevision && (
                    <button
                      type="button"
                      onClick={() => onRestoreRevision(selectedRevision)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Restore This Revision</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-300">
                  {selectedRevision.commitMessage || 'No commit message specified'}
                </p>
                <div className="flex flex-wrap gap-4 text-[11px] text-zinc-400 font-sans pt-1">
                  <span>Author: {selectedRevision.authorHandle || 'Anonymous'}</span>
                  <span>Date: {selectedRevision.createdAt ? new Date(selectedRevision.createdAt).toLocaleString() : 'Recent'}</span>
                  {selectedRevision.lineCount && <span>Lines: {selectedRevision.lineCount}</span>}
                </div>
              </div>

              {/* Lyrics Content Preview */}
              <div className="flex-1 overflow-auto p-6 custom-scrollbar space-y-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                  Snapshot Lyrics
                </h3>
                {currentDocument?.lines && currentDocument.lines.length > 0 ? (
                  <div className="space-y-1 font-sans text-xs">
                    {currentDocument.lines.map((line: any, idx: number) => (
                      <div
                        key={idx}
                        className="py-1 px-3 rounded-lg hover:bg-white/[0.03] flex items-baseline gap-4"
                      >
                        <span className="text-zinc-600 text-[11px] w-12 text-right shrink-0">
                          {line.start !== undefined ? `${line.start.toFixed(2)}s` : '--'}
                        </span>
                        <span className="text-zinc-200">{line.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    <p>Current active document matches this checkpoint.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
              Select a revision from the timeline to inspect its snapshot and diff.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
