import React from 'react';
import type { Metadata } from 'next';
import { SiteLayout } from '@/components/SiteLayout';
import { Heart, Star, Share2, Code2, Server, ArrowUpRight, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support Us | OpenLyryc',
  description: 'How to support OpenLyryc through GitHub stars, code contributions, sharing lyrics, or sponsorship.',
};

export default function SupportUsPage() {
  return (
    <SiteLayout activePage="support">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            Community & Sponsorship
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Support OpenLyryc
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            OpenLyryc is an independent project with no venture capital, no advertising banners,
            and no paid subscription tiers. Here is how you can help keep it thriving.
          </p>
        </header>

        {/* Ways to Help Without Money */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Non-monetary ways to help
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You do not need to spend money to support this project. These actions make a huge difference:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Star className="w-4 h-4 text-zinc-300" />
                <span>Star on GitHub</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Giving the repository a star on GitHub helps other lyric transcribers, audio engineers,
                and artists find our editor.
              </p>
              <div className="pt-2">
                <a
                  href="https://github.com/aurostron/openlyryc"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white underline hover:text-zinc-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Star repository</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Share2 className="w-4 h-4 text-zinc-300" />
                <span>Share your synced tracks</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When you finish syncing a song, share the LRC or TTML file with your friends or post it
                in music forums. Mentioning OpenLyryc spreads the word naturally.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Code2 className="w-4 h-4 text-zinc-300" />
                <span>Contribute code or docs</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We accept pull requests for bug fixes, performance improvements, parser tests,
                and documentation clarity.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-zinc-300" />
                <span>Report edge cases</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Found an audio file that fails to decode, or an unusual LRC format variant?
                Send us a sample so we can improve parser resilience.
              </p>
            </div>
          </div>
        </section>

        {/* Financial Sponsorship */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <div className="flex items-center gap-2 text-white font-medium text-xl tracking-tight">
            <Heart className="w-5 h-5 text-zinc-400" />
            <h2>Sponsorship & donations</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Financial contributions directly offset recurring infrastructure and hosting expenses:
          </p>

          <div className="border border-white/[0.08] rounded-xl p-5 bg-[#0c0c0f] space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="w-4 h-4 text-zinc-400" />
                <span>Where do donations go?</span>
              </div>
              <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                <li>Cloudflare Pages, Workers, and edge CDN bandwidth costs</li>
                <li>D1 SQL database query charges for public community tracks</li>
                <li>Domain registration and maintenance</li>
                <li>Testing devices to verify audio timing across various mobile browsers</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white">GitHub Sponsors</div>
                <div className="text-[11px] text-zinc-500">Monthly or one-time developer sponsorship</div>
              </div>
              <a
                href="https://github.com/sponsors/aurostron"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Sponsor on GitHub</span>
              </a>
            </div>
          </div>
        </section>

        {/* Our Promise */}
        <section className="mt-16 p-5 border border-white/[0.08] rounded-xl bg-white/[0.02] space-y-2">
          <div className="text-xs font-semibold text-white">Our commitment to users:</div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            OpenLyryc will always remain open source. We will never hide the editor behind a paywall,
            limit the number of tracks you can sync, or sell your personal data.
          </p>
        </section>
      </main>
    </SiteLayout>
  );
}
