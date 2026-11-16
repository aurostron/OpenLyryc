'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnnouncementPayload {
  id: string;
  enabled?: boolean;
  title?: string;
  message: string;
  urgent?: boolean;
  normal?: boolean;
  downtime?: boolean;
  emergency?: boolean;
  type?: 'urgent' | 'normal' | 'downtime';
  link?: string;
  linkText?: string;
  autoCollapseMs?: number;
}

interface AnnouncementBarProps {
  /** Optional override for manual testing or previewing without fetching JSON */
  override?: AnnouncementPayload;
  /** Poll interval in milliseconds (default: 5 minutes) */
  pollIntervalMs?: number;
}

interface DismissedRecord {
  kind: 'urgent' | 'normal';
  message: string;
  title?: string;
  id?: string;
  dismissedAt: number;
}

const DISMISSED_STORAGE_KEY_V2 = 'openlyryc:announcement:dismissed:v2';
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_AUTO_COLLAPSE_MS = 8000; // 8 seconds

function getDismissedRecords(): Record<string, DismissedRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY_V2);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Checks whether this announcement was already dismissed.
 * Dismissal is strictly scoped by KIND ('urgent' vs 'normal') and CONTENT (message + title):
 * - Downtime is NEVER dismissed (always displays).
 * - If the kind changed (e.g. from normal toast to urgent yellow bar), it shows.
 * - If the message content changed, it shows regardless of prior dismissals.
 */
function isDismissed(kind: 'urgent' | 'normal' | 'downtime', message: string, title?: string): boolean {
  if (typeof window === 'undefined' || !message) return false;
  if (kind === 'downtime') return false;

  try {
    const records = getDismissedRecords();
    const record = records[kind];
    if (!record) return false;

    const cleanCurrentMsg = message.trim();
    const cleanDismissedMsg = (record.message || '').trim();
    const cleanCurrentTitle = (title || '').trim();
    const cleanDismissedTitle = (record.title || '').trim();

    // If either message or title is different, the announcement was NOT dismissed
    if (cleanCurrentMsg !== cleanDismissedMsg) return false;
    if (cleanCurrentTitle !== cleanDismissedTitle) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a dismissal record for this specific kind and message content.
 */
function markDismissed(kind: 'urgent' | 'normal', message: string, title?: string, id?: string): void {
  if (typeof window === 'undefined' || !message) return;
  try {
    const records = getDismissedRecords();
    records[kind] = {
      kind,
      message: message.trim(),
      title: (title || '').trim(),
      id,
      dismissedAt: Date.now(),
    };
    window.localStorage.setItem(DISMISSED_STORAGE_KEY_V2, JSON.stringify(records));
  } catch {
    // Storage unavailable or quota exceeded
  }
}

/**
 * Universal Announcement System:
 * - Reads from the single canonical /announcements.json
 * - Re-fetches only on page mount / refresh and every 5 minutes (no continuous hammering)
 * - Cache-busted with unique timestamp query param on every fetch
 * - Supports 3 modes:
 *    1. urgent=true -> Pinned top yellow banner with dismiss button
 *    2. downtime=true / emergency=true -> Fullscreen eye-protector style minimalist UI (locked, unbypassable)
 *    3. normal=true (default) -> High-contrast white card toast at the bottom-right corner with auto-collapse
 */
export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  override,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}) => {
  const [payload, setPayload] = useState<AnnouncementPayload | null>(override ?? null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [toastVisible, setToastVisible] = useState<boolean>(true);
  const [toastCollapsed, setToastCollapsed] = useState<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAnnouncement = useCallback(async () => {
    if (override) {
      setPayload(override);
      const mode = override.urgent ? 'urgent' : override.downtime ? 'downtime' : 'normal';
      setDismissed(isDismissed(mode, override.message, override.title));
      return;
    }

    try {
      // Aggressive cache-busting to prevent stale CDN/browser HTTP cache
      const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fetchOptions: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
          Pragma: 'no-cache',
        },
      };

      const res = await fetch(`/announcements.json?_t=${nonce}`, fetchOptions);
      if (!res.ok) {
        setPayload(null);
        return;
      }

      const data = (await res.json()) as Partial<AnnouncementPayload>;
      if (!data || typeof data.message !== 'string' || !data.message.trim() || data.enabled === false) {
        setPayload(null);
        return;
      }

      if (!data || !data.message) {
        setPayload(null);
        return;
      }

      const nextPayload: AnnouncementPayload = {
        id: typeof data.id === 'string' && data.id ? data.id : 'default',
        enabled: true,
        title: data.title?.trim(),
        message: data.message.trim(),
        urgent: Boolean(data.urgent || data.type === 'urgent'),
        downtime: Boolean(data.downtime || data.emergency || data.type === 'downtime'),
        emergency: Boolean(data.emergency),
        normal: Boolean(data.normal || data.type === 'normal'),
        link: data.link?.trim(),
        linkText: data.linkText?.trim(),
        autoCollapseMs: typeof data.autoCollapseMs === 'number' ? data.autoCollapseMs : DEFAULT_AUTO_COLLAPSE_MS,
      };

      setPayload(nextPayload);
      const activeMode: 'urgent' | 'normal' | 'downtime' = nextPayload.urgent
        ? 'urgent'
        : nextPayload.downtime
        ? 'downtime'
        : 'normal';

      // Check dismissal scoped to this exact kind and content
      setDismissed(isDismissed(activeMode, nextPayload.message, nextPayload.title));
    } catch {
      // Network failure or blocked — fail silently
    }
  }, [override]);

  // Re-fetch only when refreshed (page mount) or periodically every 5 minutes
  useEffect(() => {
    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, pollIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [fetchAnnouncement, pollIntervalMs]);

  // Handle toast auto-collapse for normal notifications
  useEffect(() => {
    if (!payload || dismissed || !payload.enabled) return;
    const isNormal = payload.normal || (!payload.urgent && !payload.downtime);
    if (!isNormal) return;

    setToastVisible(true);
    setToastCollapsed(false);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const duration = payload.autoCollapseMs || DEFAULT_AUTO_COLLAPSE_MS;

    toastTimeoutRef.current = setTimeout(() => {
      setToastCollapsed(true);
    }, duration);

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [payload?.id, payload?.enabled, payload?.normal, payload?.urgent, payload?.downtime, payload?.message, dismissed]);

  if (!payload || !payload.enabled || !payload.message) {
    return null;
  }

  const isDowntime = Boolean(payload.downtime || payload.emergency || payload.type === 'downtime');
  const isUrgent = Boolean(payload.urgent || payload.type === 'urgent');

  const handleDismiss = () => {
    if (!payload) return;
    const mode: 'urgent' | 'normal' = isUrgent ? 'urgent' : 'normal';
    markDismissed(mode, payload.message, payload.title, payload.id);
    setDismissed(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DOWNTIME / EMERGENCY FULLSCREEN OVERLAY (Eye-protector aesthetic)
  // Downtime is a critical system state: it MUST ALWAYS show regardless of prior dismissal
  // ─────────────────────────────────────────────────────────────────────────────
  if (isDowntime) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 select-none bg-[#070709]/90 backdrop-blur-3xl overflow-hidden font-sans"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {/* Subtle Ambient Background Glow matching Eye Protector */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-emerald-500/5 blur-3xl opacity-70 animate-pulse" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-3xl flex flex-col items-center text-center px-4 font-sans"
        >
          {/* Giant Heading in Sans */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.08] text-balance">
            {payload.title || 'Under Maintenance'}
          </h1>

          {/* Subtitle / Message */}
          <p className="text-base sm:text-xl md:text-2xl text-zinc-300 font-light mt-5 sm:mt-7 tracking-normal max-w-2xl leading-relaxed text-balance">
            {payload.message}
          </p>

          {/* Optional Action / Status Link */}
          {payload.link && (
            <a
              href={payload.link}
              target="_blank"
              rel="noreferrer"
              className="mt-8 px-6 py-2.5 rounded-full bg-white text-zinc-950 font-medium text-xs sm:text-sm hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-lg"
            >
              <span>{payload.linkText || 'Check status'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </motion.div>
      </div>
    );
  }

  // Normal and Urgent notifications respect user dismissal
  if (dismissed) {
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. URGENT TOP BANNER (Reworked Yellow alert bar in crisp Sans typography)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isUrgent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="announcement-bar sticky top-0 z-50 w-full shrink-0 bg-amber-400 text-zinc-950 border-b border-black/15 font-sans select-none"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <div className="mx-auto flex h-9 max-w-7xl items-center gap-2 px-3 sm:px-4 text-xs font-sans">
          {/* Left spacer balances the dismiss button so text stays optically centered */}
          <span aria-hidden="true" className="hidden w-7 shrink-0 sm:block" />

          <div className="flex-1 min-w-0 truncate text-center font-sans">
            {payload.title && (
              <span className="font-bold text-black mr-1.5 inline-block font-sans">
                {payload.title}:
              </span>
            )}
            <span className="font-semibold text-zinc-950 tracking-tight font-sans">
              {payload.message}
            </span>

            {payload.link && (
              <a
                href={payload.link}
                target="_blank"
                rel="noreferrer"
                className="ml-2.5 font-bold underline underline-offset-2 hover:opacity-80 transition-opacity inline-flex items-center gap-0.5 text-zinc-950 font-sans"
              >
                <span>{payload.linkText || 'Details'}</span>
                <ExternalLink className="w-3 h-3 inline-block" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            title="Dismiss announcement"
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-900/70 hover:text-zinc-950 hover:bg-black/10 active:scale-95 transition-all"
          >
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. NORMAL NOTIFICATION TOAST (White background, black text, bottom-right corner)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {toastVisible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            height: toastCollapsed ? 'auto' : 'auto',
          }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] pointer-events-auto font-sans select-none"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <div className="relative rounded-2xl bg-white/95 border border-black/10 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl text-zinc-900 overflow-hidden ring-1 ring-black/[0.05]">
            <div className="flex items-start justify-between gap-3 font-sans">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => setToastCollapsed((prev) => !prev)}
              >
                {payload.title && (
                  <h4 className="text-xs font-semibold text-zinc-950 tracking-tight truncate font-sans">
                    {payload.title}
                  </h4>
                )}
                <p
                  className={`text-xs text-zinc-700 leading-relaxed font-normal transition-all font-sans ${
                    toastCollapsed && payload.title
                      ? 'line-clamp-1 mt-0.5 text-zinc-500'
                      : payload.title
                      ? 'mt-1'
                      : 'mt-0'
                  }`}
                >
                  {payload.message}
                </p>

                {payload.link && !toastCollapsed && (
                  <a
                    href={payload.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-950 hover:underline mt-2.5 transition-all font-sans"
                  >
                    <span>{payload.linkText || 'Learn more'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-6 h-6 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.06] transition-colors flex items-center justify-center cursor-pointer"
                  aria-label="Dismiss"
                  title="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Subtle auto-collapse progress line: black with soft opacity */}
            {!toastCollapsed && (
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{
                  duration: (payload.autoCollapseMs || DEFAULT_AUTO_COLLAPSE_MS) / 1000,
                  ease: 'linear',
                }}
                className="absolute bottom-0 left-0 h-0.5 bg-black/15"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
