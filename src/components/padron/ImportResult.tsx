'use client';

import Link from 'next/link';

interface ImportSummary {
  total: number;
  new: number;
  updated: number;
  reactivated: number;
  deactivated: number;
}

interface ImportResultProps {
  summary: ImportSummary;
  onReset: () => void;
}

const stats = [
  { key: 'new' as const, label: 'Nuevos', color: 'var(--success)', bg: 'var(--success-light)', icon: '+' },
  { key: 'updated' as const, label: 'Actualizados', color: 'var(--accent)', bg: 'var(--accent-light)', icon: '~' },
  { key: 'reactivated' as const, label: 'Reactivados', color: '#2563eb', bg: '#eff6ff', icon: '↑' },
  { key: 'deactivated' as const, label: 'Desactivados', color: 'var(--error)', bg: 'var(--error-light)', icon: '−' },
];

export default function ImportResult({ summary, onReset }: ImportResultProps) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>Resultado de la importacion</span>
          <span className="badge badge-dot badge-scrutinized">Completado</span>
        </div>

        {/* Total */}
        <div className="merge-stat" style={{ background: 'var(--surface)' }}>
          <div className="merge-stat-icon" style={{ background: 'var(--success-light)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="merge-stat-value" style={{ color: 'var(--success)' }}>
              {summary.total.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Estudiantes procesados en total
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ padding: '0.75rem 1.5rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {stats.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: s.bg,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: s.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: s.color, fontFamily: 'var(--font-mono)' }}>
                  {summary[s.key].toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <button className="btn btn-outline btn-sm" onClick={onReset}>
          Subir otro archivo
        </button>
        <Link href="/padron" className="btn btn-accent btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Ver padron
        </Link>
      </div>
    </div>
  );
}
