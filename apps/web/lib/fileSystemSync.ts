import { db, ProjectRecord } from './db';
import { exportLRC } from './lrcParser';
import type { OpenLyricsDocument } from '@/types/lyrics';

const FOLDER_HANDLE_ID = 'local_lyrics_dir';

export interface FolderConnectionStatus {
  isSupported: boolean;
  isConnected: boolean;
  folderName: string | null;
  hasPermission: boolean;
}

/**
 * Checks whether the browser supports the native File System Access API.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

interface PermissionCapableHandle {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

/**
 * Checks if read/write permission is granted for a directory handle.
 * If requestIfPrompt is true and permission is currently 'prompt', prompts the user.
 */
export async function verifyFolderPermission(
  handle: FileSystemDirectoryHandle,
  requestIfPrompt = false
): Promise<boolean> {
  try {
    const permHandle = handle as unknown as PermissionCapableHandle;
    if (typeof permHandle.queryPermission !== 'function') {
      return true;
    }
    const opts = { mode: 'readwrite' as const };
    const query = await permHandle.queryPermission(opts);
    if (query === 'granted') {
      return true;
    }
    if (requestIfPrompt && query === 'prompt' && typeof permHandle.requestPermission === 'function') {
      const requested = await permHandle.requestPermission(opts);
      return requested === 'granted';
    }
    return false;
  } catch (err) {
    console.warn('[FileSystemSync] Permission query error:', err);
    return false;
  }
}

/**
 * Retrieves the stored directory handle from IndexedDB, if any.
 */
export async function getSavedFolderHandle(): Promise<{
  handle: FileSystemDirectoryHandle;
  name: string;
} | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const record = await db.file_handles.get(FOLDER_HANDLE_ID);
    if (record && record.handle) {
      return {
        handle: record.handle,
        name: record.name || record.handle.name || 'Lyrics Folder',
      };
    }
    return null;
  } catch (err) {
    console.warn('[FileSystemSync] Failed to retrieve folder handle:', err);
    return null;
  }
}

/**
 * Queries the full connection status of the local folder.
 */
export async function getFolderConnectionStatus(): Promise<FolderConnectionStatus> {
  if (!isFileSystemAccessSupported()) {
    return {
      isSupported: false,
      isConnected: false,
      folderName: null,
      hasPermission: false,
    };
  }

  const saved = await getSavedFolderHandle();
  if (!saved) {
    return {
      isSupported: true,
      isConnected: false,
      folderName: null,
      hasPermission: false,
    };
  }

  const hasPermission = await verifyFolderPermission(saved.handle, false);
  return {
    isSupported: true,
    isConnected: true,
    folderName: saved.name,
    hasPermission,
  };
}

/**
 * Prompts user to select a folder from their hard drive and stores the handle in IndexedDB.
 */
export async function pickAndConnectFolder(): Promise<{
  handle: FileSystemDirectoryHandle;
  name: string;
} | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await (window as unknown as {
      showDirectoryPicker: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({
      mode: 'readwrite',
      id: 'openlyryc_lyrics_folder',
    });

    const hasPerm = await verifyFolderPermission(handle, true);
    if (!hasPerm) {
      return null;
    }

    const name = handle.name || 'Selected Folder';
    await db.file_handles.put({
      id: FOLDER_HANDLE_ID,
      name,
      handle,
      updatedAt: Date.now(),
    });

    return { handle, name };
  } catch (err: unknown) {
    // User cancelled the prompt or browser prevented it
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
      return null;
    }
    console.warn('[FileSystemSync] Error selecting folder:', err);
    return null;
  }
}

/**
 * Disconnects and forgets the stored directory handle.
 */
export async function disconnectFolder(): Promise<void> {
  try {
    await db.file_handles.delete(FOLDER_HANDLE_ID);
  } catch (err) {
    console.warn('[FileSystemSync] Error disconnecting folder:', err);
  }
}

/**
 * Sanitizes file names to prevent invalid characters across Windows, macOS, and Linux.
 */
export function sanitizeFileName(title: string, artist?: string, ext = 'lrc'): string {
  const cleanTitle = (title || 'Untitled Song')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .trim();
  const cleanArtist = (artist && artist.toLowerCase() !== 'unknown artist' && artist.trim().length > 0)
    ? ` - ${artist.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim()}`
    : '';

  const base = `${cleanTitle}${cleanArtist}`;
  // Limit filename length to avoid OS path length errors
  const truncated = base.slice(0, 180).trim();
  return `${truncated}.${ext}`;
}

/**
 * Saves a single project's .lrc and .openlyrics.json files into the given directory handle.
 */
export async function saveProjectToFolder(
  project: ProjectRecord,
  folderHandle?: FileSystemDirectoryHandle
): Promise<{ success: boolean; error?: string }> {
  try {
    let handle = folderHandle;
    if (!handle) {
      const saved = await getSavedFolderHandle();
      if (!saved) return { success: false, error: 'No folder connected' };
      handle = saved.handle;
    }

    const hasPerm = await verifyFolderPermission(handle, false);
    if (!hasPerm) {
      return { success: false, error: 'Folder permission not granted' };
    }

    const lrcFileName = sanitizeFileName(project.title, project.artist, 'lrc');
    const jsonFileName = sanitizeFileName(project.title, project.artist, 'openlyrics.json');

    // 1. Generate LRC text
    const lrcContent = exportLRC(project.document, {
      format: 'enhanced_compact',
      includeMetadata: true,
      precisionMode: false,
    });

    // Write .lrc file
    const lrcFileHandle = await handle.getFileHandle(lrcFileName, { create: true });
    const lrcWritable = await lrcFileHandle.createWritable();
    await lrcWritable.write(lrcContent);
    await lrcWritable.close();

    // 2. Write .openlyrics.json backup
    const jsonContent = JSON.stringify(project.document, null, 2);
    const jsonFileHandle = await handle.getFileHandle(jsonFileName, { create: true });
    const jsonWritable = await jsonFileHandle.createWritable();
    await jsonWritable.write(jsonContent);
    await jsonWritable.close();

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[FileSystemSync] Failed to save project to folder:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Automatically syncs a project to the local folder in the background if connected and authorized.
 */
export async function autoSyncProjectIfConnected(project: ProjectRecord): Promise<void> {
  if (!isFileSystemAccessSupported()) return;
  try {
    const saved = await getSavedFolderHandle();
    if (!saved) return;
    const hasPerm = await verifyFolderPermission(saved.handle, false);
    if (hasPerm) {
      await saveProjectToFolder(project, saved.handle);
    }
  } catch {
    // Non-blocking auto-sync silently ignores transient permission drops
  }
}

/**
 * Syncs all saved projects to the connected local folder.
 */
export async function syncAllProjectsToFolder(
  projects: ProjectRecord[],
  onProgress?: (synced: number, total: number) => void
): Promise<{ total: number; synced: number; failed: number }> {
  const saved = await getSavedFolderHandle();
  if (!saved) {
    throw new Error('No local folder connected.');
  }

  const hasPerm = await verifyFolderPermission(saved.handle, true);
  if (!hasPerm) {
    throw new Error('Permission denied to access selected folder.');
  }

  let synced = 0;
  let failed = 0;
  const total = projects.length;

  for (let i = 0; i < total; i++) {
    const res = await saveProjectToFolder(projects[i], saved.handle);
    if (res.success) {
      synced++;
    } else {
      failed++;
    }
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { total, synced, failed };
}

/**
 * Universal browser file download helper (works across all browsers including Firefox, Safari, and Brave).
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Direct 1-click export of a project to a standard .lrc file.
 */
export function downloadProjectLrc(project: ProjectRecord): void {
  const lrc = exportLRC(project.document, {
    format: 'enhanced_compact',
    includeMetadata: true,
  });
  const filename = sanitizeFileName(project.title, project.artist, 'lrc');
  downloadFile(lrc, filename, 'text/plain;charset=utf-8');
}

/**
 * Direct 1-click export of all saved projects to a JSON library backup file.
 */
export function downloadAllProjectsBackup(projects: ProjectRecord[]): void {
  const json = JSON.stringify(projects, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(json, `openlyryc_projects_backup_${dateStr}.json`, 'application/json');
}
