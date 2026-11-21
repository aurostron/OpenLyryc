// Maps the model's 170-class vocabulary (root:quality) to the display form used by
// the /chords UI (Cm, Cmaj7, Cm7b5, ...). Source of truth: config.json chordVocab.
//
// The model emits sharps only; flat-key songs will display enharmonically unless a
// key-aware spelling pass is added later (tracked in the plan, section 6).

const QUALITY_DISPLAY: Record<string, string> = {
  '': '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  min6: 'm6',
  maj6: '6',
  min7: 'm7',
  minmaj7: 'mMaj7',
  maj7: 'maj7',
  '7': '7',
  dim7: 'dim7',
  hdim7: 'm7b5',
  sus2: 'sus2',
  sus4: 'sus4',
};

export function displayChord(modelLabel: string): string | null {
  if (modelLabel === 'N') return 'N.C.';
  if (modelLabel === 'X') return null; // unknown -> caller holds previous chord
  const colon = modelLabel.indexOf(':');
  const root = colon === -1 ? modelLabel : modelLabel.slice(0, colon);
  const quality = colon === -1 ? '' : modelLabel.slice(colon + 1);
  const suffix = QUALITY_DISPLAY[quality];
  if (suffix === undefined) return modelLabel; // unknown quality, pass through
  return root + suffix;
}

// Whether a model label is a real, playable chord (not X/N).
export function isPlayableChord(modelLabel: string): boolean {
  return modelLabel !== 'X' && modelLabel !== 'N';
}
