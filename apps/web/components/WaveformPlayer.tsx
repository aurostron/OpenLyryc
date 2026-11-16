'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Magnet, Radio } from 'lucide-react';
import type WaveSurfer from 'wavesurfer.js';
import type { LyricLine } from '@/types/lyrics';

interface WaveformPlayerProps {
  onWaveSurferInit: (ws: WaveSurfer | null) => void;
  currentTime: number;
  currentAudioFile: File | null;
  onAudioSelect: (file: File) => void;
  externalDuration?: number;
  isExternalPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek?: (time: number) => void;
  trackTitle?: string;
  hasYouTubeEmbed?: boolean;
  hasSoundCloudEmbed?: boolean;
  audioSourceMode?: 'stream' | 'yt' | 'sc' | 'connect' | 'local' | 'none';
  onAudioSourceModeChange?: (mode: 'stream' | 'yt' | 'sc' | 'connect' | 'local' | 'none') => void;
  /** OpenLyryc Studio Connect (browser extension) is installed and can resolve YouTube Music audio. */
  isConnectAvailable?: boolean;
  /** Studio Connect engine status, for the Connect pill ('loading' animates). */
  connectStatus?: 'idle' | 'loading' | 'playing' | 'error';
  /** True while the auto-match for Connect is running (searching YouTube for the track). */
  isConnectResolving?: boolean;
  /** Auto-match this track on YouTube and switch the source to Connect (like the SoundCloud pill). */
  onTriggerConnectResolve?: () => Promise<unknown> | void;
  resolvedStreamUrl?: string | null;
  isResolvingStream?: boolean;
  hasStreamResolver?: boolean;
  onTriggerStreamResolve?: () => void;
  isResolvingSoundCloud?: boolean;
  onTriggerSoundCloudResolve?: () => void;
  loopRegion?: [number, number] | null;
  onClearLoop?: () => void;
  lines?: LyricLine[];
  isCompanionOnline?: boolean;
  onDurationDetected?: (dur: number) => void;
}

function formatPrecisionTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

const StaticWaveformBars: React.FC<{
  bars: number[];
  variant: 'base' | 'overlay';
}> = React.memo(({ bars, variant }) => {
  const isBase = variant === 'base';
  return (
    <div className="absolute inset-0 flex items-center justify-between px-2 gap-[1.5px] pointer-events-none">
      {bars.map((height, idx) => (
        <div
          key={idx}
          style={{ height: `${height}%` }}
          className={
            isBase
              ? 'flex-1 min-w-[1px] max-w-[2px] rounded-full bg-zinc-700/80 group-hover/mock:bg-zinc-600'
              : 'flex-1 min-w-[1px] max-w-[2px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.45)]'
          }
        />
      ))}
    </div>
  );
});
StaticWaveformBars.displayName = 'StaticWaveformBars';

/**
 * Resample a peak array down to `count` buckets (max-pooling so transients survive).
 * The transport width varies a lot, so the number of bars has to adapt: 180 fixed
 * 2px bars need ~630px and collapse to zero width in narrower layouts.
 */
const resamplePeaks = (peaks: number[], count: number): number[] => {
  if (peaks.length === 0 || count <= 0) return [];
  if (peaks.length === count) return peaks;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * peaks.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / count));
    let max = 0;
    for (let j = start; j < end; j++) {
      const value = peaks[j] ?? 0;
      if (value > max) max = value;
    }
    result.push(max);
  }
  return result;
};

export const WaveformPlayer: React.FC<WaveformPlayerProps> = React.memo(({
  onWaveSurferInit,
  currentTime,
  currentAudioFile,
  onAudioSelect,
  externalDuration = 0,
  isExternalPlaying = false,
  onTogglePlay,
  onSeek,
  trackTitle = 'Track',
  hasYouTubeEmbed = false,
  hasSoundCloudEmbed = false,
  audioSourceMode = 'yt',
  onAudioSourceModeChange,
  resolvedStreamUrl = null,
  isResolvingStream = false,
  hasStreamResolver = false,
  onTriggerStreamResolve,
  isResolvingSoundCloud = false,
  onTriggerSoundCloudResolve,
  loopRegion,
  onClearLoop,
  lines,
  isCompanionOnline = false,
  onDurationDetected,
  isConnectAvailable = false,
  connectStatus = 'idle',
  isConnectResolving = false,
  onTriggerConnectResolve,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockWaveformRef = useRef<HTMLDivElement>(null);
  const waveformShellRef = useRef<HTMLDivElement>(null);
  const audioFileRef = useRef<File | null>(currentAudioFile);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [waveformWidth, setWaveformWidth] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [bufferProgress, setBufferProgress] = useState<number>(0);
  const [bufferHealthSec, setBufferHealthSec] = useState<number>(0);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const pendingPlayRef = useRef<boolean>(false);
  const onDurationDetectedRef = useRef(onDurationDetected);

  useEffect(() => {
    onDurationDetectedRef.current = onDurationDetected;
  }, [onDurationDetected]);

  useEffect(() => {
    audioFileRef.current = currentAudioFile;
  }, [currentAudioFile]);

  // Track the transport waveform width so the bar count adapts instead of collapsing
  useEffect(() => {
    const el = waveformShellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setWaveformWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize WaveSurfer client-side
  useEffect(() => {
    if (!containerRef.current) return;

    let wsInstance: WaveSurfer | null = null;

    const initWaveSurfer = async () => {
      const WaveSurferModule = (await import('wavesurfer.js')).default;
      const audioEl = document.createElement('audio');
      // Do not enforce crossOrigin=anonymous so standard public audio streams can play without CORS blocks
      audioEl.preload = 'auto';

      wsInstance = WaveSurferModule.create({
        container: containerRef.current!,
        media: audioEl,
        waveColor: '#71717a',
        progressColor: '#ffffff',
        cursorColor: '#ffffff',
        cursorWidth: 2,
        height: 48,
        barWidth: 2,
        barGap: 3,
        barRadius: 2,
        normalize: true,
        autoCenter: true,
        dragToSeek: true,
      });

      const updateBuffer = () => {
        const media = wsInstance?.getMediaElement() || audioEl;
        if (media && media.buffered && media.buffered.length > 0) {
          const curTime = media.currentTime || 0;
          let maxBuffered = 0;
          let aheadSec = 0;
          for (let i = 0; i < media.buffered.length; i++) {
            const start = media.buffered.start(i);
            const end = media.buffered.end(i);
            if (end > maxBuffered) {
              maxBuffered = end;
            }
            if (curTime >= start && curTime <= end) {
              aheadSec = Math.max(0, end - curTime);
            }
          }
          const dur = media.duration || (duration > 0 ? duration : 1);
          const pct = Math.min(100, Math.round((maxBuffered / dur) * 100));
          setBufferProgress((prev) => (prev !== pct ? pct : prev));
          setBufferHealthSec(Math.round(aheadSec * 10) / 10);

          if (pendingPlayRef.current && (aheadSec > 0.5 || pct > 2 || media.readyState >= 2)) {
            pendingPlayRef.current = false;
            wsInstance?.play()?.catch(() => {});
          }
        }
      };

      const handleCanPlay = () => {
        updateBuffer();
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          wsInstance?.play()?.catch(() => {});
        }
      };

      audioEl.addEventListener('progress', updateBuffer);
      audioEl.addEventListener('canplay', handleCanPlay);
      audioEl.addEventListener('canplaythrough', () => {
        setBufferProgress(100);
        updateBuffer();
      });
      audioEl.addEventListener('loadeddata', handleCanPlay);

      wsInstance.on('play', () => {
        pendingPlayRef.current = false;
        setIsPlaying(true);
      });
      wsInstance.on('pause', () => setIsPlaying(false));
      wsInstance.on('decode', (dur) => {
        setDuration(dur);
        setBufferProgress(100);
        if (dur >= 1) {
          onDurationDetectedRef.current?.(dur);
        }
      });
      wsInstance.on('ready', (dur) => {
        setDuration(dur);
        updateBuffer();
        if (dur >= 1) {
          onDurationDetectedRef.current?.(dur);
        }
      });
      wsInstance.on('loading', (pct: number) => {
        setBufferProgress((prev) => (prev < pct ? pct : prev));
      });
      wsInstance.on('error', (err: any) => {
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
        console.warn('[WaveformPlayer] WaveSurfer notice:', err);
      });

      setWavesurfer(wsInstance);
      onWaveSurferInit(wsInstance);
    };

    initWaveSurfer();

    return () => {
      if (wsInstance) {
        wsInstance.destroy();
        onWaveSurferInit(null);
      }
      lastLoadedKeyRef.current = null;
    };
  }, []);

  // Handle audio source changes when wavesurfer is loaded
  useEffect(() => {
    if (!wavesurfer) return;

    if ((audioSourceMode === 'local' || audioSourceMode === 'connect') && currentAudioFile) {
      const fileKey = `local:${currentAudioFile.name}:${currentAudioFile.size}:${currentAudioFile.lastModified}`;
      // Self-heal: a prior stop()/empty() (track switch, new/selected project)
      // clears the media src and leaves a 0.001s dummy while lastLoadedKeyRef
      // still holds this key. Without the checks below the same file would never
      // reload and play() would reject silently, wedging local mode forever.
      const mediaEl = wavesurfer.getMediaElement();
      const srcMissing = !mediaEl?.currentSrc && !mediaEl?.src;
      const loadedDur = wavesurfer.getDuration();
      const isDummyResidue = loadedDur > 0 && loadedDur < 0.01;
      if (lastLoadedKeyRef.current === fileKey && !srcMissing && !isDummyResidue) return;
      lastLoadedKeyRef.current = fileKey;
      setBufferProgress(0);
      setBufferHealthSec(0);

      // Load File/Blob directly into WaveSurfer using its native loadBlob method.
      // This completely bypasses HTTP/network fetch() and avoids revoked blob URL desync errors!
      wavesurfer.loadBlob(currentAudioFile).catch((err) => {
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
        console.warn('[WaveformPlayer] Failed to load local file:', err);
      });
    } else if (audioSourceMode === 'stream' && resolvedStreamUrl) {
      const streamKey = `stream:${resolvedStreamUrl}`;
      if (lastLoadedKeyRef.current === streamKey) return;
      lastLoadedKeyRef.current = streamKey;
      setBufferProgress(0);
      setBufferHealthSec(0);

      // Pass dummy peaks and duration to bypass WaveSurfer's internal fetch() of the full audio file!
      // This connects directly to the HTML5 media stream for instantaneous zero-wait playback!
      const dummyPeaks = [new Float32Array([0, 0])];
      const dur = effectiveDuration > 0 ? effectiveDuration : undefined;

      wavesurfer.load(resolvedStreamUrl, dummyPeaks, dur).catch((err) => {
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
        console.warn('[WaveformPlayer] Direct stream load failed, trying CORS proxy fallback...', err);
        if (!resolvedStreamUrl.startsWith('http://localhost') && !resolvedStreamUrl.startsWith('http://127.0.0.1')) {
          const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(resolvedStreamUrl)}`;
          wavesurfer.load(proxyUrl, dummyPeaks, dur).catch(() => {});
        }
      });
    } else if (audioSourceMode === 'yt' || audioSourceMode === 'sc' || audioSourceMode === 'connect' || audioSourceMode === 'none') {
      // Pause wavesurfer playback while in YouTube, SoundCloud, Connect or idle mode, but preserve loaded audio stream in cache
      if (wavesurfer.isPlaying()) {
        wavesurfer.pause();
      }
    }
  }, [currentAudioFile, resolvedStreamUrl, audioSourceMode, wavesurfer]);

  const hasDirectAudio =
    (audioSourceMode === 'local' && Boolean(currentAudioFile)) ||
    (audioSourceMode === 'connect' && Boolean(currentAudioFile)) ||
    (audioSourceMode === 'stream' && Boolean(resolvedStreamUrl));

  // Effective Duration & Active State
  const effectiveDuration = duration > 0 ? duration : externalDuration;
  const effectiveIsPlaying = hasDirectAudio ? isPlaying : isExternalPlaying;

  // Generate Realistic Procedural Waveform Bars when streaming from embed
  const proceduralBars = useMemo(() => {
    const count = 180;
    const seedKey = `${trackTitle}-${Math.round(effectiveDuration)}`;
    
    // Fast 32-bit FNV-1a Hash to seed PRNG
    let seed = 0x811c9dc5;
    for (let i = 0; i < seedKey.length; i++) {
      seed ^= seedKey.charCodeAt(i);
      seed = Math.imul(seed, 0x01000193);
    }
    seed = seed >>> 0;

    // Mulberry32 Deterministic PRNG
    const mulberry32 = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Realistic Song Dynamic Section Curves
    const sectionBreaks = [
      { pos: 0.0, energy: 0.28 },  // Intro start
      { pos: 0.08, energy: 0.45 }, // Intro build
      { pos: 0.18, energy: 0.58 }, // Verse 1
      { pos: 0.30, energy: 0.76 }, // Pre-Chorus
      { pos: 0.38, energy: 0.94 }, // Chorus 1 Drop
      { pos: 0.52, energy: 0.60 }, // Verse 2
      { pos: 0.64, energy: 0.78 }, // Pre-Chorus 2
      { pos: 0.72, energy: 0.96 }, // Chorus 2
      { pos: 0.82, energy: 0.42 }, // Bridge / Breakdown
      { pos: 0.88, energy: 0.98 }, // Climax / Final Chorus
      { pos: 0.96, energy: 0.38 }, // Outro
      { pos: 1.0, energy: 0.18 },  // Fade out
    ];

    const getSectionEnergy = (p: number) => {
      for (let s = 0; s < sectionBreaks.length - 1; s++) {
        if (p >= sectionBreaks[s].pos && p <= sectionBreaks[s + 1].pos) {
          const span = sectionBreaks[s + 1].pos - sectionBreaks[s].pos;
          const t = (p - sectionBreaks[s].pos) / span;
          const smoothT = t * t * (3 - 2 * t);
          return sectionBreaks[s].energy + (sectionBreaks[s + 1].energy - sectionBreaks[s].energy) * smoothT;
        }
      }
      return 0.5;
    };

    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const baseEnergy = getSectionEnergy(progress);

      // Multi-frequency harmonic variation
      const phraseWave = Math.sin(progress * Math.PI * 28 + (seed % 10)) * 0.14;
      const barRhythm = (i % 4 === 0 || i % 7 === 0) ? (mulberry32() * 0.22 + 0.12) : 0;
      const isMicroPause = mulberry32() < 0.035;
      const naturalNoise = mulberry32() * 0.38 - 0.19;

      if (isMicroPause) {
        bars.push(Math.round(Math.max(12, baseEnergy * 18)));
      } else {
        const raw = (baseEnergy + phraseWave + barRhythm + naturalNoise) * 100;
        const clamped = Math.max(14, Math.min(98, raw));
        bars.push(Math.round(clamped));
      }
    }
    return bars;
  }, [trackTitle, effectiveDuration]);

  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    time: number;
    isSnap?: boolean;
    snapLabel?: string;
  } | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  // Keyboard shortcut: S toggles magnetic snapping (when not in text input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');
      if (isInput) return;

      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsSnapping((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize internal WaveSurfer zoom if active
  useEffect(() => {
    if (!wavesurfer) return;
    try {
      wavesurfer.zoom(zoom * 25);
    } catch {}
  }, [wavesurfer, zoom]);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (wavesurfer) {
      wavesurfer.setPlaybackRate(rate);
    }
  };

  const handleNudge = (seconds: number) => {
    if (wavesurfer && hasDirectAudio) {
      const newTime = Math.max(0, wavesurfer.getCurrentTime() + seconds);
      wavesurfer.setTime(newTime);
    } else if (onSeek) {
      const newTime = Math.max(0, Math.min(effectiveDuration, currentTime + seconds));
      onSeek(newTime);
    }
  };

  const handlePlayPauseClick = () => {
    if (wavesurfer && hasDirectAudio) {
      if (isPlaying) {
        pendingPlayRef.current = false;
        wavesurfer.pause();
      } else {
        const media = wavesurfer.getMediaElement();
        if (media && (media.readyState >= 2 || (media.buffered && media.buffered.length > 0))) {
          wavesurfer.play()?.catch((err) => console.warn('[WaveformPlayer] Play error:', err));
        } else {
          pendingPlayRef.current = true;
          wavesurfer.play()?.catch(() => {});
        }
      }
    } else if (onTogglePlay) {
      onTogglePlay();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAudioSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  const [localAudioPeaks, setLocalAudioPeaks] = useState<number[] | null>(null);

  // Extract real audio waveform peaks from local audio file in background
  useEffect(() => {
    if (!currentAudioFile) {
      setLocalAudioPeaks(null);
      return;
    }

    let isMounted = true;

    const extractPeaks = async () => {
      try {
        const arrayBuffer = await currentAudioFile.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const samplesCount = 180;
        const blockSize = Math.floor(channelData.length / samplesCount);
        const rawPeaks: number[] = [];

        let maxPeak = 0;
        for (let i = 0; i < samplesCount; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          let peak = 0;
          for (let j = start; j < end; j += 4) {
            const val = Math.abs(channelData[j]);
            if (val > peak) peak = val;
          }
          rawPeaks.push(peak);
          if (peak > maxPeak) maxPeak = peak;
        }

        audioCtx.close().catch(() => {});

        if (isMounted) {
          const normalized = rawPeaks.map((p) =>
            Math.round(Math.max(14, Math.min(98, (p / (maxPeak || 1)) * 98)))
          );
          setLocalAudioPeaks(normalized);
        }
      } catch (err) {
        console.warn('Real audio peak extraction fallback:', err);
      }
    };

    extractPeaks();

    return () => {
      isMounted = false;
    };
  }, [currentAudioFile]);

  // Active waveform bars: real extracted peaks for local file, or procedural section curves for stream
  const activeBars = useMemo(() => {
    if (localAudioPeaks && localAudioPeaks.length > 0) {
      return localAudioPeaks;
    }
    return proceduralBars;
  }, [localAudioPeaks, proceduralBars]);

  // Match the bar count to the rendered width (2px bar + 1.5px gap ≈ 3.6px per bar)
  const transportBarCount = waveformWidth > 0
    ? Math.max(20, Math.min(activeBars.length || 180, Math.floor((waveformWidth - 20) / 3.6)))
    : 0;

  const displayBars = useMemo(
    () => (transportBarCount > 0 ? resamplePeaks(activeBars, transportBarCount) : activeBars),
    [activeBars, transportBarCount]
  );

  // Horizontal translation offset for zoomed waveform (keeps current playhead visible)
  const scrollOffsetPct = useMemo(() => {
    if (zoom <= 1) return 0;
    const playheadPos = (progressPercent / 100) * (zoom * 100);
    const targetOffset = playheadPos - 50;
    return Math.max(0, Math.min((zoom - 1) * 100, targetOffset));
  }, [zoom, progressPercent]);

  // Precise seek calculator with magnetic snap to lyric lines, playhead, loop markers, and real audio transients
  const getSeekTimeFromEvent = useCallback(
    (
      clientX: number,
      shouldSnap: boolean
    ): { time: number; pixelX: number; isSnap: boolean; snapLabel?: string } => {
      if (effectiveDuration <= 0 || !mockWaveformRef.current) {
        return { time: 0, pixelX: 0, isSnap: false };
      }
      const rect = mockWaveformRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const clampedRelativeX = Math.max(0, Math.min(rect.width, relativeX));
      const normalizedRatio = clampedRelativeX / rect.width;

      const trackRatio =
        zoom > 1
          ? Math.max(0, Math.min(1, (normalizedRatio * 100 + scrollOffsetPct) / (zoom * 100)))
          : normalizedRatio;

      const rawTime = trackRatio * effectiveDuration;

      if (!shouldSnap) {
        return {
          time: Number(rawTime.toFixed(3)),
          pixelX: Math.round(clampedRelativeX),
          isSnap: false,
        };
      }

      // Magnetic snap radius: 10 screen pixels
      const thresholdPx = 10;
      const visibleDuration = effectiveDuration / zoom;
      const thresholdSec = (thresholdPx / rect.width) * visibleDuration;

      let closestDistSec = thresholdSec;
      let bestSnapTime: number | null = null;
      let bestLabel: string | undefined = undefined;

      // 1. Lyric lines boundaries (start and end)
      if (lines && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const distStart = Math.abs(rawTime - l.start);
          if (distStart < closestDistSec) {
            closestDistSec = distStart;
            bestSnapTime = l.start;
            bestLabel = `Line ${i + 1}`;
          }
          const distEnd = Math.abs(rawTime - l.end);
          if (distEnd < closestDistSec) {
            closestDistSec = distEnd;
            bestSnapTime = l.end;
            bestLabel = `Line ${i + 1} End`;
          }
        }
      }

      // 2. Loop region markers
      if (loopRegion) {
        const distLoopStart = Math.abs(rawTime - loopRegion[0]);
        if (distLoopStart < closestDistSec) {
          closestDistSec = distLoopStart;
          bestSnapTime = loopRegion[0];
          bestLabel = 'Loop In';
        }
        const distLoopEnd = Math.abs(rawTime - loopRegion[1]);
        if (distLoopEnd < closestDistSec) {
          closestDistSec = distLoopEnd;
          bestSnapTime = loopRegion[1];
          bestLabel = 'Loop Out';
        }
      }

      // 3. Playhead (currentTime)
      const distPlayhead = Math.abs(rawTime - currentTime);
      if (distPlayhead < closestDistSec) {
        closestDistSec = distPlayhead;
        bestSnapTime = currentTime;
        bestLabel = 'Playhead';
      }

      // 4. Real audio peaks (ONLY when localAudioPeaks exists - never on fake procedural bars)
      if (localAudioPeaks && localAudioPeaks.length > 0) {
        const totalBars = localAudioPeaks.length;
        const currentBarIdx = Math.round(trackRatio * (totalBars - 1));
        const searchRadiusBars = 4;
        const startIdx = Math.max(1, currentBarIdx - searchRadiusBars);
        const endIdx = Math.min(totalBars - 2, currentBarIdx + searchRadiusBars);

        for (let idx = startIdx; idx <= endIdx; idx++) {
          const p = localAudioPeaks[idx];
          if (p >= 45 && p >= localAudioPeaks[idx - 1] && p >= localAudioPeaks[idx + 1]) {
            const peakTime = (idx / (totalBars - 1)) * effectiveDuration;
            const distPeak = Math.abs(rawTime - peakTime);
            if (distPeak < closestDistSec) {
              closestDistSec = distPeak;
              bestSnapTime = peakTime;
              bestLabel = 'Transient';
            }
          }
        }
      }

      if (bestSnapTime !== null) {
        // Compute exact screen pixel position for the snapped target
        const snappedRatio = bestSnapTime / effectiveDuration;
        const snappedNormalizedRatio =
          zoom > 1
            ? (snappedRatio * (zoom * 100) - scrollOffsetPct) / 100
            : snappedRatio;
        const snappedPixelX = Math.round(snappedNormalizedRatio * rect.width);

        return {
          time: Number(bestSnapTime.toFixed(3)),
          pixelX: Math.max(0, Math.min(rect.width, snappedPixelX)),
          isSnap: true,
          snapLabel: bestLabel,
        };
      }

      return {
        time: Number(rawTime.toFixed(3)),
        pixelX: Math.round(clampedRelativeX),
        isSnap: false,
      };
    },
    [effectiveDuration, zoom, scrollOffsetPct, lines, loopRegion, currentTime, localAudioPeaks]
  );

  const handleMockWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (effectiveDuration <= 0) return;
      // Holding Shift inverts snap behavior
      const shouldSnap = (isSnapping && !e.shiftKey) || (!isSnapping && e.shiftKey);
      const { time } = getSeekTimeFromEvent(e.clientX, shouldSnap);

      if (wavesurfer && hasDirectAudio) {
        wavesurfer.setTime(time);
      } else if (onSeek) {
        onSeek(time);
      }
    },
    [effectiveDuration, isSnapping, getSeekTimeFromEvent, wavesurfer, hasDirectAudio, onSeek]
  );

  const handleMockWaveformMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (effectiveDuration <= 0 || !mockWaveformRef.current) return;
      // Holding Shift inverts snap behavior
      const shouldSnap = (isSnapping && !e.shiftKey) || (!isSnapping && e.shiftKey);
      const { time, pixelX, isSnap, snapLabel } = getSeekTimeFromEvent(e.clientX, shouldSnap);

      setHoverPosition((prev) => {
        if (
          prev &&
          prev.x === pixelX &&
          prev.time === time &&
          prev.isSnap === isSnap &&
          prev.snapLabel === snapLabel
        ) {
          return prev;
        }
        return { x: pixelX, time, isSnap, snapLabel };
      });
    },
    [effectiveDuration, isSnapping, getSeekTimeFromEvent]
  );

  const handleMockWaveformMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  const handleWaveformWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(8, z * 2));
    } else if (e.deltaY > 0) {
      setZoom((z) => Math.max(1, z / 2));
    }
  }, []);

  return (
    <section data-tutorial="waveform-transport" className="h-16 sm:h-20 bg-[#0b0b0e] border-t border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.5)] flex items-center px-3 sm:px-6 gap-2.5 sm:gap-5 shrink-0 w-full select-none z-20 studio-chrome">
      {/* WaveSurfer audio engine container (Offscreen without display:none so audio media runs unimpeded) */}
      <div ref={containerRef} className="w-0 h-0 overflow-hidden opacity-0 pointer-events-none absolute" />

      {/* Modern Circular Playback Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleNudge(-0.5)}
          title="Nudge -500ms (Shift+Left)"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">fast_rewind</span>
        </motion.button>

        <motion.button
          onClick={handlePlayPauseClick}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', damping: 15, stiffness: 400 }}
          title="Play / Pause (Space)"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white text-zinc-950 hover:bg-zinc-200 shadow-md shadow-white/10 transition-colors cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined fill text-[20px] sm:text-[22px]">
            {effectiveIsPlaying ? 'pause' : 'play_arrow'}
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleNudge(0.5)}
          title="Nudge +500ms (Shift+Right)"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">fast_forward</span>
        </motion.button>
      </div>

      {/* Waveform Visualization Canvas */}
      <div ref={waveformShellRef} className="flex-1 h-12 relative flex items-center overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.06] group">
        {/* Interactive Waveform Display (Active when local audio or streaming audio is loaded) */}
        {(currentAudioFile || effectiveDuration > 0) && (
          <div
            ref={mockWaveformRef}
            onClick={handleMockWaveformClick}
            onMouseMove={handleMockWaveformMouseMove}
            onMouseLeave={handleMockWaveformMouseLeave}
            onWheel={handleWaveformWheel}
            title="Click or drag to seek playback. Scroll wheel to zoom."
            className="absolute inset-0 z-10 overflow-hidden cursor-pointer group/mock select-none bg-[#0c0c0e]/90"
          >
            {/* Zoomable Waveform Inner Track */}
            <div
              style={{
                width: `${zoom * 100}%`,
                transform: `translateX(-${scrollOffsetPct}%)`,
                transition: 'transform 80ms ease-out',
              }}
              className="relative h-full flex items-center justify-between px-3 pointer-events-none"
            >
              {/* Waveform Base Layer (Unplayed background bars) */}
              <StaticWaveformBars bars={displayBars} variant="base" />

              {/* Stream Audio Buffer Progress Fill (Subtle gentle white shade) */}
              {audioSourceMode === 'stream' && bufferProgress > 0 && (
                <div
                  style={{ width: `${Math.min(100, bufferProgress)}%` }}
                  className="absolute top-0 bottom-0 left-0 bg-white/[0.04] border-r border-white/[0.15] pointer-events-none z-0 transition-all duration-300"
                />
              )}

              {/* Waveform Played Overlay (High-luminance active bars with single GPU clip-path) */}
              <div
                style={{ clipPath: `inset(0 ${Math.max(0, 100 - progressPercent)}% 0 0)` }}
                className="absolute inset-0 pointer-events-none z-10"
              >
                <StaticWaveformBars bars={displayBars} variant="overlay" />
              </div>

              {/* Feature 3: Loop Region Bracket */}
              {loopRegion && effectiveDuration > 0 && (
                <div
                  style={{
                    left: `${(loopRegion[0] / effectiveDuration) * 100}%`,
                    width: `${((loopRegion[1] - loopRegion[0]) / effectiveDuration) * 100}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-amber-400/20 border-x border-amber-400/60 z-10 pointer-events-none group/loop"
                >
                  {onClearLoop && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearLoop();
                      }}
                      className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center opacity-0 group-hover/loop:opacity-100 transition-opacity pointer-events-auto cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                    </button>
                  )}
                </div>
              )}

              {/* Active Playhead Scrubber Line (Zero-lag 240Hz playhead) */}
              <div
                style={{ left: `${progressPercent}%` }}
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_#ffffff] z-20 pointer-events-none"
              />
            </div>

            {/* Hover Scrubber Line & Precision Timecode Tooltip */}
            {hoverPosition && (
              <>
                <div
                  style={{ left: `${hoverPosition.x}px` }}
                  className={`absolute top-0 bottom-0 pointer-events-none z-20 ${
                    hoverPosition.isSnap ? 'w-[1.5px] bg-amber-300 shadow-[0_0_6px_#fde047]' : 'w-[1px] bg-white/40'
                  }`}
                />
                <div
                  style={{
                    left: `${Math.max(35, Math.min(mockWaveformRef.current ? mockWaveformRef.current.clientWidth - 45 : 100, hoverPosition.x))}px`,
                  }}
                  className="absolute top-1 -translate-x-1/2 pointer-events-none z-30 px-2 py-0.5 rounded-lg bg-black/95 border border-white/20 text-[10px] font-sans font-medium text-white shadow-xl backdrop-blur-md tabular-nums flex items-center gap-1.5"
                >
                  <span>{formatPrecisionTimecode(hoverPosition.time)}</span>
                  {hoverPosition.isSnap && (
                    <span className="text-[9px] font-sans text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span>Snap</span>
                      {hoverPosition.snapLabel && (
                        <span className="text-amber-200/80 font-normal">({hoverPosition.snapLabel})</span>
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty State: No File & No Stream Duration */}
        {!currentAudioFile && effectiveDuration <= 0 && (
          <label className="absolute inset-0 z-20 flex items-center justify-center gap-2 text-zinc-400 text-xs font-sans bg-[#0c0c0e]/90 group-hover:text-white group-hover:bg-[#0c0c0e]/75 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span>Click or Drop Audio Track (.mp3, .flac, .wav, .m4a)</span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac,.wma"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>
        )}
      </div>

      {/* Stream / YT / Local Audio Source Segmented Toggle Switch */}
      <div data-tutorial="audio-sources" className="hidden sm:flex items-center rounded-xl bg-white/[0.03] border border-white/[0.08] p-0.5 shrink-0 select-none">
        {/* Stream Audio Source Toggle Button (Treated natively as Stream Mode) */}
        {(Boolean(resolvedStreamUrl) || isCompanionOnline || hasStreamResolver || Boolean(hasYouTubeEmbed)) && (
          <button
            type="button"
            onClick={() => {
              if (audioSourceMode === 'stream') {
                onAudioSourceModeChange?.('none');
              } else {
                onAudioSourceModeChange?.('stream');
                if (!resolvedStreamUrl && onTriggerStreamResolve) {
                  onTriggerStreamResolve();
                }
              }
            }}
            title={
              resolvedStreamUrl
                ? (audioSourceMode === 'stream'
                  ? `Active Direct Audio Stream | Buffered: ${bufferProgress}% (+${bufferHealthSec}s ahead) — Click to disconnect`
                  : `Direct Audio Stream | Buffered: ${bufferProgress}% (+${bufferHealthSec}s ahead)`)
                : (audioSourceMode === 'stream' ? 'Active Stream Mode — Click to disconnect' : 'Switch to Direct Stream Mode')
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              audioSourceMode === 'stream'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white disabled:opacity-25'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${isResolvingStream ? 'animate-spin' : ''}`}>
              {isResolvingStream ? 'sync' : 'stream'}
            </span>
            <span>
              {isResolvingStream
                ? 'Resolving...'
                : audioSourceMode === 'stream' && bufferProgress > 0 && bufferProgress < 100
                ? `Stream ${bufferProgress}%`
                : 'Stream'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (audioSourceMode === 'yt') {
              onAudioSourceModeChange?.('none');
            } else {
              onAudioSourceModeChange?.('yt');
            }
          }}
          disabled={!hasYouTubeEmbed}
          title={
            hasYouTubeEmbed
              ? audioSourceMode === 'yt'
                ? 'Active YouTube Reference Audio — Click to disconnect'
                : 'Use YouTube Reference Audio Stream'
              : 'No YouTube track linked'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            audioSourceMode === 'yt'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">smart_display</span>
          <span>YouTube</span>
        </button>

        {/* OpenLyryc Studio Connect: direct YouTube Music audio through the browser extension (no embed).
            Behaves like the SoundCloud pill: with a YouTube track linked it switches the source; without one, it auto-matches. */}
        {isConnectAvailable && (
          <button
            type="button"
            onClick={() => {
              if (audioSourceMode === 'connect') {
                onAudioSourceModeChange?.('none');
              } else if (hasYouTubeEmbed) {
                onAudioSourceModeChange?.('connect');
              } else if (onTriggerConnectResolve) {
                void onTriggerConnectResolve();
              }
            }}
            disabled={!hasYouTubeEmbed && !onTriggerConnectResolve}
            title={
              isConnectResolving
                ? 'Finding this track on YouTube…'
                : hasYouTubeEmbed
                  ? audioSourceMode === 'connect'
                    ? 'Active Studio Connect stream (real audio + waveform) — Click to disconnect'
                    : 'Stream this track directly via the Studio Connect extension'
                  : 'Auto-find this track on YouTube and stream it via the Studio Connect extension'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              audioSourceMode === 'connect'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${isConnectResolving || connectStatus === 'loading' ? 'animate-spin' : ''}`}>
              {isConnectResolving || connectStatus === 'loading' ? 'sync' : 'cable'}
            </span>
            <span>{isConnectResolving ? 'Connecting…' : connectStatus === 'loading' ? 'Connecting…' : 'Connect'}</span>
          </button>
        )}

        {/* SoundCloud Audio Source Toggle Button — Always Available, Clean Monochrome */}
        <button
          type="button"
          onClick={() => {
            if (audioSourceMode === 'sc') {
              onAudioSourceModeChange?.('none');
            } else if (hasSoundCloudEmbed) {
              onAudioSourceModeChange?.('sc');
            } else if (onTriggerSoundCloudResolve) {
              onTriggerSoundCloudResolve();
            } else {
              onAudioSourceModeChange?.('sc');
            }
          }}
          title={
            audioSourceMode === 'sc'
              ? 'Active SoundCloud Stream — Click to disconnect'
              : hasSoundCloudEmbed
              ? 'Switch to SoundCloud Reference Stream'
              : 'Find and connect SoundCloud Stream'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            audioSourceMode === 'sc'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span className={`material-symbols-outlined text-[15px] ${isResolvingSoundCloud ? 'animate-spin' : ''}`}>
            {isResolvingSoundCloud ? 'sync' : 'graphic_eq'}
          </span>
          <span>{isResolvingSoundCloud ? 'Finding...' : 'SoundCloud'}</span>
        </button>

        <label
          title={
            currentAudioFile
              ? audioSourceMode === 'local'
                ? `Active Local Track: ${currentAudioFile.name} — Click to disconnect`
                : `Local Track: ${currentAudioFile.name} — Click to activate`
              : 'Upload Local Audio File (.mp3, .wav, .flac)'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            audioSourceMode === 'local'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
          onClick={(e) => {
            if (audioSourceMode === 'local') {
              e.preventDefault();
              onAudioSourceModeChange?.('none');
            } else if (currentAudioFile) {
              e.preventDefault();
              onAudioSourceModeChange?.('local');
            }
          }}
        >
          <span className="material-symbols-outlined text-[15px]">music_note</span>
          <span>{currentAudioFile ? 'Local File' : 'Load Audio'}</span>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac,.wma"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </label>
      </div>

      {/* Waveform Zoom Controls */}
      <div className="hidden sm:flex items-center rounded-lg bg-white/[0.03] border border-white/[0.07] p-0.5 shrink-0 gap-0.5">
        <button
          type="button"
          disabled={zoom <= 1}
          onClick={() => setZoom((prev) => Math.max(1, prev / 2))}
          title="Zoom out waveform (or mouse wheel down)"
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px]">zoom_out</span>
        </button>
        <span className="px-1 text-[10px] font-sans text-zinc-300 select-none tabular-nums font-semibold">
          {zoom}x
        </span>
        <button
          type="button"
          disabled={zoom >= 8}
          onClick={() => setZoom((prev) => Math.min(8, prev * 2))}
          title="Zoom in waveform (or mouse wheel up)"
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px]">zoom_in</span>
        </button>
      </div>

      {/* Magnetic Snapping Toggle */}
      <button
        type="button"
        onClick={() => setIsSnapping((prev) => !prev)}
        title={
          isSnapping
            ? 'Magnetic Snapping: ON (Press S to toggle. Snaps to line starts, loop points & peaks)'
            : 'Magnetic Snapping: OFF (Press S to toggle. Hold Shift while clicking to snap)'
        }
        className={`hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
          isSnapping
            ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25 shadow-sm'
            : 'bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
        }`}
      >
        <Magnet className="w-3.5 h-3.5 stroke-[2.2]" />
        <span className="text-[11px]">Snap {isSnapping ? 'On' : 'Off'}</span>
      </button>
      <div className="hidden lg:flex items-center rounded-lg bg-white/[0.03] border border-white/[0.07] p-0.5 shrink-0">
        {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
          <button
            key={rate}
            onClick={() => handleSpeedChange(rate)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-sans tabular-nums transition-all cursor-pointer ${
              playbackRate === rate
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>

      {/* Clean Tabular Timecode Display */}
      <div className="flex flex-col items-end min-w-[70px] sm:min-w-[100px] select-none font-sans shrink-0">
        <span className="tabular-nums text-xs sm:text-sm text-white font-bold tracking-tight">
          {formatPrecisionTimecode(currentTime)}
        </span>
        <span className="tabular-nums text-[10px] sm:text-[11px] text-zinc-500 font-medium">
          / {formatPrecisionTimecode(effectiveDuration)}
        </span>
      </div>
    </section>
  );
});
WaveformPlayer.displayName = 'WaveformPlayer';
