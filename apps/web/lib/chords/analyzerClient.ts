import type { GeneratedChordAnalysis, ChordAnalysisProgress } from './analysis';
import type { SyncedChordFrame } from './beatSyncEngine';

// Mirror of packages/ai-aligner/src/alignerClient.ts worker lifecycle.

type WorkerOut =
  | { type: 'PROGRESS'; payload: ChordAnalysisProgress }
  | { type: 'SUCCESS'; payload: GeneratedChordAnalysisPayload | null }
  | { type: 'ERROR'; payload: string };

interface GeneratedChordAnalysisPayload {
  frameCount: number;
  frames: SyncedChordFrame[];
  rows: GeneratedChordAnalysis['rows'];
  meta: GeneratedChordAnalysis['meta'];
}

export interface ChordAnalyzerClientOptions {
  onProgress?: (p: ChordAnalysisProgress) => void;
}

let worker: Worker | null = null;
let cancelled = false;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL('../../workers/chordAnalyzer.worker.ts', import.meta.url),
    { type: 'module' },
  );
  return worker;
}

function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export function cancelChordAnalysis(): void {
  cancelled = true;
  if (worker) worker.postMessage({ type: 'CANCEL' });
}

export async function preloadChordModel(): Promise<void> {
  const w = getWorker();
  return new Promise<void>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === 'SUCCESS') {
        w.removeEventListener('message', handler);
        resolve();
      } else if (e.data.type === 'ERROR') {
        w.removeEventListener('message', handler);
        reject(new Error(e.data.payload));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'PRELOAD' });
  });
}

async function decodeToMono22050(
  file: File | Blob,
  onProgress?: (stage: 'decoding' | 'resampling', p: number) => void,
): Promise<Float32Array> {
  onProgress?.('decoding', 0.1);
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  onProgress?.('decoding', 1);

  // Downmix to mono as arithmetic mean (NOT ffmpeg -ac 1's /sqrt(2)).
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  if (channels === 1) {
    mono.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      mono[i] = (ch0[i] + ch1[i]) / 2;
    }
  }

  // Resample to 22050 via OfflineAudioContext.
  onProgress?.('resampling', 0.1);
  const targetRate = 22050;
  if (audioBuffer.sampleRate === targetRate) {
    onProgress?.('resampling', 1);
    return mono;
  }
  const offline = new OfflineAudioContext(1, Math.ceil(mono.length * (targetRate / audioBuffer.sampleRate)), targetRate);
  const src = offline.createBufferSource();
  const buf = offline.createBuffer(1, mono.length, audioBuffer.sampleRate);
  buf.copyToChannel(mono, 0);
  src.buffer = buf;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  onProgress?.('resampling', 1);
  return rendered.getChannelData(0).slice();
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (clamp to int16)
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
export async function analyzeChordAudio(
  file: File | Blob,
  opts: ChordAnalyzerClientOptions = {},
): Promise<GeneratedChordAnalysis> {
  const { onProgress } = opts;
  cancelled = false;

  const report = (stage: ChordAnalysisProgress['stage'], progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  report('decoding', 0, 'Decoding audio…');
  const samples = await decodeToMono22050(file, (stage, p) => {
    report(stage, p, stage === 'decoding' ? 'Decoding audio…' : 'Resampling to 22050 Hz…');
  });
  if (cancelled) throw new Error('cancelled');

  // Playback uses a WAV re-encode (universally decodable) instead of the raw
  // file blob, which some browsers reject as "no supported sources".
  // Capture duration BEFORE the sample buffer is transferred to the worker.
  const duration = samples.length / 22050;
  const audioUrl = URL.createObjectURL(encodeWav(samples, 22050));

  report('cqt', 0, 'Starting analysis…');
  const w = getWorker();

  return new Promise<GeneratedChordAnalysis>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerOut>) => {
      const data = e.data;
      if (data.type === 'PROGRESS') {
        const p = data.payload as ChordAnalysisProgress;
        report(p.stage, p.progress, p.message);
        return;
      }
      if (data.type === 'SUCCESS') {
        w.removeEventListener('message', handler);
        const payload = data.payload as GeneratedChordAnalysisPayload | null;
        if (!payload) {
          reject(new Error('empty result'));
          return;
        }
        const title = file instanceof File ? file.name.replace(/\.[^.]+$/, '') : 'Generated';
        resolve({
          title,
          audioUrl,
          duration: samples.length / 22050,
          frames: payload.frames,
          rows: payload.rows,
          meta: payload.meta,
        });
        return;
      }
      if (data.type === 'ERROR') {
        w.removeEventListener('message', handler);
        reject(new Error(data.payload));
        return;
      }
    };
    w.addEventListener('message', handler);
    // Transfer the sample buffer (zero-copy).
    const buffer = samples.buffer;
    w.postMessage({ type: 'ANALYZE', payload: { samples } }, [buffer]);
  });
}
