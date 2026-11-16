'use client';

import React from 'react';

interface CouncilSealProps {
  className?: string;
  size?: number;
}

export const CouncilSeal: React.FC<CouncilSealProps> = ({ className = 'size-6', size }) => {
  return (
    <span
      className={`inline-block relative shrink-0 drop-shadow-[0_2px_8px_rgba(192,134,0,0.45)] select-none pointer-events-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
      title="Better Lyrics Council Approved (BLCA)"
    >
      <img
        src="/badges/unison/committee.svg"
        alt="Council Seal"
        className="w-full h-full object-contain -rotate-6"
        onError={(e) => {
          // Fallback if SVG fails to load
          const target = e.currentTarget;
          target.style.display = 'none';
        }}
      />
    </span>
  );
};
