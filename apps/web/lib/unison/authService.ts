'use client';

import {
  canonicalJson,
  generateRandomNonce,
  generateUnisonKeyPair,
  hashPublicKey,
  importSigningKey,
  isP256Jwk,
  parseIdentityExport,
  signPayload,
  toBase64,
  createIdentityExportFile,
  UnisonKeyPair,
} from './crypto';
import type {
  UnisonChallenge,
  UnisonIdentity,
  UnisonSignedBody,
  UnisonStoredSession,
  UnisonApiEnvelope,
} from './types';

export const UNISON_SESSION_STORAGE_KEY = 'openlyryc_unison_session_v1';
export const UNISON_API_BASE = 'https://unison.betterlyrics.org';

export const BL_EXTENSION_ID = 'effdbpeggelllpfkjppbokhmmiinhlmg';
export const BL_EDGE_EXTENSION_ID = 'mjfeaklppoegooljmjicjdbiccgjdlhd';
export const BL_EXTENSION_IDS = [BL_EXTENSION_ID, BL_EDGE_EXTENSION_ID] as const;
export const CUSTOM_EXTENSION_ID_KEY = 'openlyryc_bl_extension_id';

export function getCustomExtensionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOM_EXTENSION_ID_KEY);
}

export function setCustomExtensionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (!id || !id.trim()) {
    localStorage.removeItem(CUSTOM_EXTENSION_ID_KEY);
  } else {
    localStorage.setItem(CUSTOM_EXTENSION_ID_KEY, id.trim());
  }
}

export interface ExtensionProbeResult {
  hasChromiumRuntime: boolean;
  isAvailable: boolean;
  extensionId?: string;
}

export async function probeBetterLyricsExtension(customId?: string): Promise<ExtensionProbeResult> {
  const runtime = getChromeRuntime();
  if (!runtime) {
    return { hasChromiumRuntime: false, isAvailable: false };
  }

  const candidateIds = Array.from(
    new Set([customId, getCustomExtensionId(), BL_EXTENSION_ID, BL_EDGE_EXTENSION_ID].filter(Boolean))
  ) as string[];

  for (const id of candidateIds) {
    try {
      const port = runtime.connect(id, { name: 'bl-auth-site' });
      let disconnected = false;
      const connected = await new Promise<boolean>((resolve) => {
        port.onDisconnect.addListener(() => {
          disconnected = true;
          resolve(false);
        });
        setTimeout(() => {
          if (!disconnected) resolve(true);
        }, 120);
      });

      try {
        port.disconnect();
      } catch {}

      if (connected) {
        return {
          hasChromiumRuntime: true,
          isAvailable: true,
          extensionId: id,
        };
      }
    } catch {
      // try next
    }
  }

  return {
    hasChromiumRuntime: true,
    isAvailable: false,
  };
}

interface ExtensionPort {
  onMessage: { addListener: (listener: (msg: unknown) => void) => void };
  onDisconnect: { addListener: (listener: () => void) => void };
  postMessage: (msg: unknown) => void;
  disconnect: () => void;
}

interface ChromeRuntimeLike {
  connect: (id: string, info: { name: string }) => ExtensionPort;
  lastError?: { message: string };
}

function getChromeRuntime(): ChromeRuntimeLike | null {
  if (typeof window === 'undefined') return null;
  const c = (globalThis as unknown as { chrome?: { runtime?: Partial<ChromeRuntimeLike> } }).chrome;
  if (!c || !c.runtime || typeof c.runtime.connect !== 'function') return null;
  return c.runtime as ChromeRuntimeLike;
}

export function loadUnisonSession(): UnisonStoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(UNISON_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as UnisonStoredSession;
    if (
      !session ||
      typeof session.sessionToken !== 'string' ||
      typeof session.keyId !== 'string' ||
      typeof session.expiresAt !== 'number'
    ) {
      localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
      return null;
    }
    // Check expiration (timestamp is in seconds)
    if (session.expiresAt <= Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveUnisonSession(session: UnisonStoredSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('openlyryc-unison-session-updated'));
}

export function clearUnisonSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('openlyryc-unison-session-updated'));
}

async function unwrapEnvelope<T>(res: Response): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = (body as { error?: unknown })?.error;
    throw new Error(typeof err === 'string' && err.length > 0 ? err : `HTTP ${res.status}`);
  }
  const envelope = body as UnisonApiEnvelope<T>;
  if (!envelope.success) throw new Error(envelope.error || 'Request failed');
  return envelope.data;
}

/**
 * Fetches a challenge nonce from the Unison server.
 */
export async function fetchChallenge(): Promise<UnisonChallenge> {
  const res = await fetch(`${UNISON_API_BASE}/auth/challenge`);
  return unwrapEnvelope<UnisonChallenge>(res);
}

/**
 * Exchanges a signed challenge response for a 30-day session token.
 */
export async function postSession(signedBody: UnisonSignedBody): Promise<UnisonStoredSession> {
  const res = await fetch(`${UNISON_API_BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedBody),
  });
  return unwrapEnvelope<UnisonStoredSession>(res);
}

/**
 * Validates the current session token with Unison and retrieves the current profile.
 */
export async function fetchMe(token: string): Promise<UnisonIdentity> {
  const res = await fetch(`${UNISON_API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrapEnvelope<UnisonIdentity>(res);
}

/**
 * Signs in using an uploaded Better Lyrics identity export file (`better-lyrics-identity.json`).
 * Works natively in all browsers and desktop without needing extension permissions.
 */
export async function signInWithIdentityFile(file: File): Promise<UnisonStoredSession> {
  const text = await file.text();
  const identity = parseIdentityExport(text);

  // 1. Fetch challenge nonce
  const { nonce } = await fetchChallenge();

  // 2. Build canonical payload
  const payload = {
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://openlyryc.com',
    timestamp: Date.now(),
    nonce,
    keyId: identity.keyId,
  };

  // 3. Sign with ECDSA P-256
  const signature = await signPayload(payload, identity.privateKey);

  // 4. Submit to Unison session endpoint
  const signedBody: UnisonSignedBody = {
    payload,
    signature,
    publicKey: identity.publicKey,
  };

  const session = await postSession(signedBody);

  // 5. Store private and public keys in session so future submissions can be signed
  const fullSession: UnisonStoredSession = {
    ...session,
    privateKeyJwk: identity.privateKey,
    publicKeyJwk: identity.publicKey,
  };

  saveUnisonSession(fullSession);
  return fullSession;
}

/**
 * Generates a fresh in-browser ECDSA P-256 keypair, registers it with Unison, and saves the session.
 * Also returns the exportable backup JSON string so the user can download it.
 */
export async function generateAndRegisterNewIdentity(): Promise<{
  session: UnisonStoredSession;
  exportJson: string;
}> {
  const keyPair = await generateUnisonKeyPair();
  const { nonce } = await fetchChallenge();

  const payload = {
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://openlyryc.com',
    timestamp: Date.now(),
    nonce,
    keyId: keyPair.keyId,
  };

  const signature = await signPayload(payload, keyPair.privateKey);

  const signedBody: UnisonSignedBody = {
    payload,
    signature,
    publicKey: keyPair.publicKey,
  };

  const session = await postSession(signedBody);

  const fullSession: UnisonStoredSession = {
    ...session,
    privateKeyJwk: keyPair.privateKey,
    publicKeyJwk: keyPair.publicKey,
  };

  saveUnisonSession(fullSession);
  const exportJson = createIdentityExportFile(keyPair);

  return { session: fullSession, exportJson };
}

/**
 * Signs in using the official Better Lyrics Chrome/Edge extension port.
 * Sequentially queries candidate extension IDs (custom dev ID, Chrome ID, Edge ID).
 */
export async function signInWithExtension(
  targetExtensionId?: string
): Promise<UnisonStoredSession> {
  const runtime = getChromeRuntime();
  if (!runtime) {
    throw new Error(
      'Chromium browser runtime not detected. Direct extension sign-in requires Chrome, Brave, or Edge.'
    );
  }

  const candidateIds = Array.from(
    new Set([targetExtensionId, getCustomExtensionId(), BL_EXTENSION_ID, BL_EDGE_EXTENSION_ID].filter(Boolean))
  ) as string[];

  const { nonce } = await fetchChallenge();
  const origin = window.location.origin;

  let lastErrorDetail = '';

  for (const extensionId of candidateIds) {
    try {
      const signedBody = await new Promise<UnisonSignedBody>((resolve, reject) => {
        let port: ExtensionPort;
        try {
          port = runtime.connect(extensionId, { name: 'bl-auth-site' });
        } catch (connectErr: any) {
          reject(new Error(connectErr?.message || 'Could not initiate connection to extension.'));
          return;
        }

        let settled = false;

        port.onMessage.addListener((raw: unknown) => {
          if (settled) return;
          settled = true;
          const msg = raw as { ok: boolean; signedBody?: UnisonSignedBody; reason?: string };
          if (msg && msg.ok && msg.signedBody) {
            resolve(msg.signedBody);
          } else {
            let errorReason = 'Better Lyrics rejected or could not complete authentication.';
            if (msg?.reason === 'USER_CANCELLED') {
              errorReason = 'Sign-in cancelled in Better Lyrics.';
            } else if (msg?.reason === 'USER_DISMISSED') {
              errorReason = 'Better Lyrics approval window was closed.';
            } else if (msg?.reason === 'ORIGIN_MISMATCH') {
              errorReason = 'Origin mismatch between OpenLyryc and Better Lyrics.';
            } else if (msg?.reason === 'INVALID_REQUEST') {
              errorReason = 'Invalid authentication challenge received.';
            }
            reject(new Error(errorReason));
          }
          try {
            port.disconnect();
          } catch {}
        });

        port.onDisconnect.addListener(() => {
          if (settled) return;
          settled = true;
          const msg = runtime.lastError?.message || '';
          if (msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection')) {
            reject(new Error('NOT_DETECTED'));
          } else {
            reject(new Error(msg || 'Better Lyrics extension disconnected before reply.'));
          }
        });

        port.postMessage({
          type: 'bl-auth-request',
          nonce,
          origin,
        });
      });

      const session = await postSession(signedBody);
      saveUnisonSession(session);
      return session;
    } catch (err: any) {
      if (err?.message === 'NOT_DETECTED') {
        lastErrorDetail = 'Extension not responding with ID ' + extensionId;
        continue;
      }
      throw err;
    }
  }

  // If we reach here, neither extension responded
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));

  if (isLocal) {
    throw new Error(
      `Direct extension sign-in cannot connect from localhost (${origin}). Chrome strictly restricts extension communication to origins declared in the extension's externally_connectable manifest (which only allows https://openlyryc.pages.dev). For local development, please sign in by importing your Identity File (better-lyrics-identity.json).`
    );
  }

  throw new Error(
    'Better Lyrics extension was not detected or did not accept the connection. If you have Better Lyrics installed from the Chrome Web Store, the update recognizing OpenLyryc (PR #1046) is merged into master but pending a store release by the Better Lyrics team (current Web Store version is 3.0.2). You can load an unpacked master build or sign in instantly using your Identity File.'
  );
}
