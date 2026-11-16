'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { BetterLyricsLogo } from './BetterLyricsLogo';
import {
  probeBetterLyricsExtension,
  signInWithExtension,
  getCustomExtensionId,
  setCustomExtensionId,
  ExtensionProbeResult,
} from '@/lib/unison/authService';
import type { UnisonStoredSession } from '@/lib/unison/types';

interface ExtensionConnectCardProps {
  onSuccess: (session: UnisonStoredSession) => void;
  onError: (error: string) => void;
  onSwitchToFile?: () => void;
  isLoading?: boolean;
}

export const ExtensionConnectCard: React.FC<ExtensionConnectCardProps> = ({
  onSuccess,
  onError,
  onSwitchToFile,
  isLoading = false,
}) => {
  const [probeResult, setProbeResult] = useState<ExtensionProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showDevOptions, setShowDevOptions] = useState<boolean>(false);
  const [devExtensionId, setDevExtensionId] = useState<string>(() => (typeof window !== 'undefined' ? getCustomExtensionId() || '' : ''));
  const [savedDevSuccess, setSavedDevSuccess] = useState<boolean>(false);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  const runProbe = async () => {
    setIsProbing(true);
    try {
      const res = await probeBetterLyricsExtension();
      setProbeResult(res);
    } catch {
      setProbeResult({ hasChromiumRuntime: false, isAvailable: false });
    } finally {
      setIsProbing(false);
    }
  };

  useEffect(() => {
    runProbe();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const session = await signInWithExtension();
      onSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Extension connection failed.';
      onError(msg);
      runProbe();
    } finally {
      setIsConnecting(false);
    }
  };

  const isBusy = isLoading || isConnecting;

  return (
    <div className="w-full max-w-md mx-auto space-y-3.5">
      {/* ── Status Banner ── */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
            <BetterLyricsLogo className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white truncate">Better Lyrics Extension</span>
              {probeResult?.isAvailable ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  Ready
                </span>
              ) : isProbing ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Checking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-[10px] font-medium text-zinc-400">
                  Not Detected
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {probeResult?.isAvailable
                ? 'Handshake port verified and responsive'
                : 'Connect seamlessly using your browser extension'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => runProbe()}
          disabled={isProbing}
          title="Re-check extension availability"
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Main Connect Action ── */}
      {probeResult?.isAvailable ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isBusy}
            className="w-full h-10 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] font-medium text-xs transition-all shadow-md shadow-white/5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isBusy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-950" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>One-Click Sign In with Better Lyrics</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </>
            )}
          </button>
          <p className="text-[11px] text-zinc-500 text-center">
            Zero password entry. Verified directly via cryptographic handshake.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/[0.06] space-y-3 text-left">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Better Lyrics extension wasn&apos;t detected in this browser session.
            </p>

            {isLocalhost ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Localhost restriction notice</span>
                </div>
                <p>
                  Chrome security blocks external connections from localhost because only{' '}
                  <code className="px-1 py-0.5 rounded bg-black/40 text-amber-300">https://openlyryc.pages.dev</code>{' '}
                  is listed in the extension manifest. On localhost, please sign in with your <strong>Identity File</strong>.
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200/90 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-blue-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Pending Web Store rollout (PR #1046)</span>
                </div>
                <p>
                  PR #1046 is merged in upstream Better Lyrics master, but Chrome Web Store currently hosts v3.0.2. Until v3.0.3 publishes, you can sign in directly using your <strong>Identity File</strong> or an unpacked master build.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={isBusy}
                className="flex-1 h-9 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isBusy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Retry Extension</span>
                )}
              </button>

              {onSwitchToFile && (
                <button
                  type="button"
                  onClick={onSwitchToFile}
                  className="px-3.5 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Use Identity File</span>
                </button>
              )}
            </div>

            {/* Dev options toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDevOptions(!showDevOptions)}
                className="text-[10px] text-zinc-500 hover:text-zinc-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-2.5 h-2.5" />
                <span>{showDevOptions ? 'Hide' : 'Configure'} custom extension ID (unpacked dev builds)</span>
              </button>

              {showDevOptions && (
                <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <label className="block text-[10px] text-zinc-400">
                    Custom Extension ID (e.g., from chrome://extensions):
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={devExtensionId}
                      onChange={(e) => setDevExtensionId(e.target.value.trim())}
                      placeholder="e.g. effdbpeggelllpfkjppbokhmmiinhlmg"
                      className="flex-1 h-7 px-2 text-xs rounded-lg bg-zinc-900 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomExtensionId(devExtensionId);
                        setSavedDevSuccess(true);
                        runProbe();
                        setTimeout(() => setSavedDevSuccess(false), 2000);
                      }}
                      className="px-2.5 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      {savedDevSuccess ? <Check className="w-3 h-3 text-emerald-400" /> : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center pt-0.5">
            <a
              href="https://betterlyrics.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition"
            >
              <span>Get Better Lyrics for Chrome / Edge</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
