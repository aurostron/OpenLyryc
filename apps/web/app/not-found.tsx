'use client';

import { useEffect, useState } from 'react';
import ProfileClientView from '@/app/u/[username]/ProfileClientView';
import Link from 'next/link';

export default function NotFound() {
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const match = pathname.match(/^\/(?:u\/|@)([^/]+)/i);
      if (match && match[1]) {
        const clean = match[1].toLowerCase().replace(/^@+/, '');
        setProfileUsername(clean);
      }
      setChecked(true);
    }
  }, []);

  // If the path is a profile route (/@username or /u/username), render dynamic profile
  if (profileUsername) {
    return <ProfileClientView initialUsername={profileUsername} />;
  }

  // Prevent flash of 404 while checking window location
  if (!checked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Authentic 404 for actual missing pages
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-sans text-zinc-400 mb-6">
        <span>404</span>
        <span className="text-zinc-600">·</span>
        <span>Route Not Found</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-white">
        Lost in the waveform
      </h1>
      <p className="text-zinc-400 max-w-sm mb-8 text-sm leading-relaxed">
        The page you are looking for does not exist or may have been relocated.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs tracking-tight hover:bg-zinc-200 transition-colors shadow-sm"
      >
        Return to Studio
      </Link>
    </div>
  );
}
