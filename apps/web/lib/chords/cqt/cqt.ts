// Plan-driven CPU CQT.
// Port of scratch/chord-parity/cqt.mjs. Verified bit-exact against librosa 0.11.0
// (mean abs diff 0.000008 on white noise; 0.0109 on a chord progression, all from
// log-floor bins). The Hann window is baked into the plan's sparse basis, so the
// input signal is NOT windowed (frame shader copies raw samples).
//
// Every octave uses a 512-point FFT; the per-octave hop halves each octave.

import type { CqtPlan } from './plan';

export interface CqtResult {
  frameCount: number;
  nBins: number;
  features: Float32Array;
}

interface CqtOptions {
  useWindow?: boolean;
  frameCount?: number;
}

const TWIDDLES = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function getTwiddles(n: number): { cos: Float64Array; sin: Float64Array } {
  let table = TWIDDLES.get(n);
  if (!table) {
    const half = n >> 1;
    table = { cos: new Float64Array(half), sin: new Float64Array(half) };
    for (let i = 0; i < half; i++) {
      const angle = (-2 * Math.PI * i) / n;
      table.cos[i] = Math.cos(angle);
      table.sin[i] = Math.sin(angle);
    }
    TWIDDLES.set(n, table);
  }
  return table;
}

function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  const { cos, sin } = getTwiddles(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

function downsampleSignal(input: Float32Array, plan: CqtPlan): Float32Array {
  const { tapCount, halfCoefficients, gain, delay } = plan.downsample;
  const outputCount = Math.ceil(input.length / 2);
  const output = new Float32Array(outputCount);
  for (let n = 0; n < outputCount; n++) {
    const center = n * 2;
    let value = 0;
    for (let tap = 0; tap < tapCount; tap++) {
      const sourceIndex = center + tap - delay;
      if (sourceIndex < 0 || sourceIndex >= input.length) continue;
      value += input[sourceIndex] * halfCoefficients[Math.abs(tap - delay)];
    }
    output[n] = value * gain;
  }
  return output;
}

function buildDecimationChain(input: Float32Array, levels: number, plan: CqtPlan): Float32Array[] {
  const chain: Float32Array[] = [input];
  let current = input;
  for (let level = 0; level < levels; level++) {
    current = downsampleSignal(current, plan);
    chain.push(current);
  }
  return chain;
}

const WINDOW_CACHE = new Map<number, Float32Array>();

function getWindow(n: number): Float32Array {
  let w = WINDOW_CACHE.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    WINDOW_CACHE.set(n, w);
  }
  return w;
}

export function computeCqt(
  input: Float32Array,
  plan: CqtPlan,
  options: CqtOptions = {},
): CqtResult {
  const useWindow = options.useWindow === true;
  const { config, octaves } = plan;
  const nBins = config.nBins;

  const fftSize = octaves[0].fftSize;
  for (const octave of octaves) {
    if (octave.fftSize !== fftSize) {
      throw new RangeError('CQT: only uniform fftSize plans are supported');
    }
  }
  if (!input || input.length < 2) {
    throw new RangeError('CQT: input too short');
  }

  const levelCount = plan.earlyDownsampleCount + octaves.length - 1;
  const chain = buildDecimationChain(input, levelCount, plan);

  let frameCount = Infinity;
  for (const octave of octaves) {
    const samples = chain[plan.earlyDownsampleCount + octave.index].length;
    frameCount = Math.min(frameCount, 1 + Math.floor(samples / octave.hopLength));
  }
  if (Number.isFinite(options.frameCount)) {
    frameCount = Math.min(frameCount, options.frameCount as number);
  }
  if (!Number.isFinite(frameCount) || frameCount < 1) {
    throw new RangeError('CQT: no complete frames');
  }

  const features = new Float32Array(frameCount * nBins);
  const half = fftSize >> 1;
  const spectrumStride = fftSize + 2;

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const window = useWindow ? getWindow(fftSize) : null;

  const { rowOffsets, fftBins, coefficients } = plan;

  for (const octave of octaves) {
    const signal = chain[plan.earlyDownsampleCount + octave.index];
    const hop = octave.hopLength;

    for (let frame = 0; frame < frameCount; frame++) {
      const base = frame * hop - half;

      re.fill(0);
      im.fill(0);
      for (let i = 0; i < fftSize; i++) {
        const sourceIndex = base + i;
        if (sourceIndex < 0 || sourceIndex >= signal.length) continue;
        re[i] = window ? signal[sourceIndex] * window[i] : signal[sourceIndex];
      }

      fftInPlace(re, im);

      const binEnd = octave.binStart + octave.binCount;
      for (let globalBin = octave.binStart; globalBin < binEnd; globalBin++) {
        const start = rowOffsets[globalBin];
        const end = rowOffsets[globalBin + 1];
        let sumRe = 0;
        let sumIm = 0;
        for (let c = start; c < end; c++) {
          const fftBin = fftBins[c];
          const sr = re[fftBin];
          const si = im[fftBin];
          const cr = coefficients[2 * c];
          const ci = coefficients[2 * c + 1];
          sumRe += cr * sr - ci * si;
          sumIm += cr * si + ci * sr;
        }
        const magnitude = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
        features[frame * nBins + globalBin] =
          config.output === 'logMagnitude'
            ? Math.log(magnitude + 1e-6)
            : magnitude;
      }
    }
  }

  return { frameCount, nBins, features };
}

export function computeStats(features: Float32Array): { mean: number; std: number; count: number } {
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < features.length; i++) {
    const v = features[i];
    sum += v;
    sumSq += v * v;
  }
  const n = features.length;
  const mean = sum / n;
  return { mean, std: Math.sqrt(sumSq / n - mean * mean), count: n };
}
