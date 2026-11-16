import {
  OpenLyrycPluginManifest,
  InstalledPlugin,
  PluginExecutionQuery,
  StreamResolutionResult,
  TrackSearchResult,
  LyricsProviderResult,
} from '@/types/plugins';
import { isSafeUrl, sanitizeStreamUrl, sanitizeString, corsResilientFetch } from '@/lib/security/sandbox';

const STORAGE_KEY = 'openlyryc_installed_plugins';
const FETCH_TIMEOUT_MS = 7000; // Resilient 7-second timeout for external plugin endpoints

/**
 * Replace placeholders like {title}, {artist}, {sourceId}, {query}, {instanceUrl} in endpoint templates
 */
function interpolateEndpoint(
  template: string,
  query: PluginExecutionQuery,
  settings: Record<string, string | number | boolean> = {},
  manifest?: OpenLyrycPluginManifest
): string {
  let url = template;

  // Build merged settings with default values from manifest settingsSchema
  const effectiveSettings: Record<string, string | number | boolean> = {};
  if (manifest?.settingsSchema) {
    manifest.settingsSchema.forEach((field) => {
      if (field.defaultValue !== undefined) {
        effectiveSettings[field.key] = field.defaultValue;
      }
    });
  }
  Object.assign(effectiveSettings, settings);

  // Insert settings variables (e.g. {instanceUrl}, {serverUrl}, {apiKey})
  Object.entries(effectiveSettings).forEach(([key, val]) => {
    const rawVal = String(val).trim();
    // If it's a URL or base path, don't encode slashes/colons; just strip trailing slash
    if (
      rawVal.startsWith('http://') ||
      rawVal.startsWith('https://') ||
      /url|host|endpoint|instance|server|base/i.test(key)
    ) {
      const cleanBase = rawVal.replace(/\/+$/, '');
      url = url.replace(new RegExp(`{${key}}`, 'gi'), cleanBase);
    } else {
      url = url.replace(new RegExp(`{${key}}`, 'gi'), encodeURIComponent(rawVal));
    }
  });

  // Insert query variables
  url = url.replace(/{query}/gi, encodeURIComponent(query.query || `${query.title || ''} ${query.artist || ''}`.trim()));
  url = url.replace(/{title}/gi, encodeURIComponent(query.title || ''));
  url = url.replace(/{artist}/gi, encodeURIComponent(query.artist || ''));
  url = url.replace(/{album}/gi, encodeURIComponent(query.album || ''));
  url = url.replace(/{sourceId}/gi, encodeURIComponent(query.sourceId || query.youtubeId || ''));
  url = url.replace(/{id}/gi, encodeURIComponent(query.sourceId || query.youtubeId || ''));
  url = url.replace(/{youtubeId}/gi, encodeURIComponent(query.youtubeId || query.sourceId || ''));
  url = url.replace(/{spotifyId}/gi, encodeURIComponent(query.spotifyId || ''));
  url = url.replace(/{isrc}/gi, encodeURIComponent(query.isrc || ''));

  return url;
}

/**
 * Intelligently extracts direct audio stream URL and metadata from diverse API responses
 * Supports standard REST, POST JSON payloads, adaptive audio formats, and streaming servers.
 */
function extractStreamFromData(data: any): {
  url: string | null;
  mimeType?: string;
  bitrate?: number;
  format?: string;
} {
  if (!data || typeof data !== 'object') return { url: null };

  // 1. Direct top-level fields
  if (data.streamUrl || data.url || data.stream_url || data.audioUrl || data.link || data.audio) {
    return {
      url: data.streamUrl || data.url || data.stream_url || data.audioUrl || data.link || data.audio,
      mimeType: data.mimeType || data.type || data.contentType || 'audio/mp3',
      bitrate: data.bitrate,
      format: data.format || data.codec || 'mp3',
    };
  }

  // 1.1 Nested stream picker array
  if (Array.isArray(data.picker) && data.picker.length > 0) {
    const audioPicker = data.picker.find((p: any) => p.type === 'audio' || p.audio) || data.picker[0];
    if (audioPicker?.url || audioPicker?.link) {
      return {
        url: audioPicker.url || audioPicker.link,
        mimeType: audioPicker.mimeType || 'audio/mp3',
        format: 'mp3',
      };
    }
  }

  // 2. Audio streams array: select highest bitrate audio stream
  if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
    // Sort by bitrate descending to get best quality audio
    const sorted = [...data.audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = sorted[0];
    if (best?.url) {
      return {
        url: best.url,
        mimeType: best.mimeType || 'audio/webm',
        bitrate: best.bitrate,
        format: best.format || 'Opus',
      };
    }
  }

  // 3. Adaptive formats array: find best audio stream
  if (Array.isArray(data.adaptiveFormats) && data.adaptiveFormats.length > 0) {
    const audioOnly = data.adaptiveFormats.filter(
      (f: any) => (f.type && f.type.startsWith('audio/')) || (f.mimeType && f.mimeType.startsWith('audio/'))
    );
    const target = audioOnly.length > 0 ? audioOnly[audioOnly.length - 1] : data.adaptiveFormats[0];
    if (target?.url) {
      return {
        url: target.url,
        mimeType: target.type || target.mimeType || 'audio/webm',
        bitrate: target.bitrate ? Math.round(Number(target.bitrate) / 1000) : undefined,
        format: target.container || target.audioQuality,
      };
    }
  }

  // 4. Generic streams array
  if (Array.isArray(data.streams) && data.streams.length > 0) {
    const first = data.streams[0];
    if (first?.url) {
      return {
        url: first.url,
        mimeType: first.mimeType || first.type,
        bitrate: first.bitrate,
        format: first.format,
      };
    }
  }

  return { url: null };
}

/**
 * Validates manifest structure and enforces security checks on endpoints
 */
export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a valid JSON object.'] };
  }

  const m = manifest as Partial<OpenLyrycPluginManifest>;
  if (!m.id || typeof m.id !== 'string') errors.push('Missing manifest `id` (e.g. "org.community.my-plugin").');
  if (!m.name || typeof m.name !== 'string') errors.push('Missing manifest `name`.');
  if (!m.version || typeof m.version !== 'string') errors.push('Missing manifest `version` (e.g. "1.0.0").');
  if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
    errors.push('Manifest must declare at least one capability in `capabilities` array.');
  }
  if (!m.endpoints || typeof m.endpoints !== 'object') {
    errors.push('Manifest must define an `endpoints` object.');
  } else {
    // Validate each endpoint URL template for security
    Object.entries(m.endpoints).forEach(([endpointName, template]) => {
      if (typeof template === 'string') {
        const dummyUrl = interpolateEndpoint(template, { query: 'test' }, {});
        // Check protocol safety (ignore template placeholders)
        if (/^(javascript|data|file|vbscript|blob):/i.test(template)) {
          errors.push(`Endpoint "${endpointName}" contains dangerous URI scheme.`);
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Reads all installed plugins from localStorage
 */
export function getInstalledPlugins(): InstalledPlugin[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[PluginManager] Failed to read installed plugins:', e);
    return [];
  }
}

/**
 * Persists plugins array to localStorage
 */
export function saveInstalledPlugins(plugins: InstalledPlugin[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
  } catch (e) {
    console.error('[PluginManager] Failed to save installed plugins:', e);
  }
}

/**
 * Installs or updates a plugin from a valid manifest object
 */
export function installPluginFromManifest(
  manifest: OpenLyrycPluginManifest,
  sourceUrl?: string
): InstalledPlugin {
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid Plugin Manifest: ${validation.errors.join(' ')}`);
  }

  const existing = getInstalledPlugins();
  const defaultSettings: Record<string, string | number | boolean> = {};

  // Populate default settings
  if (manifest.settingsSchema) {
    manifest.settingsSchema.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaultSettings[field.key] = field.defaultValue;
      }
    });
  }

  const existingIndex = existing.findIndex((p) => p.manifest.id === manifest.id);
  const newPlugin: InstalledPlugin = {
    manifest,
    installedAt: Date.now(),
    isEnabled: true,
    userSettings: existingIndex >= 0 ? { ...defaultSettings, ...existing[existingIndex].userSettings } : defaultSettings,
    sourceUrl,
    lastHealthCheck: {
      timestamp: Date.now(),
      status: 'ok',
    },
  };

  if (existingIndex >= 0) {
    existing[existingIndex] = newPlugin;
  } else {
    existing.push(newPlugin);
  }

  saveInstalledPlugins(existing);
  return newPlugin;
}

/**
 * Fetches and installs a plugin manifest from a remote HTTP URL
 */
export async function installPluginFromUrl(manifestUrl: string): Promise<InstalledPlugin> {
  const cleanUrl = manifestUrl.trim();
  const urlCheck = isSafeUrl(cleanUrl);
  if (!urlCheck.safe) {
    throw new Error(`Security Block: ${urlCheck.reason}`);
  }

  try {
    const res = await corsResilientFetch(cleanUrl, {
      headers: { Accept: 'application/json' },
    }, FETCH_TIMEOUT_MS);

    if (!res.ok) {
      throw new Error(`Failed to fetch manifest (HTTP ${res.status}: ${res.statusText})`);
    }

    const manifest = await res.json();
    return installPluginFromManifest(manifest, cleanUrl);
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  }
}

/**
 * Returns true if at least one active stream-resolver plugin is installed and enabled
 */
export function hasActiveStreamResolvers(): boolean {
  return getInstalledPlugins().some(
    (p) => p.isEnabled && p.manifest.capabilities.includes('stream-resolver') && p.manifest.endpoints.resolveStream
  );
}

/**
 * Toggles a plugin enabled/disabled state
 */
export function togglePlugin(id: string, isEnabled: boolean): void {
  const plugins = getInstalledPlugins();
  const target = plugins.find((p) => p.manifest.id === id);
  if (target) {
    target.isEnabled = isEnabled;
    saveInstalledPlugins(plugins);
  }
}

/**
 * Uninstalls a plugin by ID
 */
export function uninstallPlugin(id: string): void {
  const plugins = getInstalledPlugins().filter((p) => p.manifest.id !== id);
  saveInstalledPlugins(plugins);
}

/**
 * Updates user settings for an installed plugin
 */
export function updatePluginSettings(
  id: string,
  settings: Record<string, string | number | boolean>
): void {
  const plugins = getInstalledPlugins();
  const target = plugins.find((p) => p.manifest.id === id);
  if (target) {
    // Sanitize setting string values to prevent injection
    const cleanSettings: Record<string, string | number | boolean> = {};
    Object.entries(settings).forEach(([k, v]) => {
      if (typeof v === 'string') {
        cleanSettings[k] = sanitizeString(v, 500);
      } else {
        cleanSettings[k] = v;
      }
    });

    target.userSettings = { ...target.userSettings, ...cleanSettings };
    saveInstalledPlugins(plugins);
  }
}

/**
 * Returns true if at least one active search-provider plugin is installed and enabled
 */
export function hasActiveSearchProviders(): boolean {
  return getInstalledPlugins().some(
    (p) => p.isEnabled && p.manifest.capabilities.includes('search-provider') && p.manifest.endpoints.searchTracks
  );
}

/**
 * Normalizes diverse track-search API responses into TrackSearchResult[]
 * (mirrors Monochrome's normalizeSearchResponse tolerance: items can sit at
 * top level or nested under tracks/data/results buckets).
 */
function extractTracksFromData(data: any, addonId: string): TrackSearchResult[] {
  if (!data || typeof data !== 'object') return [];
  const bucket = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.tracks?.items)
        ? data.tracks.items
        : Array.isArray(data.tracks)
          ? data.tracks
          : Array.isArray(data.data?.items)
            ? data.data.items
            : [];
  return bucket
    .filter((t: any) => t && (t.id !== undefined && t.id !== null))
    .map((t: any) => ({
      id: String(t.id),
      title: sanitizeString(t.title || t.name || 'Untitled', 200),
      artist: sanitizeString(
        t.artist || (Array.isArray(t.artists) ? t.artists.map((a: any) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(', ') : '') || 'Unknown Artist',
        200
      ),
      album: t.album ? sanitizeString(typeof t.album === 'string' ? t.album : (t.album.title || t.album.name || ''), 200) || undefined : undefined,
      duration: typeof t.duration === 'number' && Number.isFinite(t.duration) ? t.duration : undefined,
      coverArt: typeof t.coverArt === 'string' ? t.coverArt : (typeof t.cover === 'string' ? t.cover : undefined),
      sourceUrl: typeof t.sourceUrl === 'string' ? t.sourceUrl : undefined,
      addonId,
    }));
}

/**
 * Executes Track Search across active search-provider plugins in priority order.
 * Returns aggregated results (local bridge first, then community endpoints).
 */
export async function searchTracksWithPlugins(
  query: string,
  signal?: AbortSignal
): Promise<{ results: TrackSearchResult[]; usedPlugin: InstalledPlugin | null; latencyMs: number }> {
  const plugins = getInstalledPlugins().filter(
    (p) => p.isEnabled && p.manifest.capabilities.includes('search-provider') && p.manifest.endpoints.searchTracks
  );

  if (plugins.length === 0 || query.trim().length < 2) {
    return { results: [], usedPlugin: null, latencyMs: 0 };
  }

  const start = performance.now();
  const aggregated: TrackSearchResult[] = [];
  let usedPlugin: InstalledPlugin | null = null;

  for (const plugin of plugins) {
    try {
      const endpoint = interpolateEndpoint(
        plugin.manifest.endpoints.searchTracks!,
        { query: query.trim() },
        plugin.userSettings,
        plugin.manifest
      );

      const urlCheck = isSafeUrl(endpoint);
      if (!urlCheck.safe) {
        console.warn(`[PluginManager] Blocked unsafe search endpoint for plugin ${plugin.manifest.id}: ${urlCheck.reason}`);
        continue;
      }

      const res = await corsResilientFetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal,
      }, FETCH_TIMEOUT_MS);
      if (!res.ok) continue;

      const data = await res.json();
      const tracks = extractTracksFromData(data, plugin.manifest.id);
      if (tracks.length > 0 && !usedPlugin) usedPlugin = plugin;
      aggregated.push(...tracks);
    } catch (e: any) {
      if (e?.name === 'AbortError') break;
      console.debug(`[PluginManager] Search provider ${plugin.manifest.id} unavailable: ${e?.message || 'timeout'}. Stepping to next...`);
    }
  }

  return { results: aggregated.slice(0, 50), usedPlugin, latencyMs: Math.round(performance.now() - start) };
}

/**
 * Executes Stream Resolution across active stream-resolver plugins in priority order
  */
export async function resolveStreamWithPlugins(
  query: PluginExecutionQuery,
  settingOverrides: Record<string, string | number | boolean> = {}
): Promise<{ result: StreamResolutionResult | null; usedPlugin: InstalledPlugin | null; latencyMs: number }> {
  const plugins = getInstalledPlugins().filter(
    (p) => p.isEnabled && p.manifest.capabilities.includes('stream-resolver') && p.manifest.endpoints.resolveStream
  );

  if (plugins.length === 0) {
    return { result: null, usedPlugin: null, latencyMs: 0 };
  }

  for (const plugin of plugins) {
    const start = performance.now();

    try {
      const endpoint = interpolateEndpoint(
        plugin.manifest.endpoints.resolveStream!,
        query,
        { ...plugin.userSettings, ...settingOverrides },
        plugin.manifest
      );

      const urlCheck = isSafeUrl(endpoint);
      if (!urlCheck.safe) {
        console.warn(`[PluginManager] Blocked unsafe endpoint for plugin ${plugin.manifest.id}: ${urlCheck.reason}`);
        continue;
      }

      const method = (
        plugin.manifest.endpoints.resolveStreamMethod ||
        (plugin.manifest.endpoints.resolveStreamBody && plugin.manifest.endpoints.resolveStreamBody.length > 0 ? 'POST' : 'GET')
      ).toUpperCase();

      let reqInit: RequestInit = {
        method,
        headers: { Accept: 'application/json, audio/*' },
      };

      if (method === 'POST') {
        let bodyString = plugin.manifest.endpoints.resolveStreamBody;
        if (!bodyString) {
          bodyString = JSON.stringify({
            id: query.sourceId || query.youtubeId || '',
            title: query.title || '',
            artist: query.artist || '',
            format: 'audio',
          });
        } else {
          bodyString = interpolateEndpoint(bodyString, query, plugin.userSettings, plugin.manifest);
        }

        reqInit = {
          ...reqInit,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: bodyString,
        };
      }

      // Use CORS-resilient fetch to transparently route around browser CORS restrictions on public instances
      const res = await corsResilientFetch(endpoint, reqInit, FETCH_TIMEOUT_MS);

      if (!res.ok) continue;

      const data = await res.json();
      const latency = Math.round(performance.now() - start);

      const extracted = extractStreamFromData(data);
      const safeStreamUrl = sanitizeStreamUrl(extracted.url);

      if (safeStreamUrl) {
        const streamResult: StreamResolutionResult = {
          streamUrl: safeStreamUrl,
          mimeType: sanitizeString(extracted.mimeType || data.mimeType || data.type || 'audio/mp4', 50),
          bitrate: typeof extracted.bitrate === 'number' && Number.isFinite(extracted.bitrate) ? extracted.bitrate : (typeof data.bitrate === 'number' ? data.bitrate : undefined),
          format: extracted.format ? sanitizeString(extracted.format, 20) : (data.format ? sanitizeString(data.format, 20) : undefined),
          title: data.title ? sanitizeString(data.title, 200) : query.title,
          duration: typeof data.duration === 'number' && Number.isFinite(data.duration) ? data.duration : query.duration,
          headers: data.headers && typeof data.headers === 'object' ? data.headers : undefined,
          playbackMode: data.playbackMode || (safeStreamUrl.endsWith('.m3u8') ? 'hls' : 'direct-audio'),
          embedUrl: data.embedUrl ? sanitizeStreamUrl(data.embedUrl) || undefined : undefined,
        };

        return {
          result: streamResult,
          usedPlugin: plugin,
          latencyMs: latency,
        };
      }
    } catch (e: any) {
      // Record health check status on the plugin object
      plugin.lastHealthCheck = {
        timestamp: Date.now(),
        status: 'error',
        errorMessage: e?.message || 'Instance unreachable',
      };
      // Keep console clean and quiet on third-party instance downtime
      console.debug(`[PluginManager] Resolver ${plugin.manifest.id} unavailable: ${e?.message || 'timeout'}. Stepping to next...`);
    }
  }

  return { result: null, usedPlugin: null, latencyMs: 0 };
}

/**
 * Developer Sandbox Live Tester: Tests a stream resolver endpoint with query parameters
 */
export async function testPluginResolver(
  manifest: OpenLyrycPluginManifest,
  query: PluginExecutionQuery,
  userSettings: Record<string, string | number | boolean> = {}
): Promise<{ success: boolean; result?: StreamResolutionResult; latencyMs: number; error?: string; rawResponse?: any }> {
  if (!manifest.endpoints.resolveStream) {
    return {
      success: false,
      latencyMs: 0,
      error: 'Manifest has no `endpoints.resolveStream` specified.',
    };
  }

  const start = performance.now();

  try {
    const targetUrl = interpolateEndpoint(manifest.endpoints.resolveStream, query, userSettings, manifest);
    const urlCheck = isSafeUrl(targetUrl);
    if (!urlCheck.safe) {
      return {
        success: false,
        latencyMs: 0,
        error: `Security Sandbox Block: ${urlCheck.reason}`,
      };
    }

    const method = (
      manifest.endpoints.resolveStreamMethod ||
      (manifest.endpoints.resolveStreamBody && manifest.endpoints.resolveStreamBody.length > 0 ? 'POST' : 'GET')
    ).toUpperCase();

    let reqInit: RequestInit = {
      method,
      headers: { Accept: 'application/json, audio/*' },
    };

    if (method === 'POST') {
      let bodyString = manifest.endpoints.resolveStreamBody;
      if (!bodyString) {
        bodyString = JSON.stringify({
          id: query.sourceId || query.youtubeId || '',
          title: query.title || '',
          artist: query.artist || '',
          format: 'audio',
        });
      } else {
        bodyString = interpolateEndpoint(bodyString, query, userSettings, manifest);
      }

      reqInit = {
        ...reqInit,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: bodyString,
      };
    }

    const res = await corsResilientFetch(targetUrl, reqInit, FETCH_TIMEOUT_MS);

    const latency = Math.round(performance.now() - start);
    if (!res.ok) {
      return {
        success: false,
        latencyMs: latency,
        error: `Endpoint returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const json = await res.json();
    const extracted = extractStreamFromData(json);
    const safeStreamUrl = sanitizeStreamUrl(extracted.url);

    if (!safeStreamUrl) {
      return {
        success: false,
        latencyMs: latency,
        rawResponse: json,
        error: 'Resolver returned an invalid, unsafe, or non-media stream URL.',
      };
    }

    return {
      success: true,
      latencyMs: latency,
      rawResponse: json,
      result: {
        streamUrl: safeStreamUrl,
        mimeType: extracted.mimeType || json.mimeType || json.type,
        bitrate: extracted.bitrate || json.bitrate,
        format: extracted.format || json.format,
        title: json.title,
        duration: json.duration,
        playbackMode: json.playbackMode || 'direct-audio',
      },
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return {
      success: false,
      latencyMs: latency,
      error: err.name === 'AbortError' ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s` : (err?.message || 'Network error or CORS failure reaching endpoint.'),
    };
  }
}
