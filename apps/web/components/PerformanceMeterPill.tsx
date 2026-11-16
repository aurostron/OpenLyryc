'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FramerateTarget } from '@/types/settings';
import { Cpu, HardDrive, Activity } from 'lucide-react';

interface PerformanceMeterPillProps {
  framerateTarget?: FramerateTarget;
  className?: string;
  onClick?: () => void;
}

export const PerformanceMeterPill: React.FC<PerformanceMeterPillProps> = ({
  framerateTarget = 'max',
  className = '',
  onClick,
}) => {
  const [mounted, setMounted] = useState(false);
  const [metrics, setMetrics] = useState({
    fps: 60,
    latencyMs: 16.6,
    cpuPercent: 8,
    memoryMb: 48,
    history: Array(16).fill(12),
  });

  const frameCount = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const lastDeltaTime = useRef<number>(0);
  const totalFrameDelta = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    lastTime.current = performance.now();
    lastDeltaTime.current = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount.current += 1;
      const delta = now - lastDeltaTime.current;
      lastDeltaTime.current = now;
      totalFrameDelta.current += delta;

      const elapsed = now - lastTime.current;

      // Update metrics every 750ms for low overhead & fast responsiveness
      if (elapsed >= 750) {
        const measuredFps = Math.round((frameCount.current * 1000) / elapsed);
        const avgFrameMs = frameCount.current > 0 ? totalFrameDelta.current / frameCount.current : 16.66;

        const targetMs = 16.666;
        const calculatedCpu = Math.min(99, Math.max(2, Math.round((avgFrameMs / targetMs) * 22)));

        let mem = 48;
        if (typeof window !== 'undefined' && (performance as any).memory?.usedJSHeapSize) {
          mem = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
        }

        setMetrics((prev) => ({
          fps: measuredFps,
          latencyMs: Number(avgFrameMs.toFixed(1)),
          cpuPercent: calculatedCpu,
          memoryMb: mem,
          history: [...prev.history.slice(1), calculatedCpu],
        }));

        frameCount.current = 0;
        totalFrameDelta.current = 0;
        lastTime.current = now;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  if (!mounted) return null;

  const { fps, latencyMs, cpuPercent, memoryMb, history } = metrics;

  const sparkPoints = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * 32;
      const normalized = Math.min(100, Math.max(0, val));
      const y = 12 - (normalized / 100) * 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      onClick={onClick}
      title={`CPU: ${cpuPercent}% | Memory: ${memoryMb} MB | ${fps} FPS (${latencyMs}ms)`}
      className={`hidden md:flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] font-sans text-[10px] select-none text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white cursor-pointer shrink-0 shadow-inner ${className}`}
    >
      {/* CPU Load & Sparkline */}
      <div className="flex items-center gap-1">
        <Cpu className="w-3 h-3 text-zinc-400" />
        <span className="text-white font-bold tabular-nums">{cpuPercent}%</span>
      </div>

      <div className="w-8 h-3 flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 32 12">
          <polyline
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={sparkPoints}
          />
        </svg>
      </div>

      <div className="w-[1px] h-3 bg-white/[0.08]" />

      {/* Memory (RAM) */}
      <div className="flex items-center gap-1 text-zinc-400">
        <HardDrive className="w-2.5 h-2.5 text-zinc-500" />
        <span className="text-zinc-300 tabular-nums">{memoryMb}MB</span>
      </div>

      <div className="w-[1px] h-3 bg-white/[0.08]" />

      {/* FPS Rate & Render Latency */}
      <div className="flex items-center gap-1.5 text-zinc-300">
        <Activity className="w-3 h-3 text-zinc-400" />
        <span className="text-white font-bold tabular-nums">{fps} FPS</span>
        <span className="text-[9px] text-zinc-400 tabular-nums">({latencyMs}ms)</span>
      </div>
    </div>
  );
};
