'use client';

import React, { useState, useMemo } from 'react';
import { OpenLyricsDocument } from '@/types/lyrics';
import { exportLRC, calculateLrcSpaceSavings, LrcExportFormat } from '@/lib/lrcParser';
import { exportJSON } from '@/lib/jsonExporter';
import { exportTTML } from '@/lib/ttmlSerializer';
import { BetterLyricsLogo } from '@/components/unison/BetterLyricsLogo';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: OpenLyricsDocument;
  onDownload: (content: string, filename: string, mimeType: string) => void;
  onOpenUnisonSubmit?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onDownload,
  onOpenUnisonSubmit,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<LrcExportFormat | 'json' | 'ttml'>('enhanced_compact');
  const [copied, setCopied] = useState<boolean>(false);

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

  if (!isOpen) return null;

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
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl glass-modal-3d p-6 shadow-2xl space-y-5 font-sans text-zinc-100 max-h-[90vh] flex flex-col animate-modal-pop-3d">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 shrink-0">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <span className="material-symbols-outlined text-lg text-zinc-300">download</span>
            <span>Export Lyrics</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Format Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          {/* 1. Compact Enhanced LRC */}
          <button
            type="button"
            onClick={() => setSelectedFormat('enhanced_compact')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFormat === 'enhanced_compact'
                ? 'bg-white/[0.08] border-white/40 shadow-inner'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">Compressed .LRC</span>
              </div>
            </div>
            <div className="text-[10px] font-sans text-zinc-500 mt-2">
              {savingsReport.compactEnhancedLrcBytes} B
            </div>
          </button>

          {/* 2. Traditional Enhanced LRC */}
          <button
            type="button"
            onClick={() => setSelectedFormat('enhanced_standard')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFormat === 'enhanced_standard'
                ? 'bg-white/[0.08] border-white/40 shadow-inner'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">Enhanced .LRC</span>
                
              </div>
              
            </div>
            <div className="text-[10px] font-sans text-zinc-500 mt-2">
              {savingsReport.traditionalEnhancedLrcBytes} B
            </div>
          </button>

          {/* 3. OpenLyryc Extended (.OLRC) */}
          <button
            type="button"
            onClick={() => setSelectedFormat('olrc')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFormat === 'olrc'
                ? 'bg-white/[0.08] border-indigo-400/60 shadow-inner'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-indigo-300">OpenLyryc .OLRC</span>
                
              </div>
              
            </div>
            <div className="text-[10px] font-sans text-zinc-500 mt-2">
              {savingsReport.olrcBytes} B
            </div>
          </button>

          {/* 4. Apple Music / Timed Text TTML */}
          <button
            type="button"
            onClick={() => setSelectedFormat('ttml')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFormat === 'ttml'
                ? 'bg-white/[0.08] border-rose-400/60 shadow-inner'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-rose-300">Apple TTML</span>
               
              </div>
              
            </div>
            
          </button>

          {/* 5. Standard Line LRC */}
          <button
            type="button"
            onClick={() => setSelectedFormat('standard')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedFormat === 'standard'
                ? 'bg-white/[0.08] border-white/40 shadow-inner'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">Standard .LRC</span>
                
              </div>
              ]
            </div>
            <div className="text-[10px] font-sans text-zinc-500 mt-2">
              {savingsReport.standardLrcBytes} B
            </div>
          </button>
        </div>

        {/* Live File Preview Box */}
        <div className="flex-1 min-h-[160px] flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#08080a]">
          <div className="h-8 px-3.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-[11px] font-sans text-zinc-400 shrink-0">
            <span>
              {selectedFormat === 'json' ? `${baseFilename}.json` : selectedFormat === 'ttml' ? `${baseFilename}.ttml` : selectedFormat === 'olrc' ? `${baseFilename}.olrc` : `${baseFilename}.lrc`}
            </span>
            <span>{new Blob([activeContent]).size} bytes</span>
          </div>
          <pre className="p-3 font-sans text-xs text-zinc-300 overflow-y-auto flex-1 select-text leading-relaxed whitespace-pre-wrap">
            {activeContent}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 shrink-0 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onOpenUnisonSubmit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUnisonSubmit();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-zinc-200 hover:text-white transition cursor-pointer"
                title="Submit lyrics to Unison / Better Lyrics"
              >
                <BetterLyricsLogo size={14} variant="color" className="text-white" />
                <span>Submit to Unison</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTriggerDownload}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition cursor-pointer shadow-lg shadow-white/10"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
