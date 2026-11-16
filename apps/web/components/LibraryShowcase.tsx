'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { OpenLyrycLogo } from './OpenLyrycLogo';

export function LibraryShowcase() {
  return (
    <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 border-t border-white/[0.08]">
      <div className="space-y-4 max-w-3xl mb-12 sm:mb-16">
        <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
          Library
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
          Over 9 million songs already timed.
        </h2>
        <p className="text-zinc-300 text-base sm:text-lg leading-relaxed pt-2">
          You rarely have to start from scratch. OpenLyryc connects directly to LRCLIB, an open community database with over 9 million timed songs.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.1] bg-[#0c0c10] p-8 sm:p-12 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <OpenLyrycLogo className="h-6 w-auto text-white shrink-0" />
            <span className="text-zinc-500 text-sm font-bold select-none">·</span>
            <a
              href="https://lrclib.net"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 group cursor-pointer shrink-0"
              title="LRCLIB Open Lyrics Database"
            >
              <Image
                src="/lrclib.png"
                alt="LRCLIB Logo"
                width={24}
                height={24}
                className="h-6 w-6 rounded-[5px] object-contain shadow-sm transition-transform group-hover:scale-105"
              />
              <span className="text-xs font-sans tracking-widest uppercase text-zinc-200 font-semibold group-hover:text-white transition-colors">
                LRCLIB
              </span>
            </a>
          </div>

          <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
            Search, load, and edit in one click.
          </h3>

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
            When you load a song in the studio, matching lyrics can be pulled in automatically with timestamps already in place. You can fix small timing errors, adjust words, or export straight away. If your track is not in the library yet, time it once and save it for everyone else.
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto">
          <Link
            href="/studio"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs tracking-tight transition-all cursor-pointer active:scale-[0.98] text-center"
          >
            Open Studio Library
          </Link>
          <a
            href="https://lrclib.net"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-white/[0.12] bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.08] font-medium text-xs transition-all text-center"
          >
            About LRCLIB Database
          </a>
        </div>
      </div>
    </section>
  );
}
