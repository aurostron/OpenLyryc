'use client';

// Scoped recovery UI for the /studio segment. A crash in a lazily-loaded
// sub-view (paste, revisions, … — e.g. a chunk that failed to load) lands
// here instead of nuking the whole app via the global error screen.
// Deliberately dependency-free (no heavy imports that could re-crash).

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const goEditor = () => {
    try {
      window.location.hash = '';
    } catch {}
    reset();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#08080a] px-6 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
          <span className="material-symbols-outlined text-2xl text-amber-300">warning</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-white">Studio hit a snag</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          This view failed to load
          {error?.message ? (
            <>
              {' — '}
              <span className="font-sans text-xs text-zinc-500">
                {String(error.message).slice(0, 140)}
              </span>
            </>
          ) : (
            '.'
          )}{' '}
          Your last autosave is preserved locally.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-10 rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Reload studio
          </button>
          <button
            type="button"
            onClick={goEditor}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            Back to editor
          </button>
        </div>
        {error?.digest && (
          <p className="mt-4 font-sans text-[10px] uppercase tracking-wider text-zinc-600">
            Error {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
