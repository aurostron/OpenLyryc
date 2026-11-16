'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { OpenLyricsDocument } from '@/types/lyrics';
import { exportLRC, calculateLrcSpaceSavings, LrcExportFormat } from '@/lib/lrcParser';
import { exportJSON } from '@/lib/jsonExporter';
import { exportTTML } from '@/lib/ttmlSerializer';
import { BetterLyricsLogo } from '@/components/unison/BetterLyricsLogo';
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Clock,
  Layers,
  Zap,
} from 'lucide-react';

interface ExportViewProps {
  onBack: () => void;
  document: OpenLyricsDocument;
  onDownload: (content: string, filename: string, mimeType: string) => void;
  onOpenUnisonSubmit?: () => void;
}

export const ExportView: React.FC<ExportViewProps> = ({
  onBack,
  document: doc,
  onDownload,
  onOpenUnisonSubmit,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<LrcExportFormat | 'json' | 'ttml'>('enhanced_compact');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloaded, setDownloaded] = useState<boolean>(false);

  const savingsReport = useMemo(() => calculateLrcSpaceSavings(doc), [doc]);

  const activeContent = useMemo(() => {
    if (selectedFormat === 'json') {
      return exportJSON(doc);
    }
    if (selectedFormat === 'ttml') {
      return exportTTML(doc);
    }
    return exportLRC(doc, { format: selectedFormat });
  }, [doc, selectedFormat]);

  const baseFilename = `${doc.metadata.artist || 'Artist'} - ${doc.metadata.title || 'Untitled Track'}`;

  const handleTriggerDownload = () => {
    if (selectedFormat === 'json') {
      onDownload(activeContent, `${baseFilename}.json`, 'application/json');
    } else if (selectedFormat === 'ttml') {
      onDownload(activeContent, `${baseFilename}.ttml`, 'application/xml');
    } else if (selectedFormat === 'olrc') {
      onDownload(activeContent, `${baseFilename}.olrc`, 'text/plain');
    } else {
      onDownload(activeContent, `${baseFilename}.lrc`, 'text/plain');
    }
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formats = [
    {
      id: 'enhanced_compact' as const,
      name: 'Compact .LRC',
      badge: 'Recommended',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      description: 'Word-level sync using relative offset timings. Up to 60% smaller file size.',
      bytes: savingsReport.compactEnhancedLrcBytes,
    },
    {
      id: 'enhanced_standard' as const,
      name: 'Enhanced .LRC',
      badge: 'Enhanced',
      badgeColor: 'bg-white/[0.06] text-zinc-300 border-white/10',
      description: 'Standard word-level sync with absolute timestamps per word.',
      bytes: savingsReport.traditionalEnhancedLrcBytes,
    },
    {
      id: 'olrc' as const,
      name: 'OpenLyryc .OLRC',
      badge: 'Full Features',
      badgeColor: 'bg-white/[0.06] text-zinc-300 border-white/10',
      description: 'Word timings, duet vocal parts, and song metadata.',
      bytes: savingsReport.olrcBytes,
    },
    {
      id: 'ttml' as const,
      name: 'Apple TTML',
      badge: 'Apple Music',
      badgeColor: 'bg-white/[0.06] text-zinc-300 border-white/10',
      description: 'Timed text XML for Apple Music and streaming engines.',
      bytes: new Blob([exportTTML(doc)]).size,
    },
    {
      id: 'standard' as const,
      name: 'Standard .LRC',
      badge: 'Line Sync',
      badgeColor: 'bg-white/[0.06] text-zinc-300 border-white/10',
      description: 'Traditional line-by-line timestamps compatible with any music player.',
      bytes: savingsReport.standardLrcBytes,
    },
    {
      id: 'json' as const,
      name: 'OpenLyryc JSON',
      badge: 'Developer',
      badgeColor: 'bg-white/[0.06] text-zinc-300 border-white/10',
      description: 'Lossless JSON data model with token positions and millisecond precision.',
      bytes: new Blob([exportJSON(doc)]).size,
    },
  ];

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
          <h1 className="text-sm font-semibold text-white tracking-tight">Export Lyrics</h1>
        </div>

        <div className="text-xs text-zinc-500 font-sans hidden sm:inline">
          Esc to close
        </div>
      </header>

      {/* Main Full-Screen Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Options Pane */}
        <div className="w-full lg:w-[380px] bg-[#0e0e12] border-b lg:border-b-0 lg:border-r border-white/[0.08] p-5 overflow-y-auto custom-scrollbar flex flex-col justify-between shrink-0 gap-5 studio-chrome">
          <div className="space-y-4">
            <div>
            </div>

            <div className="space-y-2">
              {formats.map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-white/[0.08] border-white/30 shadow-inner ring-1 ring-white/20'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xl font-sans ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                        {fmt.name}
                      </span>
                      <span className={`text-[9px] font-sans px-2 py-0.5 rounded-full border ${fmt.badgeColor}`}>
                        {fmt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {fmt.description}
                    </p>
                    <div className="text-[10px] font-sans text-zinc-500 pt-1 border-t border-white/[0.04]">
                      {fmt.bytes.toLocaleString()} bytes
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Code Preview Pane */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070709]">
          <div className="h-12 px-5 border-b border-white/[0.06] bg-[#0c0c10] flex items-center justify-between text-xs font-sans text-zinc-400 shrink-0 gap-4">
            <span className="flex items-center gap-2 min-w-0 truncate">
              <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="text-zinc-200 font-semibold truncate">
                {selectedFormat === 'json'
                  ? `${baseFilename}.json`
                  : selectedFormat === 'ttml'
                  ? `${baseFilename}.ttml`
                  : selectedFormat === 'olrc'
                  ? `${baseFilename}.olrc`
                  : `${baseFilename}.lrc`}
              </span>
              <span className="text-zinc-500 text-[11px] shrink-0">
                · {new Blob([activeContent]).size.toLocaleString()} bytes
              </span>
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenUnisonSubmit && (
                <button
                  type="button"
                  onClick={onOpenUnisonSubmit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
                  title="Submit lyrics to Unison / Better Lyrics"
                >
                  <BetterLyricsLogo size={14} variant="color" />
                  <span>Submit to Unison</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleTriggerDownload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm"
              >
                {downloaded ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-600" />
                    <span className="text-emerald-700">Saved!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 custom-scrollbar">
            <pre className="font-sans text-xs text-zinc-300 select-text leading-relaxed whitespace-pre font-normal">
              {activeContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
