import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { KineticPosterRenderer } from '@/components/KineticPosterRenderer';

export const manifest = OVIS_MANIFESTS.kinetic;

export default function KineticVisualizer(props: OvisRenderProps) {
  return (
    <KineticPosterRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      onSeek={props.onSeek}
      trackTitle={props.songTitle}
      artistName={props.artistName}
      isPlaying={props.isPlaying}
      coverArt={props.coverArt}
    />
  );
}
