'use client';

import React, { useState } from 'react';
import { Play, Upload, X, MonitorPlay, Disc, Radio, Cable } from 'lucide-react';

interface NoAudioSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFreePlay: () => void;
  onOpenAudioUpload: () => void;
  /** One-shot YouTube auto-fetch (same engine as Metadata → Auto). Resolves
   *  true when a video was matched + applied (parent closes the modal). */
  onFetchYouTube?: () => Promise<boolean>;
  fetchYouTubeError?: string | null;
  canFetchYouTube?: boolean;
  /** One-shot SoundCloud auto-fetch */
  onFetchSoundCloud?: () => Promise<boolean>;
  canFetchSoundCloud?: boolean;
  /** Companion Bridge integration (127.0.0.1:4040) */
  isCompanionOnline?: boolean;
  onFetchCompanion?: () => Promise<boolean>;
  onOpenCompanionModal?: () => void;
  /** OpenLyryc Studio Connect (browser extension) is installed and can stream YouTube Music directly */
  isConnectAvailable?: boolean;
  onFetchConnect?: () => Promise<boolean>;
  fetchConnectError?: string | null;
}

export const NoAudioSourceModal: React.FC<NoAudioSourceModalProps> = ({
  isOpen,
  onClose,
  onConfirmFreePlay,
  onOpenAudioUpload,
  onFetchYouTube,
  fetchYouTubeError,
  canFetchYouTube = true,
  onFetchSoundCloud,
  canFetchSoundCloud = true,
  isCompanionOnline = false,
  onFetchCompanion,
  onOpenCompanionModal,
  isConnectAvailable = false,
  onFetchConnect,
  fetchConnectError = null,
}) => {
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [isFetchingSc, setIsFetchingSc] = useState(false);
  const [isFetchingCompanion, setIsFetchingCompanion] = useState(false);
  const [isFetchingConnect, setIsFetchingConnect] = useState(false);

  if (!isOpen) return null;

  const handleFetchYouTube = async () => {
    if (!onFetchYouTube || isFetchingYt) return;
    setIsFetchingYt(true);
    try {
      await onFetchYouTube();
    } catch (err) {
      console.warn('[NoAudioSourceModal] YouTube fetch failed:', err);
    } finally {
      setIsFetchingYt(false);
    }
  };

  const handleFetchConnect = async () => {
    if (!onFetchConnect || isFetchingConnect) return;
    setIsFetchingConnect(true);
    try {
      await onFetchConnect();
    } catch (err) {
      console.warn('[NoAudioSourceModal] Studio Connect fetch failed:', err);
    } finally {
      setIsFetchingConnect(false);
    }
  };

  const handleFetchCompanion = async () => {
    if (!onFetchCompanion || isFetchingCompanion) return;
    setIsFetchingCompanion(true);
    try {
      await onFetchCompanion();
    } catch (err) {
      console.warn('[NoAudioSourceModal] Companion fetch failed:', err);
    } finally {
      setIsFetchingCompanion(false);
    }
  };

  const handleFetchSoundCloud = async () => {
    if (!onFetchSoundCloud || isFetchingSc) return;
    setIsFetchingSc(true);
    try {
      await onFetchSoundCloud();
    } catch (err) {
      console.warn('[NoAudioSourceModal] SoundCloud fetch failed:', err);
    } finally {
      setIsFetchingSc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg glass-modal-3d rounded-2xl p-6 shadow-2xl space-y-5 font-sans text-zinc-100 relative animate-modal-pop-3d">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
            <Play className="w-5 h-5 fill-white/20" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              No Audio Loaded
            </h3>
            <p className="text-xs text-zinc-400">
              No audio file or video loaded.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
          You can use the manual timer to sync lyrics without audio, fetch the song from YouTube, or load an audio file.
        </p>

        {fetchYouTubeError && (
          <p className="text-xs text-red-300 leading-relaxed bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {fetchYouTubeError}
          </p>
        )}

        {fetchConnectError && (
          <p className="text-xs text-red-300 leading-relaxed bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {fetchConnectError}
          </p>
        )}

        {isCompanionOnline && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>Companion Bridge Online (:4040)</span>
            </span>

            {onOpenCompanionModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCompanionModal();
                }}
                className="text-zinc-400 hover:text-white underline decoration-dotted transition-colors cursor-pointer"
              >
                Browse Cache
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {isCompanionOnline && onFetchCompanion && (
            <button
              type="button"
              onClick={handleFetchCompanion}
              disabled={isFetchingCompanion || isFetchingYt}
              title="Download lossless raw audio via local OpenLyryc Companion daemon"
              className="h-9 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Disc className={`w-3.5 h-3.5 text-zinc-400 ${isFetchingCompanion ? 'animate-spin' : ''}`} />
              <span>{isFetchingCompanion ? 'Downloading…' : 'Fetch via Companion'}</span>
            </button>
          )}

          {onFetchYouTube && (
            <button
              type="button"
              onClick={handleFetchYouTube}
              disabled={isFetchingYt || isFetchingSc || isFetchingCompanion || !canFetchYouTube}
              title={canFetchYouTube ? 'Auto-find this song on YouTube' : 'Set artist/title in Metadata first'}
              className="h-9 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MonitorPlay className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isFetchingYt ? 'Finding…' : 'Fetch from YT'}</span>
            </button>
          )}

          {isConnectAvailable && onFetchConnect && (
            <button
              type="button"
              onClick={handleFetchConnect}
              disabled={isFetchingConnect || isFetchingYt || isFetchingSc || isFetchingCompanion || !canFetchYouTube}
              title={canFetchYouTube ? 'Stream this song directly via the Studio Connect extension' : 'Set artist/title in Metadata first'}
              className="h-9 px-3.5 rounded-xl text-xs font-medium text-emerald-200 hover:text-white hover:bg-emerald-500/[0.15] active:bg-emerald-500/[0.2] border border-emerald-500/[0.25] hover:border-emerald-400/[0.35] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Cable className={`w-3.5 h-3.5 text-emerald-300 ${isFetchingConnect ? 'animate-pulse' : ''}`} />
              <span>{isFetchingConnect ? 'Connecting…' : 'Studio Connect'}</span>
            </button>
          )}

          {onFetchSoundCloud && (
            <button
              type="button"
              onClick={handleFetchSoundCloud}
              disabled={isFetchingSc || isFetchingYt || isFetchingCompanion || !canFetchSoundCloud}
              title={canFetchSoundCloud ? 'Auto-find this song on SoundCloud' : 'Set artist/title in Metadata first'}
              className="h-9 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Radio className={`w-3.5 h-3.5 text-zinc-400 ${isFetchingSc ? 'animate-spin' : ''}`} />
              <span>{isFetchingSc ? 'Finding…' : 'Fetch from SoundCloud'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAudioUpload();
            }}
            className="h-9 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Open Audio File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirmFreePlay();
            }}
            className="h-9 px-3.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.06] hover:border-white/[0.14] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 text-zinc-400" />
            <span>Use Timer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
