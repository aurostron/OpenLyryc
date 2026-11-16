'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronRight, ExternalLink, Play, X } from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { MultilingualShowcase } from '@/components/MultilingualShowcase';
import { LibraryShowcase } from '@/components/LibraryShowcase';

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const PHOTO_ATTRIBUTIONS = [
  {
    title: 'Microphone on foggy stage',
    author: 'Oscar Keys',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/photo-of-microphone-on-foggy-stage-ojVMh1QTVGY',
  },
  {
    title: 'Musical notes and piano keys',
    author: 'Jana T.',
    source: 'Pexels',
    url: 'https://www.pexels.com/photo/close-up-shot-of-musical-notes-and-piano-keys-4231581/',
  },
  {
    title: 'Concert field crowd',
    author: 'Danny Howe',
    source: 'Unsplash',
    url: 'https://unsplash.com/photos/people-gathering-on-concert-field-bn-D2bCvpik',
  },
];

export default function HomePage() {
  const [isAttributionsOpen, setIsAttributionsOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#08080a] text-zinc-100 flex flex-col font-sans">
      <AnnouncementBar />

      {/* ── 1. Top Navigation (Ableton Minimalist Editorial Style) ── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#08080a]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer" title="OpenLyryc Home">
              <OpenLyrycLogo className="h-5 sm:h-6 w-auto text-white group-hover:opacity-90 transition-opacity select-none" />
              <span className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
                We're in Beta
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs text-zinc-400" aria-label="Main Navigation">
              <Link href="/studio" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors">
                Studio
              </Link>
              <Link href="/preview" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors">
                Stage Mode
              </Link>
              <Link href="/help" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors">
                Help
              </Link>
              <Link href="/status" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors">
                Status
              </Link>
              <a
                href="https://github.com/aurostron/openlyryc"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors inline-flex items-center gap-1.5"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs tracking-tight transition-all cursor-pointer active:scale-[0.98] shadow-sm"
            >
              <span>Stop the fuss, launch the studio?</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section (FL Studio Workstation Showcase + Ableton Bold Simplicity) ── */}
      <section className="relative w-full border-b border-white/[0.08] overflow-hidden">
        {/* Subtle radial focus glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-white/[0.03] blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-16 relative z-10 text-center flex flex-col items-center">

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-sans tracking-tight text-white max-w-4xl leading-[1.08]">
            Make lyrics for the songs you love in your browser.
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-2xl mt-6">
            Tap Space to set timestamps, split words for karaoke playback, and export directly to Enhanced LRC and Apple Music TTML. Free, local, and private.
          </p>

          {/* ── Studio Screenshot Showcase ── */}
          <div className="w-full mt-14 sm:mt-16 rounded-2xl overflow-hidden shadow-[0_32px_90px_rgba(0,0,0,0.85)] group relative">
            <Link
              href="/studio"
              className="block relative overflow-hidden bg-black focus:outline-none cursor-pointer rounded-2xl"
              title="Launch OpenLyryc Studio"
            >
              <Image
                src="/studio-screenshot.png"
                alt="OpenLyryc Studio workspace showing multi-track lyric timing, word-by-word syllable sync, and live stage visualizer"
                width={2560}
                height={1600}
                quality={100}
                unoptimized
                priority
                className="w-full h-auto block rounded-2xl transition-transform duration-500 ease-out group-hover:scale-[1.008]"
              />
              <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/[0.02] transition-colors pointer-events-none" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Core Moat & Features (Ableton Modular Bento Grid) ── */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 border-t border-white/[0.08]">
        <div className="space-y-4 mb-14 sm:mb-20">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Everything you need to time lyrics.
          </h2>
          <p className="text-zinc-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Simple tools to match words to music, edit timestamps, and export clean files.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Large Visual Card (Stage Mode) */}
          <div className="md:col-span-2 relative min-h-[320px] sm:min-h-[400px] rounded-2xl border border-white/[0.08] overflow-hidden p-8 sm:p-12 flex flex-col justify-end group">
            <img
              src="/photos/oscar-keys-ojVMh1QTVGY-unsplash.jpg"
              alt="Live stage lighting"
              className="absolute inset-0 w-full h-full object-cover grayscale brightness-75 contrast-125 group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/80 to-transparent" />

            <div className="relative z-10 space-y-3 max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                Fullscreen stage mode
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Put lyrics on a TV, tablet, or stage screen. Words scroll smoothly as the song plays, with clear countdowns before each verse begins.
              </p>
              <div className="pt-2">
                <Link
                  href="/preview"
                  className="inline-flex items-center gap-2 text-xs font-medium text-white hover:underline underline-offset-4"
                >
                  <span>Open Stage Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 2: Word-by-Word Timing */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d11] p-8 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl sm:text-2xl font-light text-white tracking-tight">
                Word-by-word timing
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Highlight each word or syllable as it is sung. Perfect for karaoke tracks and glowing lyrics.
              </p>
            </div>
          </div>

          {/* Card 3: Standard Formats */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d11] p-8 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-xl sm:text-2xl font-light text-white tracking-tight">
                Standard file exports
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Export standard .lrc files for Spotify and media players, or .ttml files formatted for Apple Music.
              </p>
            </div>
          </div>

          {/* Card 4: Local & Private */}
          <div className="md:col-span-2 rounded-2xl border border-white/[0.08] bg-[#0d0d11] p-8 sm:p-10 flex flex-col justify-between space-y-4">
            <div className="space-y-3 max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                Runs on your computer
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Audio decoding happens directly in your browser. Nothing is uploaded to a server, no account is needed, and your songs stay on your computer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Community Library Showcase (9M+ Songs Moat) ── */}
      <LibraryShowcase />

      {/* ── 3. Multilingual Typography Showcase (Universal Scripts) ── */}
      <MultilingualShowcase />

      {/* ── 4. Technical Workflow Row (Ableton Plain Editorial Style) ── */}
      <section className="w-full border-t border-white/[0.08] bg-[#0a0a0d]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
          <div className="space-y-4 mb-14 sm:mb-20">
            <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
              Workflow
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
              How it works in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {/* Step 1 */}
            <div className="space-y-3 border-t border-white/[0.12] pt-8">
              <div className="font-sans text-xs text-zinc-400 font-medium">01</div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Load your music
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Drop any audio file from your computer or paste a YouTube link. Paste your lyrics into the editor.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 border-t border-white/[0.12] pt-8">
              <div className="font-sans text-xs text-zinc-400 font-medium">02</div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Tap along with the song
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Press play and tap Space when each line begins. Use the bracket keys [ and ] to nudge timing backward or forward.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 border-t border-white/[0.12] pt-8">
              <div className="font-sans text-xs text-zinc-400 font-medium">03</div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Save and export
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Download your timed .lrc or .ttml file, or open stage mode to see how it looks on screen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Fast Precision Controls (How It Works) ── */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 border-t border-white/[0.08]">
        <div className="space-y-4 mb-14 sm:mb-20">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
            Controls
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Keyboard shortcuts for fast timing.
          </h2>
          <p className="text-zinc-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Keep your hands on the keyboard. Most songs can be timed in one play through.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Key 1: Spacebar */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.15] font-sans text-xs text-white">
              Space
            </div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Mark the line
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Taps the start time for the active line and advances to the next one automatically.
            </p>
          </div>

          {/* Key 2: Brackets */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <div className="inline-flex items-center gap-1.5">
              <span className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.15] font-sans text-xs text-white">[</span>
              <span className="text-zinc-500">/</span>
              <span className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.15] font-sans text-xs text-white">]</span>
            </div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Nudge timing
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Shift timestamps forward or backward by 10 milliseconds to get the sync exact.
            </p>
          </div>

          {/* Key 3: Syllable Split */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.15] font-sans text-xs text-white">
              Ctrl + Space
            </div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Split words
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Divides a line into separate words for syllable-by-syllable karaoke timing.
            </p>
          </div>

          {/* Key 4: Waveform Drag */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.15] font-sans text-xs text-white">
              Click & Drag
            </div>
            <h3 className="text-lg font-medium text-white tracking-tight">
              Scrub waveform
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Jump directly to any beat, drum drop, or vocal pause on the visual waveform.
            </p>
          </div>
        </div>
      </section>

      {/* ── Audience / Use Cases (Jobs to Be Done) ── */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 border-t border-white/[0.08]">
        <div className="space-y-4 mb-14 sm:mb-20">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
            Creators
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Made for anyone working with lyrics.
          </h2>
          <p className="text-zinc-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            From releasing music on streaming services to performing live on stage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Persona 1 */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Musicians & Producers
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Deliver timed lyrics with your song release so they appear on Spotify and Apple Music without recurring middleman costs.
            </p>
          </div>

          {/* Persona 2 */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Video Editors
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Generate subtitle files for Premiere, DaVinci Resolve, or Final Cut without keyframing text lines one by one.
            </p>
          </div>

          {/* Persona 3 */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Bands & Performers
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Turn any laptop, tablet, or stage display into a live prompter that scrolls smoothly with the music.
            </p>
          </div>

          {/* Persona 4 */}
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-4">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Karaoke Creators
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Time syllables and word fills for sing-along videos and live karaoke tracks.
            </p>
          </div>
        </div>
      </section>

      {/* ── Comparison (Contrast Effect & Clear Advantages) ── */}
      <section className="w-full border-t border-white/[0.08] bg-[#09090d]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
          <div className="space-y-4 mb-14 sm:mb-20">
            <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
              Comparison
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
              A dedicated timing tool.
            </h2>
            <p className="text-zinc-300 text-base sm:text-lg max-w-2xl leading-relaxed">
              Traditional video editors and paid web tools make lyric timing slow and frustrating.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Column 1: Video Editors */}
            <div className="p-8 sm:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <div className="text-xs font-sans uppercase tracking-wider text-zinc-400">
                Traditional Video Editors
              </div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Manual Timeline Cutting
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Dragging text layers by hand takes hours for a single song. Project files are heavy, and they cannot export standard .lrc or .ttml files for Spotify.
              </p>
            </div>

            {/* Column 2: Subscription SaaS */}
            <div className="p-8 sm:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <div className="text-xs font-sans uppercase tracking-wider text-zinc-400">
                Online Subtitle Apps
              </div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Monthly Fees & Cloud Uploads
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Most web tools require monthly subscriptions, restrict downloads behind paywalls, and force you to upload unreleased audio to third-party cloud servers.
              </p>
            </div>

            {/* Column 3: OpenLyryc */}
            <div className="relative p-8 sm:p-10 rounded-2xl bg-white/[0.02] border border-emerald-500/70 space-y-4 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-400" />
              <div className="text-xs font-sans uppercase tracking-wider text-emerald-400">
                OpenLyryc
              </div>
              <h3 className="text-xl font-medium text-white tracking-tight">
                Fast, Private, and Free
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Runs 100% in your browser. Tap Space to time an entire song in under five minutes, with standard exports for Spotify, Apple Music, and video editors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Frequently Asked Questions ── */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 border-t border-white/[0.08]">
        <div className="space-y-4 mb-14 sm:mb-20">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-400">
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Frequently asked questions.
          </h2>
          <p className="text-zinc-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Quick answers about file formats, browser privacy, and how OpenLyryc works.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-3">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Is OpenLyryc completely free to use?
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Yes. OpenLyryc is free and open-source. There are no subscriptions, trial periods, accounts, or file export limits.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-3">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Do my audio files get uploaded to a server?
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              No. Audio decoding runs entirely inside your browser using the Web Audio API. Your songs never leave your device.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-3">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Where can I use exported files?
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Standard .lrc files work with Spotify, Plex, foobar2000, and media players. Word-synced .ttml files are ready for Apple Music and karaoke players.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#0d0d12] border border-white/[0.08] space-y-3">
            <h3 className="text-lg font-medium text-white tracking-tight">
              Can I load existing LRC files to fix timing?
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Yes. Drop any .lrc file into the editor to adjust timestamps, fix typos, or split lines into word-by-word timing.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. Final Call to Action ── */}
      <section className="w-full border-t border-white/[0.08] bg-[#09090d]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-24 sm:py-36 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <OpenLyrycLogo className="h-8 w-auto text-white" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
              Start timing your music.
            </h2>
            <p className="text-base text-zinc-300 leading-relaxed">
              No signup required. Drop an MP3, WAV, or paste a YouTube link to begin.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white text-zinc-950 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-all shadow-md cursor-pointer"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/preview"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs sm:text-sm font-medium border border-white/[0.1] transition-all cursor-pointer"
            >
              <span>Stage Preview</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. Minimalist Footer ── */}
      <footer className="w-full bg-[#070709] border-t border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-12 sm:pt-16 pb-8 sm:pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-10 sm:gap-12 text-xs">
            {/* Brand Block */}
            <div className="lg:col-span-2 space-y-4">
              <Link href="/" className="group inline-flex items-center hover:opacity-90 transition-opacity">
                <OpenLyrycLogo className="h-6 sm:h-7 w-auto text-white" />
              </Link>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                A free, open-source lyric timing tool that runs in your browser.
              </p>
              {/* Credits */}
              <div className="flex flex-col gap-1 pt-1 text-xs text-zinc-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>&copy; 2026 OpenLyryc contributors.</span>
                  <span className="text-zinc-700">·</span>
                  <a
                    href="https://github.com/aurostron"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Built by aurostron.
                  </a>
                </div>
                <div className="font-sans text-[11px] text-zinc-600">
                  No BS · No limits · You don't pay a penny.
                </div>
              </div>
            </div>


            {/* 4 Clean Columns */}
            <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Column 1: Studio */}
              <div className="space-y-3">
                <div className="font-sans uppercase tracking-widest text-zinc-300 font-medium">
                  Studio
                </div>
                <ul className="space-y-2 text-zinc-400">
                  <li>
                    <Link href="/studio" className="hover:text-white transition-colors">
                      Stop the fuss, Launch the Studio?
                    </Link>
                  </li>
                  <li>
                    <Link href="/preview" className="hover:text-white transition-colors">
                      Stage Previews
                    </Link>
                  </li>
                  <li>
                    <Link href="/help" className="hover:text-white transition-colors">
                      Keyboard Shortcuts
                    </Link>
                  </li>
                  <li>
                    <Link href="/help" className="hover:text-white transition-colors">
                      Supported Formats
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 2: Project */}
              <div className="space-y-3">
                <div className="font-sans uppercase tracking-widest text-zinc-300 font-medium">
                  Project
                </div>
                <ul className="space-y-2 text-zinc-400">
                  <li>
                    <Link href="/about" className="hover:text-white transition-colors">
                      About OpenLyryc
                    </Link>
                  </li>
                  <li>
                    <Link href="/status" className="hover:text-white transition-colors">
                      System Status
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://github.com/aurostron/openlyryc"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <span>GitHub Repository</span>
                      <ExternalLink className="w-3 h-3 text-zinc-600" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/aurostron/openlyryc/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <span>Releases</span>
                      <ExternalLink className="w-3 h-3 text-zinc-600" />
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 3: Community */}
              <div className="space-y-3">
                <div className="font-sans uppercase tracking-widest text-zinc-300 font-medium">
                  Community
                </div>
                <ul className="space-y-2 text-zinc-400">
                  <li>
                    <a
                      href="https://github.com/aurostron/openlyryc/issues"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Report an Issue
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/aurostron/openlyryc/discussions"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Feature Discussions
                    </a>
                  </li>
                  <li>
                    <Link href="/support-us" className="hover:text-white transition-colors">
                      Support & Sponsor
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="hover:text-white transition-colors">
                      Contact the Maintainer
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 4: Legal & Info */}
              <div className="space-y-3">
                <div className="font-sans uppercase tracking-widest text-zinc-300 font-medium">
                  Legal & Info
                </div>
                <ul className="space-y-2 text-zinc-400">
                  <li>
                    <Link href="/privacy" className="hover:text-white transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-white transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsAttributionsOpen(true)}
                      className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-left"
                    >
                      All Attributions
                    </button>
                  </li>
                  <li>
                    <span className="text-zinc-600 font-sans">MIT License</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── 6. Attributions Modal ── */}
      <AnimatePresence>
        {isAttributionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-[#0e0e12] border border-white/[0.12] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 select-text"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-lg font-light tracking-tight text-white">
                    Credits & Attributions
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Photography used across OpenLyryc under free licenses.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttributionsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {/* Photography Attributions */}
                <div>
                  <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 pb-2 border-b border-white/[0.06]">
                    Photography
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {PHOTO_ATTRIBUTIONS.map((item) => (
                      <div
                        key={item.title}
                        className="py-3 first:pt-2 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-zinc-200 font-medium">{item.title}</div>
                          <div className="text-[11px] text-zinc-400">
                            by <span className="text-zinc-300">{item.author}</span> on {item.source}
                          </div>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors shrink-0 ml-4"
                        >
                          View Source
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAttributionsOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
