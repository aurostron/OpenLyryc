/**
 * D1 SQL Schema Definitions
 * @see docs/02_data_spec_and_schemas.md
 */

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
CREATE INDEX IF NOT EXISTS idx_artists_normalized ON artists(normalized_name);

CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    artist_id TEXT NOT NULL REFERENCES artists(id),
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    album TEXT,
    duration INTEGER NOT NULL,
    isrc TEXT,
    spotify_id TEXT,
    youtube_id TEXT,
    canonical_key TEXT NOT NULL UNIQUE,
    lyrics_simhash TEXT,
    canonical_r2_key TEXT NOT NULL,
    current_revision_id TEXT,
    is_restricted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
CREATE INDEX IF NOT EXISTS idx_songs_lookup ON songs(normalized_title, artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_simhash ON songs(lyrics_simhash);

CREATE TABLE IF NOT EXISTS song_platform_links (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    platform TEXT CHECK(platform IN ('spotify', 'youtube', 'isrc', 'applemusic')) NOT NULL,
    platform_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_lookup ON song_platform_links(platform, platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_song ON song_platform_links(song_id);

CREATE TABLE IF NOT EXISTS song_variants (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL REFERENCES songs(id),
    variant_name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    isrc TEXT,
    spotify_id TEXT,
    canonical_r2_key TEXT NOT NULL,
    current_revision_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
CREATE INDEX IF NOT EXISTS idx_variants_song ON song_variants(song_id);


CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    reputation_score INTEGER DEFAULT 100,
    role TEXT CHECK(role IN ('contributor', 'reviewer', 'admin')) DEFAULT 'contributor',
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);

CREATE TABLE IF NOT EXISTS song_revisions (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL REFERENCES songs(id),
    variant_id TEXT REFERENCES song_variants(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    author_handle TEXT NOT NULL,
    parent_revision_id TEXT,
    patch_data TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
    sync_accuracy_score REAL DEFAULT 0.0,
    line_count INTEGER NOT NULL DEFAULT 0,
    has_word_sync INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
CREATE INDEX IF NOT EXISTS idx_revisions_song ON song_revisions(song_id);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    revision_id TEXT NOT NULL REFERENCES song_revisions(id),
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    vote TEXT CHECK(vote IN ('approve', 'reject')) NOT NULL,
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (UNIXEPOCH())
);
`;
