import { OpenLyricsDocument } from '@/types/lyrics';
import { parseYouTubeMusicId } from './platformLinker';

/**
 * ZigZag encoding converts signed integers to unsigned integers
 * such that small negative numbers become small positive numbers.
 */
function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

/**
 * ZigZag decoding converts back from unsigned integers to signed integers.
 */
function zigzagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

/**
 * Write a protobuf-style VarInt to a byte array buffer.
 */
function writeVarInt(buf: number[], value: number): void {
  // Use Math.floor to avoid 32-bit signed overflow issues for large numbers
  while (value >= 128) {
    buf.push((value & 0x7F) | 0x80);
    value = Math.floor(value / 128);
  }
  buf.push(value & 0x7F);
}

/**
 * Read a protobuf-style VarInt from a Uint8Array, advancing the offset.
 */
function readVarInt(bytes: Uint8Array, offset: { pos: number }): number {
  let value = 0;
  let shift = 0;
  while (true) {
    const b = bytes[offset.pos++];
    value |= (b & 0x7F) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return value;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Write a VarInt length-prefixed UTF-8 string to a byte array buffer.
 */
function writeString(buf: number[], str: string): void {
  const bytes = textEncoder.encode(str);
  writeVarInt(buf, bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buf.push(bytes[i]);
  }
}

/**
 * Read a VarInt length-prefixed UTF-8 string from a Uint8Array.
 */
function readString(bytes: Uint8Array, offset: { pos: number }): string {
  const len = readVarInt(bytes, offset);
  const str = textDecoder.decode(bytes.subarray(offset.pos, offset.pos + len));
  offset.pos += len;
  return str;
}

/**
 * Encodes an OpenLyricsDocument to a compact binary format (OLB v1).
 */
export function encodeDocumentToBinary(doc: OpenLyricsDocument): Uint8Array {
  const buf: number[] = [];
  const meta = doc.metadata;

  // Header: Magic 'O', Version 0x01
  buf.push(0x4F);
  buf.push(0x01);

  const cleanYt = meta.youtubeId ? (parseYouTubeMusicId(meta.youtubeId) || (/^[\w-]{11}$/.test(meta.youtubeId) ? meta.youtubeId : undefined)) : undefined;

  // Flags byte
  let flags = 0;
  if (cleanYt) flags |= 1;
  if (meta.syncedBy) flags |= 2;
  if (meta.album) flags |= 4;
  buf.push(flags);

  // Duration in seconds (uint16 big-endian)
  const duration = Math.round(meta.duration || 0);
  buf.push((duration >> 8) & 0xFF);
  buf.push(duration & 0xFF);

  // Metadata Strings
  writeString(buf, meta.title || '');
  writeString(buf, meta.artist || '');
  
  if (cleanYt) {
    // 11 bytes exact ASCII
    const ytBytes = textEncoder.encode(cleanYt.padEnd(11, ' '));
    for (let i = 0; i < 11; i++) buf.push(ytBytes[i]);
  }
  
  if (meta.syncedBy) {
    writeString(buf, meta.syncedBy);
  }
  
  if (meta.album) {
    writeString(buf, meta.album);
  }

  // Lines
  const lines = doc.lines || [];
  writeVarInt(buf, lines.length);

  let prevLineStartMs = 0;

  for (const line of lines) {
    const startMs = Math.round(line.start * 1000);
    const endMs = Math.round(line.end * 1000);
    const durationMs = Math.max(0, endMs - startMs);

    writeVarInt(buf, zigzagEncode(startMs - prevLineStartMs));
    writeVarInt(buf, durationMs);
    writeString(buf, line.text || '');

    let lineFlags = 0;
    if (line.tokens && line.tokens.length > 0) lineFlags |= 1;
    if (line.emphasis) lineFlags |= 2;
    buf.push(lineFlags);

    if (line.tokens && line.tokens.length > 0) {
      writeVarInt(buf, line.tokens!.length);
      let prevTokenEndMs = startMs;
      
      for (const token of line.tokens!) {
        const tokenStartMs = Math.round(token.start * 1000);
        const tokenEndMs = Math.round(token.end * 1000);
        const tokenDurationMs = Math.max(0, tokenEndMs - tokenStartMs);

        writeVarInt(buf, zigzagEncode(tokenStartMs - prevTokenEndMs));
        writeVarInt(buf, tokenDurationMs);
        writeString(buf, token.text || '');

        let tokenFlags = 0;
        if (token.emphasis) tokenFlags |= 1;
        buf.push(tokenFlags);

        prevTokenEndMs = tokenEndMs;
      }
    }

    prevLineStartMs = startMs;
  }

  return new Uint8Array(buf);
}

/**
 * Decodes an OLB v1 binary Uint8Array back to an OpenLyricsDocument.
 */
export function decodeBinaryToDocument(bytes: Uint8Array): OpenLyricsDocument {
  const offset = { pos: 0 };

  // Header
  const magic = bytes[offset.pos++];
  if (magic !== 0x4F) throw new Error("Invalid magic byte, expected 0x4F ('O')");
  const version = bytes[offset.pos++];
  if (version !== 1) throw new Error("Unsupported version, expected 0x01");
  
  const flags = bytes[offset.pos++];
  const hasYouTubeId = (flags & 1) !== 0;
  const hasSyncedBy = (flags & 2) !== 0;
  const hasAlbum = (flags & 4) !== 0;

  // Duration
  const durationSec = (bytes[offset.pos++] << 8) | bytes[offset.pos++];

  // Metadata Strings
  const title = readString(bytes, offset);
  const artist = readString(bytes, offset);

  let youtubeId: string | undefined;
  if (hasYouTubeId) {
    youtubeId = textDecoder.decode(bytes.subarray(offset.pos, offset.pos + 11)).trim();
    offset.pos += 11;
  }

  let syncedBy = '';
  if (hasSyncedBy) {
    syncedBy = readString(bytes, offset);
  }

  let album: string | undefined;
  if (hasAlbum) {
    album = readString(bytes, offset);
  }

  const numLines = readVarInt(bytes, offset);
  const lines: OpenLyricsDocument['lines'] = [];
  let prevLineStartMs = 0;

  for (let i = 0; i < numLines; i++) {
    const startMsDelta = zigzagDecode(readVarInt(bytes, offset));
    const startMs = prevLineStartMs + startMsDelta;
    const durationMs = readVarInt(bytes, offset);
    const endMs = startMs + durationMs;
    const text = readString(bytes, offset);

    const lineFlags = bytes[offset.pos++];
    const hasTokens = (lineFlags & 1) !== 0;
    const lineEmphasis = (lineFlags & 2) !== 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const line: any = {
      id: String(i),
      text,
      start: startMs / 1000,
      end: endMs / 1000
    };
    if (lineEmphasis) line.emphasis = true;

    if (hasTokens) {
      const tokenCount = readVarInt(bytes, offset);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokens: any[] = [];
      let prevTokenEndMs = startMs;

      for (let j = 0; j < tokenCount; j++) {
        const tokenStartDelta = zigzagDecode(readVarInt(bytes, offset));
        const tokenStartMs = prevTokenEndMs + tokenStartDelta;
        const tokenDurationMs = readVarInt(bytes, offset);
        const tokenEndMs = tokenStartMs + tokenDurationMs;
        const tokenText = readString(bytes, offset);
        const tokenFlags = bytes[offset.pos++];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token: any = {
          text: tokenText,
          start: tokenStartMs / 1000,
          end: tokenEndMs / 1000,
          durMs: tokenDurationMs
        };
        if ((tokenFlags & 1) !== 0) token.emphasis = true;
        
        tokens.push(token);
        prevTokenEndMs = tokenEndMs;
      }
      line.tokens = tokens;
    }

    lines.push(line);
    prevLineStartMs = startMs;
  }

  return {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata: {
      title,
      artist,
      duration: durationSec,
      ...(youtubeId && { youtubeId }),
      syncedBy,
      ...(album && { album }),
    },
    lines
  };
}
