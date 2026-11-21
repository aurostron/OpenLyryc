import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Poppins } from 'next/font/google';
import LastActivePing from '@/components/LastActivePing';
import { OvisReactBridge } from '@/components/OvisReactBridge';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist_mono',
  subsets: ['latin'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://openlyryc.pages.dev'),
  title: 'OpenLyryc — Synced Lyric Editor',
  description:
    'Free, open-source synced lyric editor. Tap Space to mark timestamps, split syllables for karaoke, and export Enhanced LRC and Apple Music TTML in seconds.',
  keywords: [
    'lrc editor',
    'synced lyrics maker',
    'apple music ttml lyrics',
    'karaoke lyric sync',
    'enhanced lrc creator',
    'word by word lyric timing',
    'open source audio editor',
    'web audio lyric synchronizer',
  ],
  authors: [{ name: 'aurostron', url: 'https://github.com/aurostron' }],
  creator: 'aurostron',
  alternates: {
    canonical: 'https://openlyryc.pages.dev',
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://openlyryc.pages.dev',
    siteName: 'OpenLyryc',
    title: 'OpenLyryc — Synced Lyric Editor',
    description:
      'The swiss knife for lyrics. Sync word-by-word karaoke, preview with stage visualizers, and export to Enhanced LRC and Apple TTML.',
    images: [
      {
        url: 'https://openlyryc.pages.dev/openlyryc-thumbnail.png?v=4',
        width: 3840,
        height: 2160,
        alt: 'OpenLyryc — The swiss knife for lyrics',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@aurostron',
    creator: '@aurostron',
    title: 'OpenLyryc — Synced Lyric Editor',
    description:
      'The swiss knife for lyrics. Sync word-by-word karaoke, preview with stage visualizers, and export to Enhanced LRC and Apple TTML.',
    images: ['https://openlyryc.pages.dev/openlyryc-thumbnail.png?v=4'],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="canonical" href="https://openlyryc.pages.dev" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-title" content="OpenLyryc" />
        <meta name="theme-color" content="#09090b" />
        <meta name="twitter:site" content="@aurostron" />
        <meta name="twitter:creator" content="@aurostron" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:opsz,wght@9..144,400;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'OpenLyryc',
              url: 'https://openlyryc.pages.dev',
              applicationCategory: 'MultimediaApplication',
              operatingSystem: 'Any (Web Browser)',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-white/20 selection:text-white">
        <OvisReactBridge />
        {children}
        <LastActivePing />
      </body>
    </html>
  );
}
