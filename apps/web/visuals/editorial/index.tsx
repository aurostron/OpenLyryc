import React from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import { EditorialStackRenderer } from '@/components/EditorialStackRenderer';

export const manifest = OVIS_MANIFESTS.editorial;

export default function EditorialVisualizer(props: OvisRenderProps) {
  const s = props.settings || {};
  return (
    <EditorialStackRenderer
      lines={props.lines}
      currentTime={props.currentTime}
      songTitle={props.songTitle}
      artistName={props.artistName}
      onSeek={props.onSeek}
      palette={props.palette}
      maxLines={s.maxLines ?? 4}
      cleanLyrics={s.cleanLyrics ?? true}
      wordsPerRow={s.wordsPerRow ?? 0}
    />
  );
}
