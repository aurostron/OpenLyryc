'use client';

import React from 'react';

interface OpenLyrycLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

/**
 * OpenLyryc Vector Logotype Component
 * References the cached external SVG to keep initial HTML documents lightweight (<60 KB).
 */
export const OpenLyrycLogo: React.FC<OpenLyrycLogoProps> = ({
  className = 'h-6 w-auto',
  alt = 'OpenLyryc',
  ...props
}) => {
  return (
    <img
      src="/openlyryc-logo.svg"
      alt={alt}
      className={className}
      {...props}
    />
  );
};

export default OpenLyrycLogo;
