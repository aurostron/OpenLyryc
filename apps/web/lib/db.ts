import Dexie, { type Table } from 'dexie';
import type { OpenLyricsDocument } from '@/types/lyrics';

export interface ProjectRecord {
  id: string;
  title: string;
  artist: string;
  updatedAt: number;
  lineCount: number;
  document: OpenLyricsDocument;
}

export interface LyricsCacheRecord {
  songId: string;
  document: OpenLyricsDocument;
  timestamp: number;
  source?: string;
}

export interface DraftRecord {
  id: string;
  document: OpenLyricsDocument;
  updatedAt: number;
}

export interface FileHandleRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  updatedAt: number;
}

export interface AppBackdropRecord {
  id: string; // 'active'
  blob: Blob;
  mediaType: 'image' | 'video';
  name: string;
  updatedAt: number;
}

export class OpenLyrycDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  lyrics_cache!: Table<LyricsCacheRecord, string>;
  drafts!: Table<DraftRecord, string>;
  file_handles!: Table<FileHandleRecord, string>;
  app_backdrop!: Table<AppBackdropRecord, string>;

  constructor() {
    super('OpenLyrycDB');
    this.version(1).stores({
      projects: 'id, title, artist, updatedAt, lineCount',
      lyrics_cache: 'songId, timestamp',
      drafts: 'id, updatedAt',
    });
    this.version(2).stores({
      file_handles: 'id',
    });
    this.version(3).stores({
      app_backdrop: 'id, updatedAt',
    });
  }
}

export const db = new OpenLyrycDatabase();

// Legacy localStorage keys for zero-data-loss migration
const LEGACY_PROJECTS_KEY = 'openlyryc_saved_projects_v1';
const LEGACY_DRAFT_KEY = 'openlyrics_current_document_v1';

let migrationPromise: Promise<void> | null = null;

/**
 * Automatically migrates existing projects and active drafts from localStorage
 * into Dexie IndexedDB on first run so no user data is lost.
 */
export function migrateLegacyLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      // 1. Migrate Saved Projects
      const rawProjects = localStorage.getItem(LEGACY_PROJECTS_KEY);
      if (rawProjects) {
        const parsed: ProjectRecord[] = JSON.parse(rawProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingCount = await db.projects.count();
          if (existingCount === 0) {
            await db.projects.bulkPut(parsed);
            console.info(`[OpenLyrycDB] Successfully migrated ${parsed.length} projects from localStorage to Dexie.`);
          }
        }
      }

      // 2. Migrate Active Draft
      const rawDraft = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (rawDraft) {
        const parsedDoc = JSON.parse(rawDraft) as OpenLyricsDocument;
        if (parsedDoc && Array.isArray(parsedDoc.lines)) {
          const existingDraft = await db.drafts.get('active_doc');
          if (!existingDraft) {
            await db.drafts.put({
              id: 'active_doc',
              document: parsedDoc,
              updatedAt: Date.now(),
            });
            console.info('[OpenLyrycDB] Successfully migrated active draft from localStorage to Dexie.');
          }
        }
      }
    } catch (err) {
      console.warn('[OpenLyrycDB] Legacy localStorage migration error:', err);
    }
  })();

  return migrationPromise;
}

/**
 * Retrieves all saved projects sorted by most recently updated.
 */
export async function getSavedProjects(): Promise<ProjectRecord[]> {
  if (typeof window === 'undefined') return [];
  try {
    await migrateLegacyLocalStorage();
    return await db.projects.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to get projects:', err);
    return [];
  }
}

export const ACTIVE_PROJECT_ID_KEY = 'openlyrics_active_project_id';

/**
 * Saves or updates a project document in Dexie.
 */
export async function saveProjectToStorage(
  doc: OpenLyricsDocument,
  songTitle?: string,
  existingId?: string
): Promise<string> {
  if (typeof window === 'undefined') return existingId || 'proj_1';
  try {
    await migrateLegacyLocalStorage();
    const title = (songTitle || doc.metadata.title || 'Untitled Song').trim();
    const artist = (doc.metadata.artist || 'Unknown Artist').trim();

    let targetId = existingId;

    if (!targetId && title.toLowerCase() !== 'untitled song' && title.toLowerCase() !== 'untitled track') {
      const match = await db.projects
        .where('title')
        .equalsIgnoreCase(title)
        .and((p) => p.artist.toLowerCase() === artist.toLowerCase())
        .first();

      if (match) {
        targetId = match.id;
      }
    }

    const id = targetId || `proj_${Date.now()}`;
    const lineCount = doc.lines.length;
    const updatedAt = Date.now();

    const projectRecord: ProjectRecord = {
      id,
      title,
      artist,
      updatedAt,
      lineCount,
      document: doc,
    };

    await db.projects.put(projectRecord);
    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, id);

    // Auto-sync to connected local folder in background
    import('./fileSystemSync')
      .then((m) => m.autoSyncProjectIfConnected(projectRecord))
      .catch(() => {});

    return id;
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to save project:', err);
    return existingId || 'proj_1';
  }
}

/**
 * Deletes a project by ID and returns the updated list.
 */
export async function deleteProjectFromStorage(id: string): Promise<ProjectRecord[]> {
  if (typeof window === 'undefined') return [];
  try {
    await db.projects.delete(id);
    return await db.projects.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to delete project:', err);
    return [];
  }
}

/**
 * Retrieves the currently active editor draft.
 */
export async function getActiveDraft(): Promise<OpenLyricsDocument | null> {
  if (typeof window === 'undefined') return null;
  try {
    await migrateLegacyLocalStorage();
    const draft = await db.drafts.get('active_doc');
    if (draft && draft.document) {
      return draft.document;
    }
    // Fallback to legacy localStorage if not yet migrated
    const raw = localStorage.getItem(LEGACY_DRAFT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    return null;
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to get active draft:', err);
    return null;
  }
}

/**
 * Persists the active editor draft asynchronously into Dexie.
 */
export async function saveActiveDraft(doc: OpenLyricsDocument): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await db.drafts.put({
      id: 'active_doc',
      document: doc,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[OpenLyrycDB] Failed to save active draft:', err);
  }
}

/**
 * Clears the active editor draft.
 */
export async function clearActiveDraft(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await db.drafts.delete('active_doc');
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to clear active draft:', err);
  }
}

/**
 * Persists an image or video backdrop directly as a binary Blob in Dexie (IndexedDB).
 * Bypasses 5MB localStorage limits and eliminates main-thread base64 freezes.
 */
export async function saveAppBackdropBlob(
  file: File | Blob,
  mediaType: 'image' | 'video',
  name?: string
): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const fileName = name || (file instanceof File ? file.name : `${mediaType}_backdrop`);
    const record: AppBackdropRecord = {
      id: 'active',
      blob: file,
      mediaType,
      name: fileName,
      updatedAt: Date.now(),
    };
    await db.app_backdrop.put(record);
    return URL.createObjectURL(file);
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to save backdrop to Dexie:', err);
    return URL.createObjectURL(file);
  }
}

/**
 * Loads the active persistent backdrop Blob from Dexie on startup.
 */
export async function getActiveAppBackdrop(): Promise<{
  url: string;
  mediaType: 'image' | 'video';
  name: string;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const record = await db.app_backdrop.get('active');
    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      return {
        url,
        mediaType: record.mediaType,
        name: record.name,
      };
    }
    return null;
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to load backdrop from Dexie:', err);
    return null;
  }
}

/**
 * Deletes the persistent backdrop from Dexie.
 */
export async function clearAppBackdropBlob(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await db.app_backdrop.delete('active');
  } catch (err) {
    console.warn('[OpenLyrycDB] Failed to clear backdrop from Dexie:', err);
  }
}

