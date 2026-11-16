'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowUpRight, Activity, HelpCircle, Heart, Mail, Info, Tv, Music2, Mic2, BookOpen } from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

interface SiteNavProps {
  activePage?: 'stage' | 'lyrics' | 'karaoke' | 'about' | 'help' | 'status' | 'support' | 'contact' | 'privacy' | 'terms' | 'docs';
}

export const SiteNav: React.FC<SiteNavProps> = ({ activePage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/lyrics', label: 'Lyrics', id: 'lyrics', icon: Music2 },
    { href: '/karaoke', label: 'Karaoke', id: 'karaoke', icon: Mic2 },
    { href: '/preview', label: 'Stage', id: 'stage', icon: Tv },
    { href: '/about', label: 'About', id: 'about', icon: Info },
    { href: '/docs', label: 'Docs', id: 'docs', icon: BookOpen },
    { href: '/help', label: 'Help & Guide', id: 'help', icon: HelpCircle },
    { href: '/status', label: 'Status', id: 'status', icon: Activity },
    { href: '/support-us', label: 'Support Us', id: 'support', icon: Heart },
    { href: '/contact', label: 'Contact', id: 'contact', icon: Mail },
  ];

  return (
    <header className="w-full border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 group cursor-pointer"
          title="OpenLyryc Home"
        >
          <OpenLyrycLogo className="h-5 sm:h-6 w-auto text-white group-hover:opacity-90 transition-opacity select-none" />
          <span className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
            Beta
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive = activePage === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/[0.08]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Primary CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <span>Open Studio</span>
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#0c0c0f] px-6 py-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activePage === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/[0.08]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4 text-zinc-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-white/[0.06]">
            <Link
              href="/studio"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <span>Open Studio</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
