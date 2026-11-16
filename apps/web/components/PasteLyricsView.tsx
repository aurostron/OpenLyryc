'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
  Check,
  Trash2,
  ArrowRight,
} from 'lucide-react';

interface PasteLyricsViewProps {
  onBack: () => void;
  onImportText: (text: string) => void;
}

export const PasteLyricsView: React.FC<PasteLyricsViewProps> = ({
  onBack,
  onImportText,
}) => {
  const [text, setText] = useState('');

  const handleImport = () => {
    if (!text.trim()) return;
    onImportText(text);
  };

  const lineCount = text ? text.split('\n').filter((l) => l.trim().length > 0).length : 0;

  const detectFormat = (content: string) => {
    if (!content.trim()) return null;
    if (content.includes('<tt') || content.includes('<div') || content.includes('xml:lang')) {
      return { type: 'Apple TTML XML', badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20' };
    }
    if (/\[\d{2}:\d{2}/.test(content)) {
      return { type: 'Standard / Enhanced LRC', badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
    }
    return { type: 'Plain Text (Will Auto-Timestamp)', badge: 'bg-white/10 text-zinc-300 border-white/10' };
  };

  const detectedFormat = detectFormat(text);

  const loadSample = (type: 'plain' | 'lrc' | 'ttml') => {
    if (type === 'plain') {
      setText(`Waiting in a car
Waiting for a ride in the dark
The night city grows
Look and see her eyes, they glow

Waiting in a car
Waiting for a ride in the dark
The night city grows
Look and see her eyes, they glow`);
    } else if (type === 'lrc') {
      setText(`[ti:Midnight City]
[ar:M83]
[al:Hurry Up, We're Dreaming]
[00:14.50]Waiting in a car
[00:17.80]Waiting for a ride in the dark
[00:21.40]The night city grows
[00:25.10]Look and see her eyes, they glow`);
    } else {
      setText(`<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:14.500" end="00:17.500">
        <span begin="00:14.500" end="00:15.200">Waiting </span>
        <span begin="00:15.200" end="00:16.000">in </span>
        <span begin="00:16.000" end="00:16.800">a </span>
        <span begin="00:16.800" end="00:17.500">car</span>
      </p>
      <p begin="00:17.800" end="00:21.000">
        <span begin="00:17.800" end="00:18.200">Waiting </span>
        <span begin="00:18.200" end="00:18.600">for </span>
        <span begin="00:18.600" end="00:19.000">a </span>
        <span begin="00:19.000" end="00:19.500">ride </span>
        <span begin="00:19.500" end="00:20.100">in </span>
        <span begin="00:20.100" end="00:21.000">the dark</span>
      </p>
    </div>
  </body>
</tt>`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#0e0e12] border-b border-white/[0.08] px-6 md:px-8 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.1] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />
          <h1 className="text-sm font-semibold text-white tracking-tight">Paste Lyrics</h1>
          {detectedFormat && (
            <span className={`text-[10px] font-sans px-2 py-0.5 rounded-md border ${detectedFormat.badge} hidden sm:inline`}>
              {detectedFormat.type}
            </span>
          )}
        </div>

        <div className="text-xs text-zinc-500 font-sans hidden sm:inline">
          Esc to close
        </div>
      </header>

      {/* Main Full-Screen Body */}
      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-hidden max-w-5xl mx-auto w-full gap-4">
        {/* Helper bar & sample loaders */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <p className="text-xs text-zinc-400">
            Paste raw text lines, timestamped LRC <code className="text-zinc-300 bg-white/[0.05] px-1 py-0.5 rounded font-sans">[00:12.34]</code>, or Apple Music TTML XML.
          </p>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] uppercase font-sans text-zinc-500 mr-1">Samples:</span>
            <button
              type="button"
              onClick={() => loadSample('plain')}
              className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
            >
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => loadSample('lrc')}
              className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
            >
              LRC
            </button>
            <button
              type="button"
              onClick={() => loadSample('ttml')}
              className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
            >
              TTML
            </button>
          </div>
        </div>

        {/* Textarea Card with Integrated Action Footer */}
        <div className="flex-1 flex flex-col rounded-xl border border-white/[0.08] bg-[#07070a] overflow-hidden focus-within:border-white/25 transition-all">
          <div className="h-10 px-4 border-b border-white/[0.06] bg-[#0d0d12] flex items-center justify-between text-xs font-sans text-zinc-400 shrink-0">
            <span></span>
            {detectedFormat && (
              <span className="text-[11px] text-zinc-400 sm:hidden">
                {detectedFormat.type}
              </span>
            )}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Waiting in a car\nWaiting for a ride in the dark\n\nOr paste [00:12.34] Timestamped LRC / Apple TTML XML`}
            className="w-full flex-1 bg-transparent p-5 font-sans text-xs md:text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none custom-scrollbar leading-relaxed"
            autoFocus
          />

          {/* Contextual Action Footer Bar */}
          <div className="h-13 px-4 md:px-5 border-t border-white/[0.06] bg-[#0c0c10] flex items-center justify-between shrink-0">
            <div className="text-xs font-sans text-zinc-400">
              {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {text.length.toLocaleString()} characters
            </div>

            <div className="flex items-center gap-3">
              {text && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={!text.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer shadow-sm"
              >
                <span>Import Into Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteLyricsView;
