import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenLyryc — Synced Lyric Preview',
  description: 'Interactive synchronized lyric visualizer and cinema player.',
  openGraph: {
    type: 'music.song',
    title: 'OpenLyryc — Synced Lyric Preview',
    description: 'Interactive synchronized lyric visualizer and cinema player.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenLyryc — Synced Lyric Preview',
    description: 'Interactive synchronized lyric visualizer and cinema player.',
  },
};

export default function PLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
