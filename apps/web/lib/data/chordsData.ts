/**
 * Chord Song Configuration Data
 *
 * Lyrics + timing come from the live lyricsResolver (lrc.red / binimum / musixmatch / lrclib).
 * This file only stores chord annotations per line index and song metadata.
 * Line indices refer to the resolved LyricLine[] array (after lyrics are fetched).
 */

export interface ChordAnnotation {
  /** Optional lyric text cue to anchor chord regardless of provider line breaks */
  lyricCue?: string;
  /** Index into the resolved LyricLine[] array from the lyrics engine */
  lineIndex: number;
  /** Chord name, e.g. "G", "Bm", "Am", "D" */
  chord: string;
  /**
   * Fractional offset within the line (0.0 = line start, 1.0 = line end).
   * Used when a chord change happens mid-line, e.g. (G) first half, (Bm) second half.
   * Omit (or set 0) when the chord plays for the full line.
   */
  beatOffset?: number;
}

export interface ChordSongConfig {
  id: string;
  slug: string;
  title: string;
  artist: string;
  movieOrAlbum?: string;
  coverArt: string;
  youtubeId?: string;
  capo?: string;
  key?: string;
  /** BPM used for minimum chord hold duration (1 bar = beatsPerBar / BPM * 60) */
  bpm: number;
  timeSignature: [number, number];
  chordsUsed: string[];
  chordAnnotations: ChordAnnotation[];
}

export const SEEDED_CHORD_SONGS: ChordSongConfig[] = [
  {
    id: 'tu-jaane-na',
    slug: 'tu-jaane-na-chords-ajab-prem-ki-ghazab-kahani',
    title: 'Tu Jaane Na',
    artist: 'Atif Aslam',
    movieOrAlbum: 'Ajab Prem Ki Ghazab Kahani',
    coverArt:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    youtubeId: 'P8PWXg3sWJ8',
    capo: 'Capo - 2nd Fret',
    key: 'G Major',
    bpm: 82,
    timeSignature: [4, 4],
    chordsUsed: ['G', 'Bm', 'Am', 'D', 'Em'],
    chordAnnotations: [
      // Verse 1
      { lyricCue: 'Kaise bataye', lineIndex: 0, chord: 'G' },
      { lyricCue: 'Kyun tujhko', lineIndex: 1, chord: 'Bm' },
      { lyricCue: 'Yaara bata', lineIndex: 2, chord: 'Am' },
      { lyricCue: 'na paayein', lineIndex: 2, chord: 'D', beatOffset: 0.5 },
      { lyricCue: 'Baatein dilon', lineIndex: 3, chord: 'G' },
      { lyricCue: 'Dekho jo', lineIndex: 4, chord: 'Bm' },
      { lyricCue: 'Aankhein tujhe', lineIndex: 5, chord: 'Am' },
      { lyricCue: 'samjhayein', lineIndex: 5, chord: 'D', beatOffset: 0.5 },
      // Chorus
      { lyricCue: 'Tu jaane na', lineIndex: 6, chord: 'G' },
      { lineIndex: 7, chord: 'D', beatOffset: 0.5 },
      { lineIndex: 8, chord: 'G' },
      { lineIndex: 9, chord: 'D', beatOffset: 0.5 },
      // Bridge
      { lyricCue: 'Milke bhi hum', lineIndex: 10, chord: 'G' },
      { lyricCue: 'Tumse na jaane kyun', lineIndex: 11, chord: 'D' },
      { lyricCue: 'Meelo ke hain', lineIndex: 12, chord: 'G' },
      { lyricCue: 'Tumse na jaane kyun', lineIndex: 13, chord: 'Am' },
      { lyricCue: 'Anjaane hain', lineIndex: 14, chord: 'G' },
      { lyricCue: 'Tumse na jaane kyun', lineIndex: 15, chord: 'Em' },
      { lyricCue: 'Sapne hain palko', lineIndex: 16, chord: 'G' },
      { lyricCue: 'Tumse na jaane kyun', lineIndex: 17, chord: 'Am' },
    ],
  },
  {
    id: 'cant-help-falling-in-love',
    slug: 'cant-help-falling-in-love-chords-elvis-presley',
    title: "Can't Help Falling in Love",
    artist: 'Elvis Presley',
    movieOrAlbum: 'Blue Hawaii',
    coverArt:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    youtubeId: 'vGJTaP6anOU',
    capo: 'No Capo',
    key: 'C Major',
    bpm: 68,
    timeSignature: [6, 8],
    chordsUsed: ['C', 'Em', 'Am', 'F', 'G', 'B7', 'A7', 'Dm'],
    chordAnnotations: [
      { lineIndex: 0, chord: 'C' },
      { lineIndex: 0, chord: 'Em', beatOffset: 0.15 },
      { lineIndex: 0, chord: 'Am', beatOffset: 0.3 },
      { lineIndex: 0, chord: 'F', beatOffset: 0.5 },
      { lineIndex: 0, chord: 'G', beatOffset: 0.75 },
      { lineIndex: 1, chord: 'F' },
      { lineIndex: 1, chord: 'G', beatOffset: 0.25 },
      { lineIndex: 1, chord: 'Am', beatOffset: 0.45 },
      { lineIndex: 1, chord: 'F', beatOffset: 0.6 },
      { lineIndex: 1, chord: 'C', beatOffset: 0.75 },
      { lineIndex: 1, chord: 'G', beatOffset: 0.88 },
      { lineIndex: 2, chord: 'C' },
      { lineIndex: 2, chord: 'Em', beatOffset: 0.3 },
      { lineIndex: 2, chord: 'Am', beatOffset: 0.5 },
      { lineIndex: 2, chord: 'F', beatOffset: 0.65 },
      { lineIndex: 3, chord: 'F' },
      { lineIndex: 3, chord: 'G', beatOffset: 0.25 },
      { lineIndex: 3, chord: 'Am', beatOffset: 0.45 },
      { lineIndex: 3, chord: 'F', beatOffset: 0.6 },
      // Bridge
      { lineIndex: 4, chord: 'Em' },
      { lineIndex: 4, chord: 'B7', beatOffset: 0.33 },
      { lineIndex: 4, chord: 'Em', beatOffset: 0.55 },
      { lineIndex: 4, chord: 'B7', beatOffset: 0.75 },
      { lineIndex: 5, chord: 'Em' },
      { lineIndex: 5, chord: 'B7', beatOffset: 0.4 },
      { lineIndex: 6, chord: 'Em' },
      { lineIndex: 6, chord: 'A7', beatOffset: 0.4 },
      { lineIndex: 6, chord: 'Dm', beatOffset: 0.65 },
      { lineIndex: 6, chord: 'G', beatOffset: 0.83 },
    ],
  },
  {
    id: 'perfect',
    slug: 'perfect-chords-ed-sheeran',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    movieOrAlbum: '÷ (Divide)',
    coverArt:
      'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=800&q=80',
    youtubeId: '2Vv-BfVoq4g',
    capo: 'Capo - 1st Fret',
    key: 'Ab Major (G shapes)',
    bpm: 95,
    timeSignature: [12, 8],
    chordsUsed: ['G', 'Em', 'C', 'D'],
    chordAnnotations: [
      { lineIndex: 0, chord: 'G' },
      { lineIndex: 0, chord: 'Em', beatOffset: 0.5 },
      { lineIndex: 1, chord: 'C' },
      { lineIndex: 1, chord: 'D', beatOffset: 0.65 },
      { lineIndex: 2, chord: 'G' },
      { lineIndex: 2, chord: 'Em', beatOffset: 0.55 },
      { lineIndex: 3, chord: 'C' },
      { lineIndex: 3, chord: 'D', beatOffset: 0.65 },
      // Pre-chorus
      { lineIndex: 4, chord: 'G' },
      { lineIndex: 5, chord: 'Em' },
      { lineIndex: 6, chord: 'C' },
      { lineIndex: 6, chord: 'D', beatOffset: 0.55 },
      { lineIndex: 7, chord: 'G' },
      { lineIndex: 8, chord: 'Em' },
      { lineIndex: 9, chord: 'C' },
      { lineIndex: 9, chord: 'D', beatOffset: 0.55 },
      // Chorus
      { lineIndex: 10, chord: 'Em' },
      { lineIndex: 10, chord: 'C', beatOffset: 0.35 },
      { lineIndex: 10, chord: 'G', beatOffset: 0.6 },
      { lineIndex: 11, chord: 'D' },
      { lineIndex: 11, chord: 'Em', beatOffset: 0.5 },
      { lineIndex: 12, chord: 'C' },
      { lineIndex: 12, chord: 'G', beatOffset: 0.5 },
      { lineIndex: 13, chord: 'D' },
      { lineIndex: 13, chord: 'Em', beatOffset: 0.5 },
    ],
  },
  {
    id: 'wonderwall',
    slug: 'wonderwall-chords-oasis',
    title: 'Wonderwall',
    artist: 'Oasis',
    movieOrAlbum: "(What's the Story) Morning Glory?",
    coverArt:
      'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    youtubeId: '6hzrDeceEKc',
    capo: 'Capo - 2nd Fret',
    key: 'F#m (Em shapes)',
    bpm: 88,
    timeSignature: [4, 4],
    chordsUsed: ['Em', 'G', 'D', 'A', 'C'],
    chordAnnotations: [
      { lineIndex: 0, chord: 'Em' },
      { lineIndex: 0, chord: 'G', beatOffset: 0.4 },
      { lineIndex: 1, chord: 'D' },
      { lineIndex: 1, chord: 'A', beatOffset: 0.6 },
      { lineIndex: 2, chord: 'Em' },
      { lineIndex: 2, chord: 'G', beatOffset: 0.5 },
      { lineIndex: 3, chord: 'D' },
      { lineIndex: 3, chord: 'A', beatOffset: 0.55 },
      { lineIndex: 4, chord: 'Em' },
      { lineIndex: 4, chord: 'G', beatOffset: 0.55 },
      { lineIndex: 5, chord: 'D' },
      { lineIndex: 5, chord: 'A', beatOffset: 0.45 },
      { lineIndex: 5, chord: 'C', beatOffset: 0.75 },
      // Verse 2
      { lineIndex: 6, chord: 'Em' },
      { lineIndex: 6, chord: 'G', beatOffset: 0.35 },
      { lineIndex: 7, chord: 'D' },
      { lineIndex: 7, chord: 'A', beatOffset: 0.6 },
      { lineIndex: 8, chord: 'Em' },
      { lineIndex: 8, chord: 'G', beatOffset: 0.5 },
      { lineIndex: 9, chord: 'D' },
      { lineIndex: 9, chord: 'A', beatOffset: 0.6 },
      { lineIndex: 10, chord: 'Em' },
      { lineIndex: 10, chord: 'G', beatOffset: 0.55 },
      { lineIndex: 11, chord: 'D' },
      { lineIndex: 11, chord: 'A', beatOffset: 0.45 },
      { lineIndex: 11, chord: 'C', beatOffset: 0.75 },
      // Chorus
      { lineIndex: 12, chord: 'C' },
      { lineIndex: 12, chord: 'D', beatOffset: 0.35 },
      { lineIndex: 12, chord: 'Em', beatOffset: 0.7 },
      { lineIndex: 13, chord: 'C' },
      { lineIndex: 13, chord: 'D', beatOffset: 0.35 },
      { lineIndex: 13, chord: 'Em', beatOffset: 0.7 },
      { lineIndex: 14, chord: 'C' },
      { lineIndex: 14, chord: 'D', beatOffset: 0.35 },
      { lineIndex: 14, chord: 'G', beatOffset: 0.6 },
      { lineIndex: 15, chord: 'A' },
      // Maybe
      { lineIndex: 16, chord: 'C' },
      { lineIndex: 16, chord: 'Em', beatOffset: 0.4 },
      { lineIndex: 17, chord: 'Em' },
      { lineIndex: 17, chord: 'C', beatOffset: 0.5 },
      { lineIndex: 18, chord: 'Em' },
      { lineIndex: 18, chord: 'C', beatOffset: 0.4 },
      { lineIndex: 19, chord: 'Em' },
      { lineIndex: 19, chord: 'C', beatOffset: 0.35 },
    ],
  },
  {
    id: 'kabira',
    slug: 'kabira-chords-yeh-jawaani-hai-deewani',
    title: 'Kabira',
    artist: 'Tochi Raina',
    movieOrAlbum: 'Yeh Jawaani Hai Deewani',
    coverArt:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    youtubeId: 'jHNNMj5bNQw',
    capo: 'Capo - 3rd Fret',
    key: 'D Major',
    bpm: 92,
    timeSignature: [4, 4],
    chordsUsed: ['D', 'A', 'Bm', 'G'],
    chordAnnotations: [
      { lineIndex: 0, chord: 'D' },
      { lineIndex: 1, chord: 'A' },
      { lineIndex: 2, chord: 'Bm' },
      { lineIndex: 2, chord: 'G', beatOffset: 0.55 },
      // Verse 2
      { lineIndex: 3, chord: 'D' },
      { lineIndex: 4, chord: 'A' },
      { lineIndex: 5, chord: 'Bm' },
      { lineIndex: 6, chord: 'G' },
      // Chorus
      { lineIndex: 7, chord: 'D' },
      { lineIndex: 8, chord: 'A' },
      { lineIndex: 9, chord: 'Bm' },
      { lineIndex: 10, chord: 'G' },
    ],
  },
];

export function getSeededSongByIdOrSlug(query: string): ChordSongConfig | undefined {
  const q = query.toLowerCase().trim();
  return SEEDED_CHORD_SONGS.find(
    (s) => s.id.toLowerCase() === q || s.slug.toLowerCase() === q || s.title.toLowerCase().includes(q)
  );
}
