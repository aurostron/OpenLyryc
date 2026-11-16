'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LintIssue } from '@/lib/syncLinter';
import { AlertCircle, AlertTriangle, Check, CheckCheck, X } from 'lucide-react';

interface SyncLintBadgeProps {
  issues: LintIssue[];
  onJumpToLine: (lineIndex: number) => void;
  onAutoFix: () => void;
  onFixSingleIssue?: (issue: LintIssue) => void;
}

export const SyncLintBadge: React.FC<SyncLintBadgeProps> = ({
  issues,
  onJumpToLine,
  onAutoFix,
  onFixSingleIssue,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<number | null>(null);

  // Auto-close after brief delay when all issues become resolved while open
  useEffect(() => {
    if (open && issues.length === 0) {
      autoCloseTimerRef.current = window.setTimeout(() => {
        setOpen(false);
      }, 1500);
      return () => {
        if (autoCloseTimerRef.current) window.clearTimeout(autoCloseTimerRef.current);
      };
    }
  }, [open, issues.length]);

  // Handle outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Clean hide when closed and empty
  if (!open && issues.length === 0) return null;

  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return (
    <div ref={containerRef} className="relative inline-block select-none">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Check sync timing issues"
        className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-md ${
          issues.length === 0
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
            : errorCount > 0
            ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
            : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
        }`}
      >
        {issues.length === 0 ? (
          <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
        ) : errorCount > 0 ? (
          <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
        )}
        <span>
          {issues.length === 0
            ? 'In Sync'
            : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute top-10 right-0 z-50 w-84 max-w-[92vw] bg-[#111115]/98 border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white font-sans">
                  Timing Health
                </span>
                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full bg-white/[0.08] text-zinc-300">
                  {issues.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {issues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onAutoFix();
                    }}
                    title="Auto-fix all timing collisions, gaps, and word tokens"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-zinc-950 text-[11px] font-bold hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <CheckCheck className="w-3 h-3 stroke-[2.5]" />
                    <span>Fix All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            {issues.length === 0 ? (
              <div className="p-5 flex flex-col items-center justify-center text-center gap-2 animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="text-xs font-bold text-white">All Timings Aligned</div>
                <div className="text-[11px] text-zinc-400 leading-tight">
                  No line overlaps, micro-gaps, or out-of-bounds word tokens detected.
                </div>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5 divide-y divide-white/[0.04]">
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="w-full p-2 rounded-xl hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-2 group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onJumpToLine(issue.lineIndex);
                        setOpen(false);
                      }}
                      title="Jump to this line in editor"
                      className="flex-1 min-w-0 text-left flex items-start gap-2.5 cursor-pointer"
                    >
                      <span
                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          issue.severity === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-200 group-hover:text-white transition-colors leading-snug break-words">
                          {issue.message}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 font-sans">
                          Click row to inspect line {issue.lineIndex + 1}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onFixSingleIssue) {
                          onFixSingleIssue(issue);
                        } else {
                          onAutoFix();
                        }
                      }}
                      title={`Fix line ${issue.lineIndex + 1}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white text-zinc-200 hover:text-zinc-950 text-[11px] font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ml-1.5"
                    >
                      <Check className="w-2.5 h-2.5" />
                      <span>Fix</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
