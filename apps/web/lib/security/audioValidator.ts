/**
 * OpenLyryc Audio Security & File Validator
 * Ensures only authentic audio files can be transferred over P2P rooms.
 * Validates binary magic headers, checks file size limits, and sanitizes filenames.
 */

export const MAX_AUDIO_FILE_SIZE_BYTES = 70 * 1024 * 1024; // 70 MB maximum
export const MIN_AUDIO_FILE_SIZE_BYTES = 64; // Minimum bytes for valid audio header

export interface AudioValidationResult {
  valid: boolean;
  format?: 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a' | 'aac' | 'webm';
  mimeType?: string;
  error?: string;
}

/**
 * Inspects binary magic bytes to ensure file is legitimate audio.
 * Prevents scripts, executables, or malicious payloads from being disguised as audio.
 */
export function validateAudioMagicBytes(buffer: ArrayBuffer | Uint8Array): AudioValidationResult {
  if (!buffer) {
    return { valid: false, error: 'No audio data received.' };
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.byteLength < MIN_AUDIO_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File is too small to be a valid audio file.' };
  }

  if (bytes.byteLength > MAX_AUDIO_FILE_SIZE_BYTES) {
    const sizeMb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File exceeds maximum allowed size (${sizeMb} MB > 70 MB).` };
  }

  // 1. MP3 with ID3 header: "ID3" (0x49 0x44 0x33)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { valid: true, format: 'mp3', mimeType: 'audio/mpeg' };
  }

  // 2. MP3 raw frame sync: 11 bits set (0xFF followed by 0xFB, 0xF3, 0xF2, 0xFA, 0xE0..0xFF)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0 && (bytes[1] & 0x06) !== 0x00) {
    return { valid: true, format: 'mp3', mimeType: 'audio/mpeg' };
  }

  // 3. WAV: "RIFF" .... "WAVE"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    return { valid: true, format: 'wav', mimeType: 'audio/wav' };
  }

  // 4. Ogg / Opus / Vorbis: "OggS" (0x4F 0x67 0x67 0x53)
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { valid: true, format: 'ogg', mimeType: 'audio/ogg' };
  }

  // 5. FLAC: "fLaC" (0x66 0x4C 0x61 0x43)
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { valid: true, format: 'flac', mimeType: 'audio/flac' };
  }

  // 6. MP4 / M4A / AAC container: "ftyp" at byte 4
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    return { valid: true, format: 'm4a', mimeType: 'audio/mp4' };
  }

  // 7. ADTS AAC: 0xFFF1 or 0xFFF9 (12 bits syncword)
  if (bytes[0] === 0xFF && (bytes[1] & 0xF6) === 0xF0) {
    return { valid: true, format: 'aac', mimeType: 'audio/aac' };
  }

  // 8. WebM / Matroska audio: 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return { valid: true, format: 'webm', mimeType: 'audio/webm' };
  }

  return {
    valid: false,
    error: 'File format not recognized as valid audio. Only MP3, WAV, OGG, FLAC, M4A, and AAC are allowed.',
  };
}

/**
 * Sanitizes an incoming audio filename.
 * Strips path traversal attempts, strange characters, and enforces allowed audio extensions.
 */
export function sanitizeAudioFilename(rawName: string | undefined | null): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'track.mp3';
  }

  // Strip path traversal and slashes
  let name = rawName.replace(/^.*[\\/]/, '').trim();

  // Remove dangerous control characters and null bytes
  name = name.replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, '_');

  // Verify safe extension
  const allowedExtensions = /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i;
  if (!allowedExtensions.test(name)) {
    name = `${name}.mp3`;
  }

  // Cap length
  if (name.length > 80) {
    const extMatch = name.match(allowedExtensions);
    const ext = extMatch ? extMatch[0] : '.mp3';
    name = `${name.slice(0, 75)}${ext}`;
  }

  return name || 'track.mp3';
}
