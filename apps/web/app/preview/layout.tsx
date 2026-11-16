import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenLyryc — Stage & Cinema Preview',
  description: 'Interactive synchronized lyric visualizer and cinema player.',
  openGraph: {
    type: 'music.song',
    title: 'OpenLyryc — Stage & Cinema Preview',
    description: 'Interactive synchronized lyric visualizer and cinema player.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenLyryc — Stage & Cinema Preview',
    description: 'Interactive synchronized lyric visualizer and cinema player.',
  },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
