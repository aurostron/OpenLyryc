/**
 * Base2048 Encoding/Decoding for ultra-compact URL embedding.
 * Base2048 encodes 11 bits per Unicode character.
 */

// Build the main repertoire of 2048 safe Unicode characters.
const REPERTOIRE_RANGES = [
  [0x03B1, 0x03C9], // Greek lowercase
  [0x0400, 0x04FF], // Cyrillic
  [0x0500, 0x052F], // Cyrillic Supplement
  [0x0530, 0x058F], // Armenian
  [0x10A0, 0x10FF], // Georgian
  [0x1200, 0x137F], // Ethiopic
  [0x13A0, 0x13FF], // Cherokee
  [0x1400, 0x167F], // Unified Canadian Aboriginal Syllabics
  [0x1681, 0x169F], // Ogham (skipped 0x1680 space)
  [0x2D00, 0x2D2F], // Georgian Supplement
  [0x2C00, 0x2C5F], // Glagolitic
  [0xA500, 0xA63F], // Vai
];

const forwardMap: string[] = [];
const reverseMap: Map<string, number> = new Map();

for (const range of REPERTOIRE_RANGES) {
  for (let cp = range[0]; cp <= range[1]; cp++) {
    if (forwardMap.length >= 2048) break;
    // We already skipped 0x1680 in the ranges above, and the other ranges
    // contain visible characters, not controls, spaces, or surrogates.
    const char = String.fromCodePoint(cp);
    forwardMap.push(char);
    reverseMap.set(char, forwardMap.length - 1);
  }
}

if (forwardMap.length !== 2048) {
  throw new Error(`Failed to build Base2048 repertoire: found ${forwardMap.length} chars (expected 2048)`);
}

/**
 * Encodes a Uint8Array into a Base2048 string.
 * Uses a 2-byte length prefix to correctly handle trailing padding bits.
 * Maximum payload is 65535 bytes.
 *
 * @param bytes The input byte array to encode.
 * @returns The Base2048 encoded string.
 */
export function base2048encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  const totalLength = bytes.length;
  if (totalLength > 65535) {
    throw new Error("Base2048 payload too large (max 65535 bytes)");
  }
  
  // Prepend 2-byte length (big-endian)
  const paddedBytes = new Uint8Array(totalLength + 2);
  paddedBytes[0] = (totalLength >> 8) & 0xFF;
  paddedBytes[1] = totalLength & 0xFF;
  paddedBytes.set(bytes, 2);

  let result = "";
  let currentVal = 0;
  let bitsInCurrent = 0;

  for (let i = 0; i < paddedBytes.length; i++) {
    currentVal = (currentVal << 8) | paddedBytes[i];
    bitsInCurrent += 8;

    while (bitsInCurrent >= 11) {
      bitsInCurrent -= 11;
      const index = (currentVal >> bitsInCurrent) & 0x7FF;
      result += forwardMap[index];
    }
  }

  // Handle remaining bits (pad with 0s)
  if (bitsInCurrent > 0) {
    const index = (currentVal << (11 - bitsInCurrent)) & 0x7FF;
    result += forwardMap[index];
  }

  return result;
}

/**
 * Decodes a Base2048 string back into a Uint8Array.
 * Uses the encoded 2-byte length prefix to correctly determine the payload size and ignore padding.
 *
 * @param str The Base2048 encoded string.
 * @returns The decoded Uint8Array.
 */
export function base2048decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  let currentVal = 0;
  let bitsInCurrent = 0;
  const outBytes: number[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = reverseMap.get(char);
    if (index === undefined) {
      throw new Error(`Invalid Base2048 character at index ${i}: ${char}`);
    }

    currentVal = (currentVal << 11) | index;
    bitsInCurrent += 11;

    while (bitsInCurrent >= 8) {
      bitsInCurrent -= 8;
      outBytes.push((currentVal >> bitsInCurrent) & 0xFF);
    }
  }

  if (outBytes.length < 2) {
    throw new Error("Invalid Base2048 string (too short to contain length prefix)");
  }

  const length = (outBytes[0] << 8) | outBytes[1];
  if (outBytes.length - 2 < length) {
    throw new Error("Invalid Base2048 string (truncated payload)");
  }

  // Extract exactly 'length' bytes, ignoring any padding bits at the end
  return new Uint8Array(outBytes.slice(2, 2 + length));
}
