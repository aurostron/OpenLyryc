'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  X,
  Upload,
  Copy,
  Check,
  Music,
  Sparkles,
  ClipboardPaste,
  Play,
  Pause,
} from 'lucide-react';
import { LyricLine, splitPlainTextToTapLines } from '@openlyryc/schema';

interface PhoneSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasAudioLoaded: boolean;
  onTriggerAudioUpload: () => void;
  lines: LyricLine[];
  onUpdateLines: (updater: (prevLines: LyricLine[]) => LyricLine[]) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeLineIndex: number;
  onSetActiveLineIndex: (idx: number) => void;
  // Session lifecycle is owned by the studio (usePhoneSyncHost); the modal is a view over it.
  // Closing the modal never tears down the companion connection.
  roomId: string;
  phoneConnected: boolean;
  syncedWordStats: { stamped: number; total: number };
  onEnsureSession: () => void;
  onBroadcastSessionInit: (overrideLines?: LyricLine[]) => void;
}

export const PhoneSyncModal: React.FC<PhoneSyncModalProps> = ({
  isOpen,
  onClose,
  hasAudioLoaded,
  onTriggerAudioUpload,
  lines,
  onUpdateLines,
  isPlaying,
  onTogglePlay,
  activeLineIndex,
  onSetActiveLineIndex,
  roomId,
  phoneConnected,
  syncedWordStats,
  onEnsureSession,
  onBroadcastSessionInit,
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [pastedPlainText, setPastedPlainText] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [detectedLanIp, setDetectedLanIp] = useState<string>('');
  const [customHost, setCustomHost] = useState<string>('');
  const [isEditingHost, setIsEditingHost] = useState<boolean>(false);

  // Opening the modal lazily creates the sticky host session (kept alive after close)
  useEffect(() => {
    if (isOpen) onEnsureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-detect local LAN IP when running development locally
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      fetch('/api/network-ip')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.ip && data.ip !== '127.0.0.1') {
            setDetectedLanIp(data.ip);
          }
        })
        .catch(() => {});
    }
  }, []);

  const getEffectiveOrigin = useCallback(() => {
    if (typeof window === 'undefined') return 'https://openlyryc.pages.dev';
    if (customHost.trim()) return customHost.trim().replace(/\/+$/, '');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && detectedLanIp) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//${detectedLanIp}${port}`;
    }
    return window.location.origin;
  }, [customHost, detectedLanIp]);

  const companionUrl = `${getEffectiveOrigin()}/sync?room=${roomId}`;

  // Re-generate QR code whenever roomId or effective companionUrl changes
  useEffect(() => {
    if (!roomId) return;
    QRCode.toString(companionUrl, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#ffffff',
        light: '#00000000',
      },
      errorCorrectionLevel: 'M',
    })
      .then((svg) => {
        setQrSvg(svg);
      })
      .catch((err) => console.error('Failed to generate QR:', err));
  }, [companionUrl, roomId]);

  // Handle plain text parse & load
  const handleApplyPlainText = () => {
    if (!pastedPlainText.trim()) return;
    const parsedLines = splitPlainTextToTapLines(pastedPlainText);
    if (parsedLines.length > 0) {
      onUpdateLines(() => parsedLines);
      setShowPasteBox(false);
      setPastedPlainText('');
      // Broadcast to phone (same fresh document the studio just loaded)
      onBroadcastSessionInit(parsedLines);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(companionUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl font-sans select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl bg-[#09090b] rounded-[36px] shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Modal Header */}
        <div className="h-16 px-7 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-white/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Phone Tap Sync</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 font-medium">
                  Sub-10ms P2P
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-7 flex flex-col gap-6 max-h-[82vh] overflow-y-auto">
          {/* Audio Requirement Guard */}
          {!hasAudioLoaded ? (
            <div className="p-8 rounded-[28px] bg-white/[0.02] flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center text-zinc-300">
                <Music className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold text-white mb-1">Local Audio Required</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  This mode requires an uploaded local audio file in OpenLyryc Studio so the desktop master clock can drive ultra-low latency, syllable-level tap syncing without streaming lag.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onTriggerAudioUpload();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-2xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Local Audio Now</span>
              </button>
            </div>
          ) : (
            <>
              {/* Top Connected Status Strip (Non-Boxy, Zero Blinking Dots) */}
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.03] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full transition-colors ${
                        phoneConnected ? 'bg-white' : 'bg-zinc-600'
                      }`}
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">
                        {phoneConnected ? 'Phone Connected & Ready to Sync' : 'Waiting for phone to scan QR...'}
                      </span>
                      <span className="text-zinc-500 ml-2">
                        ({syncedWordStats.stamped} / {syncedWordStats.total} words synced)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onTogglePlay}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isPlaying ? 'Pause' : 'Play Audio'}</span>
                    </button>
                  </div>
                </div>

                {phoneConnected && (
                  <div className="flex items-center gap-2 pt-2 text-[11px] text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5]" />
                    <span>Companion paired. Connection stays live while you work — the modal can close anytime.</span>
                  </div>
                )}
              </div>

              {/* QR Code and Pairing Section (Un-outlined, Organic) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Left: QR Display */}
                <div className="flex flex-col items-center justify-center p-6 rounded-[28px] bg-white/[0.02]">
                  {qrSvg ? (
                    <div
                      className="w-44 h-44 sm:w-52 sm:h-52 [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-zinc-500">
                      Generating QR...
                    </div>
                  )}
                  <span className="text-[11px] text-zinc-500 mt-3 font-sans">
                    Scan with any smartphone camera
                  </span>
                </div>

                {/* Right: Pairing Instructions & Details */}
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">
                      Pairing Code
                    </span>
                    <div className="text-5xl font-semibold tracking-wider text-white mt-1">
                      {roomId}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Direct Companion Link:</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingHost(!isEditingHost)}
                        className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        {isEditingHost ? 'Cancel' : 'Change LAN IP / Port'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={companionUrl}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] text-xs text-zinc-300 font-sans truncate select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {isEditingHost && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.05] text-xs mt-1">
                        <input
                          type="text"
                          value={customHost}
                          onChange={(e) => setCustomHost(e.target.value)}
                          placeholder={`http://${detectedLanIp || '192.168.0.104'}:3000`}
                          className="flex-1 bg-transparent px-2 py-1 text-white placeholder:text-zinc-600 focus:outline-none font-sans text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setIsEditingHost(false)}
                          className="px-3 py-1 rounded-lg bg-white text-black font-semibold text-xs active:scale-[0.98] cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-zinc-400 leading-relaxed flex flex-col gap-1 pt-1">
                    <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Liquid Syllable Interpolation</span>
                    </span>
                    <span>
                      Each tap on your phone records down to the millisecond. OpenLyryc automatically smooths and eases word boundaries so karaoke wipes blend continuously without jarring jumps.
                    </span>
                  </div>
                </div>
              </div>

              {/* Plain Lyrics Ingestion Section (Non-Boxy) */}
              <div className="pt-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    Song Sentences ({lines.length} lines queued)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(!showPasteBox)}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>{showPasteBox ? 'Cancel Plain Paste' : 'Paste Plain Text Lyrics'}</span>
                  </button>
                </div>

                {showPasteBox ? (
                  <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-white/[0.03]">
                    <p className="text-xs text-zinc-400">
                      Paste general raw lyrics below. Our parser automatically splits them into sentence lines and word/syllable tokens:
                    </p>
                    <textarea
                      rows={5}
                      value={pastedPlainText}
                      onChange={(e) => setPastedPlainText(e.target.value)}
                      placeholder="Paste plain unsynced lyrics here...&#10;e.g.&#10;Waiting in a car&#10;Waiting for a ride in the dark&#10;The night city grows"
                      className="w-full p-3.5 rounded-xl bg-black text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 font-sans border-0"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleApplyPlainText}
                        disabled={!pastedPlainText.trim()}
                        className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-30 cursor-pointer"
                      >
                        Auto-Split & Load Into Tap Sync
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-2xl bg-white/[0.02] p-2 flex flex-col gap-1 text-xs">
                    {lines.map((l, idx) => {
                      const isCurrent = idx === activeLineIndex;
                      const hasSync = (l.tokens || []).some((t) => t.start > 0);
                      return (
                        <div
                          key={l.id ?? idx}
                          onClick={() => onSetActiveLineIndex(idx)}
                          className={`px-3.5 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                          }`}
                        >
                          <span className="truncate max-w-[80%]">
                            <span className="text-zinc-600 mr-2">{idx + 1}.</span>
                            {l.text}
                          </span>
                          <span className="text-[10px] tabular-nums text-zinc-500">
                            {hasSync ? 'Synced' : 'Unsynced'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-16 px-7 bg-transparent flex items-center justify-between text-xs text-zinc-500">
          <span>Taps sync live — connection persists while you work</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
