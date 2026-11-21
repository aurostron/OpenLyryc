import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export' as const } : {}),
  trailingSlash: false,
  turbopack: {
    resolveAlias: {
      'onnxruntime-web': '../../node_modules/onnxruntime-web',
    },
  },
  images: {
    unoptimized: true, // CF Pages serves static assets directly
  },
  webpack: (config) => {
    const path = require('path');
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'onnxruntime-web': path.resolve(process.cwd(), '../../node_modules/onnxruntime-web'),
    };
    return config;
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
