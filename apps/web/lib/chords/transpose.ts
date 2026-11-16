/**
 * Guitar Chord Transposition & Word-Level Beat Sync Utilities
 */

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Transposes a single note (e.g., "C", "F#", "Bb") by N semitones.
 */
export function transposeNote(note: string, semitones: number, preferFlats = false): string {
  const isFlat = note.includes('b');
  const scale = isFlat || preferFlats ? NOTES_FLAT : NOTES_SHARP;
  
  let idx = NOTES_SHARP.indexOf(note);
  if (idx === -1) idx = NOTES_FLAT.indexOf(note);
  if (idx === -1) return note; // Not a standard note

  const newIdx = (idx + semitones % 12 + 12) % 12;
  return scale[newIdx];
}

/**
 * Transposes a full chord symbol (e.g. "C", "Am", "F#m7", "C/G", "(G)") by N semitones.
 */
export function transposeChord(chordSymbol: string, semitones: number): string {
  if (!semitones) return chordSymbol;

  // Extract outer brackets if present (e.g., "(G)" -> prefix="(", chord="G", suffix=")")
  const match = chordSymbol.match(/^([\(\[\{]*)([A-G][#b]?[^\/\s\)\}\]]*)(\/[A-G][#b]?)?([\)\}\]]*)$/);
  if (!match) return chordSymbol;

  const [, prefix, rootAndQuality, slashBass, suffix] = match;

  // Split root note and chord quality (e.g., "C#m7" -> root="C#", quality="m7")
  const rootMatch = rootAndQuality.match(/^([A-G][#b]?)(.*)$/);
  if (!rootMatch) return chordSymbol;

  const [, root, quality] = rootMatch;
  const transposedRoot = transposeNote(root, semitones);

  let transposedSlash = '';
  if (slashBass) {
    const bassNote = slashBass.slice(1);
    transposedSlash = '/' + transposeNote(bassNote, semitones);
  }

  return `${prefix}${transposedRoot}${quality}${transposedSlash}${suffix}`;
}

export const CHORD_REGEX = /([\(\[\{][A-G][#b]?[^\/\s\)\}\]]*(?:\/[A-G][#b]?)?[\)\}\]])/g;

export interface ChordToken {
  text: string;
  chord?: string; // e.g. "C", "G", "Am"
  relativeOffset: number; // 0.0 to 1.0 position in line
}

export interface LineChordMarker {
  chord: string;
  relativeOffset: number; // 0.0 to 1.0 position in line
}

export interface ParsedChordLine {
  originalText: string;
  transposedText: string;
  cleanText: string;
  tokens: ChordToken[];
  chords: string[]; // Unique chord names in line
  chordMarkers: LineChordMarker[]; // Chronological chord occurrences with exact position ratio
}

/**
 * Parses a single lyrics line containing chords like "(G) Kaise Bataye (Bm) Kyu"
 * and returns structured tokens, chord markers with exact relative offsets, and clean text.
 */
export function parseChordLine(line: string, semitones = 0): ParsedChordLine {
  if (!line || !line.trim()) {
    return {
      originalText: line,
      transposedText: line,
      cleanText: line,
      tokens: [{ text: line, relativeOffset: 0 }],
      chords: [],
      chordMarkers: [],
    };
  }

  // 1. Transpose raw chords inside brackets
  const transposedText = line.replace(CHORD_REGEX, (rawMatch) => {
    const rawChord = rawMatch.slice(1, -1).trim();
    const transposed = transposeChord(rawChord, semitones);
    return `(${transposed})`;
  });

  // 2. Extract clean lyric text (without chord markers) to measure text length
  const cleanText = transposedText.replace(CHORD_REGEX, '').replace(/\s+/g, ' ').trim();
  const totalCleanLength = Math.max(1, cleanText.length);

  // 3. Tokenize line chronologically and calculate exact character offset ratios
  const parts = transposedText.split(CHORD_REGEX);
  const tokens: ChordToken[] = [];
  const chordMarkers: LineChordMarker[] = [];
  const chordsFound: string[] = [];

  let currentCleanCharCount = 0;
  let currentPendingChord: string | undefined = undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (part.match(/^\([A-G][#b]?[^\)]*\)$/)) {
      const chordName = part.slice(1, -1);
      currentPendingChord = chordName;
      if (!chordsFound.includes(chordName)) {
        chordsFound.push(chordName);
      }
      chordMarkers.push({
        chord: chordName,
        relativeOffset: Math.min(1, Math.max(0, currentCleanCharCount / totalCleanLength)),
      });
    } else {
      tokens.push({
        text: part,
        chord: currentPendingChord,
        relativeOffset: Math.min(1, Math.max(0, currentCleanCharCount / totalCleanLength)),
      });
      currentCleanCharCount += part.length;
      currentPendingChord = undefined;
    }
  }

  return {
    originalText: line,
    transposedText,
    cleanText,
    tokens,
    chords: chordsFound,
    chordMarkers,
  };
}
