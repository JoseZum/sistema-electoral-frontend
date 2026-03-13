'use client';

import Link from 'next/link';

interface ImportResultProps {
  total: number;
  onReset: () => void;
}

export default function ImportResult({ total, onReset }: ImportResultProps) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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

        <div className="merge-stat" style={{ background: 'var(--surface)' }}>
          <div
            className="merge-stat-icon"
            style={{
              background: 'var(--success-light)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="merge-stat-value" style={{ color: 'var(--success)' }}>
              {total.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              Estudiantes procesados en total
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1.5rem',
        }}
      >
        <button className="btn btn-outline btn-sm" onClick={onReset}>
          Cancelar
        </button>
        <Link href="/padron" className="btn btn-accent btn-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
