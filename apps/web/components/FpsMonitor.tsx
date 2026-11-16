'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FramerateTarget } from '@/types/settings';

interface FpsMonitorProps {
  framerateTarget?: FramerateTarget;
}

export const FpsMonitor: React.FC<FpsMonitorProps> = ({ framerateTarget = 'max' }) => {
  const [mounted, setMounted] = useState(false);
  const [displayHz, setDisplayHz] = useState<number>(60);
  const [displayDeltaMs, setDisplayDeltaMs] = useState<number>(16.6);
  const frameCount = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const lastDeltaTime = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    lastTime.current = performance.now();
    lastDeltaTime.current = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount.current += 1;
      const currentDelta = now - lastDeltaTime.current;
      lastDeltaTime.current = now;

      // Update display FPS calculation every 500ms for stable readability
      if (now - lastTime.current >= 500) {
        const elapsed = now - lastTime.current;
        const measuredFps = Math.round((frameCount.current * 1000) / elapsed);
        const avgDelta = frameCount.current > 0 ? elapsed / frameCount.current : 4.16;
        setDisplayHz(measuredFps);
        setDisplayDeltaMs(Number(avgDelta.toFixed(1)));
        frameCount.current = 0;
        lastTime.current = now;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute effective engine output FPS based on user's target
  const effectiveFps =
    framerateTarget === '30'
      ? 30
      : framerateTarget === '60'
      ? Math.min(60, displayHz)
      : displayHz;

  const effectiveDeltaMs =
    framerateTarget === '30'
      ? '33.3'
      : framerateTarget === '60'
      ? (1000 / Math.min(60, displayHz)).toFixed(1)
      : displayDeltaMs.toFixed(1);

  const statusLabel =
    framerateTarget === '30'
      ? '30Hz Throttled'
      : framerateTarget === '60'
      ? '60Hz Target'
      : `${displayHz}Hz Native V-Sync`;

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0f0f12]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl font-sans text-[11px] text-zinc-300 pointer-events-none select-none animate-in fade-in duration-150">
      <span
        className={`w-2 h-2 rounded-full ${
          framerateTarget === '30'
            ? 'bg-amber-400'
            : framerateTarget === '60'
            ? 'bg-blue-400'
            : 'bg-emerald-400'
        }`}
      />
      <span>
        <strong className="text-white font-bold">{effectiveFps} FPS</strong> ({effectiveDeltaMs}ms)
      </span>
      <span className="w-1 h-1 rounded-full bg-white/20" />
      <span className="text-[10px] text-zinc-400 font-sans uppercase tracking-wider font-semibold">
        {statusLabel}
      </span>
    </div>
  );
};

export default FpsMonitor;
