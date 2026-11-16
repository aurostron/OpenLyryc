export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'craft' | 'dedication' | 'milestone' | 'secret';
  unlocked: boolean;
  unlockedAt?: string;
  progress?: {
    current: number;
    max: number;
    label: string;
  };
  stickerColor: string; // Background tint for sticker
  accentColor: string;
}

// ----------------------------------------------------------------------------
// Curated Achievements for OpenLyryc
// Plain, direct English — zero AI fluff
// ----------------------------------------------------------------------------
export const ACHIEVEMENTS_CATALOGUE: Achievement[] = [
  {
    id: 'first-pioneer',
    title: 'The First Pioneer',
    description: 'Claimed a username on OpenLyryc.',
    category: 'milestone',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    accentColor: '#f59e0b',
  },
  {
    id: 'spacebar-ninja',
    title: 'Spacebar Ninja',
    description: 'Tapped Space 1,000 times to sync lyrics.',
    category: 'craft',
    unlocked: true,
    unlockedAt: '',
    progress: { current: 1420, max: 1000, label: 'Taps' },
    stickerColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    accentColor: '#10b981',
  },
  {
    id: 'apple-perfectionist',
    title: 'Apple Music TTML',
    description: 'Exported lyrics with syllable-level timing.',
    category: 'craft',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    accentColor: '#f43f5e',
  },
  {
    id: 'midnight-jammer',
    title: 'Midnight Jammer',
    description: 'Timed lyrics past 2:00 AM.',
    category: 'dedication',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    accentColor: '#6366f1',
  },
  {
    id: 'unison-signer',
    title: 'WebCrypto Key',
    description: 'Signed a lyric submission using a local WebCrypto key.',
    category: 'milestone',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    accentColor: '#06b6d4',
  },
  {
    id: 'pinpoint-accuracy',
    title: 'Zero Drift',
    description: 'Timed 70 lines within 30ms of audio transients.',
    category: 'craft',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    accentColor: '#8b5cf6',
  },
  {
    id: 'caffeine-syllables',
    title: 'Syllable Surgeon',
    description: 'Split words into individual syllables for timing.',
    category: 'craft',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    accentColor: '#f97316',
  },
  {
    id: 'mic-check',
    title: 'Mic Check 1-2',
    description: 'Adjusted playback offset to align audio and lyrics.',
    category: 'milestone',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    accentColor: '#3b82f6',
  },
  {
    id: 'crowd-favorite',
    title: 'Crowd Favorite',
    description: 'Synced two full songs.',
    category: 'milestone',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    accentColor: '#ec4899',
  },
  {
    id: 'the-splitter',
    title: 'The Clean Cut',
    description: 'Split lead and backing vocals into separate lines.',
    category: 'craft',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
    accentColor: '#eab308',
  },
  {
    id: 'flow-state',
    title: 'In The Groove',
    description: 'Synced lyrics for 30 minutes straight.',
    category: 'dedication',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    accentColor: '#14b8a6',
  },
  {
    id: 'catalog-boss',
    title: 'Catalog Master',
    description: 'Published lyrics across multiple songs and formats.',
    category: 'milestone',
    unlocked: true,
    unlockedAt: '',
    stickerColor: 'bg-amber-400/10 text-amber-200 border-amber-400/20',
    accentColor: '#fbbf24',
  },
];

export function getUserAchievements(params: {
  username: string;
  hasClaimedHandle: boolean;
  unisonKeyId?: string;
  submissionsCount: number;
}): Achievement[] {
  const isAurostron = params.username.toLowerCase() === 'aurostron';

  return ACHIEVEMENTS_CATALOGUE.map((ach) => {
    if (isAurostron) {
      return ach; // Genesis author has all unlocked
    }

    let unlocked = false;
    let unlockedAt: string | undefined = undefined;

    switch (ach.id) {
      case 'first-pioneer':
        unlocked = params.hasClaimedHandle;
        unlockedAt = unlocked ? 'Claimed' : undefined;
        break;
      case 'unison-signer':
        unlocked = Boolean(params.unisonKeyId);
        unlockedAt = unlocked ? 'Key verified' : undefined;
        break;
      case 'crowd-favorite':
        unlocked = params.submissionsCount >= 2;
        unlockedAt = unlocked ? `${params.submissionsCount} songs active` : undefined;
        break;
      case 'catalog-boss':
        unlocked = params.submissionsCount >= 5;
        unlockedAt = unlocked ? `${params.submissionsCount} songs active` : undefined;
        break;
      default:
        unlocked = false;
        unlockedAt = undefined;
        break;
    }

    return {
      ...ach,
      unlocked,
      unlockedAt,
    };
  });
}
