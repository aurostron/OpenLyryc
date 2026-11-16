'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PosterPreviewPlayer } from '@/components/PosterPreviewPlayer';

function PreviewContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || searchParams.get('query') || undefined;
  const yt = searchParams.get('yt') || searchParams.get('v') || searchParams.get('youtube') || undefined;
  const trackId = searchParams.get('id') || searchParams.get('track') || undefined;
  const shortcode = searchParams.get('c') || searchParams.get('code') || undefined;
  const rawMode =
    searchParams.get('transition') ||
    searchParams.get('mode') ||
    searchParams.get('m') ||
    searchParams.get('visual') ||
    undefined;
  const isEmbed =
    searchParams.get('embed') === 'true' ||
    searchParams.get('pure') === 'true' ||
    searchParams.get('sdk') === 'true' ||
    searchParams.get('clean') === 'true';

  const enableBackgroundVideo =
    searchParams.get('bg') === 'true' ||
    searchParams.get('background') === 'true' ||
    searchParams.get('video') === 'true' ||
    searchParams.get('bgvideo') === 'true';

  const disableAudio =
    searchParams.get('audio') === 'false' ||
    searchParams.get('sound') === 'false' ||
    searchParams.get('mute') === 'true';

  const initialTransitionMode =
    rawMode === '4' || rawMode === 'peak' || rawMode === 'mountain'
      ? 'peak'
      : rawMode === '2' || rawMode === 'cube'
      ? 'cube'
      : rawMode === '3' || rawMode === 'whip'
      ? 'whip'
      : 'pivot';

  const font = searchParams.get('font') || (initialTransitionMode === 'peak' ? 'geist' : 'poppins');
  const weight = searchParams.get('weight') || '500';

  const rawX = searchParams.get('x');
  const rawY = searchParams.get('y');
  const rawScale = searchParams.get('scale') || searchParams.get('size');

  const textXPercent = rawX !== null ? parseFloat(rawX) : 0;
  const textYPercent = rawY !== null ? parseFloat(rawY) : 16;
  const fontSizeMultiplier = rawScale !== null ? parseFloat(rawScale) : 1.0;

  const starsEnabled = searchParams.get('stars') !== 'false' && searchParams.get('meteors') !== 'false';
  const parallaxEnabled = searchParams.get('parallax') !== 'false';

  return (
    <PosterPreviewPlayer
      initialQuery={q}
      initialYoutubeId={yt}
      initialTrackId={trackId}
      initialShortcode={shortcode}
      initialTransitionMode={initialTransitionMode}
      isEmbed={isEmbed}
      enableBackgroundVideo={enableBackgroundVideo}
      stageFontFamily={font}
      stageFontWeight={weight}
      textXPercent={textXPercent}
      textYPercent={textYPercent}
      fontSizeMultiplier={fontSizeMultiplier}
      disableAudio={disableAudio}
      parallaxEnabled={parallaxEnabled}
      shootingStarsEnabled={starsEnabled}
    />
  );
}

/**
 * Short URL route alias: /p mirrors /preview for ultra-compact share URLs.
 * Example: openlyryc.pages.dev/p?q=Ed+Sheeran+Sapphire
 */
export default function ShortPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-zinc-400 gap-4 font-sans">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
          <p className="text-xs font-medium tracking-wide">Loading Cinema Poster Preview…</p>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
