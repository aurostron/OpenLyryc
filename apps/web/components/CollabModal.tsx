'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Copy,
  Check,
  QrCode,
  LogOut,
  X,
  Radio,
  ArrowRight,
  Shield,
  KeyRound,
  Crown,
  Share2,
  Tv,
  Download,
  Music,
  Edit3,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  CollabUser,
  CollabRoomMode,
  CollabTransport,
  PartyStageConfig,
  PartyPlaybackState,
  PartyAudioTransferState,
} from '@/types/collab';

interface CollabModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const CollabModal: React.FC<CollabModalProps> = ({
  isOpen,
  onClose,
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

  // Sync profile name on open
  const hasInitializedNameRef = useRef(false);
  useEffect(() => {
    if (isOpen && localUser?.name && !hasInitializedNameRef.current) {
      setUserName(localUser.name);
      hasInitializedNameRef.current = true;
    }
    if (!isOpen) {
      hasInitializedNameRef.current = false;
    }
  }, [isOpen, localUser?.name]);

  // Sync mode state from room
  useEffect(() => {
    if (roomMode) {
      setSelectedMode(roomMode);
    }
  }, [roomMode]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate QR code for room link
  useEffect(() => {
    if (roomUrl) {
      QRCode.toDataURL(roomUrl, {
        width: 220,
        margin: 1.5,
        color: { dark: '#ffffff', light: '#09090b' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [roomUrl]);

  if (!isOpen) return null;

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

  const handleNameChange = (val: string) => {
    setUserName(val);
    onUpdateProfile(val);
  };

  const handleCreate = () => {
    onUpdateProfile(userName);
    onCreateRoom(selectedMode, selectedTransport);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputRoomId.trim();
    if (!clean) return;
    onUpdateProfile(userName);
    let effTransport = selectedTransport;
    if (clean.toUpperCase().startsWith('RTC-')) {
      effTransport = 'webrtc';
    } else if (clean.toUpperCase().startsWith('JAM-')) {
      effTransport = 'trystero';
    }
    onJoinRoom(clean, selectedMode, effTransport);
    setInputRoomId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d0d10]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {isConnected ? (selectedMode === 'party' ? 'Watch Party' : 'Live Session') : 'Live Rooms'}
            </h2>
            {isConnected && (
              <span className="text-[11px] font-sans text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                {peers.length + 1} online
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">

          {/* Connected Room Dashboard */}
          {isConnected && roomId ? (
            <div className="space-y-5">
              
              {/* Room Code & Share Box */}
              <div className="p-4 rounded-xl bg-[#121217] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">Room Code</span>
                  <span className="text-[11px] font-sans text-zinc-400">
                    {transport === 'trystero' ? 'Direct (Nostr)' : 'Classic (WebRTC)'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl font-bold tracking-wider font-sans text-white">{roomId}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
                    </button>
                    {qrDataUrl && (
                      <button
                        onClick={() => setShowQr(!showQr)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          showQr ? 'bg-white text-zinc-950 border-white' : 'bg-white/5 border-white/10 text-zinc-300'
                        }`}
                        title="Show QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showQr && qrDataUrl && (
                  <div className="pt-3 border-t border-white/10 flex flex-col items-center gap-2">
                    <img src={qrDataUrl} alt="Room QR Code" className="w-40 h-40 rounded-lg p-2 bg-[#09090b] border border-white/10" />
                    <span className="text-[11px] text-zinc-500 font-sans">Scan on your phone to join</span>
                  </div>
                )}
              </div>

              {/* Mode Selector for Host */}
              {isHost && (
                <div className="p-3.5 rounded-xl bg-[#121217] border border-white/10 space-y-2.5">
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

              {/* Watch Party Controls (When active) */}
              {selectedMode === 'party' && (
                <div className="p-4 rounded-xl bg-[#121217] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-white" />
                      <span className="text-xs font-semibold text-white">Watch Party Stage</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-sans">
                      {isHost ? 'You are host' : 'Following host'}
                    </span>
                  </div>

                  {/* Stage Renderer Selector (Host directs) */}
                  {isHost && onUpdateStageConfig && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400">Screen Mode</label>
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
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              (stageConfig?.mode || 'stage') === opt.id
                                ? 'bg-white text-zinc-950 border-white'
                                : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio File Sync Card */}
                  {playbackState?.audioFileName && (
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Music className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="truncate text-zinc-300">{playbackState.audioFileName}</span>
                      </div>

                      {!isHost && onRequestAudio && (
                        <button
                          onClick={onRequestAudio}
                          disabled={audioTransfer?.isTransferring}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
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

                  <div className="text-[11px] text-zinc-500 font-sans">
                    Protected: only verified audio files (MP3, WAV, OGG, FLAC, M4A) are transferred.
                  </div>
                </div>
              )}

              {/* Participants Roster */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">People in Room</span>
                <div className="space-y-1.5">
                  {/* Local User */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#121217] border border-white/10 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-[10px] text-white">
                        {userName.slice(0, 1).toUpperCase() || 'Y'}
                      </div>
                      <span className="font-medium text-white">{userName || 'You'} (You)</span>
                    </div>
                    <span className="text-[10px] font-sans text-zinc-400">
                      {isHost ? 'Host' : selectedMode === 'party' ? 'Listener' : 'Editor'}
                    </span>
                  </div>

                  {/* Peers */}
                  {peers.map((peer) => (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#121217] border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-[10px] text-white">
                          {peer.name.slice(0, 1).toUpperCase() || 'P'}
                        </div>
                        <span className="text-zinc-200">{peer.name}</span>
                      </div>
                      <span className="text-[10px] font-sans text-zinc-400">
                        {peer.isHost ? 'Host' : selectedMode === 'party' ? 'Listener' : 'Editor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Room CTA */}
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            </div>
          ) : (
            /* Create / Join Dashboard */
            <div className="space-y-5">
              
              {/* Room Mode Switcher */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-300">Room Type</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#121217] border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('edit')}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
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
                    className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedMode === 'party'
                        ? 'bg-white text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Watch Party</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {selectedMode === 'edit'
                    ? 'Everyone can edit lyrics, time words, and see each other work.'
                    : 'You direct the stage screen and play the song. Others listen and watch along.'}
                </p>
              </div>

              {/* Profile Name Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-300">Your Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={30}
                  className="w-full bg-[#121217] border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Connection Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-300">Connection Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTransport('trystero')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      selectedTransport === 'trystero'
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-[#121217] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">Trystero (Nostr)</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Direct P2P, no server needed</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTransport('webrtc')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      selectedTransport === 'webrtc'
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-[#121217] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">Classic WebRTC</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Signaling server fallback</div>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Host or Join */}
              <div className="pt-2 border-t border-white/10 space-y-4">
                
                {/* Host a New Room */}
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isConnecting}
                  className="w-full py-2.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Radio className="w-4 h-4" />
                  <span>{isConnecting ? 'Starting...' : selectedMode === 'party' ? 'Host Watch Party' : 'Create Room'}</span>
                </button>

                {/* Or Join Room Code */}
                <form onSubmit={handleJoin} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value)}
                      placeholder="Enter room code (e.g. JAM-94X)..."
                      className="flex-1 bg-[#121217] border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2 text-xs text-white outline-none font-sans"
                    />
                    <button
                      type="submit"
                      disabled={isConnecting || !inputRoomId.trim()}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>

                {connectionError && (
                  <p className="text-xs text-zinc-400 font-sans bg-white/5 p-2 rounded-lg border border-white/10">
                    {connectionError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
