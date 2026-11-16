import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export' as const } : {}),
  // Keep the canonical (extension-less) form working exactly as before:
  // export emits /studio.html, which Cloudflare Pages serves directly for
  // /studio — no redirect hop for existing bookmarks, share links, or
  // non-browser clients. The mirrored /studio/index.html (added by
  // scripts/dual-path-export.mjs after the build) makes /studio/ work too,
  // so both forms return 200 instead of one 308-redirecting into the other.
  trailingSlash: false,
  images: {
    unoptimized: true, // CF Pages serves static assets directly
  },
  // During `next dev`, rewrite /api/youtube/* and /api/soundcloud/* to the companion proxy server.
  // These rewrites are ignored during static export (production uses
  // Cloudflare Pages Functions or scripts/dev-server.mjs instead).
  async rewrites() {
    return [
      {
        source: '/@:username',
        destination: '/u/:username',
      },
      {
        source: '/scalar',
        destination: '/scalar.html',
      },
      {
        source: '/api/youtube/:path*',
        destination: 'http://localhost:3099/api/youtube/:path*',
      },
      {
        source: '/api/soundcloud/:path*',
        destination: 'http://localhost:3099/api/soundcloud/:path*',
      },
    ];
  },
};

export default nextConfig;
