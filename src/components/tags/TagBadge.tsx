'use client';

import type { CSSProperties } from 'react';
import { resolveTagColor } from '@/lib/tag-colors';

interface TagBadgeProps {
  label: string;
  color?: string | null;
  className?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
  leadingIcon?: 'tag';
}

function getTagBadgePalette(tagName: string, color?: string | null): CSSProperties {
  return {
    '--tag-bg': resolveTagColor(tagName, color),
    '--tag-text': '#ffffff',
    '--tag-shadow': 'none',
  } as CSSProperties;
}

export default function TagBadge({
  label,
  color,
  className = '',
  size = 'md',
  style,
  leadingIcon,
}: TagBadgeProps) {
  const palette = getTagBadgePalette(label, color);

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
