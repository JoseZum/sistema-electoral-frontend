'use client';

import type { CSSProperties } from 'react';

interface TagBadgeProps {
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

const TAG_PALETTE = [
  '#C62828',
  '#AD1457',
  '#6A1B9A',
  '#4527A0',
  '#283593',
  '#1565C0',
  '#0277BD',
  '#00838F',
  '#00695C',
  '#2E7D32',
  '#558B2F',
  '#EF6C00',
  '#D84315',
  '#5D4037',
];

function getTagBadgePalette(tagName: string): CSSProperties {
  const hash = Array.from(tagName).reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0,
    17
  );
  const backgroundColor = TAG_PALETTE[hash % TAG_PALETTE.length];

  return {
    '--tag-bg': backgroundColor,
    '--tag-text': '#ffffff',
    '--tag-shadow': 'none',
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
