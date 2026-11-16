import React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

const GithubIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export const SiteFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/[0.08] bg-[#070709] mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand & Mission */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer inline-flex" title="OpenLyryc Home">
              <OpenLyrycLogo className="h-5 w-auto text-white group-hover:opacity-90 transition-opacity select-none" />
            </Link>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
              Free, open-source lyric timing editor. Runs locally in your browser.
              Audio stays on your machine, with optional real-time peer sync.
            </p>
            <div className="pt-2 flex items-center gap-4 text-xs text-zinc-500">
              <a
                href="https://github.com/aurostron/openlyryc"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>GitHub Repository</span>
              </a>
              <span className="text-zinc-700">·</span>
              <Link href="/support-us" className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                <Heart className="w-3.5 h-3.5 text-zinc-400 hover:text-white transition-colors" />
                <span>Support Us</span>
              </Link>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-200 tracking-wider uppercase font-sans">
              Resources
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/studio" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Open Studio
                </Link>
              </li>
              <li>
                <Link href="/lyrics" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Lyrics Player
                </Link>
              </li>
              <li>
                <Link href="/karaoke" className="text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
                  <span>Karaoke Stage</span>
                  <span className="text-[9px] font-sans px-1 py-0.5 rounded bg-white/[0.08] text-zinc-300 border border-white/10">New</span>
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  About Project
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Help & Shortcuts
                </Link>
              </li>
              <li>
                <Link href="/status" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  System Status
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
                  <span>API & Docs</span>
                  <span className="text-[9px] font-sans px-1 py-0.5 rounded bg-white/[0.08] text-zinc-300">v1</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Project & Legal */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-200 tracking-wider uppercase font-sans">
              Project
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/contact" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Contact & Issues
                </Link>
              </li>
              <li>
                <Link href="/support-us" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Donate & Support
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  Terms & MIT License
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span>© {new Date().getFullYear()} OpenLyryc contributors.</span>
            <span className="text-zinc-700">·</span>
            <a
              href="https://github.com/aurostron"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Created by <span className="text-zinc-300 hover:text-white">aurostron</span>.
            </a>
            <span className="text-zinc-700">·</span>
            <span>MIT License.</span>
          </div>
          <div className="font-sans text-[11px] text-zinc-600">
            No ads · No trackers · Client-first
          </div>
        </div>
      </div>
    </footer>
  );
};
