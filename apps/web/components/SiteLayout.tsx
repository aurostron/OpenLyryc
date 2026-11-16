import React from 'react';
import { AnnouncementBar } from './AnnouncementBar';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';

interface SiteLayoutProps {
  children: React.ReactNode;
  activePage?: 'about' | 'help' | 'status' | 'support' | 'contact' | 'privacy' | 'terms' | 'docs' | 'karaoke';
}

export const SiteLayout: React.FC<SiteLayoutProps> = ({ children, activePage }) => {
  return (
    <div className="min-h-screen w-full bg-[#09090b] text-[#f4f4f5] select-text flex flex-col">
      <AnnouncementBar />
      <SiteNav activePage={activePage} />
      <div className="flex-1 flex flex-col">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
};
