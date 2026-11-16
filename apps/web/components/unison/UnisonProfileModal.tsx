'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Key,
  Shield,
  Award,
  Upload,
  Download,
  LogOut,
  ExternalLink,
  Check,
  Copy,
  Music,
  Radio,
  Sparkles,
  ChevronRight,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  loadUnisonSession,
  clearUnisonSession,
  signInWithIdentityFile,
  signInWithExtension,
  generateAndRegisterNewIdentity,
  fetchMe,
  probeBetterLyricsExtension,
  BL_EXTENSION_ID,
} from '@/lib/unison/authService';
import { ExtensionConnectCard } from './ExtensionConnectCard';
import {
  fetchUnisonUserStats,
  fetchUnisonUserBadges,
  fetchUnisonUserSubmissions,
  fetchUnisonUserRank,
} from '@/lib/unison/apiClient';
import type {
  UnisonStoredSession,
  UnisonUserStats,
  UnisonUserGamification,
  UnisonUserSubmission,
} from '@/lib/unison/types';

interface UnisonProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHub?: () => void;
}

export const UnisonProfileModal: React.FC<UnisonProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenHub,
}) => {
  const [session, setSession] = useState<UnisonStoredSession | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'submissions' | 'badges'>('profile');
  const [authMethod, setAuthMethod] = useState<'extension' | 'file' | 'create'>('file');

  // Async data states
  const [stats, setStats] = useState<UnisonUserStats | null>(null);
  const [gamification, setGamification] = useState<UnisonUserGamification | null>(null);
  const [submissions, setSubmissions] = useState<UnisonUserSubmission[]>([]);
  const [rankInfo, setRankInfo] = useState<{ rank: number; score: number; tier?: string } | null>(
    null
  );

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load session on mount/open
  useEffect(() => {
    if (isOpen) {
      const stored = loadUnisonSession();
      setSession(stored);
      if (stored) {
        loadUserData(stored.keyId, stored.sessionToken);
      } else {
        probeBetterLyricsExtension().then((res) => {
          if (res.isAvailable) {
            setAuthMethod('extension');
          }
        });
      }
    }
  }, [isOpen]);

  const loadUserData = async (keyId: string, token: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const [statsData, badgesData, subsData, rankData] = await Promise.allSettled([
        fetchUnisonUserStats(keyId),
        fetchUnisonUserBadges(keyId),
        fetchUnisonUserSubmissions(keyId, { limit: 25 }),
        fetchUnisonUserRank(keyId),
      ]);

      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (badgesData.status === 'fulfilled') setGamification(badgesData.value);
      if (subsData.status === 'fulfilled') setSubmissions(subsData.value.submissions || []);
      if (rankData.status === 'fulfilled') setRankInfo(rankData.value);
    } catch (err) {
      console.error('Failed to load Unison profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKeyId = () => {
    if (session?.keyId) {
      navigator.clipboard.writeText(session.keyId);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSignOut = () => {
    clearUnisonSession();
    setSession(null);
    setStats(null);
    setGamification(null);
    setSubmissions([]);
    setRankInfo(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setAuthError(null);
    try {
      const newSession = await signInWithIdentityFile(file);
      setSession(newSession);
      await loadUserData(newSession.keyId, newSession.sessionToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import identity file.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExtensionSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const newSession = await signInWithExtension();
      setSession(newSession);
      await loadUserData(newSession.keyId, newSession.sessionToken);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not connect to the Better Lyrics extension. Try importing your identity file instead.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewIdentity = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { session: newSession, exportJson } = await generateAndRegisterNewIdentity();
      setSession(newSession);

      // Auto-trigger backup download for user safety
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `better-lyrics-identity-${newSession.displayName || 'user'}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await loadUserData(newSession.keyId, newSession.sessionToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create identity.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!session?.privateKeyJwk || !session.publicKeyJwk) {
      alert('Private key not cached in this session. Export it from your original identity file.');
      return;
    }
    const exportData = {
      version: 1,
      keyId: session.keyId,
      publicKey: session.publicKeyJwk,
      privateKey: session.privateKeyJwk,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `better-lyrics-identity-${session.displayName || 'backup'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unison-modal-title"
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d0d12] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100 animate-in zoom-in-95 duration-150"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#09090b]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <span className="font-medium text-sm select-none">U</span>
            </div>
            <div>
              <h2 id="unison-modal-title" className="text-sm font-medium text-white tracking-tight">
                Unison Contributor
              </h2>
              <p className="text-xs text-zinc-400">Better Lyrics Crowdsourced Lyrics Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session && onOpenHub && (
              <button
                onClick={() => {
                  onClose();
                  onOpenHub();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white border border-white/[0.06] transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Browse Most Wanted Songs"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>Most Wanted</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Unauthenticated View */}
          {!session ? (
            <div className="space-y-6 py-2">
              <div className="text-center max-w-md mx-auto space-y-2">
                <h3 className="text-base font-medium text-white">Connect your Unison account</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                  Sign in to view your lyrics contributions, earn reputation, and submit verified word-timed
                  TTML directly to the Better Lyrics ecosystem.
                </p>
              </div>

              {/* Method Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl max-w-md mx-auto text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAuthMethod('file')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    authMethod === 'file'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Identity File
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('extension')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    authMethod === 'extension'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Extension
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('create')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    authMethod === 'create'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Create New
                </button>
              </div>

              {/* Error Notice */}
              {authError && (
                <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start gap-2 max-w-md mx-auto">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{authError}</span>
                </div>
              )}

              {/* Option 1: File Upload */}
              {authMethod === 'file' && (
                <div className="space-y-3 max-w-md mx-auto">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/[0.12] hover:border-white/25 rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-white/[0.03] group"
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2.5 text-zinc-400 group-hover:text-white transition-colors" />
                    <p className="text-xs font-medium text-white mb-1">
                      Upload better-lyrics-identity.json
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Exported from Better Lyrics settings or previous OpenLyryc backup
                    </p>
                  </div>
                </div>
              )}

              {/* Option 2: Extension Handshake */}
              {authMethod === 'extension' && (
                <ExtensionConnectCard
                  onSuccess={async (newSession) => {
                    setSession(newSession);
                    await loadUserData(newSession.keyId, newSession.sessionToken);
                  }}
                  onError={(err) => setAuthError(err)}
                  onSwitchToFile={() => setAuthMethod('file')}
                  isLoading={isLoading}
                />
              )}

              {/* Option 3: Instant Create */}
              {authMethod === 'create' && (
                <div className="max-w-md mx-auto text-center space-y-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-left space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-white">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>Instant ECDSA P-256 Keypair</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Don't have an identity yet? OpenLyryc will generate an ECDSA P-256 cryptographic
                      keypair in your browser, register it with Unison, and download your backup file.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewIdentity}
                    disabled={isLoading}
                    className="w-full h-10 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Generate &amp; Download New Identity</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Authenticated User View */
            <div className="space-y-6">
              {/* Profile Header Card */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-rose-500/20 to-zinc-800 border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                    {session.avatarUrl ? (
                      <img
                        src={session.avatarUrl}
                        alt={session.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-white truncate">
                        {session.displayName || 'Unison Contributor'}
                      </h3>
                      {session.council?.admin && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Council Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400 font-normal">
                      <span>{session.keyId.slice(0, 8)}...{session.keyId.slice(-8)}</span>
                      <button
                        onClick={handleCopyKeyId}
                        className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        title="Copy full keyId"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {session.privateKeyJwk && (
                    <button
                      onClick={handleDownloadBackup}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Download Identity Backup"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-950/40 border border-white/[0.06] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bento Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-normal text-zinc-400">Accepted Lyrics</span>
                  <div className="text-xl font-medium text-white">
                    {stats ? stats.approvedCount || stats.contributions : '—'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-normal text-zinc-400">Reputation</span>
                  <div className="text-xl font-medium text-rose-400">
                    {stats?.reputation ? stats.reputation.toFixed(1) : '1.0'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <span className="text-[11px] font-normal text-zinc-400">Curator Rank</span>
                  <div className="text-xl font-medium text-white">
                    {rankInfo?.rank ? `#${rankInfo.rank}` : 'Top Contributor'}
                  </div>
                </div>
              </div>

              {/* Sub-Tabs: Submissions & Badges */}
              <div className="space-y-3">
                <div className="flex items-center gap-1 border-b border-white/[0.06] pb-2 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Recent Submissions ({submissions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('badges')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'badges'
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Badges ({gamification?.badges?.length || 0})
                  </button>
                </div>

                {/* Submissions List */}
                {activeTab === 'profile' && (
                  <div className="space-y-2">
                    {submissions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        No submissions yet. Submit synced lyrics from OpenLyryc to earn badges and rank!
                      </div>
                    ) : (
                      submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl bg-white/[0.015] hover:bg-white/[0.03] border border-white/[0.05] flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{sub.song}</div>
                            <div className="text-[11px] text-zinc-400 truncate">{sub.artist}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                                sub.syncType === 'richsync'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {sub.syncType}
                            </span>
                            <span className="text-zinc-400 text-[11px]">★ {sub.score}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Badges List */}
                {activeTab === 'badges' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {gamification?.badges && gamification.badges.length > 0 ? (
                      gamification.badges.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5"
                        >
                          <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{b.name}</div>
                            <div className="text-[11px] text-zinc-500 line-clamp-2">{b.description}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-8 text-center text-xs text-zinc-500">
                        No badges unlocked yet. Keep submitting lyrics to unlock community milestones!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
