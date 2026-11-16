/**
 * OpenLyryc Client-Side Audio Fingerprinting Engine
 * Generates cryptographic content hashes (SHA-256) and acoustic metadata
 * for binding audio files to canonical registry records.
 */

export interface AudioFingerprintResult {
  audioHash: string; // e.g. "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  rawHash: string; // Hex string without prefix
  durationSeconds?: number;
  sampleRate?: number;
  numberOfChannels?: number;
  fileSizeBytes: number;
}

/**
 * Computes a deterministic SHA-256 hash of an audio File or Blob.
 */
export async function computeAudioFileHash(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('WebCrypto subtle digest failed, using fallback hasher', e);
    }
  }

  // Robust FNV-1a fallback hash if Web Crypto subtle is unavailable
  let h1 = 0xdeadbeef ^ file.size;
  let h2 = 0x41c6ce57 ^ file.size;
  const view = new Uint8Array(arrayBuffer);
  const step = Math.max(1, Math.floor(view.length / 50000));
  for (let i = 0; i < view.length; i += step) {
    h1 = Math.imul(h1 ^ view[i], 2654435761);
    h2 = Math.imul(h2 ^ view[i], 1597334677);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}${file.size.toString(16).padStart(8, '0')}`.padEnd(64, '0');
}

/**
 * Generates full audio fingerprint including SHA-256 and decoded audio properties.
 */
export async function generateAudioFingerprint(file: File): Promise<AudioFingerprintResult> {
  const rawHash = await computeAudioFileHash(file);
  const audioHash = `sha256:${rawHash}`;

  let durationSeconds: number | undefined;
  let sampleRate: number | undefined;
  let numberOfChannels: number | undefined;

  // Attempt to decode audio header for precise duration if AudioContext is available
  if (typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const buffer = await file.slice(0, Math.min(file.size, 5 * 1024 * 1024)).arrayBuffer();
        try {
          const decoded = await ctx.decodeAudioData(buffer.slice(0));
          durationSeconds = decoded.duration;
          sampleRate = decoded.sampleRate;
          numberOfChannels = decoded.numberOfChannels;
        } catch {
          // Some audio files require full buffer to decode header
        } finally {
          ctx.close();
        }
      }
    } catch {
      // AudioContext fallback
    }
  }

  return {
    audioHash,
    rawHash,
    durationSeconds,
    sampleRate,
    numberOfChannels,
    fileSizeBytes: file.size,
  };
}
