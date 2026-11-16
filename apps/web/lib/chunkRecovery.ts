// Chunk-load resilience for the studio's lazily-split sub-views.
//
// Symptom this fixes: after a new Pages deploy, the user's cached HTML (or a
// CDN/browser chunk cache) references chunk hashes that no longer exist. The
// dynamic() promise then rejects at runtime with a minified webpack/turbopack
// "Failed to fetch dynamically imported module" / "ChunkLoadError" error and
// the whole app tree dies — the user saw it as the bare Next.js
// "This page couldn't load" screen on #search / #paste / #revisions.
//
// Recovery: any chunk-load failure triggers exactly ONE hard reload per deploy
// (flag in sessionStorage, not the hash). If the reload still can't load it
// (genuinely broken deployment), the flag prevents a reload loop and the
// scoped app/studio/error.tsx boundary renders instead.

const RELOAD_FLAG = 'openlyryc:studio:chunk-reload';

function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: string } | null;
  if (!e) return false;
  const name = String(e.name || '');
  const msg = String(e.message || '');
  const code = String(e.code || '');
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    code === 'ERR_MODULE_NOT_FOUND'
  );
}

export function withChunkRecovery<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  viewName: string
): () => Promise<T> {
  return async () => {
    try {
      return await loader();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        /* private mode — fall through to a single reload attempt */
      }
      if (!alreadyReloaded) {
        // Hard reload so the document re-fetches the current deployment's
        // chunk manifest. Keeps the hash so we land back on the same view.
        window.location.reload();
        // Park the promise: the document is being replaced anyway.
        return new Promise<T>(() => {});
      }
      // Second failure after a fresh load = real problem, not a cache miss.
      throw new Error(
        `Failed to load the ${viewName} view after reloading. The latest deployment may be incomplete — please retry in a moment.`
      );
    }
  };
}
