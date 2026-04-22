'use client';

import type { CSSProperties } from 'react';

interface TagBadgeProps {
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

function getTagBadgePalette(tagName: string): CSSProperties {
  const hash = Array.from(tagName).reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0,
    17
  );
  const hue = hash % 360;
  const saturation = 58 + (hash % 18);
  const accentLightness = 34 + (hash % 10);
  const backgroundLightness = 90 + (hash % 4);

  return {
    '--tag-accent': `hsl(${hue} ${saturation}% ${accentLightness}%)`,
    '--tag-bg': `hsl(${hue} ${Math.max(42, saturation - 16)}% ${backgroundLightness}%)`,
    '--tag-shadow': `0 10px 22px hsla(${hue} ${saturation}% ${accentLightness}% / 0.14)`,
  } as CSSProperties;
}

export default function TagBadge({
  label,
  className = '',
  size = 'md',
  style,
}: TagBadgeProps) {
  const palette = getTagBadgePalette(label);

  return (
    <span
      className={`tag-badge tag-badge--${size}${className ? ` ${className}` : ''}`}
      style={{ ...palette, ...style }}
    >
      <span className="tag-badge__label">{label}</span>
    </span>
  );
}
