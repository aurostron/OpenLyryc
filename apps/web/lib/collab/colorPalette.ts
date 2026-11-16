/**
 * Collaborator Color & Monochrome Theme Allocator
 * Assigns clean, accessible monochrome shades to room peers.
 */

export interface PeerColorTheme {
  hex: string;
  badgeBg: string;
  badgeText: string;
  glowBorder: string;
  cursorBg: string;
}

export const MONOCHROME_PALETTE: PeerColorTheme[] = [
  {
    hex: '#ffffff', // White
    badgeBg: 'bg-white/10',
    badgeText: 'text-white',
    glowBorder: 'border-white/30 ring-1 ring-white/20',
    cursorBg: 'bg-white',
  },
  {
    hex: '#e4e4e7', // Zinc 200
    badgeBg: 'bg-zinc-800',
    badgeText: 'text-zinc-200',
    glowBorder: 'border-zinc-500/40 ring-1 ring-zinc-500/20',
    cursorBg: 'bg-zinc-200',
  },
  {
    hex: '#d4d4d8', // Zinc 300
    badgeBg: 'bg-zinc-800',
    badgeText: 'text-zinc-300',
    glowBorder: 'border-zinc-600/40 ring-1 ring-zinc-600/20',
    cursorBg: 'bg-zinc-300',
  },
  {
    hex: '#a1a1aa', // Zinc 400
    badgeBg: 'bg-zinc-800/80',
    badgeText: 'text-zinc-400',
    glowBorder: 'border-zinc-700/60 ring-1 ring-zinc-700/30',
    cursorBg: 'bg-zinc-400',
  },
  {
    hex: '#f4f4f5', // Zinc 100
    badgeBg: 'bg-white/15',
    badgeText: 'text-white',
    glowBorder: 'border-white/40 ring-1 ring-white/20',
    cursorBg: 'bg-white',
  },
];

// Fallback legacy palette for reverse compatibility
export const COLLAB_PALETTE: PeerColorTheme[] = MONOCHROME_PALETTE;

/**
 * Gets a deterministic monochrome theme based on index or string hash.
 */
export function getCollabColor(input: number | string): PeerColorTheme {
  if (typeof input === 'number') {
    return MONOCHROME_PALETTE[Math.abs(input) % MONOCHROME_PALETTE.length];
  }

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return MONOCHROME_PALETTE[Math.abs(hash) % MONOCHROME_PALETTE.length];
}

const MEMORABLE_NAMES = [
  'Writer',
  'Singer',
  'Host',
  'Listener',
  'Editor',
  'Viewer',
  'Member',
  'Guide',
];

/**
 * Generates a clean default name like "Writer 42".
 */
export function generateRandomCollabName(): string {
  const name = MEMORABLE_NAMES[Math.floor(Math.random() * MEMORABLE_NAMES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${name} ${num}`;
}
