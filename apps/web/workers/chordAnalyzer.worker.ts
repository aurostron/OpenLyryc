/// <reference lib="webworker" />

// @ts-nocheck
import * as ort from 'onnxruntime-web';
import { decodePlan } from '../lib/chords/cqt/plan';
import { computeCqt } from '../lib/chords/cqt/cqt';
import { displayChord } from '../lib/chords/vocabDisplay';
import type { CqtPlan } from '../lib/chords/cqt/plan';
import type { SyncedChordFrame } from '../lib/chords/beatSyncEngine';
import type {
  AnalysisRow,
  ChordAnalysisProgress,
  ChordAnalysisStage,
} from '../lib/chords/analysis';

// wasm EP only, single thread (no SharedArrayBuffer / COOP/COEP required).
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

const MODEL_URL = '/models/chordnet.onnx';
const PLAN_URL = '/models/cqt-plan.bin';
const CONFIG_URL = '/models/config.json';

const SEQ = 108;
const BINS = 144;
const WINDOWS = 16;
const FRAME_DUR = 2048 / 22050;
const SMOOTH_K = 9;

let session: ort.InferenceSession | null = null;
let plan: CqtPlan | null = null;
let vocab: string[] = [];
let cancelled = false;

function postProgress(stage: ChordAnalysisStage, progress: number, message: string): void {
  const msg: ChordAnalysisProgress = { stage, progress, message };
  self.postMessage({ type: 'PROGRESS', payload: msg });
}

async function preload(): Promise<void> {
  if (session && plan && vocab.length) return;
  postProgress('decoding', 0.05, 'Loading model…');
  const [planBuf, modelBuf, config] = await Promise.all([
    fetch(PLAN_URL).then((r) => {
      if (!r.ok) throw new Error(`plan fetch ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(MODEL_URL).then((r) => {
      if (!r.ok) throw new Error(`model fetch ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(CONFIG_URL).then((r) => {
      if (!r.ok) throw new Error(`config fetch ${r.status}`);
      return r.json();
    }),
  ]);
  if (cancelled) return;
  plan = decodePlan(new Uint8Array(planBuf));
  vocab = (config as { chordVocab: string[] }).chordVocab;
  postProgress('decoding', 0.4, 'Initializing inference session…');
  session = await ort.InferenceSession.create(modelBuf, {
    executionProviders: ['wasm'],
  });
  if (cancelled) return;
  postProgress('decoding', 1, 'Ready');
}

interface AnalyzePayload {
  samples: Float32Array;
}

async function analyze(payload: AnalyzePayload): Promise<void> {
  if (!session || !plan || !vocab.length) {
    await preload();
  }
  if (cancelled) return;

  const { samples } = payload;
  const t0 = performance.now();

  // --- CQT ---
  postProgress('cqt', 0.0, 'Computing CQT…');
  const { frameCount, features } = computeCqt(samples, plan!);
  if (cancelled) return;

  // feature stats (diagnostics)
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < features.length; i++) {
    sum += features[i];
    sumSq += features[i] * features[i];
  }
  const n = features.length;
  const meanFeature = sum / n;
  const stdFeature = Math.sqrt(sumSq / n - meanFeature * meanFeature);

  // --- ONNX inference ---
  postProgress('inferring', 0.0, 'Running chord model…');
  const windowsNeeded = Math.ceil(frameCount / SEQ);
  const rawLabels = new Int32Array(frameCount);

  for (let start = 0; start < windowsNeeded; start += WINDOWS) {
    if (cancelled) return;
    const data = new Float32Array(WINDOWS * SEQ * BINS);
    for (let w = 0; w < WINDOWS; w++) {
      const windowIndex = start + w;
      for (let s = 0; s < SEQ; s++) {
        const srcFrame = Math.min(windowIndex * SEQ + s, frameCount - 1);
        const dst = (w * SEQ + s) * BINS;
        data.set(features.subarray(srcFrame * BINS, (srcFrame + 1) * BINS), dst);
      }
    }
    const tensor = new ort.Tensor('float32', data, [WINDOWS, SEQ, BINS]);
    const out = await session!.run({ features: tensor });
    const logits = out[session!.outputNames[0]];
    const [, seqLen, classes] = logits.dims;
    const stride = seqLen * classes;
    const batch = Math.min(WINDOWS, windowsNeeded - start);
    for (let w = 0; w < batch; w++) {
      for (let s = 0; s < SEQ; s++) {
        const frame = (start + w) * SEQ + s;
        if (frame >= frameCount) break;
        const base = w * stride + s * classes;
        let best = 0;
        for (let c = 1; c < classes; c++) {
          if (logits.data[base + c] > logits.data[base + best]) best = c;
        }
        rawLabels[frame] = best;
      }
    }
    const done = Math.min(start + WINDOWS, windowsNeeded);
    postProgress('inferring', done / windowsNeeded, `Inference ${done}/${windowsNeeded} windows`);
  }
  if (cancelled) return;

  // --- 9-frame smoothing ---
  postProgress('smoothing', 0.0, 'Smoothing…');
  const half = Math.floor(SMOOTH_K / 2);
  const smoothed = new Int32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const counts = new Map<number, number>();
    for (let d = -half; d <= half; d++) {
      const g = Math.min(Math.max(f + d, 0), frameCount - 1);
      const c = rawLabels[g];
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    let bestC = rawLabels[f];
    let bestN = -1;
    for (const [c, count] of counts) {
      if (count > bestN || (count === bestN && c === rawLabels[f])) {
        bestN = count;
        bestC = c;
      }
    }
    smoothed[f] = bestC;
  }

  // --- run-length segments -> model labels ---
  interface Seg { label: string; start: number; end: number }
  const segs: Seg[] = [];
  for (let f = 0; f < frameCount; f++) {
    const label = vocab[smoothed[f]];
    if (segs.length && segs[segs.length - 1].label === label) {
      segs[segs.length - 1].end = f + 1;
    } else {
      segs.push({ label, start: f, end: f + 1 });
    }
  }

  // --- X -> hold previous; build display labels ---
  const displayLabels: (string | null)[] = segs.map((s) => displayChord(s.label));
  for (let i = 0; i < displayLabels.length; i++) {
    if (displayLabels[i] === null) {
      displayLabels[i] = i > 0 ? displayLabels[i - 1] : 'N.C.';
    }
  }

  // --- SyncedChordFrame[] ---
  const frames: SyncedChordFrame[] = segs.map((s, i) => {
    const chord = displayLabels[i] ?? 'N.C.';
    const next = i + 1 < displayLabels.length ? displayLabels[i + 1] : null;
    const prev = i > 0 ? displayLabels[i - 1] : null;
    return {
      startTime: s.start * FRAME_DUR,
      endTime: s.end * FRAME_DUR,
      chord,
      nextChord: next,
      prevChord: prev,
      lineIndex: 0, // filled in below when rows are built
    };
  });

  // --- AnalysisRow[] (group ~4 chords / ~8s per row) ---
  const rows: AnalysisRow[] = [];
  let rowStart = 0;
  let rowChords: Seg[] = [];
  let rowDuration = 0;
  const flushRow = (endIdx: number) => {
    if (rowChords.length === 0) return;
    const startFrame = rowChords[0].start;
    const endFrame = rowChords[rowChords.length - 1].end;
    const startTime = startFrame * FRAME_DUR;
    const endTime = endFrame * FRAME_DUR;
    const tokens = rowChords.map((s, k) => ({
      time: s.start * FRAME_DUR,
      chord: displayLabels[rowStart + k] ?? 'N.C.',
      duration: (s.end - s.start) * FRAME_DUR,
    }));
    rows.push({
      index: rows.length,
      startTime,
      endTime,
      label: `Section ${rows.length + 1}`,
      tokens,
    });
    // assign lineIndex on the frames that belong to this row
    for (let k = 0; k < rowChords.length; k++) {
      frames[rowStart + k].lineIndex = rows.length - 1;
    }
    rowStart += rowChords.length;
    rowChords = [];
    rowDuration = 0;
  };

  for (let i = 0; i < segs.length; i++) {
    rowChords.push(segs[i]);
    rowDuration += (segs[i].end - segs[i].start) * FRAME_DUR;
    const enoughChords = rowChords.length >= 4;
    const enoughTime = rowDuration >= 8;
    const last = i === segs.length - 1;
    if (last || (enoughChords && enoughTime)) {
      flushRow(i);
    }
  }

  postProgress('smoothing', 1, 'Done');

  const analysedMs = performance.now() - t0;
  self.postMessage({
    type: 'SUCCESS',
    payload: {
      frameCount,
      frames,
      rows,
      meta: {
        backend: 'wasm' as const,
        modelId: 'musetric/chordmini-onnx',
        frameDuration: FRAME_DUR,
        analysedMs,
        meanFeature: meanFeature,
        stdFeature: stdFeature,
      },
    },
  });
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data as { type: string; payload?: unknown };
  if (type === 'PRELOAD') {
    preload()
      .then(() => self.postMessage({ type: 'SUCCESS', payload: null }))
      .catch((err) => self.postMessage({ type: 'ERROR', payload: String(err) }));
    return;
  }
  if (type === 'ANALYZE') {
    cancelled = false;
    analyze(payload as AnalyzePayload)
      .catch((err) => {
        if (!cancelled) self.postMessage({ type: 'ERROR', payload: String(err) });
      });
    return;
  }
  if (type === 'CANCEL') {
    cancelled = true;
    return;
  }
};
