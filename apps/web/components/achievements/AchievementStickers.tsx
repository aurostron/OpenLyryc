'use client';

import React from 'react';

interface StickerProps {
  className?: string;
  variant?: 'color' | 'ink';
}

const createBadgeComponent = (slug: string, title: string): React.FC<StickerProps> => {
  const BadgeComponent: React.FC<StickerProps> = ({ className = 'w-10 h-10', variant = 'color' }) => {
    const src = variant === 'ink' ? `/badges/ink/${slug}.png` : `/badges/svg/${slug}.svg`;
    return (
      <img
        src={src}
        alt={title}
        className={`${className} object-contain select-none pointer-events-none drop-shadow-sm`}
        loading="lazy"
        draggable={false}
      />
    );
  };
  BadgeComponent.displayName = `Badge_${slug.replace(/-/g, '_')}`;
  return BadgeComponent;
};

export const AchievementStickers: Record<string, React.FC<StickerProps>> = {
  // 1. Genesis Milestone
  'first-pioneer': createBadgeComponent('first-pioneer', 'The First Pioneer'),

  // 2. Spacebar Ninja
  'spacebar-ninja': createBadgeComponent('spacebar-ninja', 'Spacebar Ninja'),

  // 3. Apple Music Perfectionist
  'apple-perfectionist': createBadgeComponent('apple-perfectionist', 'Apple Music Perfectionist'),

  // 4. Midnight Jammer
  'midnight-jammer': createBadgeComponent('midnight-jammer', 'Midnight Jammer'),

  // 5. Unison Signer / Crypto Key
  'unison-signer': createBadgeComponent('unison-signer', 'WebCrypto Architect'),

  // 6. Zero Drift (with pinpoint-accuracy alias)
  'zero-drift': createBadgeComponent('zero-drift', 'Zero Drift'),
  'pinpoint-accuracy': createBadgeComponent('zero-drift', 'Zero Drift'),

  // 7. Syllable Surgeon (with caffeine-syllables alias)
  'syllable-surgeon': createBadgeComponent('syllable-surgeon', 'Syllable Surgeon'),
  'caffeine-syllables': createBadgeComponent('syllable-surgeon', 'Syllable Surgeon'),

  // 8. Mic Check
  'mic-check': createBadgeComponent('mic-check', 'Mic Check 1-2'),

  // 9. Crowd Favorite
  'crowd-favorite': createBadgeComponent('crowd-favorite', 'Crowd Favorite'),

  // 10. The Clean Cut (with the-splitter alias)
  'the-clean-cut': createBadgeComponent('the-clean-cut', 'The Clean Cut'),
  'the-splitter': createBadgeComponent('the-clean-cut', 'The Clean Cut'),

  // 11. In The Groove / Flow State
  'flow-state': createBadgeComponent('flow-state', 'In The Groove'),

  // 12. Catalog Master / Boss
  'catalog-boss': createBadgeComponent('catalog-boss', 'Catalog Master'),
};
