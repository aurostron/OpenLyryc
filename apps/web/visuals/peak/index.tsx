import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { MountainPeakRenderer } from '@/components/MountainPeakRenderer';

export const manifest = OVIS_MANIFESTS.peak;

export default function MountainPeakVisualizer(props: OvisRenderProps) {
  const s = props.settings || {};
  return (
    <MountainPeakRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      onSeek={props.onSeek}
      trackTitle={props.songTitle}
      artistName={props.artistName}
      fontSizeMultiplier={s.fontSize ? s.fontSize / 48 : 1.0}
      parallaxEnabled={s.parallax ?? true}
    />
  );
}
