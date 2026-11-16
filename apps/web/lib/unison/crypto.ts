/**
 * WebCrypto-based cryptographic utilities for Better Lyrics / Unison.
 * Uses ECDSA with curve P-256 (prime256v1) and SHA-256 hashing.
 */

export interface BetterLyricsIdentityExport {
  version: number;
  keyId: string;
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

export interface UnisonKeyPair {
  keyId: string;
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  cryptoKey?: CryptoKey;
}

const ECDSA_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ECDSA_SHA256 = { name: 'ECDSA', hash: 'SHA-256' } as const;

/**
 * Deterministically orders JSON keys alphabetically so signed payload hashes match.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

/**
 * Converts ArrayBuffer to Base64 string.
 */
export function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Computes the 64-character hex SHA-256 keyId of a canonicalized P-256 public JWK.
 */
export async function hashPublicKey(jwk: JsonWebKey): Promise<string> {
  const canonical = canonicalJson({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if a value is a valid P-256 EC JWK.
 */
export function isP256Jwk(value: unknown): value is JsonWebKey {
  if (!value || typeof value !== 'object') return false;
  const jwk = value as Record<string, unknown>;
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    typeof jwk.y === 'string'
  );
}

/**
 * Generates a brand new ECDSA P-256 keypair for Unison.
 */
export async function generateUnisonKeyPair(): Promise<UnisonKeyPair> {
  const pair = await crypto.subtle.generateKey(ECDSA_P256, true, ['sign', 'verify']);
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.privateKey),
  ]);
  const keyId = await hashPublicKey(publicJwk);

  return {
    keyId,
    publicKey: publicJwk,
    privateKey: privateJwk,
    cryptoKey: pair.privateKey,
  };
}

/**
 * Imports a private CryptoKey from JWK.
 */
export async function importSigningKey(privateJwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', privateJwk, ECDSA_P256, false, ['sign']);
}

/**
 * Parses and validates an exported Better Lyrics identity file (`better-lyrics-identity.json`).
 */
export function parseIdentityExport(text: string): BetterLyricsIdentityExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('This file is not a Better Lyrics identity export.');
  }

  const file = parsed as Record<string, unknown>;
  const { publicKey, privateKey, keyId, version } = file;

  if (
    version !== 1 ||
    typeof keyId !== 'string' ||
    keyId.length !== 64 ||
    !isP256Jwk(publicKey) ||
    !isP256Jwk(privateKey) ||
    typeof privateKey.d !== 'string'
  ) {
    throw new Error('This file is not a valid Better Lyrics identity export.');
  }

  return {
    version,
    keyId,
    publicKey: publicKey as JsonWebKey,
    privateKey: privateKey as JsonWebKey,
  };
}

/**
 * Signs any arbitrary payload object using ECDSA P-256 over its canonical JSON.
 */
export async function signPayload(
  payload: Record<string, unknown>,
  signingKeyOrJwk: CryptoKey | JsonWebKey
): Promise<string> {
  const signingKey =
    signingKeyOrJwk instanceof CryptoKey
      ? signingKeyOrJwk
      : await importSigningKey(signingKeyOrJwk);

  const canonicalString = canonicalJson(payload);
  const data = new TextEncoder().encode(canonicalString);
  const signatureBuffer = await crypto.subtle.sign(ECDSA_SHA256, signingKey, data);
  return toBase64(signatureBuffer);
}

/**
 * Generates an exportable Better Lyrics JSON file object.
 */
export function createIdentityExportFile(keyPair: UnisonKeyPair): string {
  const exportData: BetterLyricsIdentityExport = {
    version: 1,
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Generates a random alphanumeric/base64url nonce string for challenge signing.
 */
export function generateRandomNonce(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
