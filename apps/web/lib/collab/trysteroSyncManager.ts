import * as Y from 'yjs';
import { OpenLyricsDocument, LyricLine } from '@/types/lyrics';
import {
  CollabUser,
  CollabCursor,
  CollabRoomMode,
  PartyStageConfig,
  PartyPlaybackState,
  CollabSongChange,
} from '@/types/collab';
import { validateAudioMagicBytes, sanitizeAudioFilename } from '@/lib/security/audioValidator';
import { sanitizeDocumentMetadata, sanitizeString } from '@/lib/security/sandbox';

export interface TrysteroSyncCallbacks {
  onDocumentChange?: (doc: OpenLyricsDocument) => void;
  onPeersChange?: (peers: CollabUser[]) => void;
  onStatusChange?: (status: { connected: boolean; peersCount: number }) => void;
  onStageSync?: (stage: PartyStageConfig) => void;
  onPlaybackSync?: (playback: PartyPlaybackState) => void;
  onSongChange?: (song: CollabSongChange) => void;
  onAudioFileReceived?: (blob: Blob, fileName: string) => void;
  onAudioProgress?: (progressPercent: number) => void;
  onAudioError?: (errorMsg: string) => void;
}

export class TrysteroSyncManager {
  public ydoc: Y.Doc;
  public roomId: string;
  public roomMode: CollabRoomMode;
  private localUser: CollabUser;
  private callbacks: TrysteroSyncCallbacks;
  private isDestroyed = false;

  // Trystero Room & Action Handlers
  private room: any = null;
  private peerMap = new Map<string, CollabUser>();
  private docUpdateSender: any = null;
  private docSyncSender: any = null;
  private presenceSender: any = null;
  private stageSender: any = null;
  private playbackSender: any = null;
  private songChangeSender: any = null;
  private audioRequestSender: any = null;
  private audioTransferSender: any = null;
  private cursorSender: any = null;

  // Cached Audio File for P2P sharing
  private cachedAudioBuffer: ArrayBuffer | null = null;
  private cachedAudioName: string = 'track.mp3';

  // Cached State for Instant Sync on Peer Connect
  private lastStageConfig?: PartyStageConfig;
  private lastPlaybackState?: PartyPlaybackState;
  private lastSongChange?: CollabSongChange;

  // Yjs Shared Types
  private yLines: Y.Array<LyricLine>;
  private yMetadata: Y.Map<unknown>;
  private docChangeRafId: number | null = null;

  constructor(
    roomId: string,
    initialDocument: OpenLyricsDocument | null,
    localUser: CollabUser,
    callbacks: TrysteroSyncCallbacks = {},
    roomMode: CollabRoomMode = 'edit',
    password?: string
  ) {
    this.roomId = roomId.toUpperCase().trim();
    this.localUser = localUser;
    this.callbacks = callbacks;
    this.roomMode = roomMode;
    this.ydoc = new Y.Doc();

    this.yLines = this.ydoc.getArray<LyricLine>('lyrics_lines');
    this.yMetadata = this.ydoc.getMap<unknown>('lyrics_metadata');

    if (localUser.isHost && initialDocument) {
      this.seedInitialDocument(initialDocument);
    }

    this.initTrystero(password);
    this.attachYjsListeners();
  }

  private seedInitialDocument(doc: OpenLyricsDocument | null) {
    this.ydoc.transact(() => {
      if (doc) {
        if (this.yLines.length === 0 && doc.lines && doc.lines.length > 0) {
          this.yLines.push(doc.lines);
        }
        if (this.yMetadata.size === 0 && doc.metadata) {
          Object.entries(doc.metadata).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
              this.yMetadata.set(key, val);
            }
          });
        }
      }
      if (this.localUser.isHost) {
        this.yMetadata.set('hostUserId', this.localUser.id);
        this.yMetadata.set('hostName', this.localUser.name);
      }
    }, 'initial-seed');
  }

  private async initTrystero(password?: string) {
    if (typeof window === 'undefined') return;

    try {
      const { joinRoom } = await import('trystero/nostr');

      const config: any = {
        appId: 'openlyryc-studio-v1',
        relayConfig: {
          urls: [
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.primal.net',
            'wss://nostr.mom',
            'wss://0x-nostr-relay.fly.dev',
          ],
          redundancy: 4,
        },
      };
      if (password) {
        config.password = password;
      }

      this.room = joinRoom(config, this.roomId);

      // Universal Action Registrations (supports both Modern Object API and Legacy Tuple API)
      const registerAction = (
        actionId: string,
        onMsg: (data: any, peerId: string, metadata?: any) => void,
        onProgress?: (progressPercent: number, peerId: string, metadata?: any) => void
      ) => {
        const safeOnMsg = (data: any, peerId: string, metadata?: any) => {
          try {
            onMsg(data, peerId, metadata);
          } catch (err) {
            console.warn(`[Trystero] Action ${actionId} handler error:`, err);
          }
        };

        const safeOnProgress = (progress: number, peerId: string, metadata?: any) => {
          try {
            onProgress?.(progress, peerId, metadata);
          } catch (err) {
            console.warn(`[Trystero] Action ${actionId} progress error:`, err);
          }
        };

        const action = this.room.makeAction(actionId);
        if (Array.isArray(action)) {
          const [sendFn, onReceiveFn, onProgressFn] = action;
          onReceiveFn((data: any, peerId: string, metadata?: any) => {
            safeOnMsg(data, peerId, metadata);
          });
          if (typeof onProgressFn === 'function') {
            onProgressFn((prog: number, peerId: string, metadata?: any) => {
              safeOnProgress(prog, peerId, metadata);
            });
          }
          return (data: any, opts?: any) => {
            const target = typeof opts === 'string' ? opts : opts?.target;
            const meta = opts?.metadata;
            return sendFn(data, target, meta);
          };
        } else {
          action.onMessage = (data: any, ctx: any) => {
            const peerId = typeof ctx === 'string' ? ctx : ctx?.peerId || '';
            safeOnMsg(data, peerId, ctx?.metadata);
          };
          if (onProgress) {
            action.onReceiveProgress = (prog: number, ctx: any) => {
              const peerId = typeof ctx === 'string' ? ctx : ctx?.peerId || '';
              safeOnProgress(prog, peerId, ctx?.metadata);
            };
          }
          return (data: any, opts?: any) => {
            const options = typeof opts === 'string' ? { target: opts } : (opts || {});
            return action.send(data, options);
          };
        }
      };

      this.docUpdateSender = registerAction('doc_upd', (data: any) => {
        if (this.isDestroyed) return;
        try {
          const update = data instanceof Uint8Array ? data : new Uint8Array(data);
          if (update.byteLength > 2) {
            Y.applyUpdate(this.ydoc, update, 'trystero');
          }
        } catch (e) {
          console.warn('[Trystero] Error applying remote update:', e);
        }
      });

      this.docSyncSender = registerAction('doc_sync', (data: any, peerId: string) => {
        if (this.isDestroyed) return;
        try {
          if (data.type === 'sv' && data.sv) {
            const remoteSv = new Uint8Array(data.sv);
            const diff = Y.encodeStateAsUpdate(this.ydoc, remoteSv);
            if (diff.byteLength > 2 && this.docSyncSender) {
              this.docSyncSender({ type: 'diff', diff: Array.from(diff) }, { target: peerId });
            }
          } else if (data.type === 'diff' && data.diff) {
            const diff = data.diff instanceof Uint8Array ? data.diff : new Uint8Array(data.diff);
            if (diff.byteLength > 2) {
              Y.applyUpdate(this.ydoc, diff, 'trystero');
            }
          }
        } catch (e) {
          console.warn('[Trystero] Sync step error:', e);
        }
      });

      this.presenceSender = registerAction('presence', (presence: CollabUser, peerId: string) => {
        if (this.isDestroyed || !presence) return;
        this.peerMap.set(peerId, {
          ...presence,
          id: peerId,
        });
        this.callbacks.onPeersChange?.(Array.from(this.peerMap.values()));
      });

      this.stageSender = registerAction('stage_cfg', (stageConfig: PartyStageConfig) => {
        if (this.isDestroyed || !stageConfig) return;
        this.callbacks.onStageSync?.(stageConfig);
      });

      this.playbackSender = registerAction('playback', (playbackState: PartyPlaybackState) => {
        if (this.isDestroyed || !playbackState) return;
        this.callbacks.onPlaybackSync?.(playbackState);
      });

      this.songChangeSender = registerAction('song_chg', (song: CollabSongChange) => {
        if (this.isDestroyed || !song) return;
        this.callbacks.onSongChange?.(song);
      });

      this.audioRequestSender = registerAction('aud_req', (req: any, peerId: string) => {
        if (this.isDestroyed || !this.localUser.isHost) return;
        if (req?.action === 'get_audio' && this.cachedAudioBuffer && this.audioTransferSender) {
          this.audioTransferSender(this.cachedAudioBuffer, {
            target: peerId,
            metadata: { fileName: this.cachedAudioName },
          });
        }
      });

      this.audioTransferSender = registerAction('aud_file', (buffer: ArrayBuffer | Uint8Array, peerId: string, metadata?: any) => {
        if (this.isDestroyed) return;
        try {
          // Security verification: magic bytes, safe audio check
          const validation = validateAudioMagicBytes(buffer);
          if (!validation.valid) {
            const err = validation.error || 'Invalid audio file received.';
            this.callbacks.onAudioError?.(err);
            return;
          }

          const rawName = metadata?.fileName || 'song.mp3';
          const safeName = sanitizeAudioFilename(rawName);
          const mimeType = validation.mimeType || 'audio/mpeg';

          const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
          const arrayBuf = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
          const blob = new Blob([arrayBuf], { type: mimeType });
          this.callbacks.onAudioFileReceived?.(blob, safeName);
        } catch (e: any) {
          this.callbacks.onAudioError?.(e?.message || 'Failed to process audio file.');
        }
      });

      this.cursorSender = registerAction('cursor', (data: { x: number; y: number }, peerId: string) => {
        if (this.isDestroyed || !data) return;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:collab-cursor', {
              detail: {
                peerId,
                cursor: data,
                peer: this.peerMap.get(peerId),
              },
            })
          );
        }
      });

      // Peer joined room (support both setter and method registration)
      const handlePeerJoin = (peerId: string) => {
        if (this.isDestroyed) return;

        // Exchange state vector with newly joined peer
        try {
          const sv = Y.encodeStateVector(this.ydoc);
          this.docSyncSender({ type: 'sv', sv: Array.from(sv) }, { target: peerId });
        } catch (e) {
          console.warn('[Trystero] Failed to send state vector:', e);
        }

        // Send local presence to peer
        this.broadcastPresence();

        // If host has stage config or playback state, immediately transmit to new peer
        if (this.localUser.isHost) {
          if (this.lastStageConfig && this.stageSender) {
            try {
              this.stageSender(this.lastStageConfig, { target: peerId });
            } catch {}
          }

          if (this.lastPlaybackState && this.playbackSender) {
            try {
              this.playbackSender(this.lastPlaybackState, { target: peerId });
            } catch {}
          }

          if (this.lastSongChange && this.songChangeSender) {
            try {
              this.songChangeSender(this.lastSongChange, { target: peerId });
            } catch {}
          }

          // If host has an audio file cached, notify peer
          if (this.cachedAudioBuffer) {
            this.broadcastPlaybackState({
              currentTime: 0,
              isPlaying: false,
              playbackRate: 1,
              duration: 0,
              timestamp: Date.now(),
              audioFileName: this.cachedAudioName,
              audioFileSize: this.cachedAudioBuffer.byteLength,
            });
          }
        }

        this.emitStatus();
      };

      if (typeof this.room.onPeerJoin === 'function') {
        this.room.onPeerJoin(handlePeerJoin);
      } else {
        this.room.onPeerJoin = handlePeerJoin;
      }

      // Peer left room (support both setter and method registration)
      const handlePeerLeave = (peerId: string) => {
        if (this.isDestroyed) return;
        this.peerMap.delete(peerId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:collab-cursor-leave', {
              detail: { peerId },
            })
          );
        }
        this.callbacks.onPeersChange?.(Array.from(this.peerMap.values()));
        this.emitStatus();
      };

      if (typeof this.room.onPeerLeave === 'function') {
        this.room.onPeerLeave(handlePeerLeave);
      } else {
        this.room.onPeerLeave = handlePeerLeave;
      }

      // Immediate initial broadcast
      this.broadcastPresence();
      this.emitStatus();
    } catch (e) {
      console.error('[Trystero] Initialization failed:', e);
    }
  }

  private attachYjsListeners() {
    // Forward local Yjs changes to peers
    this.ydoc.on('update', (update: Uint8Array, origin: string) => {
      if (origin === 'trystero' || this.isDestroyed) return;
      if (this.docUpdateSender) {
        try {
          this.docUpdateSender(Array.from(update));
        } catch (e) {
          console.warn('[Trystero] Failed to broadcast update:', e);
        }
      }
    });

    const triggerDocumentChange = (_events: unknown[], transaction: Y.Transaction) => {
      if (this.isDestroyed || !this.callbacks.onDocumentChange) return;
      // Skip if this transaction was initiated by local editor dispatch or initial seed
      if (
        transaction &&
        (transaction.origin === 'local-editor' ||
          transaction.origin === 'initial-seed' ||
          transaction.origin === 'local-broadcast')
      ) {
        return;
      }

      if (this.docChangeRafId !== null) cancelAnimationFrame(this.docChangeRafId);

      this.docChangeRafId = requestAnimationFrame(() => {
        this.docChangeRafId = null;
        if (this.isDestroyed) return;
        const currentDoc = this.getCurrentDocument();
        this.callbacks.onDocumentChange?.(currentDoc);
      });
    };

    this.yLines.observeDeep(triggerDocumentChange);
    this.yMetadata.observeDeep(triggerDocumentChange);
  }

  public updateProfile(name: string, colorIndex: number) {
    this.localUser.name = sanitizeString(name).slice(0, 30);
    this.broadcastPresence();
  }

  public updatePresence(patch: Partial<CollabUser>) {
    Object.assign(this.localUser, patch);
    this.broadcastPresence();
  }

  public updateCursor(cursor: CollabCursor | null) {
    this.localUser.cursor = cursor;
    if (this.cursorSender && !this.isDestroyed) {
      try {
        if (cursor) {
          this.cursorSender({ x: cursor.x, y: cursor.y });
        } else {
          this.cursorSender({ x: -999, y: -999 });
        }
      } catch {}
    }
  }

  private broadcastPresence() {
    if (!this.presenceSender || this.isDestroyed) return;
    try {
      this.presenceSender({
        id: this.localUser.id,
        name: this.localUser.name,
        color: this.localUser.color || '#ffffff',
        badgeBg: this.localUser.badgeBg || 'bg-zinc-800',
        badgeText: this.localUser.badgeText || 'text-white',
        cursor: this.localUser.cursor,
        activeLineIndex: this.localUser.activeLineIndex,
        activeTokenIndex: this.localUser.activeTokenIndex,
        isSyncing: this.localUser.isSyncing,
        isHost: this.localUser.isHost,
        role: this.localUser.role || (this.localUser.isHost ? 'host' : 'editor'),
        roomMode: this.roomMode,
      });
    } catch {}
  }

  public broadcastStageConfig(config: PartyStageConfig) {
    if (this.isDestroyed) return;
    const configWithMode: PartyStageConfig = {
      ...config,
      roomMode: config.roomMode || this.roomMode,
    };
    this.lastStageConfig = configWithMode;
    if (this.stageSender) {
      try {
        this.stageSender(configWithMode);
      } catch {}
    }
  }

  public broadcastPlaybackState(playback: PartyPlaybackState) {
    if (this.isDestroyed) return;
    this.lastPlaybackState = playback;
    if (this.playbackSender) {
      try {
        this.playbackSender(playback);
      } catch {}
    }
  }

  public broadcastSongChange(song: CollabSongChange) {
    if (this.isDestroyed) return;
    this.lastSongChange = song;
    if (this.songChangeSender) {
      try {
        this.songChangeSender(song);
      } catch {}
    }
  }

  /**
   * Caches an audio file on the host side so guests can download it.
   */
  public setHostAudioFile(buffer: ArrayBuffer, fileName: string) {
    this.cachedAudioBuffer = buffer;
    this.cachedAudioName = sanitizeAudioFilename(fileName);
  }

  /**
   * Guest calls this to request the song file from the host.
   */
  public requestAudioFromHost() {
    if (!this.audioRequestSender || this.isDestroyed) return;
    try {
      this.audioRequestSender({ action: 'get_audio' });
    } catch {}
  }

  /**
   * Pushes local editor document state into Yjs using diff-based reconciliation.
   * Instead of destructive clear+push (which breaks CRDT edits and floods peer networks),
   * this reconciles line-by-line and only transmits real changes.
   */
  public broadcastDocumentChange(doc: OpenLyricsDocument) {
    if (this.isDestroyed) return;
    this.ydoc.transact(() => {
      // 1. Reconcile lines array with in-place diffing (preserves untouched peer edits)
      const localLines = doc.lines || [];

      for (let i = 0; i < localLines.length; i++) {
        const localLine = localLines[i];
        if (i < this.yLines.length) {
          const currentYLine = this.yLines.get(i) as LyricLine;
          if (JSON.stringify(currentYLine) !== JSON.stringify(localLine)) {
            this.yLines.delete(i, 1);
            this.yLines.insert(i, [localLine]);
          }
        } else {
          this.yLines.push([localLine]);
        }
      }

      // Trim trailing lines if local document has fewer lines
      if (this.yLines.length > localLines.length) {
        this.yLines.delete(localLines.length, this.yLines.length - localLines.length);
      }

      // 2. Update metadata
      if (doc.metadata) {
        const currentMetaKeys = Array.from(this.yMetadata.keys());
        const newKeys = new Set(Object.keys(doc.metadata));

        currentMetaKeys.forEach((key) => {
          if (!newKeys.has(key) && key !== 'hostUserId' && key !== 'hostName' && key !== 'syncedBy') {
            this.yMetadata.delete(key);
          }
        });

        Object.entries(doc.metadata).forEach(([k, v]) => {
          if (k !== 'syncedBy') {
            if (v !== undefined && v !== null) {
              this.yMetadata.set(k, v);
            } else {
              this.yMetadata.delete(k);
            }
          }
        });
      }
    }, 'local-editor');
  }

  public getCurrentDocument(): OpenLyricsDocument {
    const rawLines = this.yLines.toArray();
    const rawMeta = this.yMetadata.toJSON() as Record<string, any>;
    const cleanMeta = sanitizeDocumentMetadata(rawMeta) as Record<string, any>;

    return {
      $schema: 'https://openlyrics.dev/schema/v1.json',
      version: 1,
      metadata: {
        title: cleanMeta.title || 'Untitled Track',
        artist: cleanMeta.artist || 'Untitled Artist',
        album: cleanMeta.album || '',
        duration: typeof cleanMeta.duration === 'number' ? cleanMeta.duration : 0,
        syncedBy: this.localUser.name || cleanMeta.syncedBy || 'OpenLyryc Collaborator',
        language: cleanMeta.language,
        isrc: cleanMeta.isrc,
        spotifyId: cleanMeta.spotifyId,
        youtubeId: cleanMeta.youtubeId,
        appleMusicId: cleanMeta.appleMusicId,
        audioFileName: cleanMeta.audioFileName,
        audioHash: cleanMeta.audioHash,
        offset: typeof cleanMeta.offset === 'number' ? cleanMeta.offset : 0,
        precisionMode: Boolean(cleanMeta.precisionMode),
        coverArt: cleanMeta.coverArt,
        ambientGlow: cleanMeta.ambientGlow !== undefined ? Boolean(cleanMeta.ambientGlow) : true,
        vocalists: cleanMeta.vocalists,
        platformLinks: cleanMeta.platformLinks,
        canonicalKey: cleanMeta.canonicalKey,
        lyricsSimhash: cleanMeta.lyricsSimhash,
        lyricsHash: cleanMeta.lyricsHash,
        isCanonicalMaster: cleanMeta.isCanonicalMaster,
      },
      lines: rawLines.map((l) => ({
        ...l,
        text: sanitizeString(l.text || '', 2000),
        section: l.section ? sanitizeString(l.section, 100) : undefined,
      })),
    };
  }

  private emitStatus() {
    this.callbacks.onStatusChange?.({
      connected: true,
      peersCount: this.peerMap.size,
    });
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.docChangeRafId !== null) {
      cancelAnimationFrame(this.docChangeRafId);
      this.docChangeRafId = null;
    }
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
    this.peerMap.clear();
    this.ydoc.destroy();
  }
}
