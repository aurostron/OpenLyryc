import {
  OpenLyrycHostCommand,
  OpenLyrycRendererEvent,
  TrackMetadata,
  TransitionMode,
} from './protocol';
import { buildEmbedUrl } from './api';
import type { OpenLyricsDocument } from '@openlyryc/schema';

export interface OpenLyrycEmbedOptions {
  container: HTMLElement;
  previewUrl?: string;
  initialTrack?: TrackMetadata;
  transitionMode?: TransitionMode;
  backgroundVideo?: boolean;
  onSeek?: (seconds: number) => void;
  onReady?: () => void;
  onLyricsLoaded?: (meta: { title: string; artist: string; duration: number; lineCount: number }) => void;
}

export class OpenLyrycEmbed {
  private iframe: HTMLIFrameElement;
  private container: HTMLElement;
  private isReady = false;
  private messageListener: (event: MessageEvent) => void;
  private pendingCommands: OpenLyrycHostCommand[] = [];

  private onSeekCb?: (seconds: number) => void;
  private onReadyCb?: () => void;
  private onLoadedCb?: (meta: { title: string; artist: string; duration: number; lineCount: number }) => void;

  constructor(options: OpenLyrycEmbedOptions) {
    this.container = options.container;
    this.onSeekCb = options.onSeek;
    this.onReadyCb = options.onReady;
    this.onLoadedCb = options.onLyricsLoaded;

    const embedUrl = buildEmbedUrl({
      baseUrl: options.previewUrl,
      title: options.initialTrack?.title,
      artist: options.initialTrack?.artist,
      transitionMode: options.transitionMode,
      backgroundVideo: options.backgroundVideo ?? false,
    });

    this.iframe = document.createElement('iframe');
    this.iframe.src = embedUrl;
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.style.display = 'block';
    this.iframe.style.backgroundColor = '#000000';
    this.iframe.allow = 'autoplay; encrypted-media';

    this.messageListener = (event: MessageEvent) => {
      if (event.source !== this.iframe.contentWindow) return;
      const data = event.data as OpenLyrycRendererEvent;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'openlyryc:ready') {
        this.isReady = true;
        this.flushPendingCommands();
        this.onReadyCb?.();
      } else if (data.type === 'openlyryc:seek') {
        this.onSeekCb?.(data.time);
      } else if (data.type === 'openlyryc:loaded') {
        this.onLoadedCb?.({
          title: data.title,
          artist: data.artist,
          duration: data.duration,
          lineCount: data.lineCount,
        });
      }
    };

    this.iframe.onload = () => {
      this.iframe.contentWindow?.postMessage({ type: 'openlyryc:ping' }, '*');
    };

    const handshakeInterval = setInterval(() => {
      if (this.isReady) {
        clearInterval(handshakeInterval);
        return;
      }
      this.iframe.contentWindow?.postMessage({ type: 'openlyryc:ping' }, '*');
    }, 250);

    setTimeout(() => clearInterval(handshakeInterval), 6000);

    window.addEventListener('message', this.messageListener);
    this.container.appendChild(this.iframe);
  }

  public syncTime(seconds: number): void {
    this.sendCommand({ type: 'openlyryc:time', time: seconds });
  }

  public play(): void {
    this.sendCommand({ type: 'openlyryc:play', isPlaying: true });
  }

  public pause(): void {
    this.sendCommand({ type: 'openlyryc:pause' });
  }

  public loadTrack(track: TrackMetadata): void {
    this.sendCommand({ type: 'openlyryc:track', track });
  }

  public setDocument(doc: OpenLyricsDocument): void {
    this.sendCommand({ type: 'openlyryc:document', doc });
  }

  public setLrc(lrc: string, title?: string, artist?: string): void {
    this.sendCommand({ type: 'openlyryc:lrc', lrc, title, artist });
  }

  public setMode(mode: TransitionMode): void {
    this.sendCommand({ type: 'openlyryc:mode', mode });
  }

  public onSeek(cb: (seconds: number) => void): this {
    this.onSeekCb = cb;
    return this;
  }

  public onReady(cb: () => void): this {
    this.onReadyCb = cb;
    return this;
  }

  public onLyricsLoaded(
    cb: (meta: { title: string; artist: string; duration: number; lineCount: number }) => void
  ): this {
    this.onLoadedCb = cb;
    return this;
  }

  public destroy(): void {
    window.removeEventListener('message', this.messageListener);
    if (this.iframe.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe);
    }
  }

  private sendCommand(command: OpenLyrycHostCommand): void {
    if (!this.isReady) {
      this.pendingCommands.push(command);
      return;
    }
    this.iframe.contentWindow?.postMessage(command, '*');
  }

  private flushPendingCommands(): void {
    while (this.pendingCommands.length > 0) {
      const cmd = this.pendingCommands.shift();
      if (cmd) {
        this.iframe.contentWindow?.postMessage(cmd, '*');
      }
    }
  }
}
