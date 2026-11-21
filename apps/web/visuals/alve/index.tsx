import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { AlveTownRenderer } from '@/components/AlveTownRenderer';

export const manifest = OVIS_MANIFESTS.alve;

export default function AlveVisualizer(props: OvisRenderProps) {
  const s = props.settings || {};
  const activeLineIndex = props.lines.findIndex(
    (l) => props.currentTime >= l.start && props.currentTime <= l.end
  );

  return (
    <AlveTownRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      activeLineIndex={activeLineIndex}
      animated={s.animation ?? true}
      dayNight={s.dayNight ?? true}
      dim={s.dim ?? 0.3}
      onSeek={props.onSeek}
    />
  );
}
