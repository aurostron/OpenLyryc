/**
 * Alve Town day-night scene grading — faithful port of lively-alve (Gabrz).
 *
 * Original: assets/scripts/scene.js (phase timeline, lights, stars) +
 * assets/scripts/main.js (sceneCycle filter tables per layer), driven by
 * sunrise/sunset (weather API or the 05:20 / 22:00 defaults from
 * LivelyProperties.json).
 *
 * Adaptation: weather API omitted (defaults always); the 6 layer triples are
 * kept EXACT (sky_0/1/2, sign, city_1/2) since OpenLyryc stacks the original
 * layers 1:1. No clock display — the scene only *syncs* to local time.
 */

export type AlvePhaseName = 'night' | 'morning' | 'noon' | 'afternoon';

/** Lively layer element ids, in stack order. */
export type AlveLayerId = 'sky0' | 'sky3' | 'sky1' | 'sky2' | 'sign' | 'city1' | 'city2';

interface PhaseTriple {
  bri: number;
  sat: number;
  hue: number;
}

type PhaseTable = Record<AlveLayerId, PhaseTriple>;

// Exact tables from lively main.js sceneCycle (sceneS0/S1/S2/S/C1/C2).
const NIGHT: PhaseTable = {
  sky0: { bri: 0, sat: 0.9, hue: 0 },
  sky3: { bri: 0, sat: 0.9, hue: 0 },
  sky1: { bri: 0.2, sat: 1, hue: 24 },
  sky2: { bri: 0.2, sat: 2, hue: 0 },
  sign: { bri: 0.55, sat: 0.65, hue: 0 },
  city1: { bri: 0.3, sat: 1, hue: 0 },
  city2: { bri: 0.3, sat: 1, hue: 0 },
};

const MORNING: PhaseTable = {
  sky0: { bri: 0.9, sat: 1, hue: 14 },
  sky3: { bri: 0.9, sat: 1, hue: 14 },
  sky1: { bri: 0.8, sat: 0.8, hue: 32 },
  sky2: { bri: 0.8, sat: 1, hue: 49 },
  sign: { bri: 0.8, sat: 0.8, hue: 0 },
  city1: { bri: 0.8, sat: 0.6, hue: 0 },
  city2: { bri: 0.8, sat: 0.9, hue: 0 },
};

const NOON: PhaseTable = {
  sky0: { bri: 1, sat: 1, hue: 0 },
  sky3: { bri: 1, sat: 1, hue: 0 },
  sky1: { bri: 1, sat: 1, hue: 0 },
  sky2: { bri: 1, sat: 1, hue: 0 },
  sign: { bri: 1, sat: 1, hue: 0 },
  city1: { bri: 1, sat: 1, hue: 0 },
  city2: { bri: 1, sat: 1, hue: 0 },
};

const AFTERNOON: PhaseTable = {
  sky0: { bri: 0.8, sat: 1.4, hue: 28 },
  sky3: { bri: 0.8, sat: 1.4, hue: 28 },
  sky1: { bri: 1, sat: 1, hue: 34 },
  sky2: { bri: 0.9, sat: 1.1, hue: 59 },
  sign: { bri: 0.9, sat: 0.9, hue: -15 },
  city1: { bri: 0.9, sat: 1.4, hue: -17 },
  city2: { bri: 0.7, sat: 1.4, hue: 16 },
};

// Transition margins from scene.js (minutes).
const OUTER_MARGIN = 90;
const INNER_MARGIN = 30;

function lerp(a: number, b: number, t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return a + (b - a) * c;
}

function blendTable(from: PhaseTable, to: PhaseTable, t: number): PhaseTable {
  const out = {} as PhaseTable;
  (Object.keys(from) as AlveLayerId[]).forEach((k) => {
    out[k] = {
      bri: lerp(from[k].bri, to[k].bri, t),
      sat: lerp(from[k].sat, to[k].sat, t),
      hue: lerp(from[k].hue, to[k].hue, t),
    };
  });
  return out;
}

function parseDayMinutes(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm || '').trim());
  if (!m) return fallback;
  return (Number(m[1]) % 24) * 60 + Math.min(59, Number(m[2]));
}

export interface AlveSceneState {
  filters: Record<AlveLayerId, string>;
  /** Stars (sky_3) opacity 0..0.4 — port of updateSceneStars. */
  starsOpacity: number;
  /** Sign/house lights overlays visible — port of drawScene light toggles. */
  lightsSign: boolean;
  lightsCity: boolean;
  phase: AlvePhaseName;
}

function css(t: PhaseTriple): string {
  return `brightness(${t.bri.toFixed(3)}) saturate(${t.sat.toFixed(3)}) hue-rotate(${t.hue.toFixed(1)}deg)`;
}

/**
 * Computes the full lively scene state for a moment in time. Mirrors
 * scene.js drawScene() branch order; sunrise/sunset default to 05:20 / 22:00.
 */
export function getAlveSceneState(
  now: Date = new Date(),
  sunrise = '05:20',
  sunset = '22:00'
): AlveSceneState {
  const t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const rise = parseDayMinutes(sunrise, 5 * 60 + 20);
  const set = parseDayMinutes(sunset, 22 * 60);

  let table: PhaseTable = NOON;
  let phase: AlvePhaseName = 'noon';
  let stars = 0;

  if (t < rise - OUTER_MARGIN || t >= set + OUTER_MARGIN) {
    table = NIGHT; phase = 'night'; stars = 0.4; // Night
  } else if (t < rise - INNER_MARGIN) {
    table = blendTable(NIGHT, MORNING, (t - (rise - OUTER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
    phase = 'morning'; // Night → Morning
    stars = 0.4 * (1 - (t - (rise - OUTER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
  } else if (t < rise + INNER_MARGIN) {
    table = MORNING; phase = 'morning'; // Morning
  } else if (t < rise + OUTER_MARGIN) {
    table = blendTable(MORNING, NOON, (t - (rise + INNER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
    phase = 'morning'; // Morning → Noon
  } else if (t < set - OUTER_MARGIN) {
    table = NOON; phase = 'noon'; // Noon
  } else if (t < set - INNER_MARGIN) {
    table = blendTable(NOON, AFTERNOON, (t - (set - OUTER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
    phase = 'afternoon'; // Noon → Afternoon
  } else if (t < set + INNER_MARGIN) {
    table = AFTERNOON; phase = 'afternoon'; // Afternoon
  } else {
    table = blendTable(AFTERNOON, NIGHT, (t - (set + INNER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
    phase = 'night'; // Afternoon → Night
    stars = 0.4 * ((t - (set + INNER_MARGIN)) / (OUTER_MARGIN - INNER_MARGIN));
  }

  const filters = {} as Record<AlveLayerId, string>;
  (Object.keys(table) as AlveLayerId[]).forEach((k) => {
    filters[k] = css(table[k]);
  });

  return {
    filters,
    starsOpacity: Math.min(0.4, Math.max(0, stars)),
    lightsSign: t >= set + INNER_MARGIN * 1.5 || t < rise - INNER_MARGIN * 1.5,
    lightsCity: t >= set + INNER_MARGIN * 2 && t < set + OUTER_MARGIN * 2,
    phase,
  };
}
