import { createClient, type Client } from '@libsql/client/web';
import { OpenLyricsDocument } from '@/types/lyrics';
import { PreviewTheme } from './previewLink';
import { encodeDocumentToBinary, decodeBinaryToDocument } from './binaryLyrics';
import { deflateRaw, inflateRaw } from 'pako';

const TURSO_URL = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL || '';

const TURSO_TOKEN = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN || '';

// Shared LibSQL client instance for browser & edge runtimes
let clientInstance: Client | null = null;

export function getTursoClient(): Client {
  if (!TURSO_URL) {
    throw new Error(
      'Shared links are not configured. Set NEXT_PUBLIC_TURSO_DATABASE_URL in apps/web/.env.local.'
    );
  }
  if (!clientInstance) {
    clientInstance = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
  }
  return clientInstance;
}

// ----------------------------------------------------------------------------
// Multi-Tier Caching for Low Reads (<1 read per session)
// ----------------------------------------------------------------------------
interface CachedPreview {
  document: OpenLyricsDocument;
  theme?: PreviewTheme;
  tvMode?: boolean;
  cachedAt: number;
}

const memoryCache = new Map<string, CachedPreview>();
const inFlightRequests = new Map<
  string,
  Promise<{ document: OpenLyricsDocument; theme?: PreviewTheme; tvMode?: boolean } | null>
>();

function getFromCache(code: string): CachedPreview | null {
  // 1. Memory Cache
  const mem = memoryCache.get(code);
  if (mem) return mem;

  // 2. LocalStorage Cache (Client-side)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`openlyrics_share_${code}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedPreview;
        memoryCache.set(code, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function saveToCache(code: string, item: CachedPreview): void {
  memoryCache.set(code, item);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`openlyrics_share_${code}`, JSON.stringify(item));
    } catch {
      // ignore
    }
  }
}

// ----------------------------------------------------------------------------
// Base64 Binary Encoding Helpers
// ----------------------------------------------------------------------------
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ----------------------------------------------------------------------------
// Shortcode Generator (Nano-style 6-char URL-safe alphanumeric)
// ----------------------------------------------------------------------------
const SHORTCODE_CHARS = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';

export function generateShortCode(length = 6): string {
  let result = '';
  const charLen = SHORTCODE_CHARS.length;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      result += SHORTCODE_CHARS[randomBytes[i] % charLen];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += SHORTCODE_CHARS[Math.floor(Math.random() * charLen)];
    }
  }
  return result;
}

// ----------------------------------------------------------------------------
// Schema Initialization
// ----------------------------------------------------------------------------
let schemaInitialized = false;

export async function initTursoSchema(): Promise<void> {
  if (schemaInitialized) return;
  try {
    const client = getTursoClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS preview_shares (
        code TEXT PRIMARY KEY,
        canonical_key TEXT,
        title TEXT,
        artist TEXT,
        duration INTEGER,
        theme TEXT DEFAULT 'fluid_glow',
        tv_mode INTEGER DEFAULT 0,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH()),
        views INTEGER DEFAULT 0
      );
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_preview_created ON preview_shares(created_at);
    `);
    schemaInitialized = true;
  } catch (err) {
    console.warn('Failed to verify Turso schema:', err);
  }
}

// ----------------------------------------------------------------------------
// Save Preview to Turso DB
// ----------------------------------------------------------------------------
export interface SavePreviewResult {
  code: string;
  url: string;
  isCached: boolean;
}

export async function savePreviewToTurso(
  doc: OpenLyricsDocument,
  options: {
    theme?: PreviewTheme;
    tvMode?: boolean;
    origin?: string;
  } = {}
): Promise<SavePreviewResult | null> {
  try {
    await initTursoSchema();
    const client = getTursoClient();

    // 1. Generate ultra-compact compressed binary payload
    const binary = encodeDocumentToBinary(doc);
    const deflated = deflateRaw(binary, { level: 9 });
    const payloadBase64 = uint8ArrayToBase64(deflated);

    // Generate fresh unique shortcode to avoid stale social crawler cache collisions (Discord/WhatsApp)

    // 3. Generate a clean unique 6-character shortcode
    const code = generateShortCode(6);
    const title = doc.metadata.title || 'Untitled';
    const artist = doc.metadata.artist || 'Unknown';
    const duration = Math.round(doc.metadata.duration || 0);
    const canonicalKey = doc.metadata.canonicalKey || `${artist}_${title}_${duration}`;
    const theme = options.theme || 'fluid_glow';
    const tvMode = options.tvMode ? 1 : 0;

    // 4. Save into Turso
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO preview_shares 
        (code, canonical_key, title, artist, duration, theme, tv_mode, payload, created_at, views)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), 0)
      `,
      args: [code, canonicalKey, title, artist, duration, theme, tvMode, payloadBase64],
    });

    // 5. Cache locally to avoid future reads
    saveToCache(code, {
      document: doc,
      theme: options.theme,
      tvMode: options.tvMode,
      cachedAt: Date.now(),
    });


    const baseOrigin =
      options.origin || (typeof window !== 'undefined' ? window.location.origin : '');
    const tvParam = options.tvMode ? '&tv=1' : '';

    return {
      code,
      url: `${baseOrigin}/p?c=${code}${tvParam}`,
      isCached: false,
    };
  } catch (err) {
    console.error('Turso DB save error:', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Fetch Preview from Turso DB (Optimized for 0-1 read with Multi-Tier Cache)
// ----------------------------------------------------------------------------
export async function fetchPreviewFromTurso(
  code: string
): Promise<{ document: OpenLyricsDocument; theme?: PreviewTheme; tvMode?: boolean } | null> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) return null;

  // 1. Check Multi-Tier Cache first (0 Turso reads!)
  const cached = getFromCache(cleanCode);
  if (cached) {
    return {
      document: cached.document,
      theme: cached.theme,
      tvMode: cached.tvMode,
    };
  }

  // 2. Return in-flight request if already querying (Request Coalescing: 0 duplicate network calls)
  const pending = inFlightRequests.get(cleanCode);
  if (pending) {
    return pending;
  }

  // 3. Execute network fetch and register in flight
  const fetchPromise = (async () => {
    try {
      const client = getTursoClient();
      const result = await client.execute({
        sql: 'SELECT payload, theme, tv_mode FROM preview_shares WHERE code = ? LIMIT 1',
        args: [cleanCode],
      });

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const payloadBase64 = String(row.payload);
      const theme = (row.theme as PreviewTheme) || 'fluid_glow';
      const tvMode = Boolean(row.tv_mode);

      // Decompress payload back to OpenLyricsDocument
      const compressedBytes = base64ToUint8Array(payloadBase64);
      const inflatedBinary = inflateRaw(compressedBytes);
      const document = decodeBinaryToDocument(inflatedBinary);

      // Save to Multi-Tier Cache
      saveToCache(cleanCode, {
        document,
        theme,
        tvMode,
        cachedAt: Date.now(),
      });

      // Fire-and-forget asynchronous view count update (non-blocking)
      client.execute({
        sql: 'UPDATE preview_shares SET views = views + 1 WHERE code = ?',
        args: [cleanCode],
      }).catch(() => {});

      return {
        document,
        theme,
        tvMode,
      };
    } catch (err) {
      console.error('Failed to fetch preview from Turso:', err);
      return null;
    } finally {
      inFlightRequests.delete(cleanCode);
    }
  })();

  inFlightRequests.set(cleanCode, fetchPromise);
  return fetchPromise;
}
