'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  CollabUser,
  CollabRoomMode,
  CollabTransport,
  PartyStageConfig,
  PartyPlaybackState,
  PartyAudioTransferState,
} from '@/types/collab';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  QrCode,
  LogOut,
  Radio,
  ArrowRight,
  Share2,
  Tv,
  Download,
  Music,
  Edit3,
} from 'lucide-react';

interface CollabViewProps {
  onBack: () => void;
  roomId: string | null;
  roomUrl: string | null;
  roomMode?: CollabRoomMode;
  transport?: CollabTransport;
  isConnected: boolean;
  isConnecting: boolean;
  isHost: boolean;
  peers: CollabUser[];
  localUser: CollabUser | null;
  connectionError: string | null;
  stageConfig?: PartyStageConfig | null;
  playbackState?: PartyPlaybackState | null;
  audioTransfer?: PartyAudioTransferState | null;
  onCreateRoom: (mode?: CollabRoomMode, transport?: CollabTransport) => void;
  onJoinRoom: (roomId: string, mode?: CollabRoomMode, transport?: CollabTransport) => void;
  onLeaveRoom: () => void;
  onUpdateProfile: (name: string) => void;
  onUpdateStageConfig?: (stage: PartyStageConfig) => void;
  onUpdateRoomMode?: (mode: CollabRoomMode) => void;
  onRequestAudio?: () => void;
}

const STAGE_OPTIONS = [
  { id: 'stage', label: 'Stage' },
  { id: 'flow', label: 'Flow' },
  { id: 'kinetic', label: 'Kinetic' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'alve', label: 'Town' },
  { id: 'peak', label: 'Peak' },
  { id: 'colors', label: 'Colors' },
  { id: 'flythrough', label: 'Flythrough' },
] as const;

export const CollabView: React.FC<CollabViewProps> = ({
  onBack,
  roomId,
  roomUrl,
  roomMode = 'edit',
  transport = 'trystero',
  isConnected,
  isConnecting,
  isHost,
  peers,
  localUser,
  connectionError,
  stageConfig,
  playbackState,
  audioTransfer,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onUpdateProfile,
  onUpdateStageConfig,
  onUpdateRoomMode,
  onRequestAudio,
}) => {
  const [selectedMode, setSelectedMode] = useState<CollabRoomMode>(roomMode);
  const [selectedTransport, setSelectedTransport] = useState<CollabTransport>(transport);
  const [inputRoomId, setInputRoomId] = useState('');
  const [userName, setUserName] = useState(localUser?.name || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Synchronize local input once
  const hasInitializedNameRef = useRef(false);
  useEffect(() => {
    if (localUser?.name && !hasInitializedNameRef.current) {
      setUserName(localUser.name);
      hasInitializedNameRef.current = true;
    }
  }, [localUser?.name]);

  useEffect(() => {
    if (roomMode) {
      setSelectedMode(roomMode);
    }
  }, [roomMode]);

  // Generate QR Code when roomUrl is present
  useEffect(() => {
    if (roomUrl) {
      QRCode.toDataURL(roomUrl, {
        width: 200,
        margin: 1.5,
        color: { dark: '#ffffff', light: '#09090b' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [roomUrl]);

  const handleCopyLink = () => {
    if (!roomUrl) return;
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUserNameChange = (val: string) => {
    setUserName(val);
    onUpdateProfile(val);
  };

  const handleRoomIdInput = (val: string) => {
    setInputRoomId(val);
    const upper = val.toUpperCase().trim();
    if (upper.startsWith('RTC-')) {
      setSelectedTransport('webrtc');
    } else if (upper.startsWith('JAM-')) {
      setSelectedTransport('trystero');
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputRoomId.trim();
    if (clean) {
      onUpdateProfile(userName);
      let effTransport = selectedTransport;
      if (clean.toUpperCase().startsWith('RTC-')) {
        effTransport = 'webrtc';
      } else if (clean.toUpperCase().startsWith('JAM-')) {
        effTransport = 'trystero';
      }
      onJoinRoom(clean, selectedMode, effTransport);
      setInputRoomId('');
    }
  };

  const handleCreateRoom = () => {
    onUpdateProfile(userName);
    onCreateRoom(selectedMode, selectedTransport);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] text-zinc-100 select-none overflow-hidden font-sans">
      
      {/* Top Header - Strictly Monochrome, No Dots */}
      <header className="h-14 bg-[#0d0d10] border-b border-white/[0.08] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Studio"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Studio</span>
          </button>
          
          <div className="h-4 w-[1px] bg-white/10" />
          
          <h1 className="text-xs font-semibold text-white tracking-wide">
            {isConnected ? (selectedMode === 'party' ? 'Watch Party' : 'Live Editing') : 'Live Rooms'}
          </h1>

          {isConnected && (
            <span className="text-[11px] font-sans text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md">
              {peers.length + 1} online
            </span>
          )}
        </div>

        {isConnected && (
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Session</span>
          </button>
        )}
      </header>

      {/* Main Full-Screen Body */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* When Not Connected: Unified, Non-Boxy Configuration & Action Hub */}
          {!isConnected ? (
            <div className="space-y-8">
              
              {/* Configuration Controls - Consistent h-10 Controls, Zero Nested Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-6 border-b border-white/[0.08]">
                
                {/* 1. Name Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-sans uppercase tracking-wider text-zinc-500">Your Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => handleUserNameChange(e.target.value)}
                    placeholder="Enter name..."
                    maxLength={30}
                    className="h-10 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-white/30 text-xs text-white outline-none w-full font-sans transition-colors placeholder:text-zinc-600"
                  />
                </div>

                {/* 2. Room Type Pill */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-sans uppercase tracking-wider text-zinc-500">Room Type</label>
                  <div className="h-10 p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedMode('edit')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedMode === 'edit'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Edit Together</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMode('party')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedMode === 'party'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>Watch Party</span>
                    </button>
                  </div>
                </div>

                {/* 3. Connection Method Pill */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-sans uppercase tracking-wider text-zinc-500">Network</label>
                  <div className="h-10 p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTransport('trystero')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                        selectedTransport === 'trystero'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Nostr P2P
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTransport('webrtc')}
                      className={`flex-1 h-8 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center ${
                        selectedTransport === 'webrtc'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      WebRTC
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Action Arena - Two Balanced, Equal-Proportion Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Card 1: Host Room */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 flex flex-col justify-between h-[210px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white tracking-tight">Host a Room</h2>
                      <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded">
                        {selectedMode === 'party' ? 'Watch Party' : 'Edit Together'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {selectedMode === 'party'
                        ? 'Stream song playback and stage visuals. Friends listen and follow along in sync.'
                        : 'Create a live editing session for your current track. Collaborate with word timers in real time.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    disabled={isConnecting}
                    className="w-full h-10 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <span>{isConnecting ? 'Starting...' : 'Create Room'}</span>
                  </button>
                </div>

                {/* Card 2: Join Room */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 flex flex-col justify-between h-[210px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white tracking-tight">Join a Room</h2>
                      <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded">
                        Code
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Enter the 6-character room code from your host to connect directly from your browser.
                    </p>
                  </div>

                  <form onSubmit={handleJoinSubmit}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputRoomId}
                        onChange={(e) => handleRoomIdInput(e.target.value)}
                        placeholder="e.g. JAM-94X or RTC-94X"
                        className="flex-1 h-10 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] focus:border-white/30 text-xs text-white font-sans outline-none tracking-wider uppercase transition-colors placeholder:text-zinc-600"
                      />
                      <button
                        type="submit"
                        disabled={isConnecting || !inputRoomId.trim()}
                        className="h-10 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <span>Join</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {connectionError && (
                <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.08] text-xs text-zinc-400 font-sans">
                  {connectionError}
                </div>
              )}

              {/* Quiet Footer Note */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-zinc-500 font-sans">
                  Direct browser connection. Audio and lyrics never leave your local room.
                </p>
              </div>
            </div>
          ) : (
            /* Connected Room Dashboard - Clean & Proportional */
            <div className="space-y-6">
              
              {/* Room Code Banner */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-500">Room Code</span>
                    <div className="text-3xl font-bold tracking-widest font-sans text-white">{roomId}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="h-9 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-sans text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="h-9 px-3.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
                    </button>

                    {qrDataUrl && (
                      <button
                        type="button"
                        onClick={() => setShowQr(!showQr)}
                        className={`h-9 w-9 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                          showQr ? 'bg-white text-zinc-950 border-white' : 'bg-white/[0.04] border-white/[0.08] text-zinc-300'
                        }`}
                        title="Toggle QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showQr && qrDataUrl && (
                  <div className="pt-4 border-t border-white/[0.08] flex flex-col items-center gap-2">
                    <img src={qrDataUrl} alt="Room QR Code" className="w-36 h-36 rounded-lg p-2 bg-[#09090b] border border-white/[0.08]" />
                    <span className="text-[10px] text-zinc-500 font-sans">Scan on phone to join</span>
                  </div>
                )}
              </div>

              {/* Mode Selector for Host */}
              {isHost && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">Session Mode</span>
                    <span className="text-[10px] text-zinc-500 font-sans">
                      {selectedMode === 'party' ? 'Audience watch party' : 'Collaborative editor'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMode('edit');
                        onUpdateRoomMode?.('edit');
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedMode === 'edit'
                          ? 'bg-white text-zinc-950 border-white font-semibold'
                          : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Live Sync</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${selectedMode === 'edit' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                        Shared lyric editing
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMode('party');
                        onUpdateRoomMode?.('party');
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        selectedMode === 'party'
                          ? 'bg-white text-zinc-950 border-white font-semibold'
                          : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Tv className="w-3.5 h-3.5" />
                        <span>Watch Party</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${selectedMode === 'party' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                        Fullscreen audience stage
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Watch Party Stage Bar (If in Party Mode) */}
              {selectedMode === 'party' && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-white" />
                      <span className="text-xs font-semibold text-white">Stage Screen Mode</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-sans">
                      {isHost ? 'Host directing' : 'Syncing with host'}
                    </span>
                  </div>

                  {isHost && onUpdateStageConfig && (
                    <div className="flex flex-wrap gap-1.5">
                      {STAGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onUpdateStageConfig({
                              mode: opt.id,
                              fontFamily: stageConfig?.fontFamily || 'poppins',
                              fontWeight: stageConfig?.fontWeight || '500',
                              ambientGlow: stageConfig?.ambientGlow ?? true,
                              colorsBeatDivision: stageConfig?.colorsBeatDivision ?? '4',
                              colorsFontFamily: stageConfig?.colorsFontFamily ?? 'anton',
                              colorsFontSize: stageConfig?.colorsFontSize ?? 1,
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            (stageConfig?.mode || 'stage') === opt.id
                              ? 'bg-white text-zinc-950 border-white font-semibold'
                              : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Audio File Sync Card */}
                  {playbackState?.audioFileName && (
                    <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Music className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs text-white block truncate">{playbackState.audioFileName}</span>
                          <span className="text-[10px] text-zinc-500 font-sans">
                            {playbackState.audioFileSize
                              ? `${(playbackState.audioFileSize / (1024 * 1024)).toFixed(1)} MB`
                              : 'Shared track'}
                          </span>
                        </div>
                      </div>

                      {!isHost && onRequestAudio && (
                        <button
                          type="button"
                          onClick={onRequestAudio}
                          disabled={audioTransfer?.isTransferring}
                          className="h-8 px-3 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {audioTransfer?.isTransferring
                              ? `Downloading ${audioTransfer.progress}%`
                              : 'Download Song'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Participants Roster */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-500">Participants</span>
                  <span className="text-[11px] text-zinc-400 font-sans">{peers.length + 1} online</span>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {/* Local User */}
                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white">
                        {userName.slice(0, 1).toUpperCase() || 'Y'}
                      </div>
                      <span className="text-xs font-medium text-white">{userName || 'You'} (You)</span>
                    </div>
                    <span className="text-[10px] font-sans text-zinc-500">
                      {isHost ? 'Host' : selectedMode === 'party' ? 'Listener' : 'Editor'}
                    </span>
                  </div>

                  {/* Remote Peers */}
                  {peers.map((peer) => (
                    <div key={peer.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white">
                          {peer.name.slice(0, 1).toUpperCase() || 'P'}
                        </div>
                        <span className="text-xs text-zinc-300">{peer.name}</span>
                      </div>
                      <span className="text-[10px] font-sans text-zinc-500">
                        {peer.isHost ? 'Host' : selectedMode === 'party' ? 'Listener' : 'Editor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
