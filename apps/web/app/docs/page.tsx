'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import {
  ExternalLink,
  Copy,
  Check,
  FileJson,
  Sparkles,
  Maximize2,
  Tv,
} from 'lucide-react';

export default function DocsPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText('https://openlyryc.pages.dev/api/v1');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#09090b] text-[#f4f4f5] overflow-hidden select-text">
      {/* Top Navbar */}
      <header className="h-14 shrink-0 w-full border-b border-white/[0.08] bg-[#0c0c10]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group cursor-pointer"
            title="OpenLyryc Home"
          >
            <OpenLyrycLogo className="h-5 w-auto text-white group-hover:opacity-90 transition-opacity select-none" />
          </Link>
        </div>

        {/* Center Pill: Gateway Base URL */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-sans text-zinc-300">
          <span className="text-zinc-500">Base:</span>
          <span className="text-zinc-200 select-all">https://openlyryc.pages.dev/api/v1</span>
          <button
            type="button"
            onClick={handleCopyBaseUrl}
            className="ml-1 p-0.5 rounded hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Copy Public Gateway URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <a
            href="/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="View raw OpenAPI 3.1.0 JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">OpenAPI Spec</span>
          </a>

          <a
            href="/scalar"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Open Scalar in fullscreen new tab"
          >
            <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Fullscreen</span>
          </a>

          <Link
            href="/studio"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Studio</span>
          </Link>
        </div>
      </header>

      {/* Scalar Container */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] bg-[#0c0c0f] overflow-hidden relative">
        <iframe
          src="/scalar"
          title="OpenLyryc Scalar API Documentation"
          className="w-full h-full border-0 bg-[#0c0c0f]"
          allow="clipboard-write"
        />
      </main>
    </div>
  );
}
