'use client';

import React from 'react';

export function UnisonAboutView() {
  return (
    <div
      className="w-full max-w-3xl mx-auto space-y-10 animate-in fade-in duration-300 pb-16"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">About Unison</h1>
        <p className="text-xs sm:text-sm text-white/50 mt-1">
          A free, open database of timed lyrics for YouTube Music.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white tracking-tight">What is Unison</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Unison is a public database for synced lyrics on YouTube Music. All lyrics are contributed by listeners using{' '}
          <a
            href="https://betterlyrics.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors font-medium"
          >
            Better Lyrics
          </a>{' '}
          and{' '}
          <span className="text-white font-medium">OpenLyryc Studio</span>. When you play a song, Better Lyrics grabs the timed lyrics from Unison to display on screen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white tracking-tight">Leaderboard &amp; Most Wanted</h2>
        <p className="text-sm leading-relaxed text-white/70">
          <span className="text-white font-medium">Most Wanted</span> shows songs that still need lyrics, ordered by how many people asked for them.
        </p>
        <p className="text-sm leading-relaxed text-white/70">
          The <span className="text-white font-medium">Leaderboard</span> ranks curators by how many lyrics they have synced and the upvotes they receive from other listeners.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white tracking-tight">Sealed by the Council</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Songs with a <span className="text-amber-300 font-medium">Council Seal</span> have been checked by editors for accurate timing, line breaks, and spelling.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm leading-relaxed text-white/80 space-y-2">
        <div className="font-medium text-white">
          Sign in with your key
        </div>
        <p className="text-xs text-white/60">
          When you connect your key in OpenLyryc, your submissions earn curator XP and level up your rank on the leaderboard.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white tracking-tight">Credits</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Badges and icons illustrated by{' '}
          <a
            href="https://github.com/KiyoshiTheDevil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            Kiyoshi
          </a>
          . Track ID conversions powered by{' '}
          <a
            href="https://binimum.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            BiniLink
          </a>
          .
        </p>
      </section>

      <footer className="pt-8 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
        <div className="flex items-center gap-3">
          <a
            href="https://unison.betterlyrics.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Official Unison
          </a>
          <span>•</span>
          <a
            href="https://betterlyrics.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Better Lyrics
          </a>
          <span>•</span>
          <a
            href="https://discord.gg/UsHE3d5fWF"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Discord Server
          </a>
        </div>
        <span>OpenLyryc × Unison Hub</span>
      </footer>
    </div>
  );
}
