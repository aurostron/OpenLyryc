/**
 * Real-Time Collaboration & Peer Presence Types for OpenLyryc (P2P Yjs & Trystero)
 */

import { RendererViewMode, ViewTab } from './editor';
import { ColorsBeatDivision } from './settings';

export type CollabRoomMode = 'edit' | 'party';
export type CollabTransport = 'trystero' | 'webrtc';

export interface CollabCursor {
  /** X coordinate as percentage of window width (0-100) or absolute px */
  x: number;
  /** Y coordinate as percentage of window height (0-100) or absolute px */
  y: number;
  /** Viewport width for responsive normalized projection */
  vw?: number;
  /** Viewport height for responsive normalized projection */
  vh?: number;
}

export interface CollabUser {
  /** Unique ephemeral client session ID */
  id: string;
  /** Display name of the collaborator */
  name: string;
  /** Accent color hex code */
  color: string;
  /** Tailwind background color class for badges/rings */
  badgeBg: string;
  /** Tailwind text color class */
  badgeText: string;
  /** Live mouse / pointer cursor coordinate */
  cursor?: CollabCursor | null;
  /** Index of the line currently focused or clicked by this peer */
  activeLineIndex: number | null;
  /** Index of the word token currently being timed by this peer */
  activeTokenIndex?: number | null;
  /** True if the user is actively holding the Spacebar/stamping timestamps */
  isSyncing?: boolean;
  /** Whether this user is the room creator / admin */
  isHost?: boolean;
  /** Role in the room */
  role?: 'host' | 'editor' | 'listener';
  /** Room mode */
  roomMode?: CollabRoomMode;
  /** Device or client type */
  device?: 'desktop' | 'mobile';
  /** Last active heartbeat timestamp in ms */
  lastSeen?: number;
}

export interface PartyStageConfig {
  mode: RendererViewMode;
  fontFamily: string;
  fontWeight: string;
  ambientGlow: boolean;
  romanized?: boolean;
  viewTab?: ViewTab;
  roomMode?: CollabRoomMode;
  colorsBeatDivision?: ColorsBeatDivision;
  colorsFontFamily?: string;
  colorsFontSize?: number;
}

export interface PartyPlaybackState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  duration: number;
  timestamp: number; // Local epoch ms when event was dispatched
  youtubeId?: string;
  audioFileName?: string;
  audioFileSize?: number;
}

export interface CollabSongChange {
  title: string;
  artist?: string;
  album?: string;
  coverArt?: string;
  youtubeId?: string;
  duration?: number;
  canonicalKey?: string;
  timestamp?: number;
}

export interface PartyAudioTransferState {
  isTransferring: boolean;
  progress: number; // 0 - 100
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface CollabRoomConfig {
  /** Room code, e.g. "JAM-94X" */
  roomId: string;
  /** User handle */
  userName: string;
  /** Deterministic user color theme */
  userColorIndex: number;
  /** Optional room password or encryption key for private rooms */
  password?: string;
  /** Whether this client is the room initiator/host */
  isHost?: boolean;
  /** Room mode: 'edit' (collaborative editing) or 'party' (watch party) */
  mode?: CollabRoomMode;
  /** Transport protocol: 'trystero' (Nostr relays) or 'webrtc' (classic signaling) */
  transport?: CollabTransport;
}

export interface CollabRoomStatus {
  isConnected: boolean;
  isConnecting: boolean;
  roomId: string | null;
  roomUrl: string | null;
  roomMode: CollabRoomMode;
  transport: CollabTransport;
  localUser: CollabUser | null;
  peers: CollabUser[];
  peerCount: number;
  isHost: boolean;
  connectionError: string | null;
  stageConfig?: PartyStageConfig;
  playbackState?: PartyPlaybackState;
  audioTransfer?: PartyAudioTransferState;
}
