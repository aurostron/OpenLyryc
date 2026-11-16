'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  FolderOpen,
  FolderCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Loader2,
  Copy,
  Download,
  Info,
} from 'lucide-react';
import {
  getFolderConnectionStatus,
  pickAndConnectFolder,
  disconnectFolder,
  syncAllProjectsToFolder,
  verifyFolderPermission,
  getSavedFolderHandle,
  downloadAllProjectsBackup,
  downloadProjectLrc,
  FolderConnectionStatus,
} from '@/lib/fileSystemSync';
import { ProjectRecord } from '@/lib/db';

interface LocalFolderSyncCardProps {
  projects: ProjectRecord[];
  onSyncComplete?: () => void;
  compact?: boolean;
}

export const LocalFolderSyncCard: React.FC<LocalFolderSyncCardProps> = ({
  projects,
  onSyncComplete,
  compact = false,
}) => {
  const [status, setStatus] = useState<FolderConnectionStatus>({
    isSupported: true,
    isConnected: false,
    folderName: null,
    hasPermission: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [showBraveHelp, setShowBraveHelp] = useState(false);

  const isBrave = typeof window !== 'undefined' && Boolean((navigator as unknown as { brave?: unknown }).brave);

  const refreshStatus = useCallback(async () => {
    const s = await getFolderConnectionStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    setMessage(null);
    const res = await pickAndConnectFolder();
    if (res) {
      await refreshStatus();
      setMessage({
        text: `Connected to "${res.name}". Auto-sync is now active.`,
        type: 'success',
      });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleReauthorize = async () => {
    setMessage(null);
    const saved = await getSavedFolderHandle();
    if (!saved) return;
    const granted = await verifyFolderPermission(saved.handle, true);
    await refreshStatus();
    if (granted) {
      setMessage({ text: 'Folder access re-authorized.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ text: 'Permission denied. Please re-select the folder.', type: 'error' });
    }
  };

  const handleDisconnect = async () => {
    await disconnectFolder();
    await refreshStatus();
    setMessage({ text: 'Local folder disconnected.', type: 'info' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSyncAll = async () => {
    if (projects.length === 0) {
      setMessage({ text: 'No projects available to sync.', type: 'info' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: projects.length });
    setMessage(null);

    try {
      const res = await syncAllProjectsToFolder(projects, (current, total) => {
        setSyncProgress({ current, total });
      });

      setMessage({
        text: `Successfully synced ${res.synced} song${res.synced === 1 ? '' : 's'} to disk!`,
        type: 'success',
      });
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Sync failed';
      setMessage({ text: errMsg, type: 'error' });
      await refreshStatus();
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleCopyFlag = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('brave://flags/#file-system-access-api');
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 3000);
    }
  };

  const handleDownloadBackup = () => {
    if (projects.length === 0) {
      setMessage({ text: 'No saved projects to export.', type: 'info' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    downloadAllProjectsBackup(projects);
    setMessage({ text: `Exported ${projects.length} project(s) as JSON backup.`, type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDownloadActiveLrc = () => {
    if (projects.length === 0) return;
    downloadProjectLrc(projects[0]);
    setMessage({ text: `Downloaded "${projects[0].title}.lrc"`, type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  // If File System Access API is disabled by browser (e.g. Brave default setting or Firefox/Safari)
  if (!status.isSupported) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-zinc-300 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Direct Local Folder Sync</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {isBrave ? 'Brave Shields Disabled' : 'Disabled by Browser'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isBrave
                  ? 'Brave blocks native folder access by default for privacy protection.'
                  : 'Your current browser does not have the File System Access API enabled.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshStatus}
            title="Check again"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action and Enable Guide */}
        <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-300 font-medium">
              Want to auto-sync to a folder on disk like <code className="text-amber-300 font-sans">D:\Music\Lyrics</code>?
            </span>
            <button
              type="button"
              onClick={() => setShowBraveHelp(!showBraveHelp)}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer flex items-center gap-1 self-start sm:self-auto"
            >
              <Info className="w-3 h-3" />
              <span>{showBraveHelp ? 'Hide Enable Steps' : 'Enable in 5 Seconds'}</span>
            </button>
          </div>

          {showBraveHelp && (
            <div className="pt-2 text-[11px] text-zinc-300 space-y-1.5 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">1</span>
                <span>Open a new tab and paste:</span>
                <button
                  type="button"
                  onClick={handleCopyFlag}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-sans text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copiedFlag ? 'Copied URL!' : 'brave://flags/#file-system-access-api'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">2</span>
                <span>Set <strong>File System Access API</strong> to <strong>Enabled</strong>.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-bold">3</span>
                <span>Click <strong>Relaunch</strong> Brave. The "Choose Folder" button will appear!</span>
              </div>
            </div>
          )}
        </div>

        {/* 1-Click Fallback Downloads */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
          <span className="text-[11px] text-zinc-500">
            Or save files directly right now:
          </span>
          <div className="flex items-center gap-2">
            {projects.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadActiveLrc}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.08]"
              >
                <Download className="w-3 h-3 text-zinc-400" />
                <span>Export .LRC</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.12]"
            >
              <Download className="w-3 h-3 text-zinc-300" />
              <span>Export All ({projects.length}) as JSON</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'bg-white/5 text-zinc-300'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}
      </div>
    );
  }

  // Active / Supported State (Chrome, Edge, or Brave with flag enabled)
  return (
    <div className={`rounded-xl border transition-all ${
      status.isConnected
        ? 'bg-gradient-to-r from-emerald-950/20 via-zinc-900/40 to-zinc-900/30 border-emerald-500/20'
        : 'bg-white/[0.02] border-white/[0.06]'
    } ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            status.isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-white/5 text-zinc-400 border border-white/10'
          }`}>
            {status.isConnected ? <FolderCheck className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                {status.isConnected ? 'Local Disk Sync Active' : 'Custom Folder Sync'}
              </span>
              {status.isConnected && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              )}
            </div>

            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
              {status.isConnected ? (
                <span>Folder: <strong className="text-zinc-200 font-sans">{status.folderName}</strong> (auto-writes .lrc &amp; .json)</span>
              ) : (
                <span>Pick a local folder (e.g. <code className="text-zinc-300">D:\Music\Lyrics</code>) to save standard .lrc files directly to disk.</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {status.isConnected ? (
            <>
              {!status.hasPermission ? (
                <button
                  type="button"
                  onClick={handleReauthorize}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Grant Permission</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSyncing || projects.length === 0}
                  onClick={handleSyncAll}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing {syncProgress ? `${syncProgress.current}/${syncProgress.total}` : '...'}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync All ({projects.length})</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadBackup}
                title="Download JSON Backup"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                title="Disconnect folder"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.08]"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>Export Backup</span>
              </button>
              <button
                type="button"
                onClick={handleConnect}
                className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Choose Folder</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress / Status Message */}
      {message && (
        <div className={`mt-2.5 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            : message.type === 'error'
            ? 'bg-red-500/10 text-red-300 border border-red-500/20'
            : 'bg-white/5 text-zinc-300'
        }`}>
          {message.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          {message.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
