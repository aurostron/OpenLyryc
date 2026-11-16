import type { OpenLyricsDocument } from '@openlyryc/schema';

export type TransitionMode = 'pivot' | 'cube' | 'whip';

export interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  isrc?: string;
  id?: number | string;
}

export type OpenLyrycHostCommand =
  | { type: 'openlyryc:time'; time: number }
  | { type: 'openlyryc:play'; isPlaying?: boolean }
  | { type: 'openlyryc:pause' }
  | { type: 'openlyryc:track'; track: TrackMetadata }
  | { type: 'openlyryc:document'; doc: OpenLyricsDocument }
  | { type: 'openlyryc:lrc'; lrc: string; title?: string; artist?: string }
  | { type: 'openlyryc:ping' }
  | { type: 'openlyryc:mode'; mode: TransitionMode };

export type OpenLyrycRendererEvent =
  | { type: 'openlyryc:ready'; isReady?: boolean; currentTime?: number; isPlaying?: boolean }
  | { type: 'openlyryc:seek'; time: number }
  | {
      type: 'openlyryc:loaded';
      title: string;
      artist: string;
      duration: number;
      lineCount: number;
    }
  | { type: 'openlyryc:error'; message: string };

/**
 * Window object methods exposed by OpenLyryc renderer inside WebViews/iframes
 */
export interface OpenLyrycWindowApi {
  syncTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setMode: (mode: TransitionMode) => void;
  loadTrack: (trackOrQuery: string | TrackMetadata) => void;
  setDocument: (document: OpenLyricsDocument) => void;
  setLrc: (lrc: string, title?: string, artist?: string) => void;
}

/**
 * Android JavascriptInterface bridge methods called by OpenLyryc renderer
 */
export interface OpenLyrycAndroidBridge {
  onReady?: () => void;
  onSeek?: (seconds: number) => void;
  onLyricsLoaded?: (title: string, artist: string, duration: number) => void;
  onError?: (message: string) => void;
}
