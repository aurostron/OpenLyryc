'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ChevronRight,
  RefreshCw,
  X,
  AlertCircle,
  Edit2,
  Cloud,
  Link2,
  CheckCircle2,
  ArrowRight,
  Camera,
  AtSign,
  Loader2,
} from 'lucide-react';
import {
  getLocalUserProfile,
  saveLocalUserProfile,
  getUserOwnerSecret,
  LocalUserProfile,
} from '@/lib/userProfile';
import {
  checkUsernameAvailability,
  claimPublicUserProfile,
  fetchProfileByUnisonKey,
  normalizeUsername,
  validateUsernameSyntax,
} from '@/lib/profiles';
import { AvatarPickerModal } from './AvatarPickerModal';
import { BetterLyricsLogo } from '@/components/unison/BetterLyricsLogo';
import { ExtensionConnectCard } from '@/components/unison/ExtensionConnectCard';
import {
  loadUnisonSession,
  clearUnisonSession,
  signInWithIdentityFile,
  signInWithExtension,
  generateAndRegisterNewIdentity,
  probeBetterLyricsExtension,
} from '@/lib/unison/authService';
import {
  fetchUnisonUserStats,
  fetchUnisonUserBadgesDetail,
  fetchUnisonUserSubmissions,
  fetchUnisonUserRank,
  fetchUnisonBadgeCatalog,
  getUnisonBadgeImageUrl,
} from '@/lib/unison/apiClient';
import type {
  UnisonStoredSession,
  UnisonUserStats,
  UnisonUserBadgesResponse,
  UnisonUserSubmission,
  UnisonBadgeCatalogItem,
} from '@/lib/unison/types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUnisonHub?: () => void;
  onNameChanged?: (newName: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenUnisonHub,
  onNameChanged,
}) => {
  // Local Profile State
  const [profile, setProfile] = useState<LocalUserProfile>(getLocalUserProfile);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>('');

  // Avatar Picker Modal
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState<boolean>(false);

  // Username Claiming State
  const [isClaimingUsername, setIsClaimingUsername] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    error?: string;
    isCurrent?: boolean;
  } | null>(null);
  const [isSavingClaim, setIsSavingClaim] = useState<boolean>(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);

  // Unison Account State
  const [unisonSession, setUnisonSession] = useState<UnisonStoredSession | null>(null);
  const [unisonStats, setUnisonStats] = useState<UnisonUserStats | null>(null);
  const [unisonBadges, setUnisonBadges] = useState<UnisonUserBadgesResponse | null>(null);
  const [badgeCatalog, setBadgeCatalog] = useState<Record<string, UnisonBadgeCatalogItem>>({});
  const [unisonSubmissions, setUnisonSubmissions] = useState<UnisonUserSubmission[]>([]);
  const [unisonRank, setUnisonRank] = useState<{ rank: number; score: number; tier?: string } | null>(
    null
  );

  // Filter ONLY earned / unlocked badges (ignore unearned catalog entries)
  const earnedBadges = useMemo(() => {
    if (!unisonBadges?.badges || !Array.isArray(unisonBadges.badges)) return [];
    return unisonBadges.badges.filter((b) => Boolean(b.earned || (b as any).unlocked));
  }, [unisonBadges]);

  // Active view inside modal
  const [activeTab, setActiveTab] = useState<'profile' | 'unison_details'>('profile');
  const [isConnectingUnison, setIsConnectingUnison] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<'file' | 'extension' | 'create'>('file');

  // Async & UX states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unisonError, setUnisonError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isAvatarPickerOpen) {
          setIsAvatarPickerOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isAvatarPickerOpen]);

  // Auto-sync profile if bound to this Unison account in Turso
  const syncProfileFromUnison = async (keyId: string) => {
    try {
      const remote = await fetchProfileByUnisonKey(keyId);
      if (remote?.username) {
        const current = getLocalUserProfile();
        const updated = saveLocalUserProfile({
          username: remote.username,
          displayName: remote.displayName || current.displayName,
          avatarUrl: remote.avatarUrl || current.avatarUrl,
          bio: remote.bio || current.bio,
          ownerSecret: remote.ownerSecret || current.ownerSecret,
          usernameClaimsCount: Math.max(1, current.usernameClaimsCount || 1),
        });
        setProfile(updated);
        setUsernameInput(remote.username);
      }
    } catch (e) {
      console.warn('Unison profile auto-sync error:', e);
    }
  };

  // Load profile and unison session on open
  useEffect(() => {
    if (isOpen) {
      const currentProfile = getLocalUserProfile();
      setProfile(currentProfile);
      setTempName(currentProfile.displayName);
      setUsernameInput(currentProfile.username || '');

      const session = loadUnisonSession();
      setUnisonSession(session);
      if (session) {
        loadUnisonData(session.keyId, session.sessionToken);
        syncProfileFromUnison(session.keyId);
      } else {
        probeBetterLyricsExtension().then((res) => {
          if (res.isAvailable) {
            setAuthMethod('extension');
          }
        });
      }
    }
  }, [isOpen]);

  // Real-time debounced username availability check
  useEffect(() => {
    if (!isClaimingUsername) return;
    const clean = normalizeUsername(usernameInput);
    if (!clean) {
      setUsernameStatus(null);
      return;
    }

    const syntax = validateUsernameSyntax(clean);
    if (!syntax.valid) {
      setUsernameStatus({ checking: false, available: false, error: syntax.error });
      return;
    }

    setUsernameStatus({ checking: true });
    const timer = setTimeout(() => {
      checkUsernameAvailability(clean, profile.username, unisonSession?.keyId, profile.ownerSecret).then((res) => {
        setUsernameStatus({
          checking: false,
          available: res.available,
          error: res.error,
          isCurrent: res.isCurrent,
        });
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameInput, isClaimingUsername, profile.username, unisonSession?.keyId, profile.ownerSecret]);

  const loadUnisonData = async (keyId: string, token: string) => {
    setIsLoading(true);
    setUnisonError(null);
    try {
      const [statsData, badgesData, subsData, rankData, catalogData] = await Promise.allSettled([
        fetchUnisonUserStats(keyId),
        fetchUnisonUserBadgesDetail(keyId),
        fetchUnisonUserSubmissions(keyId, { limit: 20 }),
        fetchUnisonUserRank(keyId),
        fetchUnisonBadgeCatalog(),
      ]);

      if (statsData.status === 'fulfilled') setUnisonStats(statsData.value);
      if (badgesData.status === 'fulfilled' && badgesData.value) setUnisonBadges(badgesData.value);
      if (subsData.status === 'fulfilled' && subsData.value?.submissions) {
        setUnisonSubmissions(subsData.value.submissions);
      }
      if (rankData.status === 'fulfilled') setUnisonRank(rankData.value);
      if (catalogData.status === 'fulfilled' && catalogData.value?.badges) {
        const catMap: Record<string, UnisonBadgeCatalogItem> = {};
        for (const item of catalogData.value.badges) {
          catMap[item.key] = item;
        }
        setBadgeCatalog(catMap);
      }
    } catch (err) {
      console.error('Failed to load Unison profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    const updated = saveLocalUserProfile({ displayName: trimmed });
    setProfile(updated);
    setIsEditingName(false);
    onNameChanged?.(trimmed);

    // Sync to Turso in background if username claimed
    if (updated.username) {
      claimPublicUserProfile({
        username: updated.username,
        displayName: trimmed,
        bio: updated.bio,
        avatarUrl: updated.avatarUrl,
        unisonKeyId: unisonSession?.keyId,
        ownerSecret: updated.ownerSecret || getUserOwnerSecret(),
      }).catch(console.warn);
    }
  };

  const claimsUsed = profile.usernameClaimsCount ?? (profile.username ? 1 : 0);
  const canChangeUsername = claimsUsed < 2;

  const handleClaimUsername = async () => {
    const clean = normalizeUsername(usernameInput);
    if (!clean || usernameStatus?.checking || !usernameStatus?.available) return;

    if (!canChangeUsername) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: 'You have reached the maximum limit of 2 username claims.',
      });
      return;
    }

    setIsSavingClaim(true);
    try {
      const secret = profile.ownerSecret || getUserOwnerSecret();
      const res = await claimPublicUserProfile({
        username: clean,
        previousUsername: profile.username,
        currentClaimsCount: claimsUsed,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        unisonKeyId: unisonSession?.keyId,
        ownerSecret: secret,
      });

      if (res.success) {
        const nextClaimsCount = claimsUsed + 1;
        const updated = saveLocalUserProfile({ username: clean, usernameClaimsCount: nextClaimsCount });
        setProfile(updated);
        setIsClaimingUsername(false);
        setClaimSuccessMessage(
          nextClaimsCount >= 2
            ? `Username changed to @${clean} (2 of 2 claims used).`
            : `Username claimed! Your profile is live at /@${clean}`
        );
        setTimeout(() => setClaimSuccessMessage(null), 4000);
      } else {
        setUsernameStatus({
          checking: false,
          available: false,
          error: res.error || 'Could not claim username',
        });
      }
    } catch (err: any) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: err?.message || 'Network error',
      });
    } finally {
      setIsSavingClaim(false);
    }
  };

  const handleAvatarSelected = (newUrl: string) => {
    const updated = saveLocalUserProfile({ avatarUrl: newUrl });
    setProfile(updated);
    if (updated.username) {
      claimPublicUserProfile({
        username: updated.username,
        displayName: updated.displayName,
        bio: updated.bio,
        avatarUrl: newUrl,
        unisonKeyId: unisonSession?.keyId,
        ownerSecret: updated.ownerSecret || getUserOwnerSecret(),
      }).catch(console.warn);
    }
  };

  const handleCompleteWelcome = () => {
    const trimmed = tempName.trim() || 'Lyricist';
    const updated = saveLocalUserProfile({
      displayName: trimmed,
      hasCompletedWelcome: true,
    });
    setProfile(updated);
    onNameChanged?.(trimmed);
  };

  const handleDisconnectUnison = () => {
    clearUnisonSession();
    setUnisonSession(null);
    setUnisonStats(null);
    setUnisonBadges(null);
    setBadgeCatalog({});
    setUnisonSubmissions([]);
    setUnisonRank(null);
    setActiveTab('profile');
  };

  const handleCopyKeyId = () => {
    if (unisonSession?.keyId) {
      navigator.clipboard.writeText(unisonSession.keyId);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUnisonError(null);
    try {
      const newSession = await signInWithIdentityFile(file);
      setUnisonSession(newSession);
      setIsConnectingUnison(false);
      await loadUnisonData(newSession.keyId, newSession.sessionToken);
      syncProfileFromUnison(newSession.keyId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import identity file.';
      setUnisonError(message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExtensionSignIn = async () => {
    setIsLoading(true);
    setUnisonError(null);
    try {
      const newSession = await signInWithExtension();
      setUnisonSession(newSession);
      setIsConnectingUnison(false);
      await loadUnisonData(newSession.keyId, newSession.sessionToken);
      syncProfileFromUnison(newSession.keyId);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not connect to the Better Lyrics extension. Try importing your identity file instead.';
      setUnisonError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewIdentity = async () => {
    setIsLoading(true);
    setUnisonError(null);
    try {
      const { session: newSession, exportJson } = await generateAndRegisterNewIdentity();
      setUnisonSession(newSession);
      setIsConnectingUnison(false);

      // Auto-trigger backup download
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `better-lyrics-identity-${newSession.displayName || 'user'}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await loadUnisonData(newSession.keyId, newSession.sessionToken);
      syncProfileFromUnison(newSession.keyId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create identity.';
      setUnisonError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!unisonSession?.privateKeyJwk || !unisonSession.publicKeyJwk) {
      alert('Private key not cached in this session. Export it from your original identity file.');
      return;
    }
    const exportData = {
      version: 1,
      keyId: unisonSession.keyId,
      publicKey: unisonSession.publicKeyJwk,
      privateKey: unisonSession.privateKeyJwk,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `better-lyrics-identity-${unisonSession.displayName || 'backup'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Active avatar URL: local profile avatar takes precedence, then Unison avatar
  const activeAvatarUrl = profile.avatarUrl || unisonSession?.avatarUrl;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. WELCOME ONBOARDING SCREEN (First-time setup)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!profile.hasCompletedWelcome) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative w-full max-w-md bg-[#09090b] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden p-7 font-sans text-zinc-100 space-y-6 animate-in zoom-in-95 duration-150">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-white">
              <User className="w-5 h-5 text-zinc-300" />
            </div>
            <h2 className="text-lg font-light text-white tracking-tight">Welcome to OpenLyryc</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Set your name to author and credit timed lyrics across synced platforms.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCompleteWelcome()}
                placeholder="e.g. Shrek"
                className="w-full h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            <button
              onClick={handleCompleteWelcome}
              disabled={!tempName.trim()}
              className="w-full h-10 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 active:scale-[0.98]"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 text-center">
            You can customize your picture and claim your @username anytime from this profile.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MAIN UNIVERSAL PROFILE MODAL
  // ─────────────────────────────────────────────────────────────────────────────
  const publicProfileUsername = (profile.username || unisonSession?.displayName || profile.displayName || 'aurostron')
    .toLowerCase()
    .replace(/^@+/, '');

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative w-full max-w-xl bg-[#09090b] border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh] font-sans text-zinc-100 animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#0d0d12]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white">
                <User className="w-4 h-4 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white tracking-tight">Lyricist Profile</h2>
                <p className="text-xs text-zinc-400">Contributor identity &amp; public portfolio</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Success Toast */}
            {claimSuccessMessage && (
              <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/[0.12] text-xs text-zinc-200 flex items-center gap-2 animate-in fade-in duration-150">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{claimSuccessMessage}</span>
              </div>
            )}

            {/* Section A: Non-Boxy Profile Identity Card */}
            <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* Profile Picture (Clickable to open Avatar Picker) */}
                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(true)}
                  className="relative w-15 h-15 rounded-full overflow-hidden bg-white/[0.04] ring-1 ring-white/15 hover:ring-white/40 transition-all cursor-pointer group shrink-0 select-none shadow-sm"
                  title="Change profile picture"
                >
                  {activeAvatarUrl ? (
                    <img
                      src={activeAvatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white font-medium text-lg">
                      {profile.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <Camera className="w-4 h-4" />
                    <span className="text-[9px] font-medium mt-0.5">Edit</span>
                  </div>
                </button>

                <div className="min-w-0 flex-1">
                  {/* Display Name with inline edit */}
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        className="h-7 px-2 text-xs font-medium bg-white/[0.06] border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer"
                        title="Save name"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-white tracking-tight truncate">
                        {profile.displayName}
                      </h3>
                      <button
                        onClick={() => {
                          setTempName(profile.displayName);
                          setIsEditingName(true);
                        }}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Edit display name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Username Display & Claiming Trigger */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {profile.username ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-sans text-xs text-zinc-300 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                          @{profile.username}
                        </span>
                        {canChangeUsername ? (
                          <button
                            type="button"
                            onClick={() => {
                              setUsernameInput(profile.username || '');
                              setIsClaimingUsername(true);
                            }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                            title="Change username (1 change remaining)"
                          >
                            Change (1 left)
                          </button>
                        ) : (
                          <span
                            className="text-[10px] text-zinc-500 font-sans select-none px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                            title="Username claim limit reached (maximum 2 total)"
                          >
                            Limit reached (2/2)
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setUsernameInput(profile.displayName.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                          setIsClaimingUsername(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <AtSign className="w-3 h-3" />
                        <span>Claim now!</span>
                      </button>
                    )}

                    {unisonSession && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-zinc-200 border border-white/[0.08] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Unison</span>
                      </span>
                    )}

                    <a
                      href={`/@${publicProfileUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                    >
                      <span>Public Profile</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              {unisonSession?.privateKeyJwk && (
                <button
                  onClick={handleDownloadBackup}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  title="Download Identity File Backup"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Username Claiming Drawer / Inline Card */}
            {isClaimingUsername && (
              <div className="p-4 rounded-2xl bg-[#0e0e13] border border-white/[0.1] space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AtSign className="w-4 h-4 text-zinc-300" />
                    <h4 className="text-xs font-medium text-white">Claim your unique @username</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsClaimingUsername(false)}
                    className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your public profile will be available at{' '}
                  <span className="font-sans text-zinc-200">openlyryc.pages.dev/@{usernameInput ? normalizeUsername(usernameInput) : 'username'}</span>
                  {claimsUsed > 0 && (
                    <span className="block mt-1 text-[11px] text-amber-300/90 font-medium">
                      Note: This is your 2nd and final username claim.
                    </span>
                  )}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-sans text-zinc-500">
                        @
                      </span>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="yourname"
                        className="w-full h-9 pl-7 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-sans text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleClaimUsername}
                      disabled={
                        !usernameStatus?.available ||
                        usernameStatus?.checking ||
                        isSavingClaim ||
                        !usernameInput.trim()
                      }
                      className="h-9 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 active:scale-[0.98]"
                    >
                      {isSavingClaim ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Claim</span>
                      )}
                    </button>
                  </div>

                  {/* Availability Feedback (Ultra clean, no jargon) */}
                  <div className="text-[11px] min-h-[18px]">
                    {usernameStatus?.checking ? (
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Checking availability...</span>
                      </span>
                    ) : usernameStatus?.isCurrent ? (
                      <span className="text-zinc-400">This is already your claimed username.</span>
                    ) : usernameStatus?.available ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" />
                        <span>Username is available!</span>
                      </span>
                    ) : usernameStatus?.error ? (
                      <span className="text-zinc-400">{usernameStatus.error}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tabs: Services vs Unison Details */}
            {unisonSession && (
              <div className="flex items-center gap-1 border-b border-white/[0.06] pb-2 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Connected Accounts
                </button>
                <button
                  onClick={() => setActiveTab('unison_details')}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'unison_details'
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Unison Contributions</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/[0.08] text-zinc-300">
                    {unisonSubmissions.length}
                  </span>
                </button>
              </div>
            )}

            {/* TAB 1: CONNECTED ACCOUNTS & SERVICES */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Services &amp; Integrations
                </h4>

                {/* CARD 1: UNISON (BETTER LYRICS) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                        <BetterLyricsLogo size={22} variant="monochrome" className="text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-medium text-white">Unison</h5>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                          Connect your Unison account to submit lyrics and track contributions.
                        </p>
                      </div>
                    </div>

                    {unisonSession ? (
                      <button
                        onClick={handleDisconnectUnison}
                        className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-red-950/30 text-[11px] text-zinc-400 hover:text-red-300 border border-white/[0.06] transition-colors cursor-pointer shrink-0"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsConnectingUnison(true)}
                        className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer shrink-0 active:scale-[0.98]"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  {/* If Unison Connected: Quick Summary Pill */}
                  {unisonSession && (
                    <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {unisonSession.displayName || 'Unison Member'}
                        </span>
                        <span className="text-zinc-500">·</span>
                        <span className="font-sans text-[11px] text-zinc-500">
                          {unisonSession.keyId.slice(0, 6)}...{unisonSession.keyId.slice(-6)}
                        </span>
                      </div>

                      <button
                        onClick={() => setActiveTab('unison_details')}
                        className="text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                      >
                        <span>View Activity</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* CARD 2: GOOGLE ACCOUNT (COMING SOON) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] opacity-80 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-medium text-white">Google Account</h5>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-white/[0.06] text-zinc-400">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                        Save drafts and projects across devices.
                      </p>
                    </div>
                  </div>

                  <button
                    disabled
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] text-zinc-500 text-xs font-medium cursor-not-allowed shrink-0 border border-white/[0.04]"
                  >
                    Sync
                  </button>
                </div>

                {/* UNISON CONNECTION SHEET (When user clicks Connect) */}
                {isConnectingUnison && !unisonSession && (
                  <div className="p-4 rounded-2xl bg-[#121217] border border-white/[0.1] space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-medium text-white flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Choose connection method</span>
                      </h5>
                      <button
                        onClick={() => setIsConnectingUnison(false)}
                        className="text-zinc-400 hover:text-white p-1 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Method Switcher */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('file')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          authMethod === 'file'
                            ? 'bg-white text-zinc-950 font-medium shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Identity File
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('extension')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          authMethod === 'extension'
                            ? 'bg-white text-zinc-950 font-medium shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Extension
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('create')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          authMethod === 'create'
                            ? 'bg-white text-zinc-950 font-medium shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Create New
                      </button>
                    </div>

                    {unisonError && (
                      <div className="p-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span>{unisonError}</span>
                      </div>
                    )}

                    {authMethod === 'file' && (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border border-dashed border-white/[0.14] hover:border-white/30 rounded-xl p-5 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-white/[0.03]"
                        >
                          <Upload className="w-5 h-5 mx-auto mb-1.5 text-zinc-400" />
                          <p className="text-xs font-medium text-white">
                            Upload better-lyrics-identity.json
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            Exported from Better Lyrics settings
                          </p>
                        </div>
                      </div>
                    )}

                    {authMethod === 'extension' && (
                      <ExtensionConnectCard
                        onSuccess={async (newSession) => {
                          setUnisonSession(newSession);
                          setIsConnectingUnison(false);
                          await loadUnisonData(newSession.keyId, newSession.sessionToken);
                          syncProfileFromUnison(newSession.keyId);
                        }}
                        onError={(err) => setUnisonError(err)}
                        onSwitchToFile={() => setAuthMethod('file')}
                        isLoading={isLoading}
                      />
                    )}

                    {authMethod === 'create' && (
                      <div className="text-center space-y-2">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Generate a fresh ECDSA P-256 keypair in your browser and download your backup file.
                        </p>
                        <button
                          onClick={handleCreateNewIdentity}
                          disabled={isLoading}
                          className="w-full h-9 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Key className="w-3.5 h-3.5" />
                              <span>Generate &amp; Download Key</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UNISON ACTIVITY & GAMIFICATION */}
            {activeTab === 'unison_details' && unisonSession && (
              <div className="space-y-5">
                {/* Stats Bento */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-0.5">
                    <span className="text-[11px] font-medium text-zinc-400">Accepted Lyrics</span>
                    <div className="text-lg font-medium text-white">
                      {unisonStats ? unisonStats.approvedCount || unisonStats.contributions : '—'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-0.5">
                    <span className="text-[11px] font-medium text-zinc-400">Reputation</span>
                    <div className="text-lg font-medium text-white">
                      {unisonStats?.reputation ? unisonStats.reputation.toFixed(1) : '1.0'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-0.5">
                    <span className="text-[11px] font-medium text-zinc-400">Leaderboard Rank</span>
                    <div className="text-lg font-medium text-white">
                      {unisonRank?.rank ? `#${unisonRank.rank}` : 'Ranked'}
                    </div>
                  </div>
                </div>

                {/* Submissions List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-white">Recent Submissions</h4>
                    {onOpenUnisonHub && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenUnisonHub();
                        }}
                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Find New Songs</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {unisonSubmissions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500 bg-white/[0.01] border border-white/[0.04] rounded-2xl">
                      No submissions yet. Submit synced lyrics from OpenLyryc to earn badges and rank!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {unisonSubmissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.05] flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{sub.song}</div>
                            <div className="text-[11px] text-zinc-400 truncate">{sub.artist}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-white/[0.06] text-zinc-300">
                              {sub.syncType}
                            </span>
                            <span className="text-zinc-400 text-[11px]">★ {sub.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Badges Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-white">
                      Earned Badges {earnedBadges.length > 0 && `(${earnedBadges.length})`}
                    </h4>
                    {onOpenUnisonHub && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenUnisonHub();
                        }}
                        className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Browse Badges</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {earnedBadges.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {earnedBadges.map((b) => {
                        const badgeKey = b.key;
                        const catalogItem = badgeCatalog[badgeKey];
                        const title =
                          catalogItem?.name ||
                          badgeKey.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                        const description =
                          catalogItem?.description || 'Verified Unison achievement';
                        const imageUrl = getUnisonBadgeImageUrl(badgeKey, catalogItem?.image?.color);

                        return (
                          <div
                            key={badgeKey}
                            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center gap-2.5 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 p-1">
                              <img
                                src={imageUrl}
                                alt={title}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  const directFallback = `https://unison.betterlyrics.org/badges/${encodeURIComponent(badgeKey)}/image.svg?variant=color&v=2`;
                                  if (target.src !== directFallback) {
                                    target.src = directFallback;
                                  }
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-white truncate">{title}</div>
                              <div className="text-[10px] text-zinc-400 line-clamp-1">{description}</div>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-sans shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/10">
                              Earned
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1.5">
                      <div className="w-8 h-8 mx-auto rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="text-xs text-zinc-300 font-medium">No badges unlocked yet</div>
                      <div className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                        Submit timed lyrics or curate songs on Unison to unlock your first contributor badge!
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Picture Selector Modal */}
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        currentAvatarUrl={profile.avatarUrl}
        onSelectAvatar={handleAvatarSelected}
      />
    </>
  );
};
