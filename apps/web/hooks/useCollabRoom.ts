'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { OpenLyricsDocument } from '@/types/lyrics';
import {
  CollabUser,
  CollabCursor,
  CollabRoomMode,
  CollabTransport,
  PartyStageConfig,
  PartyPlaybackState,
  PartyAudioTransferState,
  CollabSongChange,
} from '@/types/collab';
import { getCollabColor } from '@/lib/collab/colorPalette';

interface UseCollabRoomOptions {
  currentDocument: OpenLyricsDocument;
  onRemoteDocumentChange: (doc: OpenLyricsDocument) => void;
  onStageSync?: (stage: PartyStageConfig) => void;
  onPlaybackSync?: (playback: PartyPlaybackState) => void;
  onSongChange?: (song: CollabSongChange) => void;
  onAudioFileReceived?: (blob: Blob, fileName: string) => void;
}

export function useCollabRoom({
  currentDocument,
  onRemoteDocumentChange,
  onStageSync,
  onPlaybackSync,
  onSongChange,
  onAudioFileReceived,
}: UseCollabRoomOptions) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomMode, setRoomMode] = useState<CollabRoomMode>('edit');
  const [transport, setTransport] = useState<CollabTransport>('trystero');
  const [peers, setPeers] = useState<CollabUser[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Watch Party & Audio Transfer State
  const [stageConfig, setStageConfig] = useState<PartyStageConfig | null>(null);
  const [playbackState, setPlaybackState] = useState<PartyPlaybackState | null>(null);
  const [audioTransfer, setAudioTransfer] = useState<PartyAudioTransferState | null>(null);

  // Persistent profile
  const [localUser, setLocalUser] = useState<CollabUser>(() => {
    let savedName = '';
    let savedColorIdx = 0;

    if (typeof window !== 'undefined') {
      try {
        savedName = localStorage.getItem('openlyrics_collab_name') || '';
        const rawIdx = localStorage.getItem('openlyrics_collab_color');
        if (rawIdx !== null) {
          savedColorIdx = parseInt(rawIdx, 10) || 0;
        }
      } catch (e) {
        console.warn('Failed to read profile from storage:', e);
      }
    }

    const theme = getCollabColor(savedColorIdx);
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : `usr-${Math.random().toString(36).slice(2, 8)}`,
      name: savedName || 'Writer',
      color: theme.hex,
      badgeBg: theme.badgeBg,
      badgeText: theme.badgeText,
      activeLineIndex: null,
      activeTokenIndex: null,
      isSyncing: false,
      cursor: null,
      role: 'editor',
    };
  });

  const syncManagerRef = useRef<any>(null);
  const currentDocRef = useRef(currentDocument);
  const hasAutoJoinedRef = useRef(false);

  // Up-to-date callback references
  const onRemoteDocChangeRef = useRef(onRemoteDocumentChange);
  const onStageSyncRef = useRef(onStageSync);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  const onSongChangeRef = useRef(onSongChange);
  const onAudioFileReceivedRef = useRef(onAudioFileReceived);

  onRemoteDocChangeRef.current = onRemoteDocumentChange;
  onStageSyncRef.current = onStageSync;
  onPlaybackSyncRef.current = onPlaybackSync;
  onSongChangeRef.current = onSongChange;
  onAudioFileReceivedRef.current = onAudioFileReceived;
  currentDocRef.current = currentDocument;

  const generateRoomCode = useCallback((chosenTransport: CollabTransport = 'trystero') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = chosenTransport === 'webrtc' ? 'RTC-' : 'JAM-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }, []);

  const joinRoom = useCallback(
    async (
      targetRoomId: string,
      asHost: boolean = false,
      password?: string,
      selectedMode: CollabRoomMode = 'edit',
      selectedTransport: CollabTransport = 'trystero'
    ) => {
      const cleanId = targetRoomId.toUpperCase().trim();
      if (!cleanId) return;

      // Automatically deduce transport from code prefix if available
      let effectiveTransport = selectedTransport;
      if (cleanId.startsWith('RTC-')) {
        effectiveTransport = 'webrtc';
      } else if (cleanId.startsWith('JAM-')) {
        effectiveTransport = 'trystero';
      }

      if (syncManagerRef.current) {
        syncManagerRef.current.destroy();
        syncManagerRef.current = null;
      }

      setIsConnecting(true);
      setConnectionError(null);
      setRoomId(cleanId);
      setIsHost(asHost);
      setRoomMode(selectedMode);
      setTransport(effectiveTransport);

      const userWithRole: CollabUser = {
        ...localUser,
        isHost: asHost,
        role: asHost ? 'host' : selectedMode === 'party' ? 'listener' : 'editor',
        roomMode: selectedMode,
      };
      setLocalUser(userWithRole);

      try {
        if (effectiveTransport === 'trystero') {
          const { TrysteroSyncManager } = await import('@/lib/collab/trysteroSyncManager');
          const manager = new TrysteroSyncManager(
            cleanId,
            asHost ? currentDocRef.current : null,
            userWithRole,
            {
              onDocumentChange: (remoteDoc) => {
                if (remoteDoc.lines && remoteDoc.lines.length > 0) {
                  onRemoteDocChangeRef.current(remoteDoc);
                }
              },
              onPeersChange: (updatedPeers) => {
                setPeers(updatedPeers);
                if (!asHost) {
                  const hostPeer = updatedPeers.find((p) => p.isHost || p.role === 'host');
                  if (hostPeer?.roomMode) {
                    setRoomMode(hostPeer.roomMode);
                  }
                }
              },
              onStatusChange: (status) => {
                setIsConnected(status.connected);
                if (status.connected) {
                  setIsConnecting(false);
                }
              },
              onStageSync: (stage) => {
                setStageConfig(stage);
                if (stage.roomMode && !asHost) {
                  setRoomMode(stage.roomMode);
                }
                onStageSyncRef.current?.(stage);
              },
              onPlaybackSync: (playback) => {
                setPlaybackState(playback);
                onPlaybackSyncRef.current?.(playback);
              },
              onSongChange: (song) => {
                onSongChangeRef.current?.(song);
              },
              onAudioFileReceived: (blob, fileName) => {
                setAudioTransfer({
                  isTransferring: false,
                  progress: 100,
                  fileName,
                  fileSize: blob.size,
                });
                onAudioFileReceivedRef.current?.(blob, fileName);
              },
              onAudioProgress: (progress) => {
                setAudioTransfer((prev) => ({
                  isTransferring: true,
                  progress,
                  fileName: prev?.fileName,
                  fileSize: prev?.fileSize,
                }));
              },
              onAudioError: (error) => {
                setAudioTransfer((prev) => ({
                  isTransferring: false,
                  progress: 0,
                  error,
                  fileName: prev?.fileName,
                }));
              },
            },
            selectedMode,
            password
          );
          syncManagerRef.current = manager;
        } else {
          // Classic WebRTC fallback
          const { YjsSyncManager } = await import('@/lib/collab/yjsSyncManager');
          const manager = new YjsSyncManager(
            cleanId,
            asHost ? currentDocRef.current : null,
            userWithRole,
            {
              onDocumentChange: (remoteDoc) => {
                if (remoteDoc.lines && remoteDoc.lines.length > 0) {
                  onRemoteDocChangeRef.current(remoteDoc);
                }
              },
              onPeersChange: (updatedPeers) => {
                setPeers(updatedPeers);
                if (!asHost) {
                  const hostPeer = updatedPeers.find((p) => p.isHost || p.role === 'host');
                  if (hostPeer?.roomMode) {
                    setRoomMode(hostPeer.roomMode);
                  }
                }
              },
              onStatusChange: (status) => {
                setIsConnected(status.connected);
                if (status.connected) {
                  setIsConnecting(false);
                }
              },
              onStageSync: (stage) => {
                setStageConfig(stage);
                if (stage.roomMode && !asHost) {
                  setRoomMode(stage.roomMode);
                }
                onStageSyncRef.current?.(stage);
              },
              onPlaybackSync: (playback) => {
                setPlaybackState(playback);
                onPlaybackSyncRef.current?.(playback);
              },
              onSongChange: (song) => {
                onSongChangeRef.current?.(song);
              },
            },
            password
          );
          syncManagerRef.current = manager;
        }

        // Update URL hash for sharing
        if (typeof window !== 'undefined') {
          const modeParam = selectedMode !== 'edit' ? `&mode=${selectedMode}` : '';
          const transportParam = effectiveTransport !== 'trystero' ? `&t=${effectiveTransport}` : '';
          window.history.replaceState(null, '', `${window.location.pathname}#room=${cleanId}${modeParam}${transportParam}`);
        }
      } catch (err: unknown) {
        console.error('[useCollabRoom] Join failed:', err);
        const msg = err instanceof Error ? err.message : 'Could not connect to room.';
        setConnectionError(msg);
        setIsConnecting(false);
      }
    },
    [localUser]
  );

  const leaveRoom = useCallback(() => {
    if (syncManagerRef.current) {
      syncManagerRef.current.destroy();
      syncManagerRef.current = null;
    }

    setRoomId(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsHost(false);
    setPeers([]);
    setConnectionError(null);
    setStageConfig(null);
    setPlaybackState(null);
    setAudioTransfer(null);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.delete('room');
      url.searchParams.delete('mode');
      url.searchParams.delete('t');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
    }
  }, []);

  const createRoom = useCallback(
    (selectedMode: CollabRoomMode = 'edit', selectedTransport: CollabTransport = 'trystero', password?: string) => {
      const newRoomId = generateRoomCode(selectedTransport);
      joinRoom(newRoomId, true, password, selectedMode, selectedTransport);
      return newRoomId;
    },
    [generateRoomCode, joinRoom]
  );

  const updatePresence = useCallback((partial: Partial<CollabUser>) => {
    setLocalUser((prev) => {
      const next = { ...prev, ...partial };
      if (syncManagerRef.current?.updatePresence) {
        syncManagerRef.current.updatePresence(next);
      }
      return next;
    });
  }, []);

  const updateCursor = useCallback((cursor: CollabCursor | null) => {
    if (syncManagerRef.current && isConnected) {
      if (syncManagerRef.current.updateCursor) {
        syncManagerRef.current.updateCursor(cursor);
      } else if (syncManagerRef.current.updatePresence) {
        syncManagerRef.current.updatePresence({ cursor });
      }
    }
  }, [isConnected]);

  const updateLocalProfile = useCallback((name: string, colorIndex: number = 0) => {
    const theme = getCollabColor(colorIndex);
    const updated: Partial<CollabUser> = {
      name,
      color: theme.hex,
      badgeBg: theme.badgeBg,
      badgeText: theme.badgeText,
    };

    if (typeof window !== 'undefined') {
      try {
        if (name.trim()) {
          localStorage.setItem('openlyrics_collab_name', name.trim());
        }
        localStorage.setItem('openlyrics_collab_color', String(colorIndex));
      } catch (e) {
        console.warn('Failed to save profile:', e);
      }
    }

    setLocalUser((prev) => {
      const next = { ...prev, ...updated };
      if (syncManagerRef.current?.updateProfile) {
        syncManagerRef.current.updateProfile(next.name.trim() || 'Writer', colorIndex);
      } else if (syncManagerRef.current?.updatePresence) {
        syncManagerRef.current.updatePresence({
          ...next,
          name: next.name.trim() || 'Writer',
        });
      }
      return next;
    });
  }, []);

  const updateRoomMode = useCallback(
    (newMode: CollabRoomMode) => {
      setRoomMode(newMode);
      if (syncManagerRef.current) {
        syncManagerRef.current.roomMode = newMode;
        const updatedUser: CollabUser = {
          ...localUser,
          role: isHost ? 'host' : newMode === 'party' ? 'listener' : 'editor',
          roomMode: newMode,
        };
        setLocalUser(updatedUser);
        if (syncManagerRef.current.updatePresence) {
          syncManagerRef.current.updatePresence(updatedUser);
        }
        if (isHost && syncManagerRef.current.broadcastStageConfig) {
          syncManagerRef.current.broadcastStageConfig({
            mode: stageConfig?.mode || 'flow',
            fontFamily: stageConfig?.fontFamily || 'poppins',
            fontWeight: stageConfig?.fontWeight || '500',
            ambientGlow: stageConfig?.ambientGlow ?? true,
            roomMode: newMode,
            colorsBeatDivision: stageConfig?.colorsBeatDivision ?? '4',
            colorsFontFamily: stageConfig?.colorsFontFamily || 'anton',
            colorsFontSize: stageConfig?.colorsFontSize ?? 1,
          });
        }
      }
      if (typeof window !== 'undefined' && roomId) {
        const modeParam = newMode !== 'edit' ? `&mode=${newMode}` : '';
        const transportParam = transport !== 'trystero' ? `&t=${transport}` : '';
        const stagePrefix = newMode === 'party' ? 'stage&' : '';
        window.history.replaceState(null, '', `${window.location.pathname}#${stagePrefix}room=${roomId}${modeParam}${transportParam}`);
      }
    },
    [isHost, localUser, stageConfig, roomId, transport]
  );

  const broadcastDocumentChange = useCallback((doc: OpenLyricsDocument) => {
    if (syncManagerRef.current) {
      if (syncManagerRef.current.broadcastDocumentChange) {
        syncManagerRef.current.broadcastDocumentChange(doc);
      } else if (syncManagerRef.current.pushLocalDocument) {
        syncManagerRef.current.pushLocalDocument(doc);
      }
    }
  }, []);

  const broadcastStageConfig = useCallback((config: PartyStageConfig) => {
    setStageConfig(config);
    if (syncManagerRef.current?.broadcastStageConfig) {
      syncManagerRef.current.broadcastStageConfig(config);
    }
  }, []);

  const broadcastPlaybackState = useCallback((playback: PartyPlaybackState) => {
    setPlaybackState(playback);
    if (syncManagerRef.current?.broadcastPlaybackState) {
      syncManagerRef.current.broadcastPlaybackState(playback);
    }
  }, []);

  const broadcastSongChange = useCallback((song: CollabSongChange) => {
    if (syncManagerRef.current?.broadcastSongChange) {
      syncManagerRef.current.broadcastSongChange(song);
    }
  }, []);

  const setHostAudioFile = useCallback((buffer: ArrayBuffer, fileName: string) => {
    if (syncManagerRef.current?.setHostAudioFile) {
      syncManagerRef.current.setHostAudioFile(buffer, fileName);
    }
  }, []);

  const requestAudioFromHost = useCallback(() => {
    if (syncManagerRef.current?.requestAudioFromHost) {
      setAudioTransfer({
        isTransferring: true,
        progress: 0,
      });
      syncManagerRef.current.requestAudioFromHost();
    }
  }, []);

  // Auto-detect #room=... or ?room=... from URL on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (hasAutoJoinedRef.current) return;
      hasAutoJoinedRef.current = true;

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);
      const urlRoom = hashParams.get('room') || searchParams.get('room');
      const urlMode = (hashParams.get('mode') || searchParams.get('mode')) as CollabRoomMode | null;
      const urlTransport = (hashParams.get('t') || searchParams.get('t')) as CollabTransport | null;

      if (urlRoom) {
        let detectedTransport: CollabTransport = 'trystero';
        if (urlTransport === 'webrtc' || urlRoom.toUpperCase().startsWith('RTC-')) {
          detectedTransport = 'webrtc';
        } else if (urlTransport === 'trystero' || urlRoom.toUpperCase().startsWith('JAM-')) {
          detectedTransport = 'trystero';
        }

        const timer = setTimeout(() => {
          joinRoom(
            urlRoom,
            false,
            undefined,
            urlMode === 'party' ? 'party' : 'edit',
            detectedTransport
          );
        }, 60);
        return () => clearTimeout(timer);
      }
    }
  }, [joinRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncManagerRef.current) {
        syncManagerRef.current.destroy();
        syncManagerRef.current = null;
      }
    };
  }, []);

  const roomUrl = typeof window !== 'undefined' && roomId
    ? `${window.location.origin}${window.location.pathname}#${roomMode === 'party' ? 'stage&' : ''}room=${roomId}&t=${transport}${roomMode === 'party' ? '&mode=party' : ''}`
    : null;

  return {
    roomId,
    roomUrl,
    roomMode,
    transport,
    isConnected,
    isConnecting,
    isHost,
    peers,
    peerCount: peers.length,
    localUser,
    connectionError,
    stageConfig,
    playbackState,
    audioTransfer,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePresence,
    updateCursor,
    updateLocalProfile,
    updateRoomMode,
    broadcastDocumentChange,
    broadcastStageConfig,
    broadcastPlaybackState,
    broadcastSongChange,
    setHostAudioFile,
    requestAudioFromHost,
  };
}
