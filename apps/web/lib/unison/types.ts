/**
 * Type definitions for Boidu's Unison API and OpenLyryc integration.
 */

export interface UnisonStoredSession {
  sessionToken: string;
  keyId: string;
  displayName: string;
  expiresAt: number;
  avatarUrl?: string | null;
  council?: { admin: boolean } | null;
  /**
   * Optional private key stored client-side for signing submissions.
   */
  privateKeyJwk?: JsonWebKey;
  publicKeyJwk?: JsonWebKey;
}

export interface UnisonIdentity {
  keyId: string;
  displayName: string;
  expiresAt: number;
  avatarUrl?: string | null;
  council?: { admin: boolean } | null;
}

export interface UnisonSignedBody {
  payload: Record<string, unknown>;
  signature: string;
  publicKey?: JsonWebKey;
}

export interface UnisonChallenge {
  nonce: string;
  expiresAt: number;
}

export interface UnisonUserStats {
  contributions: number;
  approvedCount: number;
  reputation: number;
  rank?: number;
  tier?: string;
}

export interface UnisonBadge {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  unlockedAt?: number;
}

export interface UnisonUserGamification {
  badges: UnisonBadge[];
  featured: string[];
  xp?: number;
  level?: number;
}

export interface UnisonUserSubmission {
  id: number;
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  duration?: number;
  format: 'ttml' | 'lrc' | 'plain';
  syncType: 'richsync' | 'linesync' | 'plain';
  language?: string;
  score?: number;
  effectiveScore: number;
  voteCount: number;
  confidence: 'low' | 'medium' | 'high';
  createdAt: number;
  hidden?: boolean;
  lyricsPreview?: string;
}

export interface UnisonFeedMark {
  type: 'seal' | string;
  label?: string;
  icon?: string;
  by?: string;
  at?: number;
}

export interface UnisonFeedEntry {
  id: number;
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  isrc?: string;
  duration?: number;
  format: 'ttml' | 'lrc' | 'plain';
  language?: string;
  syncType: 'richsync' | 'linesync' | 'plain';
  score?: number;
  effectiveScore?: number;
  voteCount?: number;
  confidence?: 'low' | 'medium' | 'high';
  createdAt: number;
  hidden?: boolean;
  marks?: UnisonFeedMark[];
  submitter?: {
    keyId: string;
    displayName: string;
    tier?: string;
    level?: number;
    levelProgress?: number;
    badgeCount?: number;
    topBadge?: {
      key: string;
      name: string;
      tier?: number;
    };
    featured?: any;
    avatarUrl?: string | null;
  };
  userVote?: 1 | -1 | null;
}

export interface UnisonSubmissionsResponse {
  submissions: UnisonUserSubmission[];
  nextCursor?: string;
}

export interface UnisonMostWantedSong {
  videoId: string;
  song: string;
  artist: string;
  thumbnailUrl: string | null;
  demand: number;
  requestCount: number;
  rank: number;
  section: 'most_wanted' | 'needs_fixing';
}

export interface UnisonSubmitPayload {
  videoId: string;
  song: string;
  artist: string;
  duration: number;
  lyrics: string;
  format: 'ttml' | 'lrc' | 'plain';
  syncType: 'richsync' | 'linesync' | 'plain';
  album?: string;
  isrc?: string;
  language?: string;
}

export interface UnisonSubmitResponse {
  id: number;
  status: 'published' | 'queued' | 'pending';
  message?: string;
}

export interface UnisonCurator {
  keyId: string;
  displayName: string;
  handle?: string;
  avatarUrl: string | null;
  score: number;
  submissionCount: number;
  totalUpvotes: number;
  fulfilledCount?: number;
  fulfilledDemand?: number;
  rank: number;
  community: boolean;
  discordLinked: boolean;
  tier: 'legendary' | 'grandmaster' | 'master' | 'elite' | 'lyricist' | null;
  level: number;
  xp: number;
  xpForNext: number;
  xpFloor: number;
  badgeCount: number;
  topBadge?: {
    key: string;
    name: string;
    tier?: number;
  };
  featured: Array<{
    key: string;
    name: string;
    tier?: number;
  }>;
}

export interface UnisonBadgeCatalogTier {
  level: number;
  threshold: number;
  image: {
    color: string;
    mono: string;
    silhouette: string;
  };
}

export interface UnisonBadgeCatalogItem {
  key: string;
  name: string;
  description: string;
  category: 'tier' | 'output' | 'craft' | 'coverage' | 'curation' | 'acclaim' | 'consistency' | 'special';
  kind: 'medal' | 'title' | 'special';
  secret?: boolean;
  tiers?: UnisonBadgeCatalogTier[];
  image: {
    color: string;
    mono: string;
    silhouette: string;
  };
}

export interface UnisonBadgeCatalogResponse {
  badges: UnisonBadgeCatalogItem[];
  display: {
    inlineGlyphs: number;
    featuredMax: number;
    rarityThreshold: number;
    categoryOrder: string[];
  };
}

export interface UnisonUserBadgeStatus {
  key: string;
  earned: boolean;
  featured: boolean;
  progress?: {
    current: number;
    next: number;
  };
}

export interface UnisonUserBadgesResponse {
  keyId: string;
  level: number;
  xp: number;
  xpForNext: number;
  xpFloor: number;
  tier: string | null;
  tierRank: number | null;
  badges: UnisonUserBadgeStatus[];
  featured: string[];
  counts: {
    earned: number;
    total: number;
  };
}

export interface UnisonApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}
