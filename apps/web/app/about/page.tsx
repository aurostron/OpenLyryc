import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteLayout } from '@/components/SiteLayout';
import { ArrowRight, ShieldCheck, Cpu, Code2, Users, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About | OpenLyryc',
  description: 'Learn why OpenLyryc was created, how it works in your browser, and our open-source principles.',
};

export default function AboutPage() {
  return (
    <SiteLayout activePage="about">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            About Project
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Simple, accurate lyric timing for everyone.
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            OpenLyryc is a free, open-source tool for syncing lyrics to music.
            It runs directly inside your web browser, keeping your audio on your own machine.
          </p>
        </header>

        {/* Story & Background */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Why OpenLyryc exists
          </h2>
          <div className="space-y-4 text-sm text-zinc-300 leading-relaxed font-normal">
            <p>
              Most tools for creating synchronized lyrics fall into two categories: clunky desktop programs
              written twenty years ago that crash unexpectedly, or closed commercial platforms that hide basic
              export features behind paid subscriptions.
            </p>
            <p>
              Musicians, transcribers, translators, and karaoke hobbyists should not have to pay a monthly fee
              just to time words to an audio track. OpenLyryc was built to offer a clean, reliable, and accessible
              alternative that works right away in any modern browser.
            </p>
          </div>
        </section>

        {/* Technical Core Principles */}
        <section className="mt-16 space-y-8 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Design principles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                <span>Runs on your device</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your audio files never upload to our servers. The Web Audio API decodes audio locally
                in browser memory, so editing is instant and private.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <span>Millisecond precision</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Time down to the millisecond with keyboard shortcuts or visual waveforms. Adjust single
                words or full lines with zero lag.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <Users className="w-4 h-4 text-zinc-400" />
                <span>Peer-to-peer collaboration</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Invite friends or team members to sync together in real time. We connect peers directly
                over WebRTC using conflict-free replicated data types.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <Code2 className="w-4 h-4 text-zinc-400" />
                <span>Open and portable</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                No proprietary lock-in. Export your work immediately to standard formats supported
                by media players, Spotify, Apple Music, and karaoke engines.
              </p>
            </div>
          </div>
        </section>

        {/* Supported Formats */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <FileText className="w-5 h-5 text-zinc-400" />
            <h2>Supported file formats</h2>
          </div>
          <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden bg-[#0c0c0f]">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Enhanced Compact LRC</div>
                <div className="text-xs text-zinc-400 mt-0.5">Word-by-word timing tags with relative millisecond offsets</div>
              </div>
              <span className="text-[11px] font-sans text-zinc-400 self-start sm:self-auto">.lrc</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Standard Line LRC</div>
                <div className="text-xs text-zinc-400 mt-0.5">Universal line-level timestamp tags for classic music players</div>
              </div>
              <span className="text-[11px] font-sans text-zinc-400 self-start sm:self-auto">.lrc</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">Apple TTML</div>
                <div className="text-xs text-zinc-400 mt-0.5">Timed text markup language XML format for Apple Music</div>
              </div>
              <span className="text-[11px] font-sans text-zinc-400 self-start sm:self-auto">.ttml</span>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">OpenLyrics JSON</div>
                <div className="text-xs text-zinc-400 mt-0.5">Full structured document schema with line hashes, tokens, and metadata</div>
              </div>
              <span className="text-[11px] font-sans text-zinc-400 self-start sm:self-auto">.json</span>
            </div>
          </div>
        </section>

        {/* CTA to Studio */}
        <section className="mt-16 pt-12 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">Ready to start timing a track?</h3>
            <p className="text-xs text-zinc-400">Open the studio now. No login or installation required.</p>
          </div>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <span>Launch Studio</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </SiteLayout>
  );
}
