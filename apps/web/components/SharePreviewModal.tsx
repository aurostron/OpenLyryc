import React, { useState, useMemo, useEffect } from 'react';
import { OpenLyricsDocument } from '@/types/lyrics';
import { PreviewTheme, generatePreviewLink, getCompressionStats } from '@/lib/previewLink';
import { savePreviewToTurso } from '@/lib/turso';
import { QRCodeDisplay } from './QRCodeDisplay';

interface SharePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: OpenLyricsDocument;
  songId?: string;
}

export const SharePreviewModal: React.FC<SharePreviewModalProps> = ({
  isOpen,
  onClose,
  document,
  songId,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<PreviewTheme>('fluid_glow');
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [tursoShortUrl, setTursoShortUrl] = useState<string | null>(null);
  const [tursoCode, setTursoCode] = useState<string | null>(null);
  const [isSavingTurso, setIsSavingTurso] = useState<boolean>(false);

  // Persist current document into localStorage preview cache
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;
    try {
      if (songId) {
        localStorage.setItem(`openlyrics_doc_${songId}`, JSON.stringify(document));
      }
      localStorage.setItem('openlyrics_preview_latest', JSON.stringify(document));
    } catch {
      // ignore
    }
  }, [isOpen, songId, document]);

  // Compute fallback Ultra-Compact Self-Contained Link
  const fallbackShareUrl = useMemo(() => {
    return generatePreviewLink({
      document,
      songId: undefined,
      theme: selectedTheme,
      tvMode: isTvMode,
    });
  }, [document, selectedTheme, isTvMode]);

  // Asynchronously generate or retrieve Turso Shortcode
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsSavingTurso(true);

    savePreviewToTurso(document, {
      theme: selectedTheme,
      tvMode: isTvMode,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res) {
          setTursoShortUrl(res.url);
          setTursoCode(res.code);
        }
        setIsSavingTurso(false);
      })
      .catch((err) => {
        console.warn('Failed to get Turso shortcode:', err);
        if (isMounted) setIsSavingTurso(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, document, selectedTheme, isTvMode]);

  // Primary share URL (prefer short URL from Turso, fallback to self-contained hash)
  const shareUrl = tursoShortUrl || fallbackShareUrl;

  // Compression stats
  const stats = useMemo(() => {
    try {
      return getCompressionStats(document);
    } catch {
      return null;
    }
  }, [document]);

  const embedCode = useMemo(() => {
    return `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" allow="autoplay; fullscreen" style="border-radius: 16px; overflow: hidden;"></iframe>`;
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleCopyEmbed = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2500);
    });
  };

  const handleOpenPreview = () => {
    if (typeof window === 'undefined') return;
    window.open(shareUrl, '_blank');
  };

  const themeOptions = [
    {
      key: 'fluid_glow' as PreviewTheme,
      label: 'Fluid Stage Glow',
      desc: 'Ambient blurred color mesh & glowing active lines',
      accentColor: 'from-purple-500 to-cyan-400',
      icon: 'blur_on',
    },
    {
      key: 'monochrome_oled' as PreviewTheme,
      label: 'OLED Studio',
      desc: 'Deep black background with crisp high-contrast type',
      accentColor: 'from-zinc-100 to-zinc-400',
      icon: 'contrast',
    },
    {
      key: 'vaporwave_neon' as PreviewTheme,
      label: 'Vaporwave Neon',
      desc: 'Cyberpunk 80s cyan & magenta glowing aura with grid',
      accentColor: 'from-pink-500 to-cyan-400',
      icon: 'local_fire_department',
    },
    {
      key: 'stage_karaoke' as PreviewTheme,
      label: 'Stage Karaoke',
      desc: 'High-visibility rolling teleprompter & gold wipe',
      accentColor: 'from-yellow-400 to-amber-600',
      icon: 'mic',
    },
  ];

  // Format bytes into human-readable string
  const formatBytes = (b: number) =>
    b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg bg-[#0f0f14] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col text-zinc-100 font-sans overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-base">ios_share</span>
            </div>
            <div>
              <h2 className="font-bold text-white text-sm tracking-tight">Share Live Preview</h2>
              <p className="text-[11px] text-zinc-400">
                Interactive full-screen synced lyrics player
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Song Summary Banner */}
          <div className="p-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg text-zinc-300">music_note</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-white truncate">{document.metadata.title}</h3>
              <p className="text-[11px] text-zinc-400 truncate">{document.metadata.artist}</p>
            </div>
            <div className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-400">
              {document.lines.length} lines
            </div>
          </div>

          {/* Visual Theme Grid */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-300">
              Select Visual Theme
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themeOptions.map((t) => {
                const isSelected = selectedTheme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedTheme(t.key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      isSelected
                        ? 'bg-white/[0.08] border-white/40 ring-1 ring-white/30 shadow-lg'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-zinc-300">
                          {t.icon}
                        </span>
                        <span className="text-xs font-bold text-white">{t.label}</span>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {t.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Big TV Living Room Mode Card */}
          <div className="p-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0">
                <span className="material-symbols-outlined text-lg">tv</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white tracking-tight">Big TV Mode</h4>
                  {isTvMode && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  10-foot super-large typography and remote / D-Pad controls for big screens.
                </p>
              </div>
            </div>

            {/* Modern Toggle Switch */}
            <button
              type="button"
              onClick={() => {
                setIsTvMode(!isTvMode);
              }}
              title={isTvMode ? 'Disable Big TV Mode' : 'Enable Big TV Mode'}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                isTvMode ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform shadow-md absolute top-1 ${
                  isTvMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Turso DB / Compression Stats */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-emerald-400 text-base">
                {tursoCode ? 'cloud_done' : 'compress'}
              </span>
              <p className="text-xs font-bold text-white">
                {tursoCode
                  ? `Turso Edge Shortcode: ${tursoCode}`
                  : isSavingTurso
                  ? 'Saving to Turso Edge DB...'
                  : 'Ultra-Compact Binary Encoding'}
              </p>
              <span
                className={`ml-auto text-[10px] font-sans px-2 py-0.5 rounded-full border ${
                  tursoCode
                    ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                    : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {tursoCode ? '⚡ Turso Edge Cached' : `${stats?.reductionPercent || 85}% smaller`}
              </span>
            </div>
            {stats && (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">JSON</p>
                  <p className="text-[11px] font-sans text-zinc-300">{formatBytes(stats.originalJsonBytes)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">Binary</p>
                  <p className="text-[11px] font-sans text-zinc-300">{formatBytes(stats.binaryBytes)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">DEFLATE</p>
                  <p className="text-[11px] font-sans text-emerald-400">{formatBytes(stats.deflatedBytes)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500">Short URL</p>
                  <p className="text-[11px] font-sans text-cyan-300">
                    {shareUrl.length} chars
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Share Link & QR Code Toggle Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300">
                {showQrCode ? 'Never-Expiring QR Code' : 'Shareable Web URL'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {showQrCode ? 'link' : 'qr_code_2'}
                  </span>
                  <span>{showQrCode ? 'Show Link' : 'Show QR Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmbedCode(!showEmbedCode)}
                  className="text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showEmbedCode ? 'Direct Link' : 'Embed Code'}
                </button>
              </div>
            </div>

            {/* QR Code View */}
            {showQrCode ? (
              <QRCodeDisplay url={shareUrl} title={document.metadata.title} />
            ) : showEmbedCode ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={embedCode}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] font-sans text-zinc-300 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    copiedEmbed
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-white text-zinc-950 hover:bg-zinc-200 border-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedEmbed ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedEmbed ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] font-sans text-zinc-300 outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-white text-zinc-950 hover:bg-zinc-200 border-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedLink ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
            {isTvMode ? (
              <p className="text-[10px] text-cyan-300 flex items-center gap-1.5 mt-1 font-medium bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-[14px] text-cyan-400">tv</span>
                TV Ready: Scan QR or open URL on your TV. Remote / D-Pad enabled (OK = Play, ◄ ► = Seek, ▲ ▼ = Jump Lines).
              </p>
            ) : tursoCode ? (
              <p className="text-[10px] text-cyan-300 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[13px] text-cyan-400">cloud_done</span>
                Powered by Turso Edge Database (zero-latency cache). Opens instantly on any device worldwide.
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-400">devices</span>
                100% stateless — no API, no database. Opens instantly on any device worldwide.
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium text-xs transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleOpenPreview}
              className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md shadow-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              Open Fullscreen Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharePreviewModal;
