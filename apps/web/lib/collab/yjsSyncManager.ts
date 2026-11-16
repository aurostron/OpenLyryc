import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { OpenLyricsDocument, LyricLine, LyricMetadata } from '@/types/lyrics';
import { CollabUser, CollabCursor, PartyStageConfig, PartyPlaybackState, CollabSongChange } from '@/types/collab';
import { sanitizeDocumentMetadata, sanitizeString } from '@/lib/security/sandbox';

// Active, verified WebRTC signaling servers for global cross-computer peer discovery
const DEFAULT_SIGNALING_SERVERS = [
  'wss://y-webrtc-eu.fly.dev',
  'wss://y-webrtc.fly.dev',
  'wss://y-webrtc-signaling.fly.dev',
  'wss://signaling.fly.dev',
];

export interface YjsSyncCallbacks {
  onDocumentChange?: (doc: OpenLyricsDocument) => void;
  onPeersChange?: (peers: CollabUser[]) => void;
  onStatusChange?: (status: { connected: boolean; peersCount: number }) => void;
  onStageSync?: (stage: PartyStageConfig) => void;
  onPlaybackSync?: (playback: PartyPlaybackState) => void;
  onSongChange?: (song: CollabSongChange) => void;
}

export class YjsSyncManager {
  public ydoc: Y.Doc;
  public provider: WebrtcProvider | null = null;
  public roomId: string;
  private callbacks: YjsSyncCallbacks;
  private isDestroyed = false;
  private localUser: CollabUser;

  // Throttle & debounce timers for performance
  private awarenessThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private docChangeRafId: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  // Yjs Shared Types
  private yLines: Y.Array<LyricLine>;
  private yMetadata: Y.Map<unknown>;

  constructor(
    roomId: string,
    initialDocument: OpenLyricsDocument | null,
    localUser: CollabUser,
    callbacks: YjsSyncCallbacks = {},
    password?: string
  ) {
    this.roomId = roomId.toUpperCase().trim();
    this.localUser = localUser;
    this.callbacks = callbacks;
    this.ydoc = new Y.Doc();

    this.yLines = this.ydoc.getArray<LyricLine>('lyrics_lines');
    this.yMetadata = this.ydoc.getMap<unknown>('lyrics_metadata');

    // If host has an initial document and Y.Doc is empty, seed it
    if (localUser.isHost && initialDocument) {
      this.seedInitialDocument(initialDocument);
    }

    // Set up WebRTC Provider
    this.initProvider(password);
    this.attachListeners();
  }

  /**
   * Seeds the Yjs document with the initial lyrics document if empty.
   */
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

  /**
   * Connects to WebRTC signaling servers and negotiates peer connections.
   */
  private initProvider(password?: string) {
    if (typeof window === 'undefined') return;

    try {
      const roomTopic = `openlyryc-v1-${this.roomId}`;
      this.provider = new WebrtcProvider(
        roomTopic,
        this.ydoc,
        {
          signaling: DEFAULT_SIGNALING_SERVERS,
          password: password || undefined,
          awareness: this.provider?.awareness,
          maxConns: 25,
          filterBcConns: true,
          peerOpts: {
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
              ],
            },
          },
        }
      );

      // Set initial user awareness
      this.provider.awareness.setLocalStateField('user', this.localUser);
    } catch (err) {
      console.error('[YjsSyncManager] Failed to init WebRTC Provider:', err);
    }
  }

  /**
   * Attaches observation listeners for CRDT changes and awareness updates.
   */
  private attachListeners() {
    // 1. Observe lines array and metadata changes (debounced via rAF to batch rapid events)
    const handleChange = (_events: unknown[], transaction: Y.Transaction) => {
      if (this.isDestroyed) return;
      // Skip if this transaction was initiated by our own local editor dispatch
      if (transaction.origin === 'local-editor' || transaction.origin === 'initial-seed') {
        return;
      }

      // Debounce via requestAnimationFrame — batches rapid sequential CRDT events
      if (this.docChangeRafId !== null) {
        cancelAnimationFrame(this.docChangeRafId);
      }
      this.docChangeRafId = requestAnimationFrame(() => {
        this.docChangeRafId = null;
        if (this.isDestroyed) return;
        const updatedDoc = this.exportDocument();
        if (this.callbacks.onDocumentChange) {
          this.callbacks.onDocumentChange(updatedDoc);
        }
      });
    };

    this.yLines.observeDeep(handleChange);
    this.yMetadata.observeDeep(handleChange);

    // Observe stage config and playback state replication
    this.yMetadata.observe((event: Y.YMapEvent<unknown>) => {
      if (this.isDestroyed) return;
      if (event.keysChanged.has('stageConfig')) {
        const stage = this.yMetadata.get('stageConfig') as PartyStageConfig | undefined;
        if (stage && this.callbacks.onStageSync) {
          this.callbacks.onStageSync(stage);
        }
      }
      if (event.keysChanged.has('playbackState')) {
        const playback = this.yMetadata.get('playbackState') as PartyPlaybackState | undefined;
        if (playback && this.callbacks.onPlaybackSync) {
          this.callbacks.onPlaybackSync(playback);
        }
      }
      if (event.keysChanged.has('songChange')) {
        const song = this.yMetadata.get('songChange') as CollabSongChange | undefined;
        if (song && this.callbacks.onSongChange) {
          this.callbacks.onSongChange(song);
        }
      }
    });

    if (this.provider) {
      // 2. On Initial Peer Sync Event (when guest completes handshake with host)
      this.provider.on('synced', (event: { synced: boolean }) => {
        if (this.isDestroyed) return;
        if (event.synced) {
          const syncedDoc = this.exportDocument();
          if ((syncedDoc.lines && syncedDoc.lines.length > 0) || syncedDoc.metadata.title !== 'Untitled Track') {
            if (this.callbacks.onDocumentChange) {
              this.callbacks.onDocumentChange(syncedDoc);
            }
          }
          const stage = this.yMetadata.get('stageConfig') as PartyStageConfig | undefined;
          if (stage && this.callbacks.onStageSync) {
            this.callbacks.onStageSync(stage);
          }
          const playback = this.yMetadata.get('playbackState') as PartyPlaybackState | undefined;
          if (playback && this.callbacks.onPlaybackSync) {
            this.callbacks.onPlaybackSync(playback);
          }
        }
      });

      // 3. Observe Awareness (throttled to 80ms to prevent re-render flood)
      this.provider.awareness.on('change', () => {
        if (this.isDestroyed || !this.provider) return;

        // Throttle: skip if a pending dispatch is already queued
        if (this.awarenessThrottleTimer !== null) return;

        this.awarenessThrottleTimer = setTimeout(() => {
          this.awarenessThrottleTimer = null;
          if (this.isDestroyed || !this.provider) return;

          const states = this.provider.awareness.getStates();
          const remotePeers: CollabUser[] = [];
          const hostUserId = (this.yMetadata.get('hostUserId') as string) || '';

          states.forEach((state: unknown, clientID: number) => {
            const typedState = state as { user?: CollabUser } | undefined;
            if (typedState?.user) {
              const isPeerHost = Boolean(
                typedState.user.isHost ||
                (hostUserId && typedState.user.id === hostUserId)
              );

              // Only add remote peers (do not include self in peers list)
              if (typedState.user.id !== this.localUser.id) {
                const peerId = typedState.user.id || `peer-${clientID}`;
                remotePeers.push({
                  ...typedState.user,
                  isHost: isPeerHost,
                  id: peerId,
                });

                if (typedState.user.cursor && typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('openlyryc:collab-cursor', {
                      detail: {
                        peerId,
                        cursor: typedState.user.cursor,
                        peer: typedState.user,
                      },
                    })
                  );
                }
              }
            }
          });

          if (this.callbacks.onPeersChange) {
            this.callbacks.onPeersChange(remotePeers);
          }

          if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange({
              connected: this.provider!.connected,
              peersCount: remotePeers.length,
            });
          }
        }, 80);
      });

      this.provider.on('status', (event: { connected: boolean }) => {
        if (this.isDestroyed) return;
        if (this.callbacks.onStatusChange) {
          const states = this.provider?.awareness.getStates();
          let count = 0;
          states?.forEach((s: unknown) => {
            const u = (s as { user?: CollabUser })?.user;
            if (u && u.id !== this.localUser.id) count++;
          });
          this.callbacks.onStatusChange({
            connected: event.connected,
            peersCount: count,
          });
        }
      });
    }

    // 4. Mobile sleep/wake reconnection: revive signaling after backgrounding
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.provider && !this.isDestroyed) {
          // y-webrtc may have lost signaling sockets — reconnect
          try {
            this.provider.connect();
          } catch (e) {
            // Silently retry — provider may already be connected
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        if (this.provider && !this.isDestroyed) {
          try {
            this.provider.connect();
          } catch (e) {
            // Silently retry
          }
        }
      };
      window.addEventListener('online', this.onlineHandler);
    }
  }

  /**
   * Pushes local editor document state into Yjs using diff-based reconciliation.
   * Instead of destructive clear+push (which breaks concurrent CRDT edits),
   * this compares line IDs to compute minimal inserts/deletes/updates.
   */
  public pushLocalDocument(doc: OpenLyricsDocument) {
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

      // 2. Update metadata (two-way sync for all metadata fields except contributor handle)
      if (doc.metadata) {
        const currentMetaKeys = Array.from(this.yMetadata.keys());
        const newKeys = new Set(Object.keys(doc.metadata));

        // Delete removed keys (except internal room host metadata)
        currentMetaKeys.forEach((key) => {
          if (!newKeys.has(key) && key !== 'hostUserId' && key !== 'hostName' && key !== 'syncedBy') {
            this.yMetadata.delete(key);
          }
        });

        // Set/update all metadata keys
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

  /**
   * Broadcasts the local user's presence (active line, cursor coordinate, syncing status).
   */
  public updatePresence(partial: Partial<CollabUser>) {
    if (this.isDestroyed || !this.provider) return;

    this.localUser = {
      ...this.localUser,
      ...partial,
      lastSeen: Date.now(),
    };

    this.provider.awareness.setLocalStateField('user', this.localUser);
  }

  public updateCursor(cursor: CollabCursor | null) {
    if (this.isDestroyed || !this.provider) return;
    this.localUser.cursor = cursor;
    this.provider.awareness.setLocalStateField('user', this.localUser);
  }

  /**
   * Broadcasts the active stage visuals configuration in Watch Party mode.
   */
  public broadcastStageConfig(config: PartyStageConfig) {
    if (this.isDestroyed) return;
    this.yMetadata.set('stageConfig', { ...config, roomMode: config.roomMode || this.localUser.roomMode });
  }

  /**
   * Broadcasts the host playback state (current time, isPlaying) in Watch Party mode.
   */
  public broadcastPlaybackState(playback: PartyPlaybackState) {
    if (this.isDestroyed) return;
    this.yMetadata.set('playbackState', playback);
  }

  /**
   * Broadcasts the host song change event in real time across the room.
   */
  public broadcastSongChange(song: CollabSongChange) {
    if (this.isDestroyed) return;
    this.yMetadata.set('songChange', song);
  }

  /**
   * Exports the current canonical Yjs state to an OpenLyricsDocument object.
   */
  public exportDocument(): OpenLyricsDocument {
    const rawLines = this.yLines.toArray();
    const rawMeta = this.yMetadata.toJSON() as Record<string, any>;
    const cleanMeta = sanitizeDocumentMetadata(rawMeta) as LyricMetadata;

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

  /**
   * Closes WebRTC data channels, disconnects from signaling servers, and destroys Yjs document.
   */
  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Clean up throttle/debounce timers
    if (this.awarenessThrottleTimer !== null) {
      clearTimeout(this.awarenessThrottleTimer);
      this.awarenessThrottleTimer = null;
    }
    if (this.docChangeRafId !== null) {
      cancelAnimationFrame(this.docChangeRafId);
      this.docChangeRafId = null;
    }

    // Clean up visibility/online event listeners
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    try {
      if (this.provider) {
        this.provider.awareness.destroy();
        this.provider.destroy();
        this.provider = null;
      }
      this.ydoc.destroy();
    } catch (e) {
      console.warn('[YjsSyncManager] Error during teardown:', e);
    }
  }
}
