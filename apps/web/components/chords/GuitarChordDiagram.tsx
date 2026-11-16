'use client';

import React from 'react';
import { getChordDefinition, ChordDefinition } from '@/lib/chords/guitarChordDictionary';

interface GuitarChordDiagramProps {
  chord: string; // e.g. "C", "G", "Am", "F#m7"
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTitle?: boolean;
  theme?: 'monochrome' | 'emerald';
}

export const GuitarChordDiagram: React.FC<GuitarChordDiagramProps> = ({
  chord,
  size = 'md',
  className = '',
  showTitle = true,
  theme = 'monochrome',
}) => {
  const definition: ChordDefinition = getChordDefinition(chord);
  const { name, baseFret = 1, strings, fingers, barre } = definition;

  // Dimensions based on size
  const dimensions = {
    sm: { width: 75, height: 95, fontSize: 10, dotRadius: 4.5, stringSpacing: 10, fretSpacing: 12, topPadding: 24 },
    md: { width: 110, height: 145, fontSize: 13, dotRadius: 7, stringSpacing: 14, fretSpacing: 18, topPadding: 32 },
    lg: { width: 160, height: 210, fontSize: 16, dotRadius: 10, stringSpacing: 21, fretSpacing: 27, topPadding: 44 },
    xl: { width: 220, height: 280, fontSize: 20, dotRadius: 13, stringSpacing: 29, fretSpacing: 36, topPadding: 58 },
  }[size];

  const { width, height, fontSize, dotRadius, stringSpacing, fretSpacing, topPadding } = dimensions;

  const leftMargin = (width - stringSpacing * 5) / 2;
  const numFrets = 4;
  const gridHeight = fretSpacing * numFrets;

  const isMono = theme === 'monochrome';
  const dotFill = isMono ? '#ffffff' : '#06b6d4';
  const dotTextFill = isMono ? '#08080a' : '#ffffff';
  const barreFill = isMono ? '#ffffff' : '#10b981';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {showTitle && (
        <span
          className="font-extrabold tracking-tight text-white mb-2 drop-shadow-sm font-sans"
          style={{ fontSize: `${fontSize + (size === 'xl' ? 6 : 2)}px` }}
        >
          {name}
        </span>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Top Indicators: O (open) / X (muted) */}
        {strings.map((fretVal, stringIdx) => {
          const x = leftMargin + stringIdx * stringSpacing;
          const y = topPadding - (size === 'xl' ? 12 : 8);

          if (fretVal === -1) {
            return (
              <text
                key={`mute-${stringIdx}`}
                x={x}
                y={y}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize={fontSize - 2}
                fontWeight="bold"
              >
                ✕
              </text>
            );
          }
          if (fretVal === 0) {
            return (
              <circle
                key={`open-${stringIdx}`}
                cx={x}
                cy={y - (size === 'xl' ? 4 : 3)}
                r={dotRadius - (size === 'xl' ? 3.5 : 2.5)}
                fill="none"
                stroke="#e4e4e7"
                strokeWidth={size === 'xl' ? 2 : 1.5}
              />
            );
          }
          return null;
        })}

        {/* Base Fret Label if > 1 */}
        {baseFret > 1 && (
          <text
            x={leftMargin - (size === 'xl' ? 14 : 10)}
            y={topPadding + fretSpacing / 2 + (size === 'xl' ? 6 : 4)}
            textAnchor="end"
            fill="#a1a1aa"
            fontSize={fontSize - 2}
            fontWeight="700"
            className="font-sans"
          >
            {baseFret}fr
          </text>
        )}

        {/* Nut (Thick line if baseFret === 1) */}
        <line
          x1={leftMargin}
          y1={topPadding}
          x2={leftMargin + stringSpacing * 5}
          y2={topPadding}
          stroke={baseFret === 1 ? '#ffffff' : '#3f3f46'}
          strokeWidth={baseFret === 1 ? (size === 'xl' ? 6 : 4) : 2}
          strokeLinecap="round"
        />

        {/* Fret Grid Lines */}
        {Array.from({ length: numFrets + 1 }).map((_, i) => {
          if (i === 0) return null; // Nut already drawn
          const y = topPadding + i * fretSpacing;
          return (
            <line
              key={`fret-${i}`}
              x1={leftMargin}
              y1={y}
              x2={leftMargin + stringSpacing * 5}
              y2={y}
              stroke="#3f3f46"
              strokeWidth={1}
            />
          );
        })}

        {/* String Lines (6 Strings: Low E on left, High E on right) */}
        {Array.from({ length: 6 }).map((_, stringIdx) => {
          const x = leftMargin + stringIdx * stringSpacing;
          const strokeWidth = 1 + (5 - stringIdx) * 0.35; // Gauge gradient
          return (
            <line
              key={`string-${stringIdx}`}
              x1={x}
              y1={topPadding}
              x2={x}
              y2={topPadding + gridHeight}
              stroke="#71717a"
              strokeWidth={strokeWidth}
            />
          );
        })}

        {/* Barre Indicator */}
        {barre && (
          <rect
            x={leftMargin + (6 - barre.startString) * stringSpacing - dotRadius}
            y={topPadding + (barre.fret - baseFret + 0.5) * fretSpacing - dotRadius}
            width={(barre.startString - barre.endString) * stringSpacing + dotRadius * 2}
            height={dotRadius * 2}
            rx={dotRadius}
            fill={barreFill}
          />
        )}

        {/* Finger Dots */}
        {strings.map((fretVal, stringIdx) => {
          if (fretVal <= 0) return null;

          // Adjust fret position relative to baseFret
          const relFret = fretVal - baseFret + 1;
          if (relFret < 1 || relFret > numFrets) return null;

          const x = leftMargin + stringIdx * stringSpacing;
          const y = topPadding + (relFret - 0.5) * fretSpacing;
          const fingerNum = fingers ? fingers[stringIdx] : null;

          return (
            <g key={`dot-${stringIdx}`}>
              <circle
                cx={x}
                cy={y}
                r={dotRadius}
                fill={dotFill}
              />
              {fingerNum && fingerNum > 0 && (
                <text
                  x={x}
                  y={y + fontSize / 3.2}
                  textAnchor="middle"
                  fill={dotTextFill}
                  fontSize={fontSize - 3}
                  fontWeight="800"
                  className="font-sans"
                >
                  {fingerNum}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
