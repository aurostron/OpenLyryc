/**
 * The web counterpart of the phone app's TrackLog, for the Studio Connect
 * port: every step of resolving and playing a track, tagged with the track
 * it's about, kept in memory (console + a capped ring buffer the StudioPage
 * exposes for debugging). No UI of its own.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogLine {
  id: number;
  /** ms since the page loaded (performance.now), for readable relative timing. */
  t: number;
  level: LogLevel;
  /** The videoId the line is about, so a track's lines can be filtered out of the stream. */
  about: string | null;
  message: string;
}

const MAX_LINES = 1500;
const lines: LogLine[] = [];
let nextId = 0;

function push(level: LogLevel, message: string, about: string | null) {
  const line: LogLine = { id: nextId++, t: performance.now(), level, about, message };
  if (lines.length >= MAX_LINES) lines.shift();
  lines.push(line);
  const tag = about ? `[${about}] ` : '';
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.debug;
  out(`StudioConnect ${tag}${message}`);
}

export const trackLog = {
  d: (message: string, about: string | null = null) => push('debug', message, about),
  i: (message: string, about: string | null = null) => push('info', message, about),
  w: (message: string, about: string | null = null) => push('warn', message, about),
  e: (message: string, about: string | null = null) => push('error', message, about),
  /** A snapshot of the ring buffer, newest last. For diagnostics only. */
  dump: (): readonly LogLine[] => [...lines],
  clear: () => {
    lines.length = 0;
  },
};

/** Runs [block], logging how long it took whatever the outcome. */
export async function timed<T>(label: string, about: string | null, block: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await block();
  } finally {
    trackLog.d(`TIMING ${label}: ${Math.round(performance.now() - start)}ms`, about);
  }
}
