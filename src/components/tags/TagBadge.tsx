'use client';

import type { CSSProperties } from 'react';

interface TagBadgeProps {
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
  leadingIcon?: 'tag';
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
  leadingIcon,
}: TagBadgeProps) {
  const palette = getTagBadgePalette(label);

  return (
    <span
      className={`tag-badge tag-badge--${size}${className ? ` ${className}` : ''}`}
      style={{ ...palette, ...style }}
    >
      {leadingIcon === 'tag' && (
        <span className="tag-badge__icon" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" />
            <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </span>
      )}
      <span className="tag-badge__label">{label}</span>
    </span>
  );
}
