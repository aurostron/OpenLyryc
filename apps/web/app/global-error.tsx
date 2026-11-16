'use client';

// Last-resort branded fallback when an error escapes every segment boundary.
// Must define its own <html>/<body> and stay dependency-free. Prefer the
// scoped app/studio/error.tsx for studio crashes; this only fires when even
// the root layout tree is unrecoverable.

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const reload = () => {
    try {
      window.location.reload();
    } catch {
      unstable_retry();
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#08080a',
          color: '#f4f4f5',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
              OpenLyryc couldn&apos;t load this page
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#a1a1aa', margin: '0 0 24px' }}>
              Something broke while opening this view. You progress was saved.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={reload}
                style={{
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#fff',
                  color: '#09090b',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
              {/* Plain anchor on purpose: Link cannot recover a broken root layout. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e4e4e7',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Home
              </a>
            </div>
            {error?.digest && (
              <p
                style={{
                  marginTop: 16,
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: 10,
                  letterSpacing: 1,
                  color: '#52525b',
                }}
              >
                ERROR {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
