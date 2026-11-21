// CQT plan artifact decoder.
// Port of packages/cqt/src/cqt/planDecode.es.ts (MIT) - binary layout documented in
// scratch/chord-parity/plan.mjs and verified against librosa 0.11.0 in Phase 1.
//
// Header = 128 bytes, little-endian. Payload offsets are absolute from the start of
// the file.

export interface CqtConfig {
  sampleRate: number;
  hopLength: number;
  nBins: number;
  binsPerOctave: number;
  fmin: number;
  output: 'magnitude' | 'logMagnitude';
}

export interface CqtOctavePlan {
  index: number;
  sampleRate: number;
  hopLength: number;
  fftSize: number;
  binStart: number;
  binCount: number;
}

export interface HalfBandDownsamplePlan {
  tapCount: number;
  halfCoefficients: Float32Array;
  gain: number;
  delay: number;
  boundary: 'constant';
}

export interface CqtPlan {
  formatVersion: number;
  generator: string;
  config: CqtConfig;
  earlyDownsampleCount: number;
  octaves: readonly CqtOctavePlan[];
  rowOffsets: Uint32Array;
  fftBins: Uint32Array;
  coefficients: Float32Array;
  binLengths: Float32Array;
  downsample: HalfBandDownsamplePlan;
  payloadSha256: string;
}

const MAGIC = 0x5451434d;
const HEADER_BYTES = 128;
const OCTAVE_BYTES = 32;

export function decodePlan(bytes: Uint8Array): CqtPlan {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new RangeError('CQT plan: shorter than header');
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(0, true) !== MAGIC) {
    throw new RangeError('CQT plan: bad magic');
  }
  const formatVersion = data.getUint32(4, true);
  if (data.getUint32(8, true) !== HEADER_BYTES) {
    throw new RangeError('CQT plan: unsupported header size');
  }
  const payloadEnd = HEADER_BYTES + data.getUint32(60, true);
  if (payloadEnd !== bytes.byteLength) {
    throw new RangeError('CQT plan: bad payload size');
  }
  const outputKind = data.getUint32(12, true);
  if (outputKind > 1) {
    throw new RangeError('CQT plan: unsupported output kind');
  }

  const config: CqtConfig = {
    sampleRate: data.getFloat64(16, true),
    hopLength: data.getUint32(24, true),
    nBins: data.getUint32(28, true),
    binsPerOctave: data.getUint32(32, true),
    fmin: data.getFloat64(40, true),
    output: outputKind === 0 ? 'magnitude' : 'logMagnitude',
  };
  const earlyDownsampleCount = data.getUint32(36, true);
  const octaveCount = data.getUint32(48, true);
  const tapCount = data.getUint32(52, true);
  const coefficientCount = data.getUint32(56, true);
  const generatorByteLength = data.getUint32(64, true);
  const generatorOffset = data.getUint32(68, true);
  const octavesOffset = data.getUint32(72, true);
  const rowOffsetsOffset = data.getUint32(76, true);
  const fftBinsOffset = data.getUint32(80, true);
  const coefficientsOffset = data.getUint32(84, true);
  const binLengthsOffset = data.getUint32(88, true);
  const downsampleOffset = data.getUint32(92, true);

  const octaves: CqtOctavePlan[] = [];
  for (let index = 0; index < octaveCount; index++) {
    const base = octavesOffset + index * OCTAVE_BYTES;
    octaves.push({
      index: data.getUint32(base, true),
      sampleRate: data.getFloat64(base + 4, true),
      hopLength: data.getUint32(base + 12, true),
      fftSize: data.getUint32(base + 16, true),
      binStart: data.getUint32(base + 20, true),
      binCount: data.getUint32(base + 24, true),
    });
  }

  let generator = '';
  for (let index = 0; index < generatorByteLength; index++) {
    generator += String.fromCharCode(bytes[generatorOffset + index]);
  }

  let payloadSha256 = '';
  for (let index = 0; index < 32; index++) {
    payloadSha256 += data.getUint8(96 + index).toString(16).padStart(2, '0');
  }

  const rowCount = config.nBins + 1;
  const halfCoefficientCount = (tapCount + 1) / 2;

  return {
    formatVersion,
    generator,
    config,
    earlyDownsampleCount,
    octaves,
    rowOffsets: new Uint32Array(
      bytes.buffer,
      bytes.byteOffset + rowOffsetsOffset,
      rowCount,
    ),
    fftBins: new Uint32Array(
      bytes.buffer,
      bytes.byteOffset + fftBinsOffset,
      coefficientCount,
    ),
    coefficients: new Float32Array(
      bytes.buffer,
      bytes.byteOffset + coefficientsOffset,
      coefficientCount * 2,
    ),
    binLengths: new Float32Array(
      bytes.buffer,
      bytes.byteOffset + binLengthsOffset,
      config.nBins,
    ),
    downsample: {
      tapCount,
      halfCoefficients: new Float32Array(
        bytes.buffer,
        bytes.byteOffset + downsampleOffset,
        halfCoefficientCount,
      ),
      gain: Math.SQRT2,
      delay: (tapCount - 1) / 2,
      boundary: 'constant',
    },
    payloadSha256,
  };
}
