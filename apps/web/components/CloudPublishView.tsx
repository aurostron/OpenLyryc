'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  OpenLyricsDocument,
  CreateRevisionResponse,
  SongSearchResult,
  DuplicateCheckResponse,
} from '@openlyryc/schema';
import {
  publishRevision,
  getLastPublishedDocument,
  checkDuplicate,
} from '@/lib/apiClient';
import {
  resolveCanonicalSongKey,
  parseYouTubeMusicId,
  parseSpotifyTrackId,
  normalizeIsrc,
  validateAndExtractPlatformLink,
  PlatformValidationResult,
} from '@/lib/platformLinker';
import { computeDocumentDiff, metadataFieldLabel, DiffHunk, isMeaningfulChange } from '@/lib/diffEngine';
import { computeLyricsHash, computeLyricsSimHash } from '@/lib/lyricsFingerprint';
import {
  ArrowLeft,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitCommit,
  Link2,
  FileText,
  User,
  ExternalLink,
} from 'lucide-react';

interface CloudPublishViewProps {
  onBack: () => void;
  document: OpenLyricsDocument;
  onPublished?: (res: CreateRevisionResponse) => void;
  onOpenSidebar?: () => void;
}

export const CloudPublishView: React.FC<CloudPublishViewProps> = ({
  onBack,
  document,
  onPublished,
  onOpenSidebar,
}) => {
  const [authorHandle, setAuthorHandle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<CreateRevisionResponse | null>(null);
  const [mergeApproved, setMergeApproved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Platform Link Input
  const [platformInput, setPlatformInput] = useState('');
  const [attachedPlatform, setAttachedPlatform] = useState<PlatformValidationResult | null>(null);

  // Auto-detect existing attached platforms
  useEffect(() => {
    if (document.metadata.youtubeId) {
      setAttachedPlatform({
        valid: true,
        platform: 'youtube',
        id: document.metadata.youtubeId,
        label: 'YouTube Video',
      });
    } else if (document.metadata.spotifyId) {
      setAttachedPlatform({
        valid: true,
        platform: 'spotify',
        id: document.metadata.spotifyId,
        label: 'Spotify Track',
      });
    }
  }, [document.metadata.youtubeId, document.metadata.spotifyId]);

  const handleValidateLink = () => {
    const res = validateAndExtractPlatformLink(platformInput);
    if (res.valid) {
      setAttachedPlatform(res);
      setPlatformInput('');
    }
  };

  const canonicalKey = useMemo(() => {
    return (
      document.metadata.canonicalKey ||
      resolveCanonicalSongKey({
        artist: document.metadata.artist || 'Unknown',
        title: document.metadata.title || 'Untitled',
      })
    );
  }, [document.metadata.canonicalKey, document.metadata.artist, document.metadata.title]);

  const { diff, isFirstPublish } = useMemo(() => {
    const baseline = getLastPublishedDocument(canonicalKey);
    const computed = computeDocumentDiff(baseline, document);
    return { diff: computed, isFirstPublish: baseline === null };
  }, [canonicalKey, document]);

  const handlePublish = async () => {
    if (!commitMessage.trim()) return;
    setPublishing(true);
    try {
      const res = await publishRevision({
        title: document.metadata.title,
        artist: document.metadata.artist,
        album: document.metadata.album,
        commitMessage,
        authorHandle,
        allowMerge: mergeApproved,
        isVariant: false,
        document: {
          ...document,
          metadata: {
            ...document.metadata,
            canonicalKey,
          },
        },
      });
      setResult(res);
      if (onPublished) onPublished(res);
    } catch (e: any) {
      setErrorMsg(`Publish error: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-13 bg-[#111115] border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer text-xs font-semibold shadow-sm"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.25]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <div className="flex items-center gap-2">
            <CloudUpload className="w-4 h-4 text-zinc-300" />
            <h1 className="text-sm font-bold text-white tracking-tight">Publish Song Revision</h1>
            <span className="text-xs text-zinc-500 font-sans hidden sm:inline">
              · {document.metadata.title || 'Untitled'}
            </span>
          </div>
        </div>

        {!result && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || !commitMessage.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer shadow-sm"
          >
            {publishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Publish Revision</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* Main Full-Screen Body */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {result ? (
            /* Success Card */
            <div className="p-8 rounded-2xl bg-[#121217] border border-white/[0.08] text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Revision Published Successfully</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Revision hash: <code className="font-sans text-zinc-300">{result.revisionHash}</code>
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-5 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
                  <span>{errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="text-zinc-400 hover:text-white text-base leading-none p-1 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Metadata & Attribution Card */}
              <section className="bg-[#121217] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-sm">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">Revision Metadata</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Describe what was synchronized or modified in this version.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-300">
                      Commit Message <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="e.g. Precise word sync for chorus and fixed typo in verse 2..."
                      className="w-full bg-[#181820] border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-300">Author Handle / GitHub</label>
                    <input
                      type="text"
                      value={authorHandle}
                      onChange={(e) => setAuthorHandle(e.target.value)}
                      placeholder="@yourname or contributor tag"
                      className="w-full bg-[#181820] border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* Platform Linking */}
              <section className="bg-[#121217] border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Audio Source Association</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Link a YouTube or Spotify track ID so others can play the matching audio directly.
                  </p>
                </div>

                {attachedPlatform ? (
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Link2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white">{attachedPlatform.label}</span>
                        <span className="text-xs text-zinc-400 font-sans block">{attachedPlatform.id}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedPlatform(null)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={platformInput}
                      onChange={(e) => setPlatformInput(e.target.value)}
                      placeholder="Paste YouTube or Spotify track URL..."
                      className="flex-1 bg-[#181820] border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleValidateLink}
                      className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] font-bold text-xs text-white"
                    >
                      Attach
                    </button>
                  </div>
                )}
              </section>

              {/* Diff Inspection Card */}
              <section className="bg-[#121217] border border-white/[0.08] rounded-2xl p-6 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Change Summary</h3>
                  <span className="text-xs font-sans text-zinc-400">
                    {diff.length} {diff.length === 1 ? 'delta' : 'deltas'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#09090c] border border-white/[0.08] font-sans text-xs text-zinc-300 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {diff.length === 0 ? (
                    <p className="text-zinc-500 italic">First revision of this track or zero diff from baseline.</p>
                  ) : (
                    diff.map((h: DiffHunk, i: number) => (
                      <div key={i} className="flex items-baseline gap-2 py-0.5">
                        <span className="text-zinc-500 text-[10px] w-20 truncate">{h.field || 'line'}</span>
                        {h.before && <span className="text-red-400 line-through truncate max-w-xs">{h.before}</span>}
                        {h.after && <span className="text-emerald-400 truncate max-w-xs">{h.after}</span>}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
