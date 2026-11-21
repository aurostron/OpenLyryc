import { LyricLine, WordToken } from '@openlyryc/schema';

export interface TapSyncPeerCallbacks {
  onPeerJoin?: (peerId: string) => void;
  onPeerLeave?: (peerId: string) => void;
  onRequestSync?: () => void;
  onInitReceived?: (payload: {
    title: string;
    artist: string;
    duration: number;
    lines: LyricLine[];
    currentLineIndex: number;
    isPlaying: boolean;
    currentTime: number;
  }) => void;
  onClockReceived?: (currentTime: number, isPlaying: boolean) => void;
  onTapReceived?: (lineIndex: number, tokenIndex: number, timestamp: number) => void;
  onCompleteLineReceived?: (lineIndex: number, endTime: number) => void;
  onUndoReceived?: (lineIndex: number, tokenIndex: number) => void;
  onJumpLineReceived?: (lineIndex: number) => void;
  onTogglePlayReceived?: (play: boolean) => void;
  onSeekReceived?: (time: number) => void;
  onLinePatchReceived?: (lineIndex: number, line: LyricLine) => void;
  onDocUpdateReceived?: (lines: LyricLine[], currentLineIndex: number) => void;
  onError?: (err: Error) => void;
}

export class TapSyncPeer {
  private room: any = null;
  private sse: EventSource | null = null;
  private isDestroyed = false;
  private actions: Record<string, (payload: any) => Promise<any>> = {};
  public isHost: boolean;
  public roomId: string;
  public peerCount: number = 0;
  private useLocalRelay: boolean = false;

  constructor(
    roomId: string,
    isHost: boolean,
    private callbacks: TapSyncPeerCallbacks = {}
  ) {
    this.roomId = roomId.toUpperCase().trim();
    this.isHost = isHost;
    this.init();
  }

  private getRelayBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    const { hostname, port, protocol } = window.location;
    // When running in development (Next.js on 3000), direct connect to media proxy on port 3099
    // This allows mobile Safari on LAN to communicate with zero proxy buffering
    if (
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) &&
      port === '3000'
    ) {
      return `${protocol}//${hostname}:3099`;
    }
    return '';
  }

  private async init() {
    if (typeof window === 'undefined') return;

    // 1. Try local SSE relay first for sub-millisecond, zero-firewall LAN connection
    this.initLocalRelay();

    // 2. Also initialize Trystero WebRTC as global peer mesh
    this.initTrystero();
  }

  private initLocalRelay() {
    try {
      const baseUrl = this.getRelayBaseUrl();
      const sseUrl = `${baseUrl}/api/tap-sync/events?room=${encodeURIComponent(this.roomId)}&role=${this.isHost ? 'host' : 'client'}`;
      const sse = new EventSource(sseUrl);
      this.sse = sse;

      sse.onopen = () => {
        this.useLocalRelay = true;
        if (!this.isHost) {
          // Immediately ask host for session data as soon as relay connects
          this.sendAction('request_sync', {});
        }
      };

      sse.onmessage = (event) => {
        if (this.isDestroyed || !event.data) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'PEER_JOIN') {
            this.peerCount = Math.max(1, this.peerCount + 1);
            this.callbacks.onPeerJoin?.(msg.role || 'peer');
            if (this.isHost) {
              this.callbacks.onRequestSync?.();
            } else {
              this.sendAction('request_sync', {});
            }
            return;
          }

          if (msg.type === 'PEER_LEAVE') {
            this.peerCount = Math.max(0, this.peerCount - 1);
            this.callbacks.onPeerLeave?.(msg.role || 'peer');
            return;
          }

          // Handle action payloads
          if (msg.action) {
            this.handleActionMessage(msg.action, msg.payload);
          }
        } catch (err) {
          console.warn('[TapSync SSE] Parse error:', err);
        }
      };

      sse.onerror = () => {
        if (this.sse && this.sse.readyState === EventSource.CLOSED) {
          this.sse.close();
          this.sse = null;
        }
      };
    } catch (err) {
      console.warn('[TapSync] Local relay init skipped:', err);
    }
  }

  private async initTrystero() {
    try {
      const { joinRoom } = await import('trystero/nostr');
      const config: any = {
        appId: 'openlyryc-tapsync-v2',
        relayConfig: {
          urls: [
            'wss://nos.lol',
            'wss://nostr.mom',
            'wss://nostr.wine',
            'wss://relay.primal.net',
          ],
          redundancy: 3,
        },
      };

      const roomName = `openlyryc-ts-${this.roomId}`;
      this.room = joinRoom(config, roomName);

      const register = (actionName: string, onReceiveCb: (data: any, peerId: string) => void) => {
        try {
          const action = this.room.makeAction(actionName);
          const safeOnMsg = (data: any, peerId: string) => {
            if (this.isDestroyed) return;
            onReceiveCb(data, peerId);
          };

          if (Array.isArray(action)) {
            const [sendFn, onReceiveFn] = action;
            if (typeof onReceiveFn === 'function') {
              onReceiveFn((data: any, peerId: string) => safeOnMsg(data, peerId));
            }
            this.actions[actionName] = (payload: any) => {
              try {
                return sendFn(payload);
              } catch {
                return Promise.resolve();
              }
            };
          } else if (action && typeof action === 'object') {
            action.onMessage = (data: any, ctx: any) => {
              const peerId = typeof ctx === 'string' ? ctx : ctx?.peerId || '';
              safeOnMsg(data, peerId);
            };
            this.actions[actionName] = (payload: any) => {
              try {
                return action.send(payload);
              } catch {
                return Promise.resolve();
              }
            };
          }
        } catch (err) {
          console.warn('[TapSyncPeer] register error for', actionName, err);
        }
      };

      register('session_init', (data) => this.callbacks.onInitReceived?.(data));
      register('request_sync', () => this.callbacks.onRequestSync?.());
      register('audio_clock', (data) => this.callbacks.onClockReceived?.(data.currentTime, data.isPlaying));
      register('word_tap', (data) => this.callbacks.onTapReceived?.(data.lineIndex, data.tokenIndex, data.timestamp));
      register('line_complete', (data) => this.callbacks.onCompleteLineReceived?.(data.lineIndex, data.endTime));
      register('undo_token', (data) => this.callbacks.onUndoReceived?.(data.lineIndex, data.tokenIndex));
      register('jump_line', (data) => this.callbacks.onJumpLineReceived?.(data.lineIndex));
      register('toggle_play', (data) => this.callbacks.onTogglePlayReceived?.(data.play));
      register('seek', (data) => this.callbacks.onSeekReceived?.(typeof data?.time === 'number' ? data.time : 0));
      register('line_patch', (data) => {
        if (data && typeof data.lineIndex === 'number' && data.line) {
          this.callbacks.onLinePatchReceived?.(data.lineIndex, data.line);
        }
      });
      register('doc_update', (data) => this.callbacks.onDocUpdateReceived?.(data.lines, data.currentLineIndex));

      // Handle peer join with retries to account for WebRTC data channel negotiation delay
      const handlePeerJoin = (peerId: string) => {
        this.peerCount = Math.max(1, this.peerCount + 1);
        this.callbacks.onPeerJoin?.(peerId);
        if (this.isHost) {
          this.callbacks.onRequestSync?.();
          setTimeout(() => {
            if (!this.isDestroyed) this.callbacks.onRequestSync?.();
          }, 350);
          setTimeout(() => {
            if (!this.isDestroyed) this.callbacks.onRequestSync?.();
          }, 900);
          setTimeout(() => {
            if (!this.isDestroyed) this.callbacks.onRequestSync?.();
          }, 1800);
        } else {
          this.sendAction('request_sync', {});
          setTimeout(() => {
            if (!this.isDestroyed) this.sendAction('request_sync', {});
          }, 350);
          setTimeout(() => {
            if (!this.isDestroyed) this.sendAction('request_sync', {});
          }, 900);
        }
      };

      if (typeof this.room.onPeerJoin === 'function') {
        this.room.onPeerJoin(handlePeerJoin);
      } else {
        this.room.onPeerJoin = handlePeerJoin;
      }

      const handlePeerLeave = (peerId: string) => {
        this.peerCount = Math.max(0, this.peerCount - 1);
        this.callbacks.onPeerLeave?.(peerId);
      };

      if (typeof this.room.onPeerLeave === 'function') {
        this.room.onPeerLeave(handlePeerLeave);
      } else {
        this.room.onPeerLeave = handlePeerLeave;
      }
    } catch (err: any) {
      console.warn('[TapSyncPeer] Trystero fallback warning:', err);
    }
  }

  private handleActionMessage(action: string, payload: any) {
    switch (action) {
      case 'session_init':
        this.callbacks.onInitReceived?.(payload);
        break;
      case 'request_sync':
        this.callbacks.onRequestSync?.();
        break;
      case 'audio_clock':
        this.callbacks.onClockReceived?.(payload?.currentTime ?? 0, payload?.isPlaying ?? false);
        break;
      case 'word_tap':
        this.callbacks.onTapReceived?.(payload?.lineIndex ?? 0, payload?.tokenIndex ?? 0, payload?.timestamp ?? 0);
        break;
      case 'line_complete':
        this.callbacks.onCompleteLineReceived?.(payload?.lineIndex ?? 0, payload?.endTime ?? 0);
        break;
      case 'undo_token':
        this.callbacks.onUndoReceived?.(payload?.lineIndex ?? 0, payload?.tokenIndex ?? 0);
        break;
      case 'jump_line':
        this.callbacks.onJumpLineReceived?.(payload?.lineIndex ?? 0);
        break;
      case 'seek':
        this.callbacks.onSeekReceived?.(typeof payload?.time === 'number' && Number.isFinite(payload.time) ? payload.time : 0);
        break;
      case 'line_patch':
        if (payload && typeof payload.lineIndex === 'number' && payload.line) {
          this.callbacks.onLinePatchReceived?.(payload.lineIndex, payload.line);
        }
        break;
      case 'toggle_play':
        this.callbacks.onTogglePlayReceived?.(payload?.play ?? false);
        break;
      case 'doc_update':
        this.callbacks.onDocUpdateReceived?.(payload?.lines ?? [], payload?.currentLineIndex ?? 0);
        break;
    }
  }

  // --- Senders ---

  public sendSessionInit(payload: {
    title: string;
    artist: string;
    duration: number;
    lines: LyricLine[];
    currentLineIndex: number;
    isPlaying: boolean;
    currentTime: number;
  }) {
    this.sendAction('session_init', payload);
  }

  public requestSync() {
    this.sendAction('request_sync', {});
  }

  public sendClock(currentTime: number, isPlaying: boolean) {
    this.sendAction('audio_clock', { currentTime, isPlaying });
  }

  public sendWordTap(lineIndex: number, tokenIndex: number, timestamp: number) {
    this.sendAction('word_tap', { lineIndex, tokenIndex, timestamp });
  }

  public sendCompleteLine(lineIndex: number, endTime: number) {
    this.sendAction('line_complete', { lineIndex, endTime });
  }

  public sendUndo(lineIndex: number, tokenIndex: number) {
    this.sendAction('undo_token', { lineIndex, tokenIndex });
  }

  public sendJumpLine(lineIndex: number) {
    this.sendAction('jump_line', { lineIndex });
  }

  public sendSeek(time: number) {
    this.sendAction('seek', { time: Math.max(0, Number.isFinite(time) ? time : 0) });
  }

  public sendLinePatch(lineIndex: number, line: LyricLine) {
    this.sendAction('line_patch', { lineIndex, line });
  }

  public sendTogglePlay(play: boolean) {
    this.sendAction('toggle_play', { play });
  }

  public sendDocUpdate(lines: LyricLine[], currentLineIndex: number) {
    this.sendAction('doc_update', { lines, currentLineIndex });
  }

  private sendAction(name: string, payload: any) {
    if (this.isDestroyed) return;

    // 1. Send via fast local HTTP relay
    const baseUrl = this.getRelayBaseUrl();
    fetch(`${baseUrl}/api/tap-sync/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: this.roomId,
        action: name,
        payload,
        sender: this.isHost ? 'host' : 'client',
      }),
    }).catch(() => {
      // Local relay unavailable
    });

    // 2. Also send via Trystero WebRTC
    try {
      const sendFn = this.actions[name];
      if (typeof sendFn === 'function') {
        sendFn(payload);
      }
    } catch {}
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.sse) {
      try {
        this.sse.close();
      } catch {}
      this.sse = null;
    }
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
    this.actions = {};
  }
}
