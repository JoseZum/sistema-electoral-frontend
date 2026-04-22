'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TagBadge from '@/components/tags/TagBadge';
import { listTags } from '@/lib/tags-api';
import type { TagSummary } from '@/types/tags';

interface TagSelectorProps {
  value: string | null;
  onChange: (tagId: string | null) => void;
  label?: string;
  helperText?: string;
  allowClear?: boolean;
}

export default function TagSelector({
  value,
  onChange,
  label = 'Tag',
  helperText,
  allowClear = true,
}: TagSelectorProps) {
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const hasTags = tags.length > 0;
  const selectedTag = value ? tags.find((tag) => tag.id === value) ?? null : null;

  useEffect(() => {
    let cancelled = false;

    async function fetchTags() {
      try {
        setLoading(true);
        const data = await listTags();
        if (!cancelled) {
          setTags(data || []);
        }
      } catch (error) {
        console.error('Error loading tags:', error);
        if (!cancelled) {
          setTags([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTags();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="input-group">
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <span>{label}</span>
        <Link href="/tags" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}>
          Administrar tags
        </Link>
      </label>
      <select
        className="input"
        value={value || ''}
        disabled={loading || !hasTags}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="" disabled={!allowClear}>
          {allowClear ? 'Sin tag' : 'Selecciona una tag'}
        </option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name} {tag.member_count > 0 ? `(${tag.member_count})` : ''}
          </option>
        ))}
      </select>
      {selectedTag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
          <TagBadge label={selectedTag.name} size="sm" />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {selectedTag.member_count} integrante{selectedTag.member_count === 1 ? '' : 's'}
          </span>
        </div>
      )}
      {helperText && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
          {helperText}
        </p>
      )}
      {!loading && !hasTags && (
        <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.4rem' }}>
          No hay tags disponibles todavia. Crea una en la seccion de tags antes de continuar.
        </p>
      )}
    </div>
  );
}
