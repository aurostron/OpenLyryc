/**
 * OpenLyryc Security & Sandbox Engine
 * Enforces strict boundaries for plugins, P2P CRDT sync, media streams, and external data ingestion.
 */

// Private & loopback IP regex patterns to prevent SSRF
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // Cloud metadata endpoints (AWS/GCP/Azure)
  /^::1$/,
  /^[a-f0-9:]*:[a-f0-9:]*$/i, // Generic IPv6
  /\.local$/i,
  /\.internal$/i,
];

/**
 * Validates whether a URL is safe to fetch or load.
 * Restricts to HTTPS (or HTTP in local development only), blocking private networks and malicious schemes.
 */
export function isSafeUrl(rawUrl: string, allowLocalDev: boolean = true): { safe: boolean; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, reason: 'URL must be a non-empty string.' };
  }

  const trimmed = rawUrl.trim();

  // Disallow dangerous pseudo-protocols
  const dangerousSchemes = /^(javascript|data|file|vbscript|about|blob):/i;
  if (dangerousSchemes.test(trimmed)) {
    return { safe: false, reason: `Dangerous URL scheme detected in "${trimmed.slice(0, 30)}..."` };
  }

  try {
    const parsed = new URL(trimmed);

    // Require HTTP / HTTPS
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { safe: false, reason: `Protocol "${parsed.protocol}" is not permitted. Only https:// is allowed.` };
    }

    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';

    // Allow local plugin helper servers on localhost/127.0.0.1 when allowLocalDev is true
    if (isLoopback && allowLocalDev) {
      return { safe: true };
    }

    // In non-dev environments or if allowLocalDev is false, block private network addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: `Access to private network address "${hostname}" is blocked for security.` };
      }
    }

    return { safe: true };
  } catch (e: any) {
    return { safe: false, reason: `Malformed URL: ${e?.message || 'Invalid syntax'}` };
  }
}

/**
 * Sanitizes and validates audio/video stream URLs returned by third-party plugins
 */
export function sanitizeStreamUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  const check = isSafeUrl(trimmed);
  if (!check.safe) {
    console.warn(`[Security Sandbox] Blocked unsafe stream URL: ${check.reason}`);
    return null;
  }
  return trimmed;
}

/**
 * Strips dangerous HTML tags and script payloads from plain strings
 */
export function sanitizeString(input: unknown, maxLength: number = 5000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * Sanitizes incoming P2P document metadata to prevent prototype pollution or XSS injection
 */
export function sanitizeDocumentMetadata(rawMeta: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  const allowedKeys = new Set([
    'title',
    'artist',
    'album',
    'duration',
    'language',
    'isrc',
    'spotifyId',
    'youtubeId',
    'appleMusicId',
    'audioFileName',
    'audioHash',
    'offset',
    'precisionMode',
    'coverArt',
    'ambientGlow',
    'syncedBy',
    'vocalists',
    'platformLinks',
    'canonicalKey',
    'lyricsSimhash',
    'lyricsHash',
    'isCanonicalMaster',
  ]);

  Object.entries(rawMeta).forEach(([key, val]) => {
    // Guard against prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }

    if (allowedKeys.has(key)) {
      if (typeof val === 'string') {
        // For coverArt, allow https:// URLs and base64 image data URIs only
        if (key === 'coverArt') {
          if (val.startsWith('data:image/') || isSafeUrl(val).safe) {
            clean[key] = val;
          }
        } else {
          clean[key] = sanitizeString(val, 1000);
        }
      } else if (typeof val === 'number') {
        clean[key] = Number.isFinite(val) ? val : 0;
      } else if (typeof val === 'boolean') {
        clean[key] = val;
      } else if (val && typeof val === 'object') {
        // Deep clone safe plain objects
        try {
          clean[key] = JSON.parse(JSON.stringify(val));
        } catch {
          // ignore
        }
      }
    }
  });

  return clean;
}

/**
 * Trustworthy transparent CORS proxy relays for browser fetch fallback
 */
export const CORS_PROXIES = [
  (targetUrl: string) => `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
  (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  (targetUrl: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
];

/**
 * Resilient fetch utility that attempts direct fetch first, and automatically
 * falls back to transparent CORS proxy relays if the target endpoint blocks browser requests.
 */
export async function corsResilientFetch(
  targetUrl: string,
  init?: RequestInit,
  timeoutMs: number = 8000
): Promise<Response> {
  const isDirectUrlSafe = isSafeUrl(targetUrl);
  if (!isDirectUrlSafe.safe) {
    throw new Error(`Security Block: ${isDirectUrlSafe.reason}`);
  }

  // 1. First Attempt: Direct Fetch with fast timeout (3.5s)
  try {
    const directTimeout = Math.min(timeoutMs, 3500);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Direct fetch timed out')), directTimeout);
    const combinedSignal = init?.signal || controller.signal;

    const res = await fetch(targetUrl, {
      ...init,
      signal: combinedSignal,
    });
    clearTimeout(timer);

    if (res.ok || res.status < 500) {
      return res;
    }
  } catch (err: any) {
    console.info(`[CORS Avoidance] Direct fetch to ${targetUrl} failed (${err.message || 'CORS'}). Trying parallel fallback relays...`);
  }

  // Don't proxy loopback addresses through external CORS proxies
  try {
    const parsed = new URL(targetUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      throw new Error(`Local service on ${parsed.hostname} is not responding.`);
    }
  } catch (e: any) {
    if (e.message?.includes('Local service on')) throw e;
  }

  // 2. Parallel Race across resilient CORS proxies
  const fetchViaProxy = async (getProxyUrl: (u: string) => string): Promise<Response> => {
    const proxyUrl = getProxyUrl(targetUrl);
    const controller = new AbortController();
    const proxyTimeout = Math.min(timeoutMs, 6000);
    const timer = setTimeout(() => controller.abort(new Error(`Proxy relay timed out after ${proxyTimeout}ms`)), proxyTimeout);

    try {
      const res = await fetch(proxyUrl, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return res;
      }
      throw new Error(`Proxy relay returned HTTP ${res.status}`);
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    return await Promise.any(CORS_PROXIES.map((p) => fetchViaProxy(p)));
  } catch (aggregateErr) {
    throw new Error(`Instance at ${targetUrl} is unreachable or timed out across all CORS relays.`);
  }
}
