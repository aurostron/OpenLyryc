'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  url: string;
  title?: string;
  artist?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  title,
}) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [copiedQr, setCopiedQr] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    QRCode.toString(url, {
      type: 'svg',
      margin: 1.5,
      color: {
        dark: '#ffffff',
        light: '#00000000', // transparent background
      },
      errorCorrectionLevel: 'M',
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch((err) => {
        console.error('Failed to render QR Code SVG:', err);
      });

    return () => {
      active = false;
    };
  }, [url]);

  const handleDownloadPng = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark background for crisp QR export
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 600, 600);

      // Render QR onto canvas
      await QRCode.toCanvas(canvas, url, {
        width: 500,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#09090b',
        },
        errorCorrectionLevel: 'H',
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const filename = title
        ? `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr.png`
        : 'openlyryc_preview_qr.png';
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export QR PNG:', err);
    }
  };

  const handleCopyQrImage = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 500;
      await QRCode.toCanvas(canvas, url, {
        width: 500,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#09090b',
        },
        errorCorrectionLevel: 'H',
      });

      canvas.toBlob(async (blob) => {
        if (!blob || !navigator.clipboard || !window.ClipboardItem) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedQr(true);
          setTimeout(() => setCopiedQr(false), 2000);
        } catch {
          // ignore
        }
      });
    } catch (err) {
      console.error('Failed to copy QR code image:', err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
      {/* QR Vector Frame */}
      <div className="relative group p-3 bg-zinc-950/80 border border-white/10 rounded-xl shadow-inner flex items-center justify-center">
        {svgMarkup ? (
          <div
            className="w-44 h-44 shrink-0 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="w-44 h-44 flex items-center justify-center text-zinc-500 text-xs">
            Generating QR...
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          onClick={handleDownloadPng}
          className="flex-1 py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-xs font-semibold text-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">download</span>
          <span>Download PNG</span>
        </button>
        <button
          type="button"
          onClick={handleCopyQrImage}
          className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-xs font-semibold text-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          title="Copy QR Image to Clipboard"
        >
          <span className="material-symbols-outlined text-[15px]">
            {copiedQr ? 'check' : 'content_copy'}
          </span>
          <span>{copiedQr ? 'Copied' : 'Copy Image'}</span>
        </button>
      </div>
    </div>
  );
};
