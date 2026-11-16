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
  findDuplicateByLyricsHash,
  findDuplicateByAudioHash,
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


interface CloudPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: OpenLyricsDocument;
  onPublished?: (res: CreateRevisionResponse) => void;
}

// ─── Diff Hunk Row ─────────────────────────────────────────────────────────────

function DiffRow({ hunk, lineText }: { hunk: DiffHunk; lineText?: string }) {
  const isMetadata = hunk.category === 'metadata';
  const isNewEntry = hunk.field === '__new__';
  const label = isMetadata
    ? isNewEntry ? '✦ New Entry' : `metadata · ${metadataFieldLabel(hunk.field!)}`
    : `line ${(hunk.lineIndex ?? 0) + 1} · ${hunk.lineField}`;

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <div className="px-3 py-1.5 flex items-center gap-2 bg-white/[0.02]">
        <span className="material-symbols-outlined text-[12px] text-zinc-500">
          {isMetadata ? 'tune' : 'lyrics'}
        </span>
        <span className="text-[10px] font-sans text-zinc-400 tracking-wide">{label}</span>
        {lineText && !isMetadata && (
          <span className="ml-auto text-[10px] text-zinc-600 truncate max-w-[140px] font-sans italic">
            "{lineText}"
          </span>
        )}
      </div>
      {hunk.before !== undefined && (
        <div className="flex items-start gap-2 px-3 py-1 bg-red-950/20 border-l-2 border-red-500/40">
          <span className="text-red-400 font-sans text-xs shrink-0 select-none">−</span>
          <span className="text-red-300/90 font-sans text-xs break-all">{hunk.before}</span>
        </div>
      )}
      {hunk.after !== undefined && (
        <div className="flex items-start gap-2 px-3 py-1 bg-emerald-950/20 border-l-2 border-emerald-500/40">
          <span className="text-emerald-400 font-sans text-xs shrink-0 select-none">+</span>
          <span className="text-emerald-300/90 font-sans text-xs break-all">{hunk.after}</span>
        </div>
      )}
    </div>
  );
}

// ─── Hard Block Screen ─────────────────────────────────────────────────────────

function HardBlock({
  icon,
  title,
  description,
  detail,
  onClose,
}: {
  icon: string;
  title: string;
  description: string;
  detail?: string;
  onClose: () => void;
}) {
  return (
    <div className="p-8 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.12] flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl text-zinc-300">{icon}</span>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
        {detail && (
          <p className="text-[10px] font-sans bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-zinc-300 break-all mt-2">
            {detail}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="px-6 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-200 text-xs font-medium transition-all cursor-pointer"
      >
        Close
      </button>
    </div>
  );
}

// ─── Platform Gate Screen ──────────────────────────────────────────────────────

function PlatformGate({
  onClose,
  onApplyPlatformLink,
}: {
  onClose: () => void;
  onApplyPlatformLink: (validation: PlatformValidationResult) => void;
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [validation, setValidation] = useState<PlatformValidationResult | null>(null);

  const handleInputChange = (val: string) => {
    setInputUrl(val);
    if (!val.trim()) {
      setValidation(null);
      return;
    }
    const res = validateAndExtractPlatformLink(val);
    setValidation(res);
  };

  const handleConfirm = () => {
    if (validation && validation.valid) {
      onApplyPlatformLink(validation);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.12] flex items-center justify-center">
        <span className="material-symbols-outlined text-2xl text-zinc-300">link</span>
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-sm font-bold text-white">Official Platform Link Required</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          To prevent duplicate entries and guarantee single-master truth, every published lyric set
          must be anchored to an official song source (YouTube or Spotify).
        </p>
      </div>

      {/* Input box */}
      <div className="w-full text-left space-y-2 mt-2">
        <label className="block text-[11px] font-medium text-zinc-300">
          Paste YouTube URL / ID, Spotify Track URL, or ISRC
        </label>
        <div className="relative">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="e.g. https://music.youtube.com/watch?v=kJQP7kiw5Fk"
            className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-white/40 focus:bg-white/[0.06] rounded-xl text-white px-3.5 py-2.5 text-xs outline-none transition-all pr-9 font-sans"
            autoFocus
          />
          {validation && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span
                className={`material-symbols-outlined text-base ${
                  validation.valid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {validation.valid ? 'check_circle' : 'error'}
              </span>
            </div>
          )}
        </div>

        {/* Live Validation Feedback */}
        {validation && (
          <div
            className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 border ${
              validation.valid
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/30 border-red-500/30 text-red-300'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {validation.valid ? 'verified' : 'warning'}
            </span>
            <span>
              {validation.valid
                ? `Valid: ${validation.label} → Registry Key: ${validation.canonicalKey}`
                : validation.error}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3 w-full mt-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!validation || !validation.valid}
          className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Attach & Continue
        </button>
      </div>
    </div>
  );
}

// ─── Interactive Duplicate Resolution Screen ──────────────────────────────────

function DuplicateResolutionScreen({
  duplicate,
  onResolveAsRevision,
  onResolveAsVariant,
  onCancel,
}: {
  duplicate: { matchType: string; matchedSong: SongSearchResult; message?: string; hammingDistance?: number };
  onResolveAsRevision: () => void;
  onResolveAsVariant: (variantName: string) => void;
  onCancel: () => void;
}) {
  const [variantName, setVariantName] = useState('Acoustic / Live');
  const isFuzzy = duplicate.matchType === 'fuzzy_lyrics';

  return (
    <div className="p-6 space-y-5 text-left">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl text-amber-400">merge_type</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Existing Master Track Found</h3>
          <p className="text-xs text-zinc-400">
            {isFuzzy
              ? `Near-identical lyrics (${100 - (duplicate.hammingDistance ?? 1) * 3}% match) found in registry.`
              : 'This song or platform recording already exists in the OpenLyryc Registry.'}
          </p>
        </div>
      </div>

      {/* Matched Track Card */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Registered Master</span>
          <span className="text-[10px] font-sans text-zinc-400">{duplicate.matchedSong.canonicalKey}</span>
        </div>
        <div className="text-sm font-bold text-white truncate">{duplicate.matchedSong.title}</div>
        <div className="text-xs text-zinc-400 truncate">{duplicate.matchedSong.artist}</div>
      </div>

      <p className="text-xs text-zinc-300 font-medium">Choose how you would like to proceed:</p>

      {/* Option A: Submit as Revision */}
      <div className="space-y-2.5">
        <button
          onClick={onResolveAsRevision}
          className="w-full text-left p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-amber-400">history_edu</span>
              Submit as Proposed Revision / Improvement
            </span>
            <span className="material-symbols-outlined text-sm text-zinc-400">arrow_forward</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 pl-6">
            Propose your timing or word sync enhancements directly to this master song for peer review.
          </p>
        </button>

        {/* Option B: Fork as Variant */}
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
            <span className="material-symbols-outlined text-sm text-zinc-400">call_split</span>
            Fork as Track Variant (Remix / Acoustic / Live)
          </div>
          <p className="text-[11px] text-zinc-400">
            If this audio has different timing from the original studio release (e.g. live performance), register it as a sub-variant.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g. Live at Wembley"
              className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
            />
            <button
              onClick={() => onResolveAsVariant(variantName)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.1] hover:bg-white/[0.2] text-white text-xs font-semibold cursor-pointer transition-all"
            >
              Fork Variant
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={onCancel}
          className="w-full py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-zinc-400 text-xs font-medium cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

interface CheckState {
  loading: boolean;
  duplicateResult: DuplicateCheckResponse | null;
}

export const CloudPublishModal: React.FC<CloudPublishModalProps & { onOpenSidebar?: () => void }> = ({
  isOpen,
  onClose,
  document,
  onPublished,
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [authorHandle, setAuthorHandle] = useState(document.metadata.syncedBy || '0xVaporWave');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<CreateRevisionResponse | null>(null);
  const [diffExpanded, setDiffExpanded] = useState(true);
  const [checks, setChecks] = useState<CheckState>({ loading: true, duplicateResult: null });
  const [mergeApproved, setMergeApproved] = useState(false);
  const [isVariantMode, setIsVariantMode] = useState(false);
  const [variantTitle, setVariantTitle] = useState('');
  const [attachedPlatform, setAttachedPlatform] = useState<PlatformValidationResult | null>(null);

  if (!isOpen) return null;

  const currentPlatformInput =
    attachedPlatform?.id ||
    document.metadata.youtubeId ||
    document.metadata.spotifyId ||
    document.metadata.isrc;

  const canonicalKey = resolveCanonicalSongKey({
    isrc: attachedPlatform?.platform === 'isrc' ? attachedPlatform.id : document.metadata.isrc,
    spotifyId: attachedPlatform?.platform === 'spotify' ? attachedPlatform.id : document.metadata.spotifyId,
    youtubeId: attachedPlatform?.platform === 'youtube' ? attachedPlatform.id : document.metadata.youtubeId,
    appleMusicId: attachedPlatform?.platform === 'applemusic' ? attachedPlatform.id : document.metadata.appleMusicId,
    audioHash: document.metadata.audioHash,
    artist: document.metadata.artist,
    title: document.metadata.title,
  });

  const hasValidPlatformLink = Boolean(
    attachedPlatform?.valid ||
    parseSpotifyTrackId(document.metadata.spotifyId) ||
    parseYouTubeMusicId(document.metadata.youtubeId) ||
    normalizeIsrc(document.metadata.isrc)
  );

  // Compute diff against last published snapshot
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { diff, isFirstPublish } = useMemo(() => {
    const baseline = getLastPublishedDocument(canonicalKey);
    const computed = computeDocumentDiff(baseline, document);
    return { diff: computed, isFirstPublish: baseline === null };
  }, [canonicalKey, document]);

  // Run async checkDuplicate scan
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!hasValidPlatformLink || !isOpen) return;
    let cancelled = false;

    const runChecks = async () => {
      setChecks({ loading: true, duplicateResult: null });
      try {
        const lyricsHash = await computeLyricsHash(document.lines ?? []);
        const lyricsSimhash = computeLyricsSimHash(document.lines ?? []);

        const platformId =
          attachedPlatform?.id ||
          parseYouTubeMusicId(document.metadata.youtubeId) ||
          parseSpotifyTrackId(document.metadata.spotifyId) ||
          normalizeIsrc(document.metadata.isrc);

        const checkRes = await checkDuplicate({
          platform: attachedPlatform?.platform,
          platformId,
          canonicalKey,
          lyricsHash,
          lyricsSimhash,
          artist: document.metadata.artist,
          title: document.metadata.title,
          duration: document.metadata.duration,
        });

        if (!cancelled) {
          setChecks({
            loading: false,
            duplicateResult: checkRes.isDuplicate ? checkRes : null,
          });
        }
      } catch {
        if (!cancelled) setChecks({ loading: false, duplicateResult: null });
      }
    };

    runChecks();
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasValidPlatformLink, document, canonicalKey, attachedPlatform]);

  const hasChanges = diff.length > 0;
  const meaningful = isMeaningfulChange(diff);

  const metadataHunks = diff.filter((h) => h.category === 'metadata' && h.field !== '__new__');
  const addedLines = diff.filter((h) => h.category === 'line' && h.changeType === 'added').length;
  const removedLines = diff.filter((h) => h.category === 'line' && h.changeType === 'removed').length;
  const modifiedLines = diff.filter(
    (h) => h.category === 'line' && h.changeType === 'modified' && h.lineField === 'text'
  ).length;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || !meaningful) return;

    setPublishing(true);
    try {
      const docMetadata = {
        ...document.metadata,
        canonicalKey,
        isCanonicalMaster: !isVariantMode,
        ...(attachedPlatform?.platform === 'youtube' ? { youtubeId: attachedPlatform.id } : {}),
        ...(attachedPlatform?.platform === 'spotify' ? { spotifyId: attachedPlatform.id } : {}),
        ...(attachedPlatform?.platform === 'isrc' ? { isrc: attachedPlatform.id } : {}),
      };

      const res = await publishRevision({
        title: document.metadata.title,
        artist: document.metadata.artist,
        album: document.metadata.album,
        commitMessage,
        authorHandle,
        allowMerge: mergeApproved,
        isVariant: isVariantMode,
        variantName: variantTitle,
        document: {
          ...document,
          metadata: docMetadata,
        },
      });
      setResult(res);
      if (onPublished) onPublished(res);
    } catch (err) {
      console.warn('[CloudPublishModal] publish failed:', err);
      setResult({
        success: false,
        songId: '',
        revisionHash: '',
        message: err instanceof Error ? err.message : 'Publish failed',
      } as any);
    } finally {
      setPublishing(false);
    }
  };


  const lineCount = document.lines?.length || 0;
  const hasWordSync = document.lines?.some((l) => l.tokens && l.tokens.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#0f0f12] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col text-zinc-100 font-sans overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white text-xl">cloud_upload</span>
            <div>
              <h2 className="font-bold text-white text-base tracking-tight">Publish Revision</h2>
              <p className="text-[11px] text-zinc-400">Submit lyrics for review</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {/* ── Success ─────────────────────────────────────────────── */}
          {result ? (
            <div className="p-8 space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.12] text-white mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Submitted for Review</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your revision has been submitted and will be available once reviewed.
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-zinc-800 border border-white/[0.1] text-zinc-400 tracking-wider">
                    Pending Review
                  </span>
                </div>
                <p className="text-[10px] font-sans bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-zinc-300 break-all">
                  {result.revisionHash}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left text-xs bg-white/[0.02] p-4 border border-white/[0.06] rounded-xl">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Registry Key:</span>
                  <span className="text-white font-sans font-semibold truncate block">{canonicalKey}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Quality Score:</span>
                  <span className="text-white font-bold">{((result.qualityScore ?? 0.98) * 100).toFixed(0)}%</span>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer">
                Done
              </button>
            </div>

          /* ── Layer 0: No platform link ────────────────────────────── */
          ) : !hasValidPlatformLink ? (
            <PlatformGate
              onClose={onClose}
              onApplyPlatformLink={(v) => setAttachedPlatform(v)}
            />

          /* ── Loading checks ───────────────────────────────────────── */
          ) : checks.loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
              <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
              <span className="text-xs">Checking for duplicates...</span>
            </div>

          /* ── Interactive Duplicate Resolution Screen ───────────────── */
          ) : checks.duplicateResult && checks.duplicateResult.matchedSong && !mergeApproved && !isVariantMode ? (
            <DuplicateResolutionScreen
              duplicate={{
                matchType: checks.duplicateResult.matchType,
                matchedSong: checks.duplicateResult.matchedSong,
                message: checks.duplicateResult.message,
                hammingDistance: checks.duplicateResult.hammingDistance,
              }}
              onResolveAsRevision={() => setMergeApproved(true)}
              onResolveAsVariant={(vName) => {
                setIsVariantMode(true);
                setVariantTitle(vName);
                setMergeApproved(true);
              }}
              onCancel={onClose}
            />

          /* ── Publish Form ──────────────────────────────────────────── */
          ) : (
            <form onSubmit={handlePublish} className="p-6 space-y-4">


              {/* Official Source Warning */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-white/[0.02] border border-white/[0.08] rounded-xl text-xs text-zinc-400 leading-relaxed">
                <span className="material-symbols-outlined text-sm text-zinc-400 shrink-0 mt-0.5">info</span>
                <span>
                  <span className="font-semibold text-zinc-200">Official tracks only.</span>
                  {' '}Please link the official audio or music video rather than fan uploads or covers.
                </span>
              </div>

              {/* Canonical Key + Status */}
              <div className="px-3 py-2.5 bg-white/[0.02] border border-white/[0.07] rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-sm text-zinc-400 shrink-0">key</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">Registry Key:</span>
                  <span className="text-[11px] font-sans text-white truncate">{canonicalKey}</span>
                </div>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-400 shrink-0">
                  {isFirstPublish ? 'New Entry' : 'Update'}
                </span>
              </div>

              {/* Git-Diff Panel */}
              <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDiffExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer border-b border-white/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-zinc-400">difference</span>
                    <span className="text-[11px] font-bold text-white">
                      {isFirstPublish ? 'New Entry Preview' : 'Changes'}
                    </span>
                    {hasChanges ? (
                      <div className="flex items-center gap-1.5">
                        {metadataHunks.length > 0 && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                            {metadataHunks.length} meta
                          </span>
                        )}
                        {addedLines > 0 && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/20">
                            +{addedLines}
                          </span>
                        )}
                        {removedLines > 0 && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-500/20">
                            −{removedLines}
                          </span>
                        )}
                        {modifiedLines > 0 && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                            ~{modifiedLines}
                          </span>
                        )}
                        {!meaningful && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500 border border-white/[0.05]">
                            not significant
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500 border border-white/[0.05]">
                        no changes
                      </span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-[14px] text-zinc-500">
                    {diffExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {diffExpanded && (
                  <div className="max-h-60 overflow-y-auto font-sans bg-[#0a0a0c]">
                    {!meaningful ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 text-center px-6">
                        <span className="material-symbols-outlined text-3xl text-zinc-600">check_circle</span>
                        <div>
                          <p className="text-sm font-bold text-zinc-300">Nothing meaningful to commit</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {diff.length === 0
                              ? 'The document is identical to the last published revision.'
                              : 'Only minor changes detected (e.g. 1–2 timestamps). Make more substantial edits before publishing.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {diff.filter((h) => h.category === 'metadata').map((hunk, i) => (
                          <DiffRow key={`meta-${i}`} hunk={hunk} />
                        ))}
                        {(() => {
                          const seenLines = new Set<number>();
                          return diff.filter((h) => h.category === 'line').map((hunk, i) => {
                            const lineText = hunk.lineIndex !== undefined
                              ? document.lines?.[hunk.lineIndex]?.text
                              : undefined;
                            const isFirstForLine = hunk.lineIndex !== undefined && !seenLines.has(hunk.lineIndex);
                            if (hunk.lineIndex !== undefined) seenLines.add(hunk.lineIndex);
                            return (
                              <DiffRow
                                key={`line-${i}`}
                                hunk={hunk}
                                lineText={isFirstForLine && hunk.lineField !== 'text' ? lineText : undefined}
                              />
                            );
                          });
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg py-2">
                  <span className="text-zinc-500 block text-[11px]">Lines</span>
                  <span className="text-white font-bold tabular-nums">{lineCount}</span>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg py-2">
                  <span className="text-zinc-500 block text-[11px]">Sync Mode</span>
                  <span className="text-white font-semibold">{hasWordSync ? 'Word' : 'Line'}</span>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg py-2">
                  <span className="text-zinc-500 block text-[11px]">Changes</span>
                  <span className={`font-bold tabular-nums ${meaningful ? 'text-white' : 'text-zinc-600'}`}>{diff.length}</span>
                </div>
              </div>

              {/* Commit Form — only when meaningful */}
              {meaningful && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">Contributor Handle</label>
                    <input
                      type="text"
                      value={authorHandle}
                      onChange={(e) => setAuthorHandle(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg text-white p-2.5 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1.5">
                      Commit Message <span className="text-zinc-600">*</span>
                    </label>
                    <textarea
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Describe what you changed (e.g. 'Fixed word timestamps for Verse 1')"
                      className="w-full h-16 bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg text-white p-2.5 outline-none transition-all resize-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing || !commitMessage.trim() || !meaningful}
                  title={!meaningful ? 'Make more substantial edits before publishing' : undefined}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md shadow-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {publishing ? 'Submitting…' : !meaningful ? 'Nothing to Commit' : 'Submit for Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudPublishModal;
