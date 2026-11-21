import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { FlythroughRenderer } from '@/components/FlythroughRenderer';

export const manifest = OVIS_MANIFESTS.flythrough;

export default function FlythroughVisualizer(props: OvisRenderProps) {
  return (
    <FlythroughRenderer
      lines={props.lines}
      currentTime={props.currentTime}
    />
  );
}
