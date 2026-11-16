import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteLayout } from '@/components/SiteLayout';
import { ArrowRight, Keyboard, HelpCircle, FileAudio } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help & User Guide | OpenLyryc',
  description: 'Step-by-step guide and keyboard shortcuts reference for OpenLyryc lyric timing editor.',
};

export default function HelpPage() {
  return (
    <SiteLayout activePage="help">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            User Guide & Documentation
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            How to use OpenLyryc
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            Follow this guide to load your audio, time each line and word, fine-tune down to
            the millisecond, and export clean LRC or TTML files.
          </p>
        </header>

        {/* 5-Step Quick Walkthrough */}
        <section className="mt-16 space-y-12 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Step-by-step workflow
          </h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-4 sm:gap-6">
              <div className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-sans text-xs font-bold shrink-0">
                1
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Load your song</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Drag and drop an audio file (.mp3, .wav, .flac, or .m4a) directly into the waveform bar
                  at the bottom of the screen. Alternatively, click the Track Details button on the right to
                  paste a YouTube video link as reference audio.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 sm:gap-6">
              <div className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-sans text-xs font-bold shrink-0">
                2
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Paste or type your lyrics</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Open the left dock and click <strong className="text-white">Paste Lyrics</strong> or import
                  an existing plain text / LRC file. Each line appears in the center stage, ready for timing.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 sm:gap-6">
              <div className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-sans text-xs font-bold shrink-0">
                3
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Stamp timestamps in real time</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans text-[11px] text-white">Space</kbd> to
                  play. As the singer starts each line, tap <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans text-[11px] text-white">A</kbd> on
                  your keyboard to record the start time. The active line automatically steps forward.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4 sm:gap-6">
              <div className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-sans text-xs font-bold shrink-0">
                4
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Word-by-word timing (Enhanced Sync)</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Click the <strong className="text-white">Words</strong> button on any line to split it into
                  individual syllables or words. As the track plays, tap <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-sans text-[11px] text-white">A</kbd> to
                  time each word in sequence. You can also click the squiggle icon on elongated syllables to add visual karaoke wave styling.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4 sm:gap-6">
              <div className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center font-sans text-xs font-bold shrink-0">
                5
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Export your lyrics</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Click the <strong className="text-white">Export</strong> button in the left dock. Choose between
                  Enhanced Compact LRC, Standard LRC, Apple TTML, or OpenLyrics JSON, then copy the result
                  to your clipboard or download the file.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts Table */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <Keyboard className="w-5 h-5 text-zinc-400" />
            <h2>Keyboard shortcuts</h2>
          </div>

          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0c0c0f]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-zinc-400 font-sans">
                <tr>
                  <th className="py-3 px-4 font-semibold">Key</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold hidden sm:table-cell">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Space</td>
                  <td className="py-3 px-4">Play or pause audio playback</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Anywhere (when not editing text)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">A</td>
                  <td className="py-3 px-4">Stamp start timestamp on active line or word</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Studio Editor / Word Sync</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Shift + A</td>
                  <td className="py-3 px-4">Stamp end timestamp on active line</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Studio Editor</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">W</td>
                  <td className="py-3 px-4">Toggle word-sync editor for active line</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Studio Editor</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">[ / ]</td>
                  <td className="py-3 px-4">Nudge sync offset -10ms / +10ms</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Global offset fine-tuning</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">&#123; / &#125;</td>
                  <td className="py-3 px-4">Nudge sync offset -50ms / +50ms</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Global offset fine-tuning</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Shift + ← / →</td>
                  <td className="py-3 px-4">Jump playhead backward or forward 500ms</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Waveform navigation</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Ctrl / Cmd + Z</td>
                  <td className="py-3 px-4">Undo last edit or timestamp adjustment</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Global history</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Ctrl / Cmd + Shift + Z</td>
                  <td className="py-3 px-4">Redo previous history action</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Global history</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-sans font-bold text-white">Esc</td>
                  <td className="py-3 px-4">Close current popover or cancel text edit</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">Modals & Popovers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <HelpCircle className="w-5 h-5 text-zinc-400" />
            <h2>Frequently asked questions</h2>
          </div>

          <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white">Can I use OpenLyryc offline?</h3>
              <p className="text-zinc-400">
                Yes. Once the website finishes loading in your browser, the editor runs entirely with local code.
                You can drop an MP3 file and sync lyrics even without an internet connection.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white">What is Enhanced Compact LRC?</h3>
              <p className="text-zinc-400">
                Standard LRC formats each word tag as a full absolute timestamp (for example, <code className="font-sans text-white bg-white/10 px-1 py-0.5 rounded">&lt;00:14.280&gt;</code>),
                which can make lyric files very large. Enhanced Compact LRC uses relative millisecond offsets (such as <code className="font-sans text-white bg-white/10 px-1 py-0.5 rounded">&lt;350:280&gt;</code>),
                saving up to 45% in file size while remaining fully accurate.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-white">Where are my projects saved?</h3>
              <p className="text-zinc-400">
                Your projects are stored directly in your browser using local storage and IndexedDB.
                To back up your work or move it to another computer, export your track as an OpenLyrics JSON or LRC file.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 pt-12 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">Try these shortcuts in the studio</h3>
            <p className="text-xs text-zinc-400">Open the editor to test timing and playback right now.</p>
          </div>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <span>Open Studio</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </SiteLayout>
  );
}
