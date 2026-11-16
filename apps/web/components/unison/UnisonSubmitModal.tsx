'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  X,
  Key,
  AlertCircle,
} from 'lucide-react';
import type { OpenLyricsDocument } from '@/types/lyrics';
import { exportTTML } from '@/lib/ttmlSerializer';
import { exportLRC } from '@/lib/lrcParser';
import { validateDocumentForUnison } from '@/lib/unison/validator';
import { loadUnisonSession } from '@/lib/unison/authService';
import { submitLyricsToUnison, fetchUnisonUserSubmissions } from '@/lib/unison/apiClient';
import { BetterLyricsLogo } from './BetterLyricsLogo';
import type { UnisonStoredSession, UnisonSubmitPayload, UnisonUserSubmission } from '@/lib/unison/types';

interface UnisonSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: OpenLyricsDocument;
  onOpenProfile?: () => void;
}

export const UnisonSubmitModal: React.FC<UnisonSubmitModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onOpenProfile,
}) => {
  const [session, setSession] = useState<UnisonStoredSession | null>(null);
  const [videoId, setVideoId] = useState<string>('');
  const [format, setFormat] = useState<'ttml' | 'lrc'>('ttml');
  const [certifiedNonAi, setCertifiedNonAi] = useState<boolean>(true);

  // Duplicate prevention state
  const [existingSubmission, setExistingSubmission] = useState<UnisonUserSubmission | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState<boolean>(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState<boolean>(false);

  // Submission lifecycle states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load session and videoId from doc on open
  useEffect(() => {
    if (isOpen) {
      setSession(loadUnisonSession());
      setVideoId(doc.metadata.youtubeId || '');
      setSubmitError(null);
      setSubmittedId(null);
      setExistingSubmission(null);
      setConfirmDuplicate(false);
    }
  }, [isOpen, doc.metadata.youtubeId]);

  // Pre-flight document validation
  const validation = useMemo(() => validateDocumentForUnison(doc), [doc]);

  // Clean video ID extraction (handles full URLs or bare IDs)
  const cleanVideoId = useMemo(() => {
    const raw = videoId.trim();
    if (!raw) return '';
    const match = raw.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|^)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : raw;
  }, [videoId]);

  // Check for prior submissions by this user for the current video ID
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !session?.keyId || cleanVideoId.length !== 11) {
      setExistingSubmission(null);
      setConfirmDuplicate(false);
      return;
    }

    setIsCheckingExisting(true);
    fetchUnisonUserSubmissions(session.keyId, { limit: 50 })
      .then((res) => {
        if (!isMounted) return;
        const match = (res.submissions || []).find((s) => s.videoId === cleanVideoId);
        setExistingSubmission(match || null);
      })
      .catch(() => {
        if (isMounted) setExistingSubmission(null);
      })
      .finally(() => {
        if (isMounted) setIsCheckingExisting(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, session?.keyId, cleanVideoId]);

  const canSubmit = useMemo(() => {
    return (
      validation.ok &&
      cleanVideoId.length === 11 &&
      session?.privateKeyJwk &&
      certifiedNonAi &&
      !isSubmitting &&
      (!existingSubmission || confirmDuplicate)
    );
  }, [
    validation.ok,
    cleanVideoId,
    session?.privateKeyJwk,
    certifiedNonAi,
    isSubmitting,
    existingSubmission,
    confirmDuplicate,
  ]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!session || !session.privateKeyJwk) {
      setSubmitError('You must sign in with an Identity File or Keypair to submit lyrics.');
      return;
    }
    if (!cleanVideoId) {
      setSubmitError('A valid 11-character YouTube video ID or link is required.');
      return;
    }
    if (existingSubmission && !confirmDuplicate) {
      setSubmitError('Please acknowledge the existing submission before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const lyricsContent =
        format === 'ttml'
          ? exportTTML(doc)
          : exportLRC(doc, { format: 'enhanced_standard' });

      const payload: UnisonSubmitPayload = {
        videoId: cleanVideoId,
        song: doc.metadata.title.trim(),
        artist: doc.metadata.artist.trim(),
        duration: Math.round(doc.metadata.duration || validation.stats.duration || 180),
        lyrics: lyricsContent,
        format,
        syncType: validation.syncType,
        album: doc.metadata.album?.trim() || undefined,
        isrc: doc.metadata.isrc?.trim() || undefined,
        language: doc.metadata.language?.trim() || 'en',
      };

      const res = await submitLyricsToUnison(
        payload,
        session.privateKeyJwk,
        session.keyId,
        session.publicKeyJwk
      );

      setSubmittedId(res.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg bg-[#0c0c0e] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100 animate-in zoom-in-95 duration-150"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
              <BetterLyricsLogo size={18} variant="monochrome" className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white tracking-tight">Submit to Unison</h2>
              <p className="text-xs text-zinc-400 font-normal">Contribute timed lyrics to the Better Lyrics database</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {submittedId ? (
            /* Success View */
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto text-white">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-medium text-white">Lyrics submitted</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-normal">
                  Your submission is live on Unison (#{submittedId}).
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={`https://unison.betterlyrics.org/song/${cleanVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View on Unison</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>
                <button
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <div className="space-y-4">
              {/* Track Metadata & Sync Status Header (Borderless typography) */}
              <div className="flex items-start justify-between gap-4 pb-1">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-normal tracking-wider text-zinc-500 mb-0.5">
                    Track
                  </div>
                  <h3 className="text-sm font-medium text-white truncate">
                    {doc.metadata.title || 'Untitled Track'}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {doc.metadata.artist || 'Unknown Artist'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-normal tracking-wider text-zinc-500 mb-0.5">
                    Sync Status
                  </div>
                  <div className="text-xs font-medium text-white flex items-center gap-1.5 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    <span>{validation.syncType === 'richsync' ? 'RichSync' : 'LineSync'}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-normal">
                    {validation.stats.wordCount} words · {validation.stats.lineCount} lines
                  </div>
                </div>
              </div>

              {/* Submitter Account Row */}
              <div className="py-2.5 border-y border-white/[0.05] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Submitting as</span>
                  <span className="font-medium text-white">
                    {session?.displayName ? `@${session.displayName}` : 'Guest / Unconnected'}
                  </span>
                </div>

                {!session?.privateKeyJwk && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenProfile?.();
                    }}
                    className="text-xs text-white hover:underline cursor-pointer"
                  >
                    Connect account
                  </button>
                )}
              </div>

              {/* YouTube Video ID / Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    YouTube Video ID or URL
                  </label>
                  {isCheckingExisting && (
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-normal">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Checking...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={videoId}
                  onChange={(e) => {
                    setVideoId(e.target.value);
                    setConfirmDuplicate(false);
                  }}
                  placeholder="Paste YouTube link or 11-char ID (e.g. FA_J8XwpCaQ)"
                  className="w-full h-9 px-3 rounded-xl bg-white/[0.04] text-xs text-white placeholder-zinc-500 focus:outline-none focus:bg-white/[0.08] transition-colors"
                />
                {cleanVideoId && cleanVideoId.length !== 11 && (
                  <span className="text-[11px] text-zinc-400 block">
                    Must be a valid 11-character YouTube video ID.
                  </span>
                )}
              </div>

              {/* Duplicate Submission Warning (Refined Monochrome Callout) */}
              {existingSubmission && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] text-xs text-zinc-300 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium text-white">
                        Previous submission found (#{existingSubmission.id})
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        You already submitted lyrics for this track ({existingSubmission.song} by {existingSubmission.artist}). Unison is an immutable archive and does not overwrite existing records; submitting again will publish an additional version.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-2 pt-2 border-t border-white/[0.06] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={(e) => setConfirmDuplicate(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-transparent text-white focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] text-zinc-300 select-none">
                      I understand this will create an additional lyric version on Unison.
                    </span>
                  </label>
                </div>
              )}

              {/* Format Selector: Segmented Pill Control (No heavy card boxes) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-zinc-300">Format</label>
                <div className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] gap-1">
                  <button
                    type="button"
                    onClick={() => setFormat('ttml')}
                    className={`py-2 px-3 rounded-lg text-left transition-all cursor-pointer ${
                      format === 'ttml'
                        ? 'bg-white text-zinc-950 font-medium shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-medium block">Apple Music TTML</span>
                    <span
                      className={`text-[10px] block ${
                        format === 'ttml' ? 'text-zinc-600' : 'text-zinc-500'
                      }`}
                    >
                      Recommended · Word-level RichSync
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('lrc')}
                    className={`py-2 px-3 rounded-lg text-left transition-all cursor-pointer ${
                      format === 'lrc'
                        ? 'bg-white text-zinc-950 font-medium shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-medium block">Enhanced LRC</span>
                    <span
                      className={`text-[10px] block ${
                        format === 'lrc' ? 'text-zinc-600' : 'text-zinc-500'
                      }`}
                    >
                      Standard line timestamps
                    </span>
                  </button>
                </div>
              </div>

              {/* Human-Timed Attestation (Clean inline row) */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 py-1 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={certifiedNonAi}
                    onChange={(e) => setCertifiedNonAi(e.target.checked)}
                    className="rounded border-white/20 bg-transparent text-white focus:ring-0 cursor-pointer"
                  />
                  <span>I confirm these lyrics are human-timed and not generated by AI.</span>
                </label>
              </div>

              {/* Pre-flight Validation Errors (if requirements not met) */}
              {!validation.ok && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] text-xs text-zinc-300 space-y-1">
                  <div className="font-medium text-white">Requirements not met</div>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[11px]">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error Notice */}
              {submitError && (
                <div className="p-3 rounded-xl bg-white/[0.04] text-xs text-zinc-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span className="leading-snug">{submitError}</span>
                </div>
              )}

              {/* Submit CTA Button (Solid Monochrome High-Contrast) */}
              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full h-10 rounded-xl bg-white text-zinc-950 font-medium text-xs transition-all active:scale-[0.98] hover:bg-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-zinc-950" />
                      <span>Submit lyrics</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
