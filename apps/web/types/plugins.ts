/**
 * OpenLyryc Addon Protocol Specification (v1.0)
 * Inspired by Stremio's manifest-based decentralized plugin architecture.
 */

export type PluginCapability =
  | 'stream-resolver'
  | 'lyrics-provider'
  | 'search-provider'
  | 'metadata-provider';

export interface PluginSettingField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string | number }>;
  required?: boolean;
}

export interface StreamResolutionResult {
  streamUrl: string;
  mimeType?: string; // e.g. 'audio/webm', 'audio/mp4', 'audio/mpeg', 'application/x-mpegURL'
  bitrate?: number; // in kbps (e.g. 160, 256, 320)
  format?: string; // e.g. 'Opus', 'AAC', 'MP3', 'FLAC'
  title?: string;
  duration?: number; // in seconds
  headers?: Record<string, string>; // Optional HTTP headers (e.g. User-Agent or Authorization)
  playbackMode?: 'direct-audio' | 'hls' | 'embed-iframe';
  embedUrl?: string;
}

export interface TrackSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverArt?: string;
  sourceUrl?: string;
  addonId: string;
}

export interface LyricsProviderResult {
  syncedLyrics?: string; // Standard .lrc string
  plainLyrics?: string;
  format: 'lrc' | 'openlyrics-json';
  providerName?: string;
  syncedBy?: string;
}

export interface MetadataProviderResult {
  title?: string;
  artist?: string;
  album?: string;
  coverArt?: string;
  isrc?: string;
  duration?: number;
  year?: number;
  genre?: string;
}

export interface OpenLyrycPluginManifest {
  id: string; // Reverse domain format, e.g. 'org.community.custom-streamer'
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  icon?: string; // URL or SVG data URI
  capabilities: PluginCapability[];
  settingsSchema?: PluginSettingField[];
  endpoints: {
    // HTTP Webhook/API endpoint URLs (e.g. 'https://addon.domain.com/stream?q={query}')
    resolveStream?: string;
    resolveStreamMethod?: 'GET' | 'POST';
    resolveStreamBody?: string; // Optional JSON template for POST endpoints
    searchTracks?: string;
    fetchLyrics?: string;
    fetchMetadata?: string;
  };
  // Optional inline JavaScript execution code for client-side sandboxed resolvers
  clientScript?: string;
}

export interface InstalledPlugin {
  manifest: OpenLyrycPluginManifest;
  installedAt: number; // Unix timestamp
  isEnabled: boolean;
  userSettings: Record<string, string | number | boolean>;
  sourceUrl?: string; // Remote manifest URL if installed via HTTP
  lastHealthCheck?: {
    timestamp: number;
    status: 'ok' | 'error';
    latencyMs?: number;
    errorMessage?: string;
  };
}

export interface PluginExecutionQuery {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  sourceId?: string;
  youtubeId?: string;
  spotifyId?: string;
  isrc?: string;
  query?: string;
  customParams?: Record<string, string>;
}
