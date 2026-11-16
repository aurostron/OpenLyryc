'use client';

import React, { useState } from 'react';

interface UnisonBadgeProps {
  badgeKey: string;
  name?: string;
  tier?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
}

const SIZE_CLASSES = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9',
};

export function resolveBadgeUrl(key: string, tier?: number): string {
  const sanitized = key.toLowerCase().trim();
  if (tier !== undefined && tier > 0) {
    return `/badges/unison/${sanitized}_${tier}.svg`;
  }
  return `/badges/unison/${sanitized}.svg`;
}

export function UnisonBadge({
  badgeKey,
  name,
  tier,
  size = 'md',
  className = '',
  showTooltip = true,
}: UnisonBadgeProps) {
  const [imgSrc, setImgSrc] = useState(() => resolveBadgeUrl(badgeKey, tier));
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    // If tiered file failed, fallback to base key SVG
    if (imgSrc.includes('_')) {
      setImgSrc(`/badges/unison/${badgeKey.toLowerCase().trim()}.svg`);
      return;
    }
    // If local SVG missing, fallback to live Unison API CDN
    if (!imgSrc.startsWith('https://')) {
      const liveUrl = `https://unison.betterlyrics.org/badges/${encodeURIComponent(badgeKey)}/image.svg?variant=color&v=2`;
      setImgSrc(liveUrl);
      return;
    }
    setHasError(true);
  };

  if (hasError) return null;

  const tooltipLabel = name || (tier ? `${badgeKey} (Tier ${tier})` : badgeKey);

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 group ${className}`}
      title={showTooltip ? tooltipLabel : undefined}
    >
      <img
        src={imgSrc}
        alt={tooltipLabel}
        onError={handleError}
        draggable={false}
        className={`${SIZE_CLASSES[size]} object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-115`}
      />
    </span>
  );
}
