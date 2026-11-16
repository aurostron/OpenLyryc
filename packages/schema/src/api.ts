import { OpenLyricsDocument } from './lyrics.js';

export interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  syncedBy?: string;
  hasWordSync?: boolean;
  hasLineSync?: boolean;
  isInstrumental?: boolean;
  source?: 'openlyryc' | 'lrclib' | 'musixmatch' | 'binimum' | 'lrcred' | 'local';
  qualityScore?: number;
  revisionHash?: string;
  currentRevisionId?: string;
  updatedAt?: string;
  canonicalKey?: string;
  lyricsHash?: string;
  lyricsSimhash?: string;
  audioHash?: string;
  platformLinks?: Array<{
    platform: 'spotify' | 'youtube' | 'isrc' | 'applemusic' | 'soundcloud';
    platformId: string;
    isPrimary?: boolean;
  }>;

  coverArt?: string;
  year?: string | number;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SongSearchResult[];
}

export interface DuplicateCheckRequest {
  platform?: 'spotify' | 'youtube' | 'isrc' | 'applemusic' | 'soundcloud';
  platformId?: string;
  canonicalKey?: string;
  lyricsSimhash?: string;
  lyricsHash?: string;
  duration?: number;
  artist?: string;
  title?: string;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  matchType: 'none' | 'exact_platform' | 'exact_lyrics' | 'fuzzy_lyrics' | 'slug_match';
  matchedSong?: SongSearchResult;
  hammingDistance?: number;
  message?: string;
}

export interface CreateRevisionRequest {
  songId?: string;
  title: string;
  artist: string;
  album?: string;
  commitMessage: string;
  parentHash?: string;
  authorHandle: string;
  document: OpenLyricsDocument;
  allowMerge?: boolean;
  isVariant?: boolean;
  variantName?: string;
}

export interface CreateRevisionResponse {
  songId: string;
  revisionHash: string;
  status: 'pending' | 'approved' | 'rejected';
  qualityScore: number;
  createdAt: string;
  isMergedRevision?: boolean;
  platformLinked?: boolean;
}

export interface RevisionItem {
  hash: string;
  songId: string;
  authorId: string;
  authorHandle: string;
  parentHash?: string;
  commitMessage: string;
  status: 'pending' | 'approved' | 'rejected';
  qualityScore: number;
  createdAt: string;
  lineCount: number;
  hasWordSync: boolean;
}

export interface RevisionHistoryResponse {
  songId: string;
  songTitle: string;
  artistName: string;
  currentRevisionHash?: string;
  revisions: RevisionItem[];
}

export type SongRevision = RevisionItem;

export interface SubmitReviewRequest {
  vote: 'approve' | 'reject';
  reviewerHandle: string;
  comment?: string;
}

export interface DMCATakedownRequest {
  songId: string;
  title: string;
  artist: string;
  contactEmail: string;
  reason: string;
  rightsHolder: string;
}

export interface DMCATakedownResponse {
  success: boolean;
  message: string;
  songId: string;
  flaggedAt: string;
}

export type PatchOperation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'move'; from: string; path: string }
  | { op: 'copy'; from: string; path: string }
  | { op: 'test'; path: string; value: unknown };

export interface SongRevisionPatch {
  id: string;
  songId: string;
  variantId?: string;
  authorId: string;
  parentRevisionId?: string;
  patch: PatchOperation[];
  commitMessage: string;
}

