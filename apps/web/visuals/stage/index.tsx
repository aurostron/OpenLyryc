import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { StageFocusRenderer } from '@/components/StageFocusRenderer';

export const manifest = OVIS_MANIFESTS.stage;

export default function StageFocusVisualizer(props: OvisRenderProps) {
  return (
    <StageFocusRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      onSeek={props.onSeek}
      stageStyle={props.stageStyle}
    />
  );
}
