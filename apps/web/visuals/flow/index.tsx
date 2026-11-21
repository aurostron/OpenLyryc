'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import type { OvisRenderProps } from '@/types/ovis';
import { OVIS_MANIFESTS } from '@/lib/ovis/manifests';
import {
  FlowLineRow,
  InstrumentalGapIndicator,
  buildDynamicFlowItems,
} from '@/components/LyricRenderer';

export const manifest = OVIS_MANIFESTS.flow;

export default function FlowVisualizer({
  lines,
  currentTime,
  onSeek,
  stageStyle,
}: OvisRenderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineElemRef = useRef<HTMLDivElement>(null);

  const flowItems = useMemo(() => buildDynamicFlowItems(lines), [lines]);

  const activeFlowItemIndex = useMemo(() => {
    if (lines.length === 0) return -1;
    for (let i = 0; i < flowItems.length; i++) {
      const item = flowItems[i];
      const start = item.type === 'line' ? item.line.start : item.gap.start;
      const end = item.type === 'line' ? item.line.end : item.gap.end;
      if (currentTime >= start && currentTime <= end) {
        return i;
      }
    }
    return -1;
  }, [flowItems, currentTime, lines.length]);

  // Smooth follow-along scroll
  useEffect(() => {
    const el = activeLineElemRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    const elTop = el.offsetTop;
    const elHeight = el.offsetHeight;
    const containerHeight = container.clientHeight;
    const targetScroll = elTop - containerHeight / 2 + elHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth',
    });
  }, [activeFlowItemIndex]);

  return (
    <div
      ref={scrollContainerRef}
      className="absolute inset-0 overflow-y-auto px-8 pt-16 sm:pt-20 pb-36 flex flex-col gap-8 items-center custom-scrollbar scroll-smooth [perspective:1000px]"
    >
      {flowItems.map((item, idx) => {
        const isActive = idx === activeFlowItemIndex;
        const isPast = idx < activeFlowItemIndex;

        if (item.type === 'gap') {
          return (
            <InstrumentalGapIndicator
              key={item.gap.id}
              isActive={isActive}
              isPast={isPast}
              start={item.gap.start}
              end={item.gap.end}
              onSeek={onSeek}
              innerRef={isActive ? activeLineElemRef : undefined}
            />
          );
        }

        return (
          <FlowLineRow
            key={item.line.id ? `${item.line.id}_${item.idx}` : `flow-${item.idx}`}
            line={item.line}
            words={item.words}
            idx={item.idx}
            isActive={isActive}
            isPast={isPast}
            currentTime={currentTime}
            onSeek={onSeek}
            innerRef={isActive ? activeLineElemRef : undefined}
            stageStyle={stageStyle}
          />
        );
      })}
    </div>
  );
}
