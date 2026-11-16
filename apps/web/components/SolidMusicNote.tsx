import React from 'react';

/**
 * Geometric Solid Music Eighth Note
 * Exactly matches user reference: round solid notehead, vertical stem, and rectangular top flag.
 */
export const SolidMusicNote: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 29 43"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    {/* Solid circular notehead matching user reference */}
    <circle cx="9.25" cy="33.75" r="9.25" />
    {/* Solid vertical stem with sharp rectangular top flag */}
    <path d="M15 0h13.5v8.5H18.5V33.75H15V0z" />
  </svg>
);
