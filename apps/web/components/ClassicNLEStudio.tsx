'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LyricLine, WordToken, OpenLyricsDocument } from '@/types/lyrics';
import type { ColorPalette } from '@/lib/colorExtractor';
import { tokenizeLineIntoWords, isJapaneseText, estimateWordPhoneticWeight } from '@/lib/tokenizer';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Scissors,
  MousePointer,
  Magnet,
  Layers,
  Music,
  Plus,
  Trash2,
  Split,
  Check,
  ChevronRight,
  Tv,
  Edit3,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Film,
  Upload,
  Link2,
  AlertCircle,
  FileVideo,
  FileAudio,
} from 'lucide-react';

export interface TimelineLayer {
  id: string;
  name: string;
  isMuted?: boolean;
  isSolo?: boolean;
  isWordLaneExpanded?: boolean;
}

interface ClassicNLEStudioProps {
  doc: OpenLyricsDocument;
  activeLineIndex: number | null;
  onSelectLine: (index: number) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onUpdateLineTiming: (lineIndex: number, start: number, end: number, layerId?: string) => void;
  onSetLineLayer?: (lineIndex: number, layerId: string) => void;
  onReorderLines?: (fromIndex: number, toIndex: number) => void;
  onUpdateMetadata?: (metadata: Partial<OpenLyricsDocument['metadata']>) => void;
  onUpdateLineText: (lineIndex: number, text: string) => void;
  onSetWordToken?: (lineIndex: number, tokenIndex: number, start: number, end: number) => void;
  onSetWordTokenText?: (lineIndex: number, tokenIndex: number, text: string) => void;
  onSetLineVocalist?: (lineIndex: number, vocalist: string | undefined) => void;
  onAddLine?: (afterIndex?: number, text?: string, start?: number, end?: number, layerId?: string) => void;
  onDeleteLine?: (lineIndex: number) => void;
  onDivideLineIntoWords?: (lineIndex: number) => void;
  onTokenizeLine?: (lineIndex: number) => void;
  onToggleLineEmphasis?: (lineIndex: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  youtubeId?: string;
  palette?: ColorPalette;
  monitorMode?: 'video' | 'stage';
  onMonitorModeChange?: (mode: 'video' | 'stage') => void;
  wavesurfer?: any;
  currentAudioFile?: File | null;
  audioSourceMode?: 'stream' | 'yt' | 'sc' | 'connect' | 'local' | 'none';
  onAudioSelect?: (file: File) => void;
}

type NLETool = 'select' | 'razor';

interface SnapIndicatorState {
  time: number;
  label: string;
}

const LAYER_ROW_HEIGHT = 112;
const CLIP_HEIGHT = 100;

/**
 * Formats seconds into broadcast SMPTE style HH:MM:SS:FF (at 30fps)
 */
function formatSMPTE(seconds: number, fps = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

/**
 * Formats seconds into MM:SS.mmm
 */
function formatPrecise(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
}

interface WaveformCanvasProps {
  totalWidth: number;
  zoom: number;
  currentTime: number;
  audioBuffer: AudioBuffer | null;
  isLoading?: boolean;
}

const WaveformCanvas: React.FC<WaveformCanvasProps> = React.memo(({
  totalWidth,
  zoom,
  currentTime,
  audioBuffer,
  isLoading,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<{
    canvas: HTMLCanvasElement;
    zoom: number;
    totalWidth: number;
    buffer: AudioBuffer | null;
  } | null>(null);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = totalWidth;
    offscreen.height = 48;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    const step = 4;
    const barWidth = 2;
    const numBars = Math.floor(totalWidth / step);

    if (audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      const totalSamples = channelData.length;
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      octx.fillStyle = 'rgba(113, 113, 122, 0.55)';
      for (let i = 0; i < numBars; i++) {
        const x = i * step;
        const t1 = x / zoom;
        const t2 = (x + barWidth) / zoom;
        if (t1 >= duration) break;

        const s1 = Math.min(totalSamples - 1, Math.max(0, Math.floor(t1 * sampleRate)));
        const s2 = Math.min(totalSamples, Math.max(s1 + 1, Math.floor(t2 * sampleRate)));

        let maxAmp = 0;
        const sampleStride = Math.max(1, Math.floor((s2 - s1) / 35));
        for (let s = s1; s < s2; s += sampleStride) {
          const val = Math.abs(channelData[s]);
          if (val > maxAmp) maxAmp = val;
        }

        const barH = Math.max(2, Math.min(44, maxAmp * 42));
        const y = (48 - barH) / 2;
        octx.fillRect(x, y, barWidth, barH);
      }
    } else {
      // Clean center guideline when no audio buffer is available
      octx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(0, 24);
      octx.lineTo(totalWidth, 24);
      octx.stroke();
    }

    cacheRef.current = { canvas: offscreen, zoom, totalWidth, buffer: audioBuffer };
  }, [totalWidth, zoom, audioBuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cache = cacheRef.current;
    if (cache) {
      ctx.drawImage(cache.canvas, 0, 0);

      const playheadX = currentTime * zoom;
      if (playheadX > 0 && audioBuffer) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, playheadX, 48);
        ctx.clip();

        const channelData = audioBuffer.getChannelData(0);
        const totalSamples = channelData.length;
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        const step = 4;
        const barWidth = 2;
        const numBars = Math.min(Math.floor(playheadX / step) + 1, Math.floor(totalWidth / step));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        for (let i = 0; i < numBars; i++) {
          const x = i * step;
          const t1 = x / zoom;
          const t2 = (x + barWidth) / zoom;
          if (t1 >= duration) break;

          const s1 = Math.min(totalSamples - 1, Math.max(0, Math.floor(t1 * sampleRate)));
          const s2 = Math.min(totalSamples, Math.max(s1 + 1, Math.floor(t2 * sampleRate)));

          let maxAmp = 0;
          const sampleStride = Math.max(1, Math.floor((s2 - s1) / 35));
          for (let s = s1; s < s2; s += sampleStride) {
            const val = Math.abs(channelData[s]);
            if (val > maxAmp) maxAmp = val;
          }

          const barH = Math.max(2, Math.min(44, maxAmp * 42));
          const y = (48 - barH) / 2;
          ctx.fillRect(x, y, barWidth, barH);
        }
        ctx.restore();
      }
    }
  }, [currentTime, zoom, totalWidth, audioBuffer]);

  return (
    <div className="relative w-full h-12 pointer-events-none">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-sans text-zinc-400 bg-black/40 z-10 animate-pulse">
          Decoding real audio waveform...
        </div>
      )}
      {!audioBuffer && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-sans text-zinc-600 z-10 select-none">
          No local audio loaded · Click Master Audio to import audio
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={48}
        className="absolute top-0 left-0 h-12 pointer-events-none"
      />
    </div>
  );
});
WaveformCanvas.displayName = 'WaveformCanvas';

export const ClassicNLEStudio: React.FC<ClassicNLEStudioProps> = React.memo(({
  doc,
  activeLineIndex,
  onSelectLine,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  onUpdateLineTiming,
  onSetLineLayer,
  onReorderLines,
  onUpdateMetadata,
  onUpdateLineText,
  onSetWordToken,
  onSetWordTokenText,
  onSetLineVocalist,
  onAddLine,
  onDeleteLine,
  onDivideLineIntoWords,
  onTokenizeLine,
  onToggleLineEmphasis,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  youtubeId,
  palette,
  monitorMode: propMonitorMode,
  onMonitorModeChange,
  wavesurfer,
  currentAudioFile,
  audioSourceMode = 'yt',
  onAudioSelect,
}) => {
  const lines = doc.lines;
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const binListRef = useRef<HTMLDivElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Check if YouTube is the audio source (hide waveform layer if true). In
  // Connect mode the downloaded track is a real file — decode it like local.
  const isYouTubeSource =
    audioSourceMode === 'yt' ||
    (audioSourceMode === 'connect' && !currentAudioFile) ||
    (!currentAudioFile && Boolean(youtubeId) && audioSourceMode !== 'local' && audioSourceMode !== 'stream');

  // Real Audio Waveform Decoded Buffer
  const [decodedAudioBuffer, setDecodedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecodingAudio, setIsDecodingAudio] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    if (currentAudioFile) {
      setIsDecodingAudio(true);
      currentAudioFile
        .arrayBuffer()
        .then((ab) => {
          if (isCancelled) return;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) {
            setIsDecodingAudio(false);
            return;
          }
          const ctx = new AudioCtx();
          ctx
            .decodeAudioData(ab)
            .then((buf) => {
              if (isCancelled) return;
              setDecodedAudioBuffer(buf);
              setIsDecodingAudio(false);
              ctx.close();
            })
            .catch((err) => {
              console.warn('[ClassicNLEStudio] decodeAudioData error:', err);
              if (!isCancelled) setIsDecodingAudio(false);
              ctx.close();
            });
        })
        .catch(() => {
          if (!isCancelled) setIsDecodingAudio(false);
        });
    } else if (wavesurfer) {
      const wsBuf = wavesurfer.getDecodedData();
      if (wsBuf) {
        setDecodedAudioBuffer(wsBuf);
      }
    } else {
      setDecodedAudioBuffer(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [currentAudioFile, wavesurfer]);

  useEffect(() => {
    if (!wavesurfer) return;
    const handleDecode = () => {
      const buf = wavesurfer.getDecodedData();
      if (buf) setDecodedAudioBuffer(buf);
    };
    wavesurfer.on('decode', handleDecode);
    return () => {
      wavesurfer.un('decode', handleDecode);
    };
  }, [wavesurfer]);

  // Active Tool & Mode
  const [activeTool, setActiveTool] = useState<NLETool>('select');
  const [isSnapping, setIsSnapping] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<'bin' | 'inspector'>('bin');
  const [localMonitorMode, setLocalMonitorMode] = useState<'video' | 'stage'>('video');
  const monitorMode = propMonitorMode !== undefined ? propMonitorMode : localMonitorMode;
  const setMonitorMode = useCallback((mode: 'video' | 'stage') => {
    setLocalMonitorMode(mode);
    onMonitorModeChange?.(mode);
  }, [onMonitorModeChange]);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Quick Lyric Draft Input (Lyrics Bin)
  const [newLyricDraft, setNewLyricDraft] = useState<string>('');

  // Direct Inline Lyric Editing (Line level)
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Direct Inline Word Token Editing
  const [editingWordToken, setEditingWordToken] = useState<{
    lineIndex: number;
    tokenIndex: number;
    text: string;
  } | null>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // Zoom: pixels per second (min 20, max 320, default 195)
  const [zoom, setZoom] = useState<number>(195);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);

  // Snap Indicator State
  const [snapIndicator, setSnapIndicator] = useState<SnapIndicatorState | null>(null);

  // Timeline Context Menu State (Right-click to insert line)
  const [timelineContextMenu, setTimelineContextMenu] = useState<{
    clientX: number;
    clientY: number;
    time: number;
    layerId: string;
  } | null>(null);

  // Collision Warning & Prompt State
  const [collisionPrompt, setCollisionPrompt] = useState<{
    lineIndex: number;
    suggestedGapTime: number;
    layerId: string;
  } | null>(null);

  // ── LAYERS ARCHITECTURE (Default 1 row, multi-layer capable) ──
  const [layers, setLayers] = useState<TimelineLayer[]>([
    { id: 'layer-1', name: 'Layer 1', isWordLaneExpanded: false },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-1');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [layerNameDraft, setLayerNameDraft] = useState<string>('');

  // Synchronize layers if song lines already specify layerId or distinct vocalists
  useEffect(() => {
    setLayers((prevLayers) => {
      const existingIds = new Set(prevLayers.map((l) => l.id));
      const toAdd: TimelineLayer[] = [];

      lines.forEach((l) => {
        const lid = l.layerId || (l.vocalist ? `layer-${l.vocalist}` : undefined);
        if (lid && !existingIds.has(lid)) {
          existingIds.add(lid);
          toAdd.push({
            id: lid,
            name: l.vocalist
              ? `${l.vocalist.charAt(0).toUpperCase() + l.vocalist.slice(1)}`
              : `Layer ${existingIds.size}`,
            isWordLaneExpanded: false,
          });
        }
      });

      return toAdd.length > 0 ? [...prevLayers, ...toAdd] : prevLayers;
    });
  }, [lines]);

  // Clip Dragging State (Transient visual preview, single-step commit on mouseup)
  const [draggingClip, setDraggingClip] = useState<{
    lineIndex: number;
    layerId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    initialX: number;
    initialY?: number;
    initialStart: number;
    initialEnd: number;
    currentStart: number;
    currentEnd: number;
    targetLayerIndex?: number;
  } | null>(null);

  // Lyrics Bin Drag-and-Drop Reorder State
  const [draggedBinIndex, setDraggedBinIndex] = useState<number | null>(null);
  const [dropTargetBinIndex, setDropTargetBinIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // Group lines by layer (with live target layer preview during vertical dragging)
  const linesByLayer = useMemo(() => {
    const map = new Map<string, Array<{ line: LyricLine; index: number }>>();
    layers.forEach((l) => map.set(l.id, []));

    lines.forEach((line, index) => {
      let lid = line.layerId || (line.vocalist ? `layer-${line.vocalist}` : (layers[0]?.id || 'layer-1'));

      // If this line is actively moving, redirect it to target layer row preview
      if (draggingClip && draggingClip.lineIndex === index && draggingClip.mode === 'move') {
        if (typeof draggingClip.targetLayerIndex === 'number') {
          if (draggingClip.targetLayerIndex < layers.length) {
            lid = layers[draggingClip.targetLayerIndex]?.id || lid;
          } else {
            lid = '__new_layer__';
          }
        }
      }

      if (!map.has(lid)) {
        map.set(lid, []);
      }
      map.get(lid)!.push({ line, index });
    });

    map.forEach((items) => {
      items.sort((a, b) => a.line.start - b.line.start);
    });

    return map;
  }, [layers, lines, draggingClip]);

  // Video Previewer Drag-and-Drop & Media State
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localVideoName, setLocalVideoName] = useState<string | null>(null);
  const [isDraggingOverMonitor, setIsDraggingOverMonitor] = useState<boolean>(false);
  const [mediaErrorMessage, setMediaErrorMessage] = useState<string | null>(null);
  const [ytInputUrl, setYtInputUrl] = useState<string>('');
  const [isYtInputOpen, setIsYtInputOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [localVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !localVideoUrl) return;

    try {
      if (Math.abs(video.currentTime - currentTime) > 0.25) {
        video.currentTime = currentTime;
      }
      if (isPlaying && video.paused) {
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    } catch {
      // Safe fallback
    }
  }, [currentTime, isPlaying, localVideoUrl]);

  // Token Dragging State (Transient visual preview, single-step commit on mouseup)
  const [draggingToken, setDraggingToken] = useState<{
    lineIndex: number;
    tokenIndex: number;
    mode: 'move' | 'trim-start' | 'trim-end';
    initialX: number;
    initialStart: number;
    initialEnd: number;
    currentStart: number;
    currentEnd: number;
    lineStart: number;
    lineEnd: number;
  } | null>(null);

  const draggingClipRef = useRef(draggingClip);
  draggingClipRef.current = draggingClip;

  const draggingTokenRef = useRef(draggingToken);
  draggingTokenRef.current = draggingToken;

  // Close context menu on outside click
  useEffect(() => {
    if (!timelineContextMenu) return;
    const handleOutside = () => setTimelineContextMenu(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [timelineContextMenu]);

  // Notify YouTubeCornerEmbed of NLE program monitor viewport mounting & size changes
  useEffect(() => {
    const notify = () => {
      window.dispatchEvent(new CustomEvent('nle-viewport-resize'));
    };
    notify();
    const t1 = setTimeout(notify, 50);
    const t2 = setTimeout(notify, 150);
    const t3 = setTimeout(notify, 300);

    const vpEl = document.getElementById('nle-program-monitor-viewport');
    let ro: ResizeObserver | null = null;
    if (vpEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(notify);
      ro.observe(vpEl);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
    };
  }, []);

  // Effective Duration Calculation
  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      return Math.max(lastLine.end + 10, 120);
    }
    return 180;
  }, [duration, lines]);

  const totalWidth = useMemo(() => {
    return Math.max(effectiveDuration * zoom, 1200);
  }, [effectiveDuration, zoom]);

  // Selected Line
  const selectedLine = activeLineIndex !== null && activeLineIndex >= 0 && activeLineIndex < lines.length
    ? lines[activeLineIndex]
    : null;

  // Filtered Lines for the Lyrics Bin
  const filteredBinLines = useMemo(() => {
    if (!searchFilter.trim()) {
      return lines.map((line, idx) => ({ line, idx }));
    }
    const q = searchFilter.toLowerCase();
    return lines
      .map((line, idx) => ({ line, idx }))
      .filter(({ line }) => line.text.toLowerCase().includes(q));
  }, [lines, searchFilter]);

  // Ruler Tick Marks (Adaptive based on zoom level)
  const rulerTicks = useMemo(() => {
    const ticks: Array<{ time: number; label: string; isMajor: boolean; isSub: boolean }> = [];
    const step = zoom >= 90 ? 1 : zoom >= 50 ? 2 : zoom >= 30 ? 5 : 10;
    const maxSec = Math.ceil(effectiveDuration);

    for (let t = 0; t <= maxSec; t += step) {
      const isMajor = t % (step * 2) === 0;
      ticks.push({
        time: t,
        label: formatSMPTE(t).slice(3), // MM:SS:FF
        isMajor,
        isSub: false,
      });

      // Frame sub-ticks when zoomed in
      if (zoom >= 80 && t + step <= maxSec) {
        for (let sub = 1; sub < 4; sub++) {
          const subT = t + (step / 4) * sub;
          ticks.push({
            time: subT,
            label: '',
            isMajor: false,
            isSub: true,
          });
        }
      }
    }
    return ticks;
  }, [effectiveDuration, zoom]);

  // ── MAGNETIC SNAPPING & EDGE DETECTION HELPER ──
  // Gentle, secondary snap that assists rather than overrides normal sliding
  const getSnapResult = useCallback((
    rawTime: number,
    excludeLineIndex?: number,
    isRulerScrub?: boolean
  ): { snappedTime: number; targetLabel: string | null } => {
    if (!isSnapping) return { snappedTime: rawTime, targetLabel: null };
    const thresholdSec = 6 / zoom; // ~6px refined magnetic capture zone (silky smooth glide)

    // 1. Playhead priority
    if (!isDraggingPlayhead && Math.abs(rawTime - currentTime) < thresholdSec) {
      return { snappedTime: currentTime, targetLabel: `Playhead (${formatPrecise(currentTime)})` };
    }

    // 2. Adjacent clip boundaries across layers (within 8px)
    for (let i = 0; i < lines.length; i++) {
      if (i === excludeLineIndex) continue;
      const l = lines[i];
      if (Math.abs(rawTime - l.start) < thresholdSec) {
        return { snappedTime: l.start, targetLabel: `Line #${i + 1} (${formatPrecise(l.start)})` };
      }
      if (Math.abs(rawTime - l.end) < thresholdSec) {
        return { snappedTime: l.end, targetLabel: `Line #${i + 1} (${formatPrecise(l.end)})` };
      }
    }

    // 3. Rounded timeline seconds (grid markers) ONLY when explicitly scrubbing ruler
    if (isRulerScrub) {
      const nearestSec = Math.round(rawTime);
      if (Math.abs(rawTime - nearestSec) < thresholdSec) {
        return { snappedTime: nearestSec, targetLabel: `Grid (${formatSMPTE(nearestSec).slice(3)})` };
      }
    }

    return { snappedTime: rawTime, targetLabel: null };
  }, [isSnapping, zoom, currentTime, isDraggingPlayhead, lines]);

  // Media Drop & Link YouTube Handlers
  const handleMediaFile = useCallback(
    (file: File) => {
      try {
        setMediaErrorMessage(null);
        const name = file.name.toLowerCase();
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(name);
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name);

        if (isVideo) {
          if (localVideoUrl) {
            URL.revokeObjectURL(localVideoUrl);
          }
          const url = URL.createObjectURL(file);
          setLocalVideoUrl(url);
          setLocalVideoName(file.name);
          setMonitorMode('video');
          if (onAudioSelect) {
            onAudioSelect(file);
          }
        } else if (isAudio) {
          if (onAudioSelect) {
            onAudioSelect(file);
          }
          if (localVideoUrl) {
            URL.revokeObjectURL(localVideoUrl);
            setLocalVideoUrl(null);
            setLocalVideoName(null);
          }
        } else {
          setMediaErrorMessage(`Unsupported format (${file.name}). Please drop an audio or video file.`);
        }
      } catch (err: any) {
        console.error('Error handling media file', err);
        setMediaErrorMessage(`Failed to load file: ${err?.message || 'Unsupported format'}`);
      }
    },
    [localVideoUrl, onAudioSelect, setMonitorMode]
  );

  const handlePasteYoutube = useCallback(
    (raw: string) => {
      try {
        const trimmed = raw.trim();
        if (!trimmed) return;
        let id = '';
        const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (watchMatch) id = watchMatch[1];
        else if (shortMatch) id = shortMatch[1];
        else if (embedMatch) id = embedMatch[1];
        else if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) id = trimmed;

        if (id) {
          if (onUpdateMetadata) {
            onUpdateMetadata({ youtubeId: id });
          }
          if (localVideoUrl) {
            URL.revokeObjectURL(localVideoUrl);
            setLocalVideoUrl(null);
            setLocalVideoName(null);
          }
          setYtInputUrl('');
          setIsYtInputOpen(false);
          setMediaErrorMessage(null);
          setMonitorMode('video');
        } else {
          setMediaErrorMessage('Could not recognize YouTube URL or 11-char ID.');
        }
      } catch (err: any) {
        console.error('Failed to link YouTube video', err);
        setMediaErrorMessage('Failed to link YouTube video.');
      }
    },
    [localVideoUrl, onUpdateMetadata, setMonitorMode]
  );

  // Handle Playhead Scrubbing via Ruler / Canvas click with Snap
  const handleScrubStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const scrollContainer = trackScrollRef.current;
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
    const rawTargetTime = Math.max(0, Math.min(clickX / zoom, effectiveDuration));
    const { snappedTime, targetLabel } = getSnapResult(rawTargetTime, undefined, true);
    onSeek(snappedTime);
    setSnapIndicator(targetLabel ? { time: snappedTime, label: targetLabel } : null);
    setIsDraggingPlayhead(true);
  }, [zoom, effectiveDuration, onSeek, getSnapResult]);

  // Global mousemove & mouseup for playhead scrubbing & clip trimming/moving (silky smooth with rAF coalescing)
  useEffect(() => {
    if (!isDraggingPlayhead && !draggingClip && !draggingToken) return;

    let rafId: number | null = null;
    let latestMouseEvent: MouseEvent | null = null;

    // Lock cursor and text selection globally for buttery, uninterrupted dragging
    const origUserSelect = document.body.style.userSelect;
    const origCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    if (isDraggingPlayhead) {
      document.body.style.cursor = 'ew-resize';
    } else if (draggingClip) {
      document.body.style.cursor = draggingClip.mode === 'move' ? 'grabbing' : 'ew-resize';
    } else if (draggingToken) {
      document.body.style.cursor = draggingToken.mode === 'move' ? 'grabbing' : 'ew-resize';
    }

    const processMove = () => {
      rafId = null;
      const e = latestMouseEvent;
      if (!e) return;

      if (isDraggingPlayhead) {
        const scrollContainer = trackScrollRef.current;
        if (!scrollContainer) return;
        const rect = scrollContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
        const rawTargetTime = Math.max(0, Math.min(clickX / zoom, effectiveDuration));
        const { snappedTime, targetLabel } = getSnapResult(rawTargetTime, undefined, true);
        onSeek(snappedTime);
        setSnapIndicator(targetLabel ? { time: snappedTime, label: targetLabel } : null);
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.initialX;
        const deltaTime = deltaX / zoom;
        const line = lines[draggingClip.lineIndex];
        if (!line) return;

        const clipDuration = draggingClip.initialEnd - draggingClip.initialStart;
        const isBypassed = e.altKey || e.shiftKey;

        if (draggingClip.mode === 'move') {
          // Vertical layer shifting detection
          const deltaY = e.clientY - (draggingClip.initialY ?? e.clientY);
          const fromLayerIdx = layers.findIndex((l) => l.id === draggingClip.layerId);
          const layerShift = Math.round(deltaY / LAYER_ROW_HEIGHT);
          let targetIdx = (fromLayerIdx >= 0 ? fromLayerIdx : 0) + layerShift;
          if (targetIdx < 0) targetIdx = 0;
          targetIdx = Math.min(targetIdx, layers.length);

          // Free smooth horizontal slide
          const rawNewStart = Math.max(0, draggingClip.initialStart + deltaTime);
          let finalStart = rawNewStart;
          let activeSnap: SnapIndicatorState | null = null;

          if (isSnapping && !isBypassed) {
            const startSnap = getSnapResult(rawNewStart, draggingClip.lineIndex, false);
            const endSnap = getSnapResult(rawNewStart + clipDuration, draggingClip.lineIndex, false);

            if (startSnap.targetLabel) {
              finalStart = startSnap.snappedTime;
              activeSnap = { time: startSnap.snappedTime, label: startSnap.targetLabel };
            } else if (endSnap.targetLabel) {
              finalStart = endSnap.snappedTime - clipDuration;
              activeSnap = { time: endSnap.snappedTime, label: endSnap.targetLabel };
            }
          }

          finalStart = Math.max(0, finalStart);
          const finalEnd = finalStart + clipDuration;

          setSnapIndicator(activeSnap);
          setDraggingClip((prev) => prev ? {
            ...prev,
            currentStart: finalStart,
            currentEnd: finalEnd,
            targetLayerIndex: targetIdx,
          } : null);
          draggingClipRef.current = {
            ...draggingClip,
            currentStart: finalStart,
            currentEnd: finalEnd,
            targetLayerIndex: targetIdx,
          };
        } else if (draggingClip.mode === 'trim-start') {
          const isBypassed = e.altKey || e.shiftKey;
          const rawStart = Math.max(0, Math.min(draggingClip.initialStart + deltaTime, draggingClip.initialEnd - 0.2));
          const snap = isBypassed ? { snappedTime: rawStart, targetLabel: null } : getSnapResult(rawStart, draggingClip.lineIndex, false);
          const finalStart = Math.max(0, Math.min(snap.snappedTime, draggingClip.initialEnd - 0.2));

          setSnapIndicator(snap.targetLabel ? { time: snap.snappedTime, label: snap.targetLabel } : null);
          setDraggingClip((prev) => prev ? {
            ...prev,
            currentStart: finalStart,
            currentEnd: prev.initialEnd,
          } : null);
          draggingClipRef.current = { ...draggingClip, currentStart: finalStart, currentEnd: draggingClip.initialEnd };
        } else if (draggingClip.mode === 'trim-end') {
          const isBypassed = e.altKey || e.shiftKey;
          const rawEnd = Math.max(draggingClip.initialStart + 0.2, draggingClip.initialEnd + deltaTime);
          const snap = isBypassed ? { snappedTime: rawEnd, targetLabel: null } : getSnapResult(rawEnd, draggingClip.lineIndex, false);
          const finalEnd = Math.max(draggingClip.initialStart + 0.2, snap.snappedTime);

          setSnapIndicator(snap.targetLabel ? { time: snap.snappedTime, label: snap.targetLabel } : null);
          setDraggingClip((prev) => prev ? {
            ...prev,
            currentStart: prev.initialStart,
            currentEnd: finalEnd,
          } : null);
          draggingClipRef.current = { ...draggingClip, currentStart: draggingClip.initialStart, currentEnd: finalEnd };
        }
      } else if (draggingToken && onSetWordToken) {
        const deltaX = e.clientX - draggingToken.initialX;
        const deltaTime = deltaX / zoom;
        const line = lines[draggingToken.lineIndex];
        if (!line || !line.tokens || line.tokens.length === 0) return;
        const tokens = line.tokens;
        const tIdx = draggingToken.tokenIndex;
        const token = tokens[tIdx];
        if (!token) return;

        const isBypassed = e.altKey || e.shiftKey;
        const lineStart = line.start;
        const lineEnd = line.end;
        const tokenDur = Math.max(0.04, draggingToken.initialEnd - draggingToken.initialStart);

        // Strict parent lyrics box boundary limits
        const minAllowedStart = tIdx === 0 ? lineStart : (tokens[tIdx - 1]?.start ?? lineStart) + 0.04;
        const maxAllowedEnd = tIdx === tokens.length - 1 ? lineEnd : (tokens[tIdx + 1]?.end ?? lineEnd) - 0.04;
        const maxAllowedStart = Math.max(minAllowedStart, maxAllowedEnd - tokenDur);

        if (draggingToken.mode === 'move') {
          let rawStart = draggingToken.initialStart + deltaTime;

          // Gentle snap for word to playhead
          if (isSnapping && !isBypassed) {
            const wordSnapThresh = 6 / zoom;
            if (Math.abs(rawStart - currentTime) < wordSnapThresh) {
              rawStart = currentTime;
            } else if (Math.abs(rawStart + tokenDur - currentTime) < wordSnapThresh) {
              rawStart = currentTime - tokenDur;
            }
          }

          let finalStart: number;
          let finalEnd: number;

          if (tIdx === 0 && tokens.length > 1) {
            // First word cannot pull away from the start of the lyrics box; dragging it adjusts its end/duration
            finalStart = lineStart;
            const targetEnd = draggingToken.initialEnd + deltaTime;
            const maxWord0End = tokens[1]?.end ? tokens[1].end - 0.04 : lineEnd;
            finalEnd = Math.max(lineStart + 0.04, Math.min(maxWord0End, targetEnd));
          } else if (tIdx === tokens.length - 1 && tokens.length > 1) {
            // Last word cannot spill past the end of the lyrics box; dragging it adjusts its start/duration
            finalEnd = lineEnd;
            const targetStart = draggingToken.initialStart + deltaTime;
            const minLastStart = tokens[tIdx - 1]?.start ? tokens[tIdx - 1].start + 0.04 : lineStart;
            finalStart = Math.min(lineEnd - 0.04, Math.max(minLastStart, targetStart));
          } else {
            // Middle word or sole word: stays strictly locked within its neighbor bounds inside the box
            finalStart = Math.max(minAllowedStart, Math.min(maxAllowedStart, rawStart));
            finalEnd = Math.min(maxAllowedEnd, finalStart + tokenDur);
          }

          setDraggingToken((prev) => (prev ? { ...prev, currentStart: finalStart, currentEnd: finalEnd } : null));
          draggingTokenRef.current = { ...draggingToken, currentStart: finalStart, currentEnd: finalEnd };
        } else if (draggingToken.mode === 'trim-start') {
          let rawStart = draggingToken.initialStart + deltaTime;
          if (isSnapping && !isBypassed) {
            const wordSnapThresh = 6 / zoom;
            if (Math.abs(rawStart - currentTime) < wordSnapThresh) {
              rawStart = currentTime;
            }
          }

          const maxTrimStart = draggingToken.initialEnd - 0.04;
          const finalStart = Math.max(minAllowedStart, Math.min(maxTrimStart, rawStart));

          setDraggingToken((prev) => (prev ? { ...prev, currentStart: finalStart, currentEnd: prev.initialEnd } : null));
          draggingTokenRef.current = { ...draggingToken, currentStart: finalStart, currentEnd: draggingToken.initialEnd };
        } else if (draggingToken.mode === 'trim-end') {
          let rawEnd = draggingToken.initialEnd + deltaTime;
          if (isSnapping && !isBypassed) {
            const wordSnapThresh = 6 / zoom;
            if (Math.abs(rawEnd - currentTime) < wordSnapThresh) {
              rawEnd = currentTime;
            }
          }

          const minTrimEnd = draggingToken.initialStart + 0.04;
          const finalEnd = Math.max(minTrimEnd, Math.min(maxAllowedEnd, rawEnd));

          setDraggingToken((prev) => (prev ? { ...prev, currentStart: prev.initialStart, currentEnd: finalEnd } : null));
          draggingTokenRef.current = { ...draggingToken, currentStart: draggingToken.initialStart, currentEnd: finalEnd };
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      latestMouseEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        if (latestMouseEvent) {
          processMove();
        }
      }

      document.body.style.userSelect = origUserSelect;
      document.body.style.cursor = origCursor;

      setIsDraggingPlayhead(false);
      setSnapIndicator(null);

      const activeClip = draggingClipRef.current;
      if (activeClip) {
        let finalLayerId = activeClip.layerId;
        if (activeClip.mode === 'move' && typeof activeClip.targetLayerIndex === 'number') {
          if (activeClip.targetLayerIndex >= layers.length) {
            const newLayerNum = layers.length + 1;
            const newId = `layer-${Date.now()}`;
            const newLayer: TimelineLayer = { id: newId, name: `Layer ${newLayerNum}`, isWordLaneExpanded: false };
            setLayers((prev) => [...prev, newLayer]);
            finalLayerId = newId;
          } else if (activeClip.targetLayerIndex >= 0 && activeClip.targetLayerIndex < layers.length) {
            finalLayerId = layers[activeClip.targetLayerIndex].id;
          }
        }

        const roundedStart = Number(activeClip.currentStart.toFixed(3));
        const roundedEnd = Number(activeClip.currentEnd.toFixed(3));
        const hasMoved =
          Math.abs(roundedStart - activeClip.initialStart) > 0.001 ||
          Math.abs(roundedEnd - activeClip.initialEnd) > 0.001 ||
          finalLayerId !== activeClip.layerId;

        if (hasMoved) {
          onUpdateLineTiming(activeClip.lineIndex, roundedStart, roundedEnd, finalLayerId);
          if (onSetLineLayer && finalLayerId !== activeClip.layerId) {
            onSetLineLayer(activeClip.lineIndex, finalLayerId);
          }
        }
        setDraggingClip(null);
        draggingClipRef.current = null;
      }

      const activeTok = draggingTokenRef.current;
      if (activeTok && onSetWordToken) {
        const roundedStart = Number(activeTok.currentStart.toFixed(3));
        const roundedEnd = Number(activeTok.currentEnd.toFixed(3));
        const hasMoved =
          Math.abs(roundedStart - activeTok.initialStart) > 0.001 ||
          Math.abs(roundedEnd - activeTok.initialEnd) > 0.001;
        if (hasMoved) {
          onSetWordToken(activeTok.lineIndex, activeTok.tokenIndex, roundedStart, roundedEnd);
        }
        setDraggingToken(null);
        draggingTokenRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.body.style.userSelect = origUserSelect;
      document.body.style.cursor = origCursor;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDraggingPlayhead,
    draggingClip,
    draggingToken,
    zoom,
    effectiveDuration,
    onSeek,
    lines,
    linesByLayer,
    onUpdateLineTiming,
    onSetWordToken,
    getSnapResult,
  ]);

  // Smooth horizontal auto-scroll to keep playhead in view during active playback
  const lastAutoScrollTimeRef = useRef(0);
  useEffect(() => {
    if (!isPlaying || !trackScrollRef.current || isDraggingPlayhead) return;
    const playheadX = currentTime * zoom;
    const scrollLeft = trackScrollRef.current.scrollLeft;
    const containerWidth = trackScrollRef.current.clientWidth;

    const now = performance.now();
    if (playheadX > scrollLeft + containerWidth - 140) {
      if (now - lastAutoScrollTimeRef.current > 350) {
        lastAutoScrollTimeRef.current = now;
        const newScrollLeft = Math.max(0, playheadX - containerWidth * 0.35);
        trackScrollRef.current.scrollTo({
          left: newScrollLeft,
          top: trackScrollRef.current.scrollTop,
          behavior: 'smooth',
        });
      }
    } else if (playheadX < scrollLeft - 60) {
      if (now - lastAutoScrollTimeRef.current > 350) {
        lastAutoScrollTimeRef.current = now;
        trackScrollRef.current.scrollTo({
          left: Math.max(0, playheadX - containerWidth * 0.2),
          top: trackScrollRef.current.scrollTop,
          behavior: 'smooth',
        });
      }
    }
  }, [currentTime, zoom, isPlaying, isDraggingPlayhead]);

  // Razor tool click handler: Splits line into two at the click position
  const handleRazorClip = useCallback((lineIndex: number, clickTime: number) => {
    const line = lines[lineIndex];
    if (!line || clickTime <= line.start + 0.2 || clickTime >= line.end - 0.2) return;

    const isJp = isJapaneseText(line.text) && !/\s/.test(line.text);
    const words = tokenizeLineIntoWords(line.text);
    const midWordIdx = Math.max(1, Math.floor(words.length / 2));
    const firstText = words.slice(0, midWordIdx).join(isJp ? '' : ' ') || line.text;
    const secondText = words.slice(midWordIdx).join(isJp ? '' : ' ') || '...';

    onUpdateLineTiming(lineIndex, line.start, Number(clickTime.toFixed(3)));
    onUpdateLineText(lineIndex, firstText);

    if (onAddLine) {
      const lid = line.layerId || (line.vocalist ? `layer-${line.vocalist}` : 'layer-1');
      onAddLine(lineIndex, secondText, Number(clickTime.toFixed(3)), line.end, lid);
    }
  }, [lines, onUpdateLineTiming, onUpdateLineText, onAddLine]);

  // Frame Step Helpers (at 30fps = ~0.0333s)
  const stepFrame = useCallback((forward: boolean) => {
    const delta = forward ? 1 / 30 : -1 / 30;
    const newTime = Math.max(0, Math.min(effectiveDuration, currentTime + delta));
    onSeek(Number(newTime.toFixed(3)));
  }, [currentTime, effectiveDuration, onSeek]);

  // Jump to start / end of selected line
  const jumpToLineBoundary = useCallback((end: boolean) => {
    if (!selectedLine) return;
    onSeek(end ? selectedLine.end : selectedLine.start);
  }, [selectedLine, onSeek]);

  // Loop current selected clip
  const loopSelectedClip = useCallback(() => {
    if (!selectedLine) return;
    onSeek(selectedLine.start);
  }, [selectedLine, onSeek]);

  // ── QUICK ADD LYRIC (Lyrics Bin input) ──
  const handleQuickAddLyric = useCallback(() => {
    const text = newLyricDraft.trim() || 'New lyric line...';
    let start = 0;
    let end = 3.0;

    if (isPlaying) {
      start = Number(currentTime.toFixed(3));
      end = Number((currentTime + 2.5).toFixed(3));
    } else if (lines.length > 0) {
      const last = lines[lines.length - 1];
      if (currentTime > last.end) {
        start = Number(currentTime.toFixed(3));
        end = Number((currentTime + 2.8).toFixed(3));
      } else {
        start = Number((last.end + 0.3).toFixed(3));
        end = Number((last.end + 3.1).toFixed(3));
      }
    } else {
      start = Number(currentTime.toFixed(3));
      end = Number((currentTime + 3.0).toFixed(3));
    }

    if (onAddLine) {
      onAddLine(lines.length - 1, text, start, end, activeLayerId);
      setNewLyricDraft('');
      setTimeout(() => {
        quickAddInputRef.current?.focus();
        if (binListRef.current) {
          binListRef.current.scrollTo({ top: binListRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [newLyricDraft, isPlaying, currentTime, lines, onAddLine, activeLayerId]);

  // ── TIMELINE RIGHT CLICK CONTEXT MENU HANDLER ──
  const handleTimelineContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>, layerId: string) => {
    e.preventDefault();
    const scrollContainer = trackScrollRef.current;
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
    const rawTime = Math.max(0, Math.min(clickX / zoom, effectiveDuration));
    const { snappedTime } = getSnapResult(rawTime);

    setTimelineContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      time: Number(snappedTime.toFixed(3)),
      layerId,
    });
  }, [zoom, effectiveDuration, getSnapResult]);

  // Insert line from Timeline Context Menu
  const handleContextMenuAddLine = useCallback((time: number, layerId: string) => {
    if (!onAddLine) return;
    const layerClips = linesByLayer.get(layerId) || [];
    const nextClip = layerClips.find((c) => c.line.start > time);
    const maxDur = nextClip ? Math.max(0.4, nextClip.line.start - time - 0.05) : 2.8;
    const durationToUse = Math.min(2.8, maxDur);
    const end = Number((time + durationToUse).toFixed(3));

    // Find afterIndex
    let afterIdx = lines.length - 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start > time) {
        afterIdx = Math.max(0, i - 1);
        break;
      }
    }

    onAddLine(afterIdx, 'New lyric line...', time, end, layerId);
    setTimeout(() => {
      const newIdx = afterIdx + 1;
      onSelectLine(newIdx);
      setEditingLineIndex(newIdx);
      setEditingText('');
    }, 60);
  }, [onAddLine, lines, linesByLayer, onSelectLine]);

  // ── LAYER MANAGEMENT ACTIONS ──
  const handleAddLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    const newName = `Layer ${layers.length + 1}`;
    setLayers((prev) => [...prev, { id: newId, name: newName, isWordLaneExpanded: false }]);
    setActiveLayerId(newId);
  }, [layers]);

  const handleRenameLayer = useCallback((layerId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l))
    );
    setEditingLayerId(null);
  }, []);

  const handleDeleteLayer = useCallback((layerId: string) => {
    if (layers.length <= 1) return;
    // Check if layer has clips
    const clips = linesByLayer.get(layerId) || [];
    if (clips.length > 0) {
      if (!window.confirm(`Delete ${layerId} and all ${clips.length} clip(s) on it?`)) return;
      if (onDeleteLine) {
        // Delete in reverse order
        const indices = clips.map((c) => c.index).sort((a, b) => b - a);
        indices.forEach((idx) => onDeleteLine(idx));
      }
    }
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    setActiveLayerId(layers[0]?.id || 'layer-1');
  }, [layers, linesByLayer, onDeleteLine]);

  const toggleWordLaneExpansion = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === layerId ? { ...l, isWordLaneExpanded: !l.isWordLaneExpanded } : l
      )
    );
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090c] text-zinc-200 select-none overflow-hidden font-sans">
      {/* ── TOP DECK: DUAL-PANE WORKSPACE (50% HEIGHT) ────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 border-b border-white/[0.08] bg-[#0b0b0e]">
        
        {/* ── LEFT PANE: PROJECT BIN & CLIP INSPECTOR (42% width) ── */}
        <div className="w-full md:w-[42%] flex flex-col border-r border-white/[0.08] bg-[#0c0c10] min-h-0">
          {/* Panel Header Tabs */}
          <div className="h-9 px-3 border-b border-white/[0.06] bg-[#0f0f14] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLeftTab('bin')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  leftTab === 'bin'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lyrics Bin ({lines.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setLeftTab('inspector')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  leftTab === 'inspector'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Clip Inspector</span>
              </button>
            </div>

            {/* Quick Add Line */}
            {onAddLine && (
              <button
                type="button"
                onClick={handleQuickAddLyric}
                title="Add new lyric clip"
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white text-zinc-300 hover:text-zinc-950 text-[11px] font-medium transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Add Clip</span>
              </button>
            )}
          </div>

          {/* Panel Body: Lyrics Bin */}
          {leftTab === 'bin' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search input in Bin */}
              <div className="p-2 border-b border-white/[0.04] bg-[#0a0a0d] shrink-0">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter clips by text..."
                  className="w-full h-7 px-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Scrollable Clip List */}
              <div ref={binListRef} className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
                {filteredBinLines.map(({ line, idx }) => {
                  const isSelected = activeLineIndex === idx;
                  const dur = line.end - line.start;
                  const layerBadge = line.vocalist || (line.layerId ? line.layerId.replace('layer-', 'L') : 'L1');
                  const isTarget = dropTargetBinIndex === idx;
                  const isBeingDragged = draggedBinIndex === idx;

                  return (
                    <div
                      key={line.id || idx}
                      draggable={editingLineIndex !== idx}
                      onDragStart={(e) => {
                        if (editingLineIndex === idx) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData('text/plain', String(idx));
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedBinIndex(idx);
                      }}
                      onDragOver={(e) => {
                        if (draggedBinIndex === null || draggedBinIndex === idx) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isAfter = e.clientY > rect.top + rect.height / 2;
                        setDropTargetBinIndex(idx);
                        setDropPosition(isAfter ? 'after' : 'before');
                      }}
                      onDragLeave={() => {
                        if (dropTargetBinIndex === idx) {
                          setDropTargetBinIndex(null);
                          setDropPosition(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedBinIndex !== null && onReorderLines) {
                          let toIdx = idx;
                          if (draggedBinIndex < idx) {
                            toIdx = dropPosition === 'after' ? idx : Math.max(0, idx - 1);
                          } else if (draggedBinIndex > idx) {
                            toIdx = dropPosition === 'before' ? idx : Math.min(lines.length - 1, idx + 1);
                          }
                          if (toIdx !== draggedBinIndex) {
                            onReorderLines(draggedBinIndex, toIdx);
                            onSelectLine(toIdx);
                          }
                        }
                        setDraggedBinIndex(null);
                        setDropTargetBinIndex(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedBinIndex(null);
                        setDropTargetBinIndex(null);
                        setDropPosition(null);
                      }}
                      onClick={() => {
                        onSelectLine(idx);
                        onSeek(line.start);
                      }}
                      className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all group/binrow relative ${
                        isBeingDragged
                          ? 'opacity-35 bg-black/50 border border-dashed border-zinc-600'
                          : isTarget && dropPosition === 'before'
                          ? 'border-t-2 border-t-cyan-400 bg-cyan-950/20 shadow-[0_-2px_8px_rgba(34,211,238,0.4)]'
                          : isTarget && dropPosition === 'after'
                          ? 'border-b-2 border-b-cyan-400 bg-cyan-950/20 shadow-[0_2px_8px_rgba(34,211,238,0.4)]'
                          : isSelected
                          ? 'bg-white/[0.08] border-l-2 border-white text-white'
                          : 'hover:bg-white/[0.03] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {/* Drag Handle */}
                        <div
                          title="Drag up/down to reorder"
                          className="p-0.5 -ml-1 text-zinc-600 group-hover/binrow:text-zinc-300 cursor-grab active:cursor-grabbing shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Line Number */}
                        <span className={`text-[10px] font-sans w-5 shrink-0 text-right ${isSelected ? 'text-white font-bold' : 'text-zinc-500'}`}>
                          {idx + 1}
                        </span>

                        {/* Layer Badge */}
                        <span
                          className={`text-[9px] font-sans px-1 py-0.2 rounded shrink-0 border uppercase ${
                            isSelected
                              ? 'bg-white text-zinc-950 border-white font-bold'
                              : 'bg-white/5 text-zinc-400 border-white/10'
                          }`}
                        >
                          {layerBadge}
                        </span>

                        {editingLineIndex === idx ? (
                          <div
                            className="flex-1 flex items-center gap-1.5 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              ref={inlineInputRef}
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  onUpdateLineText(idx, editingText);
                                  setEditingLineIndex(null);
                                } else if (e.key === 'Escape') {
                                  setEditingLineIndex(null);
                                }
                              }}
                              onBlur={() => {
                                if (editingText !== line.text) {
                                  onUpdateLineText(idx, editingText);
                                }
                                setEditingLineIndex(null);
                              }}
                              autoFocus
                              placeholder="Enter lyrics text..."
                              className="flex-1 h-6 px-2 rounded bg-black/80 border border-white/40 text-xs text-white font-medium focus:outline-none focus:border-white shadow-inner select-text"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateLineText(idx, editingText);
                                setEditingLineIndex(null);
                              }}
                              title="Save (Enter)"
                              className="p-1 rounded bg-white text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLine(idx);
                              onSeek(line.start);
                              setEditingLineIndex(idx);
                              setEditingText(line.text);
                            }}
                            title="Click to edit lyrics directly"
                            className="flex-1 flex items-center justify-between min-w-0 group/text cursor-text py-0.5 rounded hover:bg-white/[0.04] px-1 transition-colors"
                          >
                            <span className={`text-xs truncate font-medium ${isSelected ? 'text-white font-semibold' : 'text-zinc-200 group-hover/text:text-white'}`}>
                              {line.text || <span className="italic text-zinc-600">(empty line - click to edit)</span>}
                            </span>
                            <span className="opacity-0 group-hover/text:opacity-100 text-[10px] text-zinc-400 font-sans transition-opacity shrink-0 ml-1.5 flex items-center gap-0.5">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>edit</span>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Hover Shift Nudge Buttons */}
                        {onReorderLines && (
                          <div className="opacity-0 group-hover/binrow:opacity-100 flex items-center gap-0.5 transition-opacity">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReorderLines(idx, idx - 1);
                                onSelectLine(idx - 1);
                              }}
                              title="Shift line up (↑)"
                              className="p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === lines.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReorderLines(idx, idx + 1);
                                onSelectLine(idx + 1);
                              }}
                              title="Shift line down (↓)"
                              className="p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <span className="text-[10px] font-sans text-zinc-500 tabular-nums">
                          {formatPrecise(line.start)}
                        </span>

                        <span className="text-[10px] font-sans text-zinc-600 tabular-nums w-10 text-right">
                          {dur > 0 ? `${dur.toFixed(1)}s` : '0s'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── CLEAN SLEEK QUICK-INPUT ROW AT BOTTOM OF LYRICS BIN ── */}
              <div className="p-2 border-t border-white/[0.06] bg-[#09090d] shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleQuickAddLyric();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-[10px] font-sans font-bold text-zinc-500 w-5 text-right shrink-0">
                    #{lines.length + 1}
                  </span>
                  <input
                    ref={quickAddInputRef}
                    type="text"
                    value={newLyricDraft}
                    onChange={(e) => setNewLyricDraft(e.target.value)}
                    placeholder="Type lyric line and press Enter to add..."
                    className="flex-1 h-7 px-2.5 rounded-lg bg-black/50 border border-white/[0.08] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors select-text"
                  />
                  <button
                    type="submit"
                    title="Add Lyric Line (Enter)"
                    className="h-7 px-2.5 rounded-lg bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors text-xs flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Panel Body: Clip Inspector */}
          {leftTab === 'inspector' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
              {selectedLine ? (
                <>
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-white font-sans font-bold">#{activeLineIndex! + 1}</span>
                      <span>Clip Properties</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {onReorderLines && activeLineIndex !== null && (
                        <div className="flex items-center gap-0.5 mr-1 bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
                          <button
                            type="button"
                            disabled={activeLineIndex === 0}
                            onClick={() => {
                              onReorderLines(activeLineIndex, activeLineIndex - 1);
                              onSelectLine(activeLineIndex - 1);
                            }}
                            title="Shift Line Up"
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={activeLineIndex === lines.length - 1}
                            onClick={() => {
                              onReorderLines(activeLineIndex, activeLineIndex + 1);
                              onSelectLine(activeLineIndex + 1);
                            }}
                            title="Shift Line Down"
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {onDeleteLine && (
                        <button
                          type="button"
                          onClick={() => onDeleteLine(activeLineIndex!)}
                          title="Delete selected clip"
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Line Text Editor */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider">
                      Lyric Text
                    </label>
                    <textarea
                      rows={2}
                      value={selectedLine.text}
                      onChange={(e) => onUpdateLineText(activeLineIndex!, e.target.value)}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-white resize-none focus:outline-none focus:border-white transition-colors font-sans"
                    />
                  </div>

                  {/* Timecode Start & End Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider">
                        Start (s)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedLine.start}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            onUpdateLineTiming(activeLineIndex!, val, Math.max(val + 0.1, selectedLine.end));
                          }
                        }}
                        className="h-8 px-2.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-sans text-zinc-200 focus:outline-none focus:border-white tabular-nums"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider">
                        End (s)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedLine.end}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            onUpdateLineTiming(activeLineIndex!, Math.min(selectedLine.start, val - 0.1), val);
                          }
                        }}
                        className="h-8 px-2.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-sans text-zinc-200 focus:outline-none focus:border-white tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Layer Assignment */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider">
                      Assigned Layer
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {layers.map((layer) => {
                        const isCurrentLayer =
                          selectedLine.layerId === layer.id ||
                          (!selectedLine.layerId && layer.id === 'layer-1');

                        return (
                          <button
                            key={layer.id}
                            type="button"
                            onClick={() => {
                              if (onSetLineVocalist) {
                                onSetLineVocalist(activeLineIndex!, layer.name.toLowerCase());
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all cursor-pointer ${
                              isCurrentLayer
                                ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                                : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            {layer.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Word Sync & Tokenize */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider">
                        Word Sync Tokens ({selectedLine.tokens?.length || 0})
                      </label>
                      {onDivideLineIntoWords && (!selectedLine.tokens || selectedLine.tokens.length === 0) && (
                        <button
                          type="button"
                          onClick={() => onDivideLineIntoWords(activeLineIndex!)}
                          className="flex items-center gap-1 text-[10px] font-medium text-white hover:text-zinc-200 bg-white/10 px-2 py-0.5 rounded border border-white/20 cursor-pointer transition-colors active:scale-95"
                        >
                          <Split className="w-3 h-3" />
                          <span>Tokenize Words</span>
                        </button>
                      )}
                    </div>

                    {selectedLine.tokens && selectedLine.tokens.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar p-1.5 bg-black/40 rounded-lg border border-white/[0.06]">
                        {selectedLine.tokens.map((tok, tIdx) => (
                          <div
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-sans flex items-center gap-1 group/tok"
                          >
                            <span>{tok.text}</span>
                            <span className="text-[8px] font-sans text-zinc-400">
                              {(tok.end - tok.start).toFixed(2)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-500 italic">
                        No word syllables. Click &ldquo;Tokenize Words&rdquo; to divide into karaoke clips.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <Sliders className="w-8 h-8 text-zinc-600 mb-2 opacity-50" />
                  <span className="text-xs font-semibold text-zinc-400">No Clip Selected</span>
                  <span className="text-[11px] text-zinc-600 mt-1 max-w-xs">
                    Click any lyric clip on the timeline or in the Lyrics Bin to view and modify its properties.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANE: BROADCAST PROGRAM MONITOR (58% width) ── */}
        <div className="w-full md:w-[58%] flex flex-col bg-[#09090c] min-h-0">
          {/* Monitor Header */}
          <div className="h-9 px-3 border-b border-white/[0.06] bg-[#0c0c10] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans font-semibold text-zinc-400">
                Quick Preview
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonitorMode('video')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  monitorMode === 'video'
                    ? 'bg-white/10 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Video mode
              </button>
              <button
                type="button"
                onClick={() => setMonitorMode('stage')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  monitorMode === 'stage'
                    ? 'bg-white/10 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Teleprompter mode
              </button>
            </div>
          </div>

          {/* Monitor Viewport (16:9 Canvas Frame) */}
          <div className="flex-1 flex items-center justify-center p-3 min-h-0 bg-black/60 relative overflow-hidden">
            <div
              id="nle-program-monitor-viewport"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverMonitor(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverMonitor(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverMonitor(false);
                if (e.dataTransfer.files?.[0]) {
                  handleMediaFile(e.dataTransfer.files[0]);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (
                  text &&
                  (text.includes('youtube.com') ||
                    text.includes('youtu.be') ||
                    /^[a-zA-Z0-9_-]{11}$/.test(text.trim()))
                ) {
                  e.preventDefault();
                  handlePasteYoutube(text);
                }
              }}
              className={`w-full h-full max-w-3xl aspect-video bg-[#050507] rounded-xl border shadow-2xl relative flex flex-col items-center justify-center overflow-hidden transition-all ${
                isDraggingOverMonitor
                  ? 'border-cyan-400 ring-2 ring-cyan-400/50 bg-cyan-950/20'
                  : 'border-white/[0.1]'
              }`}
            >
              {/* Media Error Boundary Alert Banner */}
              {mediaErrorMessage && (
                <div className="absolute top-3 left-3 right-3 z-50 p-2.5 rounded-xl bg-[#1a0f12]/95 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{mediaErrorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaErrorMessage(null)}
                    className="p-1 rounded hover:bg-white/10 text-rose-300 hover:text-white cursor-pointer ml-2 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Dragging Over Monitor Full Overlay */}
              {isDraggingOverMonitor && (
                <div className="absolute inset-0 z-40 bg-[#09090c]/90 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-cyan-400 text-cyan-200 pointer-events-none">
                  <Upload className="w-10 h-10 mb-2 animate-bounce text-cyan-400" />
                  <span className="text-sm font-bold text-white">Drop Audio or Video File Here</span>
                  <span className="text-xs text-zinc-400 mt-1 font-sans">MP4, WebM, MOV, MP3, WAV, FLAC, M4A</span>
                </div>
              )}

              {/* Local Video Player Tag */}
              {localVideoUrl && (
                <>
                  <video
                    ref={videoRef}
                    src={localVideoUrl}
                    muted={Boolean(currentAudioFile || wavesurfer)}
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    onError={() => {
                      setMediaErrorMessage('Failed to decode video file. Please check file format.');
                      setLocalVideoUrl(null);
                      setLocalVideoName(null);
                    }}
                  />
                  {/* Linked File Badge */}
                  <div className="absolute top-2.5 left-2.5 z-30 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-white text-[11px] font-sans flex items-center gap-2 shadow-lg">
                    <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate max-w-[170px]">{localVideoName || 'Local Video'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
                        setLocalVideoUrl(null);
                        setLocalVideoName(null);
                      }}
                      title="Unlink Video"
                      className="p-0.5 rounded hover:bg-white/20 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}

              {/* YouTube Linked Badge */}
              {youtubeId && !localVideoUrl && (
                <div className="absolute top-2.5 left-2.5 z-30 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-white text-[11px] font-sans flex items-center gap-2 shadow-lg">
                  <Tv className="w-3.5 h-3.5 text-red-500" />
                  <span className="truncate max-w-[150px]">YouTube: {youtubeId}</span>
                  {onUpdateMetadata && (
                    <button
                      type="button"
                      onClick={() => onUpdateMetadata({ youtubeId: undefined })}
                      title="Unlink YouTube Source"
                      className="p-0.5 rounded hover:bg-white/20 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Video Mode Body (When No Video/Audio File is Active) */}
              {monitorMode === 'video' ? (
                !localVideoUrl && !youtubeId && (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-6 select-none relative">
                    <div className="flex flex-col items-center text-center max-w-sm">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-zinc-400">
                        <Film className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-white mb-1">Video & Audio Previewer</span>
                      <span className="text-xs text-zinc-500 mb-4">
                        Drag & drop local video/audio, or paste a YouTube link
                      </span>

                      {/* YouTube Paste Input */}
                      <div className="w-full flex items-center gap-1.5 mb-3">
                        <div className="flex-1 relative">
                          <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            value={ytInputUrl}
                            onChange={(e) => setYtInputUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handlePasteYoutube(ytInputUrl);
                              }
                            }}
                            placeholder="Paste YouTube URL or ID..."
                            className="w-full h-8 pl-8 pr-2 rounded-lg bg-black/60 border border-white/[0.1] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/40"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePasteYoutube(ytInputUrl)}
                          disabled={!ytInputUrl.trim()}
                          className="h-8 px-3 rounded-lg bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Link
                        </button>
                      </div>

                      {/* Local File Browse */}
                      <label className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Browse Audio or Video File</span>
                        <input
                          type="file"
                          accept="audio/*,video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleMediaFile(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )
              ) : (
                /* Stage / Teleprompter Mode */
                <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center relative">
                  <div className="absolute inset-0 opacity-15 pointer-events-none blur-3xl bg-radial from-white/10 to-transparent" />
                  {selectedLine ? (
                    <div className="relative z-10 flex flex-col items-center gap-2 max-w-lg">
                      <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-sans font-bold">
                        Line #{activeLineIndex! + 1}
                      </span>
                      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                        &ldquo;{selectedLine.text}&rdquo;
                      </h2>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-500">
                      <Tv className="w-8 h-8 opacity-40 mb-1 text-zinc-500" />
                      <span className="text-xs font-semibold text-zinc-400">Standby • Ready for Playback</span>
                      <span className="text-[10px] font-sans text-zinc-600">
                        Press Space to Play or Scrub the Timeline
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="absolute inset-4 border border-white/[0.04] pointer-events-none rounded-lg" />
            </div>
          </div>

          {/* Transport Bar */}
          <div className="h-11 px-4 bg-[#0c0c10] border-t border-white/[0.08] flex items-center justify-between shrink-0">
            <div className="flex items-center">
              <span className="font-sans text-sm font-black tracking-widest text-white tabular-nums">
                {formatSMPTE(currentTime)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSeek(0)}
                title="Jump to track start"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => stepFrame(false)}
                title="Step 1 frame back"
                className="px-1.5 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-sans font-bold"
              >
                -1F
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                className="h-8 px-4 rounded-xl bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span className="text-xs">Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="text-xs">Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => stepFrame(true)}
                title="Step 1 frame forward"
                className="px-1.5 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-sans font-bold"
              >
                +1F
              </button>

              <button
                type="button"
                onClick={() => onSeek(effectiveDuration)}
                title="Jump to track end"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                type="button"
                onClick={loopSelectedClip}
                title="Loop selected clip (L)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {onUndo && (
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[17px]">undo</span>
                </button>
              )}
              {onRedo && (
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Redo (Ctrl+Y)"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[17px]">redo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM DECK: TIMELINE LAYERS WORKSPACE (50% HEIGHT) ──────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#07070a] relative">
        {/* Timeline Control Toolbar */}
        <div className="h-8 px-3 bg-[#0a0a0e] border-b border-white/[0.06] flex items-center justify-between shrink-0">
          {/* Tool Picker */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTool('select')}
              title="Selection / Move Tool (V)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                activeTool === 'select'
                  ? 'bg-white text-zinc-950 font-bold border border-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <MousePointer className="w-3 h-3" />
              <span>Select (V)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('razor')}
              title="Razor / Split Line Tool (C)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                activeTool === 'razor'
                  ? 'bg-zinc-200 text-zinc-950 font-bold border border-zinc-300 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Scissors className="w-3 h-3" />
              <span>Razor (C)</span>
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

            {/* Snapping Toggle */}
            <button
              type="button"
              onClick={() => setIsSnapping((prev) => !prev)}
              title="Toggle Magnetic Snapping (S)"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                isSnapping
                  ? 'bg-white/15 text-white border border-white/30 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              <Magnet className="w-3 h-3" />
              <span>Snap {isSnapping ? 'On' : 'Off'}</span>
            </button>

            <div className="w-[1px] h-3.5 bg-white/10 mx-1" />

            {/* Layers Badge / Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-zinc-300">
              <Layers className="w-3 h-3 text-white" />
              <span>Layers ({layers.length})</span>
            </div>
          </div>

          {/* Zoom Slider Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(20, prev - 20))}
              title="Zoom out (-)"
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={20}
              max={320}
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
              title="Timeline scale (px/s)"
              className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />

            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(320, prev + 20))}
              title="Zoom in (+)"
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-sans text-zinc-500 w-12 text-center tabular-nums">
              {Math.round(zoom)} px/s
            </span>

            <button
              type="button"
              onClick={() => {
                if (trackScrollRef.current && effectiveDuration > 0) {
                  const fitVal = Math.max(20, Math.floor((trackScrollRef.current.clientWidth - 200) / effectiveDuration));
                  if (Math.abs(zoom - fitVal) < 5) {
                    setZoom(195);
                  } else {
                    setZoom(fitVal);
                  }
                } else {
                  setZoom(195);
                }
              }}
              title="Fit timeline to view"
              className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer font-sans border border-white/[0.06]"
            >
              Fit
            </button>
          </div>
        </div>

        {/* ── UNIFIED TIMELINE LAYERS WORKSPACE ── */}
        <div className="flex-1 flex min-h-0 relative">
          
          {/* 1. Left Fixed Layer Headers Sidebar */}
          <div className="w-44 md:w-48 bg-[#09090d] border-r border-white/[0.08] flex flex-col shrink-0 select-none z-30">
            {/* Top Ruler & Waveform spacer */}
            <div
              className={`${
                isYouTubeSource ? 'h-7' : 'h-[76px]'
              } border-b border-white/[0.08] bg-[#0c0c12] px-2.5 py-1.5 flex flex-col justify-between shrink-0 transition-all`}
            >

              {!isYouTubeSource && (
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans">
                  <label
                    title={currentAudioFile ? `Click to replace: ${currentAudioFile.name}` : 'Click to load local audio file'}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group/audio max-w-[125px]"
                  >
                    <Music className="w-3 h-3 text-zinc-400 group-hover/audio:text-white shrink-0" />
                    <span className="truncate text-[10px] text-zinc-300 group-hover/audio:text-white">
                      {currentAudioFile?.name || doc.metadata.audioFileName || 'Import Audio'}
                    </span>
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onAudioSelect) onAudioSelect(file);
                      }}
                    />
                  </label>
                  <span className="text-[9px] text-zinc-600 font-bold">A1</span>
                </div>
              )}
            </div>

            {/* Layer Row Headers */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col divide-y divide-white/[0.04]">
              {layers.map((layer, lIdx) => {
                const layerClips = linesByLayer.get(layer.id) || [];
                const isSelectedLayer = activeLayerId === layer.id;

                return (
                  <div key={layer.id} className="flex flex-col">
                    {/* Main Layer Header */}
                    <div
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`h-[112px] p-2.5 flex flex-col justify-between transition-colors cursor-pointer ${
                        isSelectedLayer ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        {editingLayerId === layer.id ? (
                          <input
                            type="text"
                            value={layerNameDraft}
                            autoFocus
                            onChange={(e) => setLayerNameDraft(e.target.value)}
                            onBlur={() => handleRenameLayer(layer.id, layerNameDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameLayer(layer.id, layerNameDraft);
                              else if (e.key === 'Escape') setEditingLayerId(null);
                            }}
                            className="h-5 px-1 rounded bg-black text-xs font-bold text-white border border-white/40 focus:outline-none w-24"
                          />
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingLayerId(layer.id);
                              setLayerNameDraft(layer.name);
                            }}
                            className="flex items-center gap-1.5 min-w-0 group/title cursor-text"
                            title="Double-click to rename layer"
                          >
                            <div className="w-1.5 h-3.5 rounded-full bg-white shrink-0" />
                            <span className="text-xs font-bold text-white truncate font-sans">
                              {layer.name}
                            </span>
                            <Edit3 className="w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}

                        <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white/10 text-zinc-200 border border-white/10 font-medium shrink-0">
                          {layerClips.length}
                        </span>
                      </div>

                      {/* Controls at bottom of Layer Header */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        {/* Word Timing Sub-lane Expansion Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWordLaneExpansion(layer.id);
                          }}
                          title={layer.isWordLaneExpanded ? 'Hide word sync lane' : 'Expand word sync lane'}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans transition-colors cursor-pointer border ${
                            layer.isWordLaneExpanded
                              ? 'bg-white text-zinc-950 font-bold border-white'
                              : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Split className="w-2.5 h-2.5" />
                          <span>Words</span>
                          {layer.isWordLaneExpanded ? (
                            <ChevronUp className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                        </button>

                        {/* Delete Layer button (if more than 1 layer) */}
                        {layers.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayer(layer.id);
                            }}
                            title="Delete this layer"
                            className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Word Lane Header Spacer if Expanded */}
                    {layer.isWordLaneExpanded && (
                      <div className="h-8 border-t border-white/[0.04] bg-[#07070b] px-2 flex items-center justify-between text-[9px] font-sans text-zinc-500">
                        <span className="flex items-center gap-1 pl-2">
                          <span className="w-1 h-2 bg-zinc-600 rounded-full" />
                          <span>Word Timing</span>
                        </span>
                        <span className="text-[8px] text-zinc-600">Syllables</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ghost Layer Header when dragging down to create a new layer */}
              {draggingClip && draggingClip.mode === 'move' && typeof draggingClip.targetLayerIndex === 'number' && draggingClip.targetLayerIndex >= layers.length && (
                <div className="h-[112px] p-2.5 flex flex-col justify-center border-2 border-dashed border-cyan-400/50 bg-cyan-950/20 text-cyan-300 rounded-lg m-1 shadow-inner shrink-0">
                  <div className="flex items-center gap-1.5 font-sans text-xs font-bold">
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Layer {layers.length + 1}</span>
                  </div>
                  <span className="text-[10px] text-cyan-400/80 mt-1 font-sans">
                    Drop to create layer
                  </span>
                </div>
              )}

              {/* Add New Layer Button */}
              <div className="p-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAddLayer}
                  className="w-full py-1.5 px-2 rounded-lg border border-dashed border-white/15 hover:border-white/40 text-zinc-400 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white/[0.01] hover:bg-white/[0.03]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Layer</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Right Horizontal Scrollable Workspace */}
          <div
            ref={trackScrollRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (
                file &&
                (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name))
              ) {
                onAudioSelect?.(file);
              }
            }}
            onMouseDown={(e) => {
              if (
                (e.target as HTMLElement).closest('.nle-clip') ||
                (e.target as HTMLElement).closest('.nle-handle') ||
                (e.target as HTMLElement).closest('.nle-word-chip')
              ) {
                return;
              }
              handleScrubStart(e);
            }}
            className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-[#050508] relative cursor-crosshair"
          >
            <div
              style={{ width: `${totalWidth}px`, minHeight: '100%' }}
              className="relative flex flex-col"
            >
              {/* ── STICKY TOP BAR: TIME RULER (+ MASTER WAVEFORM IF LOCAL AUDIO) ── */}
              <div className="sticky top-0 z-40 bg-[#09090d] border-b border-white/[0.08] select-none shrink-0 shadow-lg shadow-black/70">
                {/* Time Ruler (h-7) */}
                <div
                  ref={rulerRef}
                  onMouseDown={handleScrubStart}
                  className="h-7 bg-[#0a0a0f] border-b border-white/[0.08] relative cursor-ew-resize"
                >
                  {rulerTicks.map((tick, i) => (
                    <div
                      key={i}
                      style={{ left: `${tick.time * zoom}px` }}
                      className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-end"
                    >
                      <div
                        className={`w-[1px] ${
                          tick.isMajor
                            ? 'h-3.5 bg-white/40'
                            : tick.isSub
                            ? 'h-1.5 bg-white/10'
                            : 'h-2 bg-white/20'
                        }`}
                      />
                      {tick.isMajor && tick.label && (
                        <span className="text-[8px] font-sans text-zinc-400 pl-1 -translate-y-0.5 select-none font-bold">
                          {tick.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Master Waveform Track (h-12) - Hidden if YouTube audio source */}
                {!isYouTubeSource && (
                  <div
                    onMouseDown={handleScrubStart}
                    className="h-12 bg-[#040407] relative flex items-center overflow-hidden cursor-ew-resize border-t border-white/[0.04]"
                  >
                    <WaveformCanvas
                      totalWidth={totalWidth}
                      zoom={zoom}
                      currentTime={currentTime}
                      audioBuffer={decodedAudioBuffer}
                      isLoading={isDecodingAudio}
                    />
                  </div>
                )}
              </div>

              {/* ── HORIZONTAL LAYERS WORKSPACE ── */}
              <div className="relative flex flex-col flex-1 divide-y divide-white/[0.04]">
                {layers.map((layer) => {
                  const layerClips = linesByLayer.get(layer.id) || [];

                  return (
                    <div key={layer.id} className="flex flex-col relative">
                      {/* Main Horizontal Layer Row (h-[112px]) */}
                      <div
                        onContextMenu={(e) => handleTimelineContextMenu(e, layer.id)}
                        style={{ width: `${totalWidth}px` }}
                        className="h-[112px] relative flex items-center bg-[#06060a]/40 hover:bg-[#06060a]/60 transition-colors"
                      >
                        {layerClips.map(({ line, index }) => {
                          const isCurDragging = draggingClip?.lineIndex === index;
                          const curStart = isCurDragging ? draggingClip.currentStart : line.start;
                          const curEnd = isCurDragging ? draggingClip.currentEnd : line.end;
                          const left = curStart * zoom;
                          const width = Math.max((curEnd - curStart) * zoom, 60);
                          const isSelected = activeLineIndex === index;

                          return (
                            <div
                              key={line.id || index}
                              style={{ left: `${left}px`, width: `${width}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeTool === 'razor') {
                                  const scrollContainer = trackScrollRef.current;
                                  if (!scrollContainer) return;
                                  const rect = scrollContainer.getBoundingClientRect();
                                  const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
                                  const clickTime = clickX / zoom;
                                  handleRazorClip(index, clickTime);
                                } else {
                                  onSelectLine(index);
                                  onSeek(line.start);
                                }
                              }}
                              className={`nle-clip absolute h-[100px] rounded-xl border flex flex-col justify-between cursor-pointer overflow-hidden select-none shadow-lg ${
                                isCurDragging
                                  ? 'transition-none will-change-[left,width] z-30 shadow-2xl ring-2 ring-cyan-400/80 scale-[1.01]'
                                  : 'transition-colors duration-150'
                              } ${
                                isSelected
                                  ? 'bg-white text-zinc-950 border-white ring-2 ring-white/50 z-20 font-semibold'
                                  : 'bg-[#18181c] border-white/10 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-500 hover:z-10'
                              }`}
                            >
                              {/* Left Trim Handle (Upper half) */}
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const layerIdx = layers.findIndex((l) => l.id === layer.id);
                                  setDraggingClip({
                                    lineIndex: index,
                                    layerId: layer.id,
                                    mode: 'trim-start',
                                    initialX: e.clientX,
                                    initialY: e.clientY,
                                    initialStart: line.start,
                                    initialEnd: line.end,
                                    currentStart: line.start,
                                    currentEnd: line.end,
                                    targetLayerIndex: layerIdx >= 0 ? layerIdx : 0,
                                  });
                                }}
                                title="Trim Clip Start"
                                className="nle-handle absolute left-0 top-0 bottom-8 w-2.5 hover:w-3.5 cursor-ew-resize z-20 bg-transparent"
                              />

                              {/* Top Meta Header inside Clip */}
                              <div className="flex items-center justify-between text-[10px] font-sans leading-none shrink-0 pointer-events-none px-2.5 pt-2">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                      isSelected ? 'bg-zinc-950/15 text-zinc-950' : 'bg-white/10 text-zinc-300'
                                    }`}
                                  >
                                    #{index + 1}
                                  </span>
                                  {line.vocalist && (
                                    <span className="text-[9px] font-medium text-zinc-400 uppercase">
                                      {line.vocalist}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`tabular-nums text-[9px] font-mono ${
                                    isSelected ? 'text-zinc-700 font-semibold' : 'text-zinc-400'
                                  }`}
                                >
                                  {curStart.toFixed(2)}s → {curEnd.toFixed(2)}s · {(curEnd - curStart).toFixed(2)}s
                                </span>
                              </div>

                              {/* Middle: Big Zoomed-In Lyric Text with double-click inline editing */}
                              <div
                                onMouseDown={(e) => {
                                  if (activeTool === 'razor') return;
                                  e.stopPropagation();
                                  onSelectLine(index);
                                  const layerIdx = layers.findIndex((l) => l.id === layer.id);
                                  setDraggingClip({
                                    lineIndex: index,
                                    layerId: layer.id,
                                    mode: 'move',
                                    initialX: e.clientX,
                                    initialY: e.clientY,
                                    initialStart: line.start,
                                    initialEnd: line.end,
                                    currentStart: line.start,
                                    currentEnd: line.end,
                                    targetLayerIndex: layerIdx >= 0 ? layerIdx : 0,
                                  });
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  onSelectLine(index);
                                  setEditingLineIndex(index);
                                  setEditingText(line.text);
                                }}
                                className="flex-1 flex items-center min-w-0 cursor-grab active:cursor-grabbing px-2.5 py-1 min-h-[38px]"
                              >
                                {editingLineIndex === index ? (
                                  <input
                                    type="text"
                                    value={editingText}
                                    autoFocus
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onBlur={() => {
                                      onUpdateLineText(index, editingText);
                                      setEditingLineIndex(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        onUpdateLineText(index, editingText);
                                        setEditingLineIndex(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingLineIndex(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-full px-2 py-1 rounded text-sm font-bold outline-none border ${
                                      isSelected
                                        ? 'bg-zinc-100 text-zinc-950 border-zinc-400'
                                        : 'bg-zinc-900 text-white border-zinc-700'
                                    }`}
                                  />
                                ) : (
                                  <span
                                    className={`text-sm md:text-[15px] font-bold truncate leading-tight tracking-tight ${
                                      isSelected ? 'text-zinc-950' : 'text-zinc-100'
                                    }`}
                                  >
                                    {line.text || '(empty line)'}
                                  </span>
                                )}
                              </div>

                              {/* Bottom: Scaled Real-Time Word Track Deck (maintains true horizontal scale and position) */}
                              <div
                                className={`relative h-8 w-full border-t overflow-hidden px-0.5 flex items-center ${
                                  isSelected
                                    ? 'border-zinc-950/10 bg-zinc-950/[0.04]'
                                    : 'border-white/[0.06] bg-black/30'
                                }`}
                              >
                                {line.tokens && line.tokens.length > 0 ? (
                                  (() => {
                                    const clipDur = Math.max(0.05, curEnd - curStart);
                                    const clipWidthPx = clipDur * zoom;
                                    const firstTokStart = line.tokens[0].start;
                                    // Align Word 0 to start if it has an accidental lead gap
                                    const leadOffset = (!isCurDragging && firstTokStart > curStart) ? (firstTokStart - curStart) : 0;

                                    return line.tokens.map((tok, tIdx) => {
                                      const isDraggingThis =
                                        draggingToken?.lineIndex === index &&
                                        draggingToken?.tokenIndex === tIdx;

                                      let tokRelStart: number;
                                      let tokRelEnd: number;

                                      if (isCurDragging && draggingClip.mode === 'move') {
                                        // Words stay completely stationary relative to the clip box while moving
                                        tokRelStart = tok.start - draggingClip.initialStart;
                                        tokRelEnd = tok.end - draggingClip.initialStart;
                                      } else if (isCurDragging && (draggingClip.mode === 'trim-start' || draggingClip.mode === 'trim-end')) {
                                        const initDur = Math.max(0.05, draggingClip.initialEnd - draggingClip.initialStart);
                                        const scale = clipDur / initDur;
                                        tokRelStart = (tok.start - draggingClip.initialStart) * scale;
                                        tokRelEnd = (tok.end - draggingClip.initialStart) * scale;
                                      } else if (isDraggingThis) {
                                        tokRelStart = draggingToken.currentStart - curStart;
                                        tokRelEnd = draggingToken.currentEnd - curStart;
                                      } else {
                                        tokRelStart = (tok.start - leadOffset) - curStart;
                                        tokRelEnd = (tok.end - leadOffset) - curStart;
                                      }

                                      // Strictly clamp within [0, clipDur]
                                      tokRelStart = Math.max(0, Math.min(clipDur - 0.04, tokRelStart));
                                      tokRelEnd = Math.max(tokRelStart + 0.04, Math.min(clipDur, tokRelEnd));

                                      const tokLeft = tokRelStart * zoom;
                                      const rawWidth = Math.max(18, (tokRelEnd - tokRelStart) * zoom);
                                      const tokWidth = Math.min(rawWidth, Math.max(18, clipWidthPx - tokLeft));

                                      const effectiveTokStart = curStart + tokRelStart;
                                      const effectiveTokEnd = curStart + tokRelEnd;
                                      const tokStart = effectiveTokStart;
                                      const tokEnd = effectiveTokEnd;
                                      const isActiveWord = currentTime >= tokStart && currentTime < tokEnd;

                                    const isEditingThisWord =
                                      editingWordToken?.lineIndex === index &&
                                      editingWordToken?.tokenIndex === tIdx;

                                    return isEditingThisWord ? (
                                      <input
                                        key={tIdx}
                                        ref={wordInputRef}
                                        type="text"
                                        autoFocus
                                        value={editingWordToken.text}
                                        onChange={(e) =>
                                          setEditingWordToken((prev) =>
                                            prev ? { ...prev, text: e.target.value } : null
                                          )
                                        }
                                        onBlur={() => {
                                          if (onSetWordTokenText) {
                                            onSetWordTokenText(index, tIdx, editingWordToken.text);
                                          }
                                          setEditingWordToken(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (onSetWordTokenText) {
                                              onSetWordTokenText(index, tIdx, editingWordToken.text);
                                            }
                                            setEditingWordToken(null);
                                          } else if (e.key === 'Escape') {
                                            setEditingWordToken(null);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          left: `${tokLeft + 1}px`,
                                          width: `${Math.max(48, tokWidth - 2)}px`,
                                        }}
                                        className="absolute top-0.5 bottom-0.5 px-1.5 rounded bg-black text-white text-[11px] font-sans border border-cyan-400 focus:outline-none z-30"
                                      />
                                    ) : (
                                      <div
                                        key={tIdx}
                                        style={{
                                          left: `${tokLeft + 1}px`,
                                          width: `${Math.max(18, tokWidth - 2)}px`,
                                        }}
                                        onMouseDown={(e) => {
                                          if ((e.target as HTMLElement).closest('.nle-token-trim-handle')) return;
                                          if (activeTool === 'razor') return;
                                          e.stopPropagation();
                                          onSelectLine(index);
                                          setDraggingToken({
                                            lineIndex: index,
                                            tokenIndex: tIdx,
                                            mode: 'move',
                                            initialX: e.clientX,
                                            initialStart: tok.start,
                                            initialEnd: tok.end,
                                            currentStart: tok.start,
                                            currentEnd: tok.end,
                                            lineStart: line.start,
                                            lineEnd: line.end,
                                          });
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectLine(index);
                                          onSeek(tokStart);
                                        }}
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setEditingWordToken({
                                            lineIndex: index,
                                            tokenIndex: tIdx,
                                            text: tok.text,
                                          });
                                        }}
                                        title={`"${tok.text}" (${tokStart.toFixed(2)}s - ${tokEnd.toFixed(2)}s · ${(tokEnd - tokStart).toFixed(2)}s)\n(Drag word to slide position, drag left/right edges to trim, double-click to edit text)`}
                                        className={`nle-word-chip absolute top-0.5 bottom-0.5 rounded text-[11px] font-sans flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden border ${
                                          isDraggingThis
                                            ? 'transition-none will-change-[left,width] bg-cyan-500/40 border-cyan-400 text-white ring-2 ring-cyan-400 z-30 font-bold shadow-lg shadow-cyan-500/30'
                                            : 'transition-colors duration-150'
                                        } ${
                                          !isDraggingThis && isActiveWord
                                            ? isSelected
                                              ? 'bg-zinc-950 text-white font-bold border-zinc-950 shadow-sm z-20'
                                              : 'bg-white text-zinc-950 font-bold border-white shadow-sm z-20'
                                            : !isDraggingThis && isSelected
                                            ? 'bg-zinc-950/10 text-zinc-800 border-zinc-950/20 hover:bg-zinc-950/20'
                                            : !isDraggingThis
                                            ? 'bg-white/[0.08] text-zinc-300 border-white/[0.08] hover:bg-white/[0.14] hover:text-white'
                                            : ''
                                        }`}
                                      >
                                        {/* Word Trim Start Handle */}
                                        {onSetWordToken && (
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setDraggingToken({
                                                lineIndex: index,
                                                tokenIndex: tIdx,
                                                mode: 'trim-start',
                                                initialX: e.clientX,
                                                initialStart: tok.start,
                                                initialEnd: tok.end,
                                                currentStart: tok.start,
                                                currentEnd: tok.end,
                                                lineStart: line.start,
                                                lineEnd: line.end,
                                              });
                                            }}
                                            title="Trim Word Start"
                                            className="nle-token-trim-handle absolute left-0 top-0 bottom-0 w-2 hover:w-3 hover:bg-cyan-400 cursor-ew-resize z-20 bg-transparent transition-colors"
                                          />
                                        )}

                                        <span className="truncate px-1.5 text-[11px] font-medium leading-none pointer-events-none select-none">
                                          {tok.text}
                                        </span>

                                        {/* Word Trim End Handle */}
                                        {onSetWordToken && (
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setDraggingToken({
                                                lineIndex: index,
                                                tokenIndex: tIdx,
                                                mode: 'trim-end',
                                                initialX: e.clientX,
                                                initialStart: tok.start,
                                                initialEnd: tok.end,
                                                currentStart: tok.start,
                                                currentEnd: tok.end,
                                                lineStart: line.start,
                                                lineEnd: line.end,
                                              });
                                            }}
                                            title="Trim Word End"
                                            className="nle-token-trim-handle absolute right-0 top-0 bottom-0 w-2 hover:w-3 hover:bg-cyan-400 cursor-ew-resize z-20 bg-transparent transition-colors"
                                          />
                                        )}
                                      </div>
                                    );
                                  });
                                })()
                              ) : (
                                  /* Fallback for lines without explicit tokens: synthesize proportional phonetic preview word boxes */
                                  <div className="relative w-full h-full flex items-center">
                                    {(() => {
                                      const words = tokenizeLineIntoWords(line.text);
                                      if (words.length === 0) {
                                        return (
                                          <div className="w-full flex items-center justify-between px-2 text-[10px] italic text-zinc-500">
                                            <span>(phrase clip)</span>
                                          </div>
                                        );
                                      }
                                      const lineDur = Math.max(0.1, curEnd - curStart);
                                      const weights = words.map((w) => estimateWordPhoneticWeight(w));
                                      const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
                                      let accumDur = 0;

                                      return (
                                        <>
                                          {words.map((w, wIdx) => {
                                            const wDur = (weights[wIdx] / totalWeight) * lineDur;
                                            const wStart = curStart + accumDur;
                                            const wEnd = wStart + wDur;
                                            accumDur += wDur;
                                            const wLeft = (wStart - curStart) * zoom;
                                            const wWidth = Math.max(18, wDur * zoom);

                                            return (
                                              <div
                                                key={wIdx}
                                                style={{
                                                  left: `${wLeft + 1}px`,
                                                  width: `${Math.max(18, wWidth - 2)}px`,
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onSelectLine(index);
                                                  if (onTokenizeLine) {
                                                    onTokenizeLine(index);
                                                  } else if (onDivideLineIntoWords) {
                                                    onDivideLineIntoWords(index);
                                                  }
                                                }}
                                                title={`"${w}" (estimated ${wStart.toFixed(2)}s - ${wEnd.toFixed(2)}s)\nClick or drag to tokenize and edit individual word timings`}
                                                className={`absolute top-0.5 bottom-0.5 rounded text-[11px] font-sans flex items-center justify-center border border-dashed select-none overflow-hidden cursor-pointer hover:border-cyan-400 transition-colors ${
                                                  isSelected
                                                    ? 'border-zinc-950/20 text-zinc-600 bg-zinc-950/5 hover:bg-zinc-950/15'
                                                    : 'border-white/10 text-zinc-400 bg-white/[0.03] hover:bg-white/10 hover:text-white'
                                                }`}
                                              >
                                                <span className="truncate px-1 text-[10px] leading-none opacity-80 pointer-events-none">
                                                  {w}
                                                </span>
                                              </div>
                                            );
                                          })}
                                          {(onTokenizeLine || onDivideLineIntoWords) && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (onTokenizeLine) {
                                                  onTokenizeLine(index);
                                                } else if (onDivideLineIntoWords) {
                                                  onDivideLineIntoWords(index);
                                                }
                                              }}
                                              title="Convert words into editable timing tokens"
                                              className={`absolute right-1 top-1 bottom-1 text-[10px] font-sans px-2 rounded-md transition-colors z-20 font-medium ${
                                                isSelected
                                                  ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                                                  : 'bg-white/15 text-zinc-200 hover:bg-white/25 hover:text-white'
                                              }`}
                                            >
                                              + Tokenize
                                            </button>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* Right Trim Handle (Upper half) */}
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const layerIdx = layers.findIndex((l) => l.id === layer.id);
                                  setDraggingClip({
                                    lineIndex: index,
                                    layerId: layer.id,
                                    mode: 'trim-end',
                                    initialX: e.clientX,
                                    initialY: e.clientY,
                                    initialStart: line.start,
                                    initialEnd: line.end,
                                    currentStart: line.start,
                                    currentEnd: line.end,
                                    targetLayerIndex: layerIdx >= 0 ? layerIdx : 0,
                                  });
                                }}
                                title="Trim Clip End"
                                className="nle-handle absolute right-0 top-0 bottom-8 w-2.5 hover:w-3.5 cursor-ew-resize z-20 bg-transparent"
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* ── EXPANDABLE WORD TIMING SUB-LANE (Below layer row) ── */}
                      {layer.isWordLaneExpanded && (
                        <div
                          style={{ width: `${totalWidth}px` }}
                          className="h-8 border-t border-white/[0.04] bg-[#040407] relative flex items-center px-1"
                        >
                          {layerClips.flatMap(({ line, index }) => {
                            if (!line.tokens || line.tokens.length === 0) return [];
                            const isCurClipDragging = draggingClip?.lineIndex === index && draggingClip.mode === 'move';
                            const clipShift = isCurClipDragging ? (draggingClip.currentStart - draggingClip.initialStart) : 0;

                            return line.tokens.map((tok, tIdx) => {
                              const isDraggingThis =
                                draggingToken?.lineIndex === index &&
                                draggingToken?.tokenIndex === tIdx;
                              const tokStart = isDraggingThis ? draggingToken.currentStart : tok.start + clipShift;
                              const tokEnd = isDraggingThis ? draggingToken.currentEnd : tok.end + clipShift;
                              const tokLeft = tokStart * zoom;
                              const tokWidth = Math.max((tokEnd - tokStart) * zoom, 16);
                              const isActiveWord = currentTime >= tokStart && currentTime < tokEnd;

                              return (
                                <div
                                  key={`${index}-${tIdx}`}
                                  style={{ left: `${tokLeft}px`, width: `${tokWidth}px` }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLine(index);
                                    onSeek(tok.start);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingWordToken({
                                      lineIndex: index,
                                      tokenIndex: tIdx,
                                      text: tok.text,
                                    });
                                  }}
                                  title={`"${tok.text}" (${tokStart.toFixed(2)}s - ${tokEnd.toFixed(2)}s)`}
                                  className={`nle-word-chip absolute h-6 text-[10px] font-sans flex items-center justify-between cursor-pointer select-none overflow-hidden border rounded ${
                                    isDraggingThis
                                      ? 'transition-none will-change-[left,width] bg-zinc-200 border-white text-zinc-950 ring-1 ring-white z-30 font-bold'
                                      : 'transition-colors duration-150'
                                  } ${
                                    !isDraggingThis && isActiveWord
                                      ? 'bg-white text-zinc-950 font-bold border-white shadow-md z-20'
                                      : !isDraggingThis
                                      ? 'bg-[#15151a] border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                      : ''
                                  }`}
                                >
                                  {/* Token Trim Start Handle */}
                                  {onSetWordToken && (
                                    <div
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingToken({
                                          lineIndex: index,
                                          tokenIndex: tIdx,
                                          mode: 'trim-start',
                                          initialX: e.clientX,
                                          initialStart: tok.start,
                                          initialEnd: tok.end,
                                          currentStart: tok.start,
                                          currentEnd: tok.end,
                                          lineStart: line.start,
                                          lineEnd: line.end,
                                        });
                                      }}
                                      title="Trim Word Start"
                                      className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 cursor-ew-resize z-30 bg-transparent"
                                    />
                                  )}

                                  <div
                                    onMouseDown={(e) => {
                                      if (!onSetWordToken) return;
                                      e.stopPropagation();
                                      onSelectLine(index);
                                      setDraggingToken({
                                        lineIndex: index,
                                        tokenIndex: tIdx,
                                        mode: 'move',
                                        initialX: e.clientX,
                                        initialStart: tok.start,
                                        initialEnd: tok.end,
                                        currentStart: tok.start,
                                        currentEnd: tok.end,
                                        lineStart: line.start,
                                        lineEnd: line.end,
                                      });
                                    }}
                                    className="flex-1 text-center truncate px-1 cursor-grab active:cursor-grabbing font-medium h-full flex items-center justify-center"
                                  >
                                    {tokWidth >= 20 ? tok.text : '•'}
                                  </div>

                                  {/* Token Trim End Handle */}
                                  {onSetWordToken && (
                                    <div
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingToken({
                                          lineIndex: index,
                                          tokenIndex: tIdx,
                                          mode: 'trim-end',
                                          initialX: e.clientX,
                                          initialStart: tok.start,
                                          initialEnd: tok.end,
                                          currentStart: tok.start,
                                          currentEnd: tok.end,
                                          lineStart: line.start,
                                          lineEnd: line.end,
                                        });
                                      }}
                                      title="Trim Word End"
                                      className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 cursor-ew-resize z-30 bg-transparent"
                                    />
                                  )}
                                </div>
                              );
                            });
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── GHOST ROW WHEN DRAGGING CLIP TO CREATE NEW LAYER ── */}
                {draggingClip && draggingClip.mode === 'move' && typeof draggingClip.targetLayerIndex === 'number' && draggingClip.targetLayerIndex >= layers.length && (
                  <div
                    style={{ width: `${totalWidth}px` }}
                    className="h-[112px] relative flex items-center border-2 border-dashed border-cyan-400/40 bg-cyan-950/20 rounded-xl my-1"
                  >
                    {(() => {
                      const line = lines[draggingClip.lineIndex];
                      if (!line) return null;
                      const curStart = draggingClip.currentStart;
                      const curEnd = draggingClip.currentEnd;
                      const left = curStart * zoom;
                      const width = Math.max((curEnd - curStart) * zoom, 80);

                      return (
                        <div
                          style={{ left: `${left}px`, width: `${width}px` }}
                          className="nle-clip absolute h-[100px] rounded-xl border border-cyan-400 ring-2 ring-cyan-400/60 bg-white text-zinc-950 flex flex-col justify-between overflow-hidden select-none shadow-xl z-30 font-semibold"
                        >
                          <div className="flex items-center justify-between text-[10px] font-sans leading-none px-2.5 pt-2 pointer-events-none">
                            <span className="bg-zinc-950/15 text-zinc-950 px-1.5 py-0.5 rounded font-bold text-[9px]">
                              #{draggingClip.lineIndex + 1} (New Layer)
                            </span>
                            <span className="tabular-nums text-[9px] text-zinc-700 font-semibold font-mono">
                              {curStart.toFixed(2)}s → {curEnd.toFixed(2)}s
                            </span>
                          </div>
                          <div className="flex-1 flex items-center min-w-0 px-2.5 py-1">
                            <span className="text-sm md:text-[15px] truncate font-bold text-zinc-950">
                              {line.text}
                            </span>
                          </div>
                          <div className="h-6 bg-cyan-100/90 border-t border-cyan-200 px-2 flex items-center text-[10px] text-cyan-900 font-sans font-medium">
                            Release to create Layer {layers.length + 1}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ── VERTICAL VISUAL SNAP INDICATOR ── */}
              {snapIndicator && (
                <div
                  style={{ transform: `translate3d(${snapIndicator.time * zoom}px, 0, 0)` }}
                  className="absolute top-0 bottom-0 left-0 pointer-events-none z-45 flex flex-col items-center -translate-x-1/2 will-change-transform"
                >
                  {/* Snap Pill Badge */}
                  <div className="sticky top-1 z-50 px-2 py-0.5 rounded-full bg-cyan-400 text-zinc-950 text-[9px] font-sans font-black shadow-lg shadow-cyan-400/30 whitespace-nowrap border border-white">
                    {snapIndicator.label}
                  </div>
                  {/* Vertical Guide Line */}
                  <div className="w-[1.5px] flex-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                </div>
              )}

              {/* ── UNIFIED MONO PLAYHEAD NEEDLE ── */}
              <div
                style={{ transform: `translate3d(${currentTime * zoom}px, 0, 0)` }}
                className="absolute top-0 bottom-0 left-0 pointer-events-none z-50 flex flex-col items-center -translate-x-1/2 will-change-transform"
              >
                {/* Playhead Diamond Scrubber Head pinned to sticky top */}
                <div className="sticky top-1 z-50 flex flex-col items-center">
                  <div className="w-3.5 h-3.5 bg-red-500 rotate-45 rounded-xs shadow-lg shadow-red-500/60 border border-white/90" />
                </div>
                {/* Single Continuous Vertical Red Needle Spanning All The Way to Bottom */}
                <div className="w-[1.5px] flex-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MINI CONTEXT MENU ON TIMELINE RIGHT CLICK ── */}
      {timelineContextMenu && (
        <div
          style={{ left: `${timelineContextMenu.clientX}px`, top: `${timelineContextMenu.clientY}px` }}
          className="fixed z-50 min-w-[200px] p-1.5 rounded-xl bg-[#121218]/95 backdrop-blur-md border border-white/[0.12] shadow-2xl shadow-black/80 flex flex-col gap-0.5 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-sans text-zinc-400 border-b border-white/[0.06] mb-1 flex items-center justify-between">
            <span>Timeline Position</span>
            <span className="text-white font-bold">{formatPrecise(timelineContextMenu.time)}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              handleContextMenuAddLine(timelineContextMenu.time, timelineContextMenu.layerId);
              setTimelineContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left text-zinc-200 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Add Lyric Line Here</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSeek(timelineContextMenu.time);
              setTimelineContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left text-zinc-200 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <MousePointer className="w-3.5 h-3.5 text-zinc-400" />
            <span>Move Playhead Here</span>
          </button>

          <div className="h-[1px] bg-white/[0.06] my-0.5" />

          <button
            type="button"
            onClick={() => setTimelineContextMenu(null)}
            className="w-full px-2.5 py-1 rounded-lg text-left text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── FLOATING COLLISION PROMPT (If any) ── */}
      {collisionPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#16161d] border border-amber-500/30 shadow-2xl shadow-black/80 flex items-center gap-3">
          <span className="text-xs font-medium text-amber-200">
            Collision detected on this layer
          </span>
          <button
            type="button"
            onClick={() => {
              onUpdateLineTiming(
                collisionPrompt.lineIndex,
                collisionPrompt.suggestedGapTime,
                collisionPrompt.suggestedGapTime + 2.5
              );
              setCollisionPrompt(null);
            }}
            className="px-2.5 py-1 rounded-lg bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Fit to Next Gap
          </button>
          <button
            type="button"
            onClick={() => setCollisionPrompt(null)}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

ClassicNLEStudio.displayName = 'ClassicNLEStudio';
