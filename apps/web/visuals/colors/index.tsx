import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { ColorsViewRenderer } from '@/components/ColorsViewRenderer';

export const manifest = OVIS_MANIFESTS.colors;

export default function ColorsVisualizer(props: OvisRenderProps) {
  const s = props.settings || {};
  return (
    <ColorsViewRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      trackTitle={props.songTitle}
      artistName={props.artistName}
      beatDivision={s.beatDivision || '4'}
      fontSize={s.fontSize ?? 1.0}
      onSeek={props.onSeek}
    />
  );
}
