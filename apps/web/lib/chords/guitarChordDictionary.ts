/**
 * Guitar Chord Dictionary (Standard Tuning: E A D G B E)
 * String ordering in arrays is 6th string (Low E) to 1st string (High E): [E, A, D, G, B, e]
 * Values:
 *  -1 : Muted string (X)
 *   0 : Open string (O)
 * 1..N : Fret number relative to nut (or baseFret)
 */

export interface ChordDefinition {
  name: string;
  baseFret?: number; // 1-indexed, default 1
  strings: [number, number, number, number, number, number]; // [6th, 5th, 4th, 3rd, 2nd, 1st]
  fingers?: [number, number, number, number, number, number]; // Finger numbers 1-4, 0 for open/muted
  barre?: {
    fret: number;
    startString: number; // 1 to 6 (6 is Low E, 1 is High E)
    endString: number;
  };
}

export const GUITAR_CHORD_DATABASE: Record<string, ChordDefinition> = {
  // Major Chords
  'C': { name: 'C', strings: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  'D': { name: 'D', strings: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  'E': { name: 'E', strings: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  'F': { name: 'F', baseFret: 1, strings: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, startString: 6, endString: 1 } },
  'G': { name: 'G', strings: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  'A': { name: 'A', strings: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  'B': { name: 'B', baseFret: 2, strings: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 2, startString: 5, endString: 1 } },

  // Minor Chords
  'Cm': { name: 'Cm', baseFret: 3, strings: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, startString: 5, endString: 1 } },
  'Dm': { name: 'Dm', strings: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  'Em': { name: 'Em', strings: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  'Fm': { name: 'Fm', baseFret: 1, strings: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, startString: 6, endString: 1 } },
  'Gm': { name: 'Gm', baseFret: 3, strings: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 3, startString: 6, endString: 1 } },
  'Am': { name: 'Am', strings: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  'Bm': { name: 'Bm', baseFret: 2, strings: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, startString: 5, endString: 1 } },

  // Seventh Chords
  'C7': { name: 'C7', strings: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  'D7': { name: 'D7', strings: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  'E7': { name: 'E7', strings: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  'F7': { name: 'F7', baseFret: 1, strings: [1, 3, 1, 2, 1, 1], barre: { fret: 1, startString: 6, endString: 1 } },
  'G7': { name: 'G7', strings: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  'A7': { name: 'A7', strings: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  'B7': { name: 'B7', strings: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },

  // Minor Seventh Chords
  'Dm7': { name: 'Dm7', strings: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barre: { fret: 1, startString: 2, endString: 1 } },
  'Em7': { name: 'Em7', strings: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  'Am7': { name: 'Am7', strings: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  'Bm7': { name: 'Bm7', baseFret: 2, strings: [-1, 2, 4, 2, 3, 2], barre: { fret: 2, startString: 5, endString: 1 } },

  // Major Seventh Chords
  'Cmaj7': { name: 'Cmaj7', strings: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  'Dmaj7': { name: 'Dmaj7', strings: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
  'Fmaj7': { name: 'Fmaj7', strings: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  'Gmaj7': { name: 'Gmaj7', strings: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3] },
  'Amaj7': { name: 'Amaj7', strings: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },

  // Sharp & Flat Sharp/Minor Chords
  'C#m': { name: 'C#m', baseFret: 4, strings: [-1, 4, 6, 6, 5, 4], barre: { fret: 4, startString: 5, endString: 1 } },
  'F#m': { name: 'F#m', baseFret: 2, strings: [2, 4, 4, 2, 2, 2], barre: { fret: 2, startString: 6, endString: 1 } },
  'G#m': { name: 'G#m', baseFret: 4, strings: [4, 6, 6, 4, 4, 4], barre: { fret: 4, startString: 6, endString: 1 } },
  'F#': { name: 'F#', baseFret: 2, strings: [2, 4, 4, 3, 2, 2], barre: { fret: 2, startString: 6, endString: 1 } },
  'C#': { name: 'C#', baseFret: 4, strings: [-1, 4, 6, 6, 6, 4], barre: { fret: 4, startString: 5, endString: 1 } },
  'G#': { name: 'G#', baseFret: 4, strings: [4, 6, 6, 5, 4, 4], barre: { fret: 4, startString: 6, endString: 1 } },
  'Bb': { name: 'Bb', baseFret: 1, strings: [-1, 1, 3, 3, 3, 1], barre: { fret: 1, startString: 5, endString: 1 } },
  'Bbm': { name: 'Bbm', baseFret: 1, strings: [-1, 1, 3, 3, 2, 1], barre: { fret: 1, startString: 5, endString: 1 } },
  'Eb': { name: 'Eb', baseFret: 6, strings: [-1, 6, 8, 8, 8, 6], barre: { fret: 6, startString: 5, endString: 1 } },
  'Ab': { name: 'Ab', baseFret: 4, strings: [4, 6, 6, 5, 4, 4], barre: { fret: 4, startString: 6, endString: 1 } },

  // Suspended & Add Chords
  'Dsus2': { name: 'Dsus2', strings: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  'Dsus4': { name: 'Dsus4', strings: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 4] },
  'Csus4': { name: 'Csus4', strings: [-1, 3, 3, 0, 1, 0], fingers: [0, 3, 4, 0, 1, 0] },
  'Asus2': { name: 'Asus2', strings: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  'Asus4': { name: 'Asus4', strings: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  'Esus4': { name: 'Esus4', strings: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  'Cadd9': { name: 'Cadd9', strings: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  'Gadd9': { name: 'Gadd9', strings: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4] }
};

/**
 * Normalizes a chord symbol (e.g., C/G -> C, [C] -> C, Bm7 -> Bm if exact match missing)
 */
export function getChordDefinition(chordRaw: string): ChordDefinition {
  const clean = chordRaw.trim().replace(/^[\(\[\{]+|[\)\]\}]+$/g, '');
  
  // If slash chord like C/G, resolve main chord C first
  const rootPart = clean.includes('/') ? clean.split('/')[0] : clean;

  if (GUITAR_CHORD_DATABASE[rootPart]) {
    return GUITAR_CHORD_DATABASE[rootPart];
  }

  // Handle common aliases (e.g., Db -> C#, D#m -> Ebm)
  const ALIASES: Record<string, string> = {
    'Db': 'C#',
    'Dbm': 'C#m',
    'D#m': 'Ebm',
    'Gb': 'F#',
    'Gbm': 'F#m',
    'A#': 'Bb',
    'A#m': 'Bbm',
  };

  if (ALIASES[rootPart] && GUITAR_CHORD_DATABASE[ALIASES[rootPart]]) {
    return { ...GUITAR_CHORD_DATABASE[ALIASES[rootPart]], name: clean };
  }

  // Fallback: strip numbers or extensions to find base chord (e.g. F#m7 -> F#m)
  const baseMatch = rootPart.match(/^([A-G][#b]?[m]?)/);
  if (baseMatch && GUITAR_CHORD_DATABASE[baseMatch[1]]) {
    return { ...GUITAR_CHORD_DATABASE[baseMatch[1]], name: clean };
  }

  // Generic fallback chord diagram (Open C style)
  return {
    name: clean,
    baseFret: 1,
    strings: [-1, 0, 2, 2, 1, 0],
    fingers: [0, 0, 2, 3, 1, 0],
  };
}
