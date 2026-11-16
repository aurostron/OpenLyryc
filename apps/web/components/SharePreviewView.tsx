'use client';

import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import { OpenLyricsDocument } from '@/types/lyrics';
import { generatePreviewLink } from '@/lib/previewLink';
import { savePreviewToTurso } from '@/lib/turso';
import {
  ArrowLeft,
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Code2,
  Tv,
  Eye,
  Smartphone,
  Tablet,
  Monitor,
  Download,
  Globe,
  Music2,
  Play,
  Layers,
  Send,
} from 'lucide-react';

interface SharePreviewViewProps {
  onBack: () => void;
  document: OpenLyricsDocument;
  songId?: string;
}

type PreviewTab = 'embed' | 'card' | 'qr';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const SharePreviewView: React.FC<SharePreviewViewProps> = ({
  onBack,
  document,
  songId,
}) => {
  // Embed code controls
  const [embedWidthPreset, setEmbedWidthPreset] = useState<'100%' | '640px' | '480px' | 'custom'>('100%');
  const [customWidth, setCustomWidth] = useState('800px');
  const [embedHeightPreset, setEmbedHeightPreset] = useState<'380px' | '450px' | '600px' | 'custom'>('450px');
  const [customHeight, setCustomHeight] = useState('520px');
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isOledTheme, setIsOledTheme] = useState(false);

  // Preview display controls
  const [activeTab, setActiveTab] = useState<PreviewTab>('embed');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');

  // Copy feedbacks
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Link generation state
  const [tursoShortUrl, setTursoShortUrl] = useState<string | null>(null);
  const [isSavingTurso, setIsSavingTurso] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const trackTitle = document.metadata.title || 'Untitled Track';
  const trackArtist = document.metadata.artist || 'Unknown Artist';
  const trackAlbum = document.metadata.album;
  const lineCount = document.lines?.length || 0;

  // Compute fallback Ultra-Compact Link
  const fallbackShareUrl = useMemo(() => {
    return generatePreviewLink({
      document,
      songId,
      theme: isOledTheme ? 'monochrome_oled' : 'fluid_glow',
    });
  }, [document, songId, isOledTheme]);

  // Request Turso shortcode
  useEffect(() => {
    let isMounted = true;
    setIsSavingTurso(true);

    savePreviewToTurso(document, {
      theme: isOledTheme ? 'monochrome_oled' : 'fluid_glow',
    })
      .then((res) => {
        if (!isMounted) return;
        if (res) {
          setTursoShortUrl(res.url);
        }
        setIsSavingTurso(false);
      })
      .catch((err) => {
        console.warn('Failed to generate short link:', err);
        if (isMounted) setIsSavingTurso(false);
      });

    return () => {
      isMounted = false;
    };
  }, [document, isOledTheme]);

  const activeShareUrl = tursoShortUrl || fallbackShareUrl;

  // Generate QR Code data URL
  useEffect(() => {
    if (activeShareUrl) {
      QRCode.toDataURL(activeShareUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
  }, [activeShareUrl]);

  // Determine active embed dimensions
  const finalWidth = embedWidthPreset === 'custom' ? customWidth : embedWidthPreset;
  const finalHeight = embedHeightPreset === 'custom' ? customHeight : embedHeightPreset;

  // Construct iframe source URL with parameters
  const embedUrl = useMemo(() => {
    if (!activeShareUrl) return '';
    try {
      const url = new URL(activeShareUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      if (isAutoplay) url.searchParams.set('autoplay', '1');
      if (isOledTheme) url.searchParams.set('theme', 'monochrome_oled');
      return url.toString();
    } catch {
      // In case of hash URLs like /p#data
      if (activeShareUrl.includes('#')) {
        const [base, hash] = activeShareUrl.split('#');
        const params: string[] = [];
        if (isAutoplay) params.push('autoplay=1');
        if (isOledTheme) params.push('theme=monochrome_oled');
        const query = params.length > 0 ? `?${params.join('&')}` : '';
        return `${base}${query}#${hash}`;
      }
      return activeShareUrl;
    }
  }, [activeShareUrl, isAutoplay, isOledTheme]);

  const embedSnippet = `<iframe src="${embedUrl}" width="${finalWidth}" height="${finalHeight}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const downloadQrCode = () => {
    if (!qrDataUrl) return;
    const link = window.document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${trackTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-qr.png`;
    link.click();
  };

  // Social share intent links
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out synced lyrics for "${trackTitle}" by ${trackArtist} on OpenLyryc:`)}&url=${encodeURIComponent(activeShareUrl)}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${trackTitle} by ${trackArtist} synced lyrics: ${activeShareUrl}`)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(activeShareUrl)}&text=${encodeURIComponent(`${trackTitle} by ${trackArtist} synced lyrics`)}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-14 bg-[#0e0e12] border-b border-white/[0.08] px-6 md:px-8 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
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

          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-zinc-300" />
            <h1 className="text-sm font-semibold text-white tracking-tight">Share &amp; Embed</h1>
          </div>
          <span className="text-xs text-zinc-500 font-sans hidden sm:inline">
            · {trackTitle} {trackArtist !== 'Unknown Artist' ? `by ${trackArtist}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={activeShareUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Tab</span>
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
          </button>

          <div className="text-xs text-zinc-500 font-sans hidden md:inline ml-1">
            Esc to close
          </div>
        </div>
      </header>

      {/* Main Split Body: Left Controls & Right Live Preview */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-5 md:p-7 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
          {/* Left Column: Share Link & Embed Code Configurator */}
          <div className="lg:col-span-5 space-y-5 lg:overflow-y-auto lg:h-full lg:pr-1 custom-scrollbar">
            {/* 1. Shareable Link Box */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  Direct Share Link
                </h2>
                {isSavingTurso && (
                  <span className="text-[10px] text-zinc-500 font-sans flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Getting short link...
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] font-sans text-xs text-zinc-300 break-all select-all flex items-center justify-between gap-2">
                <span className="truncate">{activeShareUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  title="Copy link"
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Quick Social Share Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                <span className="text-[11px] text-zinc-500 font-medium">Share to:</span>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs border border-white/[0.06] transition-colors cursor-pointer"
                >
                  X (Twitter)
                </a>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs border border-white/[0.06] transition-colors cursor-pointer"
                >
                  WhatsApp
                </a>
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs border border-white/[0.06] transition-colors cursor-pointer"
                >
                  Telegram
                </a>
              </div>
            </div>

            {/* 2. Embed Player Configurator */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                  Embed Player (iFrame)
                </h2>
                <span className="text-[10px] text-zinc-500 font-sans">HTML</span>
              </div>

              {/* Embed Dimension Presets */}
              <div className="space-y-3">
                {/* Width selector */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Player Width
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['100%', '640px', '480px', 'custom'] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setEmbedWidthPreset(w)}
                        className={`py-1 px-2 rounded-lg text-xs font-sans transition-all cursor-pointer border ${
                          embedWidthPreset === w
                            ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                            : 'bg-white/[0.04] text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.08]'
                        }`}
                      >
                        {w === 'custom' ? 'Custom' : w}
                      </button>
                    ))}
                  </div>
                  {embedWidthPreset === 'custom' && (
                    <input
                      type="text"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="e.g. 720px or 90%"
                      className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 rounded-xl px-3 py-1.5 text-xs text-white font-sans outline-none"
                    />
                  )}
                </div>

                {/* Height selector */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Player Height
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['380px', '450px', '600px', 'custom'] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setEmbedHeightPreset(h)}
                        className={`py-1 px-2 rounded-lg text-xs font-sans transition-all cursor-pointer border ${
                          embedHeightPreset === h
                            ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                            : 'bg-white/[0.04] text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.08]'
                        }`}
                      >
                        {h === 'custom' ? 'Custom' : h}
                      </button>
                    ))}
                  </div>
                  {embedHeightPreset === 'custom' && (
                    <input
                      type="text"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="e.g. 500px"
                      className="mt-2 w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 rounded-xl px-3 py-1.5 text-xs text-white font-sans outline-none"
                    />
                  )}
                </div>

                {/* Embed Toggles */}
                <div className="pt-2 border-t border-white/[0.04] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-zinc-300 font-medium block">Autoplay on Load</span>
                      <span className="text-[10px] text-zinc-500">Starts playback when the iframe loads</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAutoplay(!isAutoplay)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        isAutoplay ? 'bg-white' : 'bg-zinc-800 border border-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform ${
                          isAutoplay ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-zinc-300 font-medium block">Pure OLED Dark Theme</span>
                      <span className="text-[10px] text-zinc-500">Solid deep black background for dark sites</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOledTheme(!isOledTheme)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        isOledTheme ? 'bg-white' : 'bg-zinc-800 border border-white/10'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform ${
                          isOledTheme ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Snippet Display */}
              <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] font-sans text-[11px] text-zinc-400 break-all select-all leading-relaxed">
                  {embedSnippet}
                </div>

                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white font-medium text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
                  <span>{copiedEmbed ? 'Embed Code Copied!' : 'Copy Embed Code'}</span>
                </button>

                <p className="text-[11px] text-zinc-500 text-center font-sans">
                  Works on Notion, WordPress, Ghost, Webflow, and custom websites.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Preview Workspace */}
          <div className="lg:col-span-7 flex flex-col h-full space-y-3.5 min-w-0">
            {/* View Switcher Tabs & Device Presets */}
            <div className="p-2 bg-white/[0.02] border border-white/[0.08] rounded-2xl flex items-center justify-between gap-3 shrink-0">
              {/* Segmented View Switcher */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setActiveTab('embed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'embed'
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  <span>Live Player</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'card'
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Link Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'qr'
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR Code</span>
                </button>
              </div>

              {/* Viewport Simulation Controls (Only in embed view) */}
              {activeTab === 'embed' && (
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500 font-sans mr-1">Viewport:</span>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('desktop')}
                    title="Desktop (100%)"
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      deviceMode === 'desktop'
                        ? 'bg-white/[0.12] border-white/20 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('tablet')}
                    title="Tablet (640px)"
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      deviceMode === 'tablet'
                        ? 'bg-white/[0.12] border-white/20 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('mobile')}
                    title="Phone (380px)"
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      deviceMode === 'mobile'
                        ? 'bg-white/[0.12] border-white/20 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Main Interactive Preview Container */}
            <div className="flex-1 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center min-h-[460px] overflow-hidden relative">
              {/* TAB 1: Live Embed View */}
              {activeTab === 'embed' && (
                <div
                  className="w-full h-full flex flex-col items-center justify-center transition-all duration-300"
                  style={{
                    maxWidth:
                      deviceMode === 'mobile'
                        ? '380px'
                        : deviceMode === 'tablet'
                        ? '640px'
                        : '100%',
                  }}
                >
                  <div className="w-full flex items-center justify-between pb-2 text-[11px] text-zinc-500 font-sans">
                    <span>
                      Live Embed Preview · {finalWidth} × {finalHeight}
                    </span>
                    <a
                      href={embedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Direct URL</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div
                    className="w-full rounded-2xl overflow-hidden border border-white/[0.1] bg-black shadow-2xl relative"
                    style={{
                      height: finalHeight === 'custom' ? customHeight : finalHeight,
                      maxHeight: '620px',
                    }}
                  >
                    <iframe
                      src={embedUrl}
                      title="Live Embed Preview"
                      className="w-full h-full border-0 bg-black"
                      allow="autoplay; fullscreen"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Social Link Card View (Discord / Twitter / iMessage mock) */}
              {activeTab === 'card' && (
                <div className="w-full max-w-md space-y-4">
                  <div className="text-center space-y-1">
                    <span className="text-xs font-semibold text-white">Social Card Preview</span>
                    <p className="text-[11px] text-zinc-400">
                      How your link renders when pasted into Discord, Twitter, or WhatsApp.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.1] bg-[#121217] overflow-hidden shadow-2xl">
                    {/* Simulated Embed Image / Art */}
                    <div className="aspect-[1.91/1] w-full bg-[#181820] relative flex items-center justify-center overflow-hidden border-b border-white/[0.08]">
                      {document.metadata.coverArt ? (
                        <img
                          src={document.metadata.coverArt}
                          alt="Cover Art"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                          <Music2 className="w-10 h-10 text-zinc-600" />
                          <span className="text-xs font-sans">OPENLYRYC PLAYER</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs font-sans font-medium">Synced Lyrics</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-sans">
                          {lineCount} lines timed
                        </span>
                      </div>
                    </div>

                    {/* Card Content Details */}
                    <div className="p-4 space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-sans uppercase tracking-wider block">
                        openlyryc.dev
                      </span>
                      <h3 className="text-sm font-bold text-white leading-tight">
                        {trackTitle} — {trackArtist}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        Interactive word-by-word synced lyrics on OpenLyryc. Play along or practice in real time.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Mobile QR Code View */}
              {activeTab === 'qr' && (
                <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-white">Mobile QR Code</span>
                    <p className="text-[11px] text-zinc-400">
                      Scan with any smartphone camera to open full-screen synced lyrics instantly.
                    </p>
                  </div>

                  {qrDataUrl ? (
                    <div className="p-4 rounded-2xl bg-white p-3 shadow-2xl">
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-56 h-56 rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="w-56 h-56 rounded-2xl border border-white/10 flex items-center justify-center text-zinc-600">
                      Generating QR...
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={downloadQrCode}
                      className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download QR (PNG)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Link</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
