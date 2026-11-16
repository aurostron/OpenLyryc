import React from 'react';
import type { Metadata } from 'next';
import { SiteLayout } from '@/components/SiteLayout';
import { Mail, MessageSquare, Bug, CheckCircle2, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact | OpenLyryc',
  description: 'How to contact the OpenLyryc maintainers, report bugs, ask questions, or contribute.',
};

export default function ContactPage() {
  return (
    <SiteLayout activePage="contact">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <header className="space-y-4">
          <div className="text-xs font-sans uppercase tracking-widest text-zinc-500">
            Contact & Feedback
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white">
            Get in touch
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed pt-2">
            Found an issue, have an idea for a feature, or need help with a lyric format?
            We welcome questions and bug reports.
          </p>
        </header>

        {/* Contact Channels Grid */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Direct channels
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* GitHub Issues */}
            <a
              href="https://github.com/aurostron/openlyryc/issues"
              target="_blank"
              rel="noreferrer"
              className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] hover:border-white/20 hover:bg-[#111116] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-zinc-400 group-hover:text-white transition-colors">
                  <Bug className="w-5 h-5" />
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">GitHub Issues</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Best for reporting bugs, playback problems, or submitting technical feature requests.
                </p>
              </div>
              <div className="pt-4 text-[11px] font-sans text-zinc-500">
                github.com/aurostron/openlyryc/issues
              </div>
            </a>

            {/* GitHub Discussions */}
            <a
              href="https://github.com/aurostron/openlyryc/discussions"
              target="_blank"
              rel="noreferrer"
              className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] hover:border-white/20 hover:bg-[#111116] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-zinc-400 group-hover:text-white transition-colors">
                  <MessageSquare className="w-5 h-5" />
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">GitHub Discussions</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ask general questions, share synced lyrics, or talk about karaoke formats and plugins.
                </p>
              </div>
              <div className="pt-4 text-[11px] font-sans text-zinc-500">
                github.com/aurostron/openlyryc/discussions
              </div>
            </a>

            {/* Direct Email */}
            <a
              href="mailto:281557829+aurostron@users.noreply.github.com?subject=OpenLyryc%20Inquiry"
              className="p-5 rounded-xl border border-white/[0.08] bg-[#0c0c0f] hover:border-white/20 hover:bg-[#111116] transition-all cursor-pointer group flex flex-col justify-between sm:col-span-2"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-zinc-400 group-hover:text-white transition-colors">
                  <Mail className="w-5 h-5" />
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Direct Email</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Send an email directly to the maintainer for private questions, security disclosures, or collaboration proposals.
                </p>
              </div>
              <div className="pt-4 text-[11px] font-sans text-zinc-300">
                281557829+aurostron@users.noreply.github.com
              </div>
            </a>
          </div>
        </section>

        {/* Bug Reporting Guide */}
        <section className="mt-16 space-y-6 border-t border-white/[0.08] pt-12">
          <h2 className="text-xl font-medium text-white tracking-tight">
            How to file a helpful bug report
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            When reporting a bug on GitHub or via email, including the following details helps us reproduce
            and fix the problem quickly:
          </p>

          <div className="space-y-3 pt-2 text-xs text-zinc-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span><strong>Browser and operating system:</strong> (e.g. Chrome 128 on Windows 11, Safari 17 on macOS Sonoma).</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span><strong>Audio source:</strong> Were you using a local MP3/FLAC file, a direct audio stream URL, or a YouTube reference link?</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span><strong>Steps to reproduce:</strong> What buttons did you press, or what shortcut key triggered the unexpected behavior?</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span><strong>Console errors:</strong> Open developer tools (F12) and copy any red error text printed under the Console tab.</span>
            </div>
          </div>
        </section>

        {/* Response Expectations */}
        <section className="mt-16 p-5 border border-white/[0.08] rounded-xl bg-white/[0.02] text-xs text-zinc-400 leading-relaxed">
          <strong className="text-zinc-200">Response time:</strong> OpenLyryc is an independent open-source project.
          We typically read and reply to issues and emails within two to three days.
        </section>
      </main>
    </SiteLayout>
  );
}
