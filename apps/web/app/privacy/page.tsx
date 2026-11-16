import React from 'react';
import type { Metadata } from 'next';
import { SiteLayout } from '@/components/SiteLayout';
import { Shield, EyeOff, Lock, Database } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | OpenLyryc',
  description: 'Our straightforward, human-readable privacy statement: no trackers, no ads, and local-first audio.',
};

export default function PrivacyPage() {
  return (
    <SiteLayout activePage="privacy">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            Privacy Statement
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Your audio and lyrics belong to you.
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            OpenLyryc was designed to work locally in your browser.
            We do not track your browsing habits, run advertising pixels, or store your audio files on our servers.
          </p>
        </header>

        {/* Core Privacy Guarantees */}
        <section className="mt-16 space-y-8 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Key privacy principles
          </h2>

          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Lock className="w-4 h-4 text-zinc-300" />
                <span>Audio never leaves your computer</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When you drag and drop a music file into OpenLyryc, your browser decodes it locally via the
                Web Audio API. The file is never transmitted to our servers or saved anywhere in the cloud.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Database className="w-4 h-4 text-zinc-300" />
                <span>Local browser storage</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your lyrics and timing drafts are stored solely in your device&apos;s LocalStorage and IndexedDB.
                If you clear your browser cache or delete a project inside the Projects view, that data is gone from your machine.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <EyeOff className="w-4 h-4 text-zinc-300" />
                <span>Zero third-party trackers or ads</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We do not include Google Analytics, Facebook pixels, advertising cookies, or cross-site tracking scripts.
                We do not profile visitors or sell any data to third parties.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Shield className="w-4 h-4 text-zinc-300" />
                <span>Encrypted peer-to-peer collaboration</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When collaborating live with other people, OpenLyryc sends document edits directly between peer
                browsers via encrypted WebRTC data channels. Signaling servers only broker the initial connection
                and never record your lyric session content.
              </p>
            </div>
          </div>
        </section>

        {/* Policy Changes & Date */}
        <section className="mt-16 pt-12 border-t border-white/[0.08] text-xs text-zinc-500 font-sans">
          <div>Last reviewed: September 2026</div>
          <div className="mt-1">
            Questions regarding this privacy statement? Email{' '}
            <a href="mailto:281557829+aurostron@users.noreply.github.com" className="text-zinc-300 underline hover:text-white">
              281557829+aurostron@users.noreply.github.com
            </a>.
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
