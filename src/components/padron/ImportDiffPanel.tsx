'use client';

import type { ImportSummary } from '@/types/padron';

interface ImportDiffPanelProps {
  diff: ImportSummary;
  activeStudents: number;
  /** El backend exige confirmación explícita para aplicar estas bajas. */
  requiresConfirmation: boolean;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
}

const CELLS = [
  { key: 'new' as const, label: 'Nuevos', sign: '+', color: 'var(--success)' },
  { key: 'updated' as const, label: 'Actualizados', sign: '~', color: 'var(--accent)' },
  { key: 'reactivated' as const, label: 'Reactivados', sign: '↑', color: '#2563eb' },
  { key: 'deactivated' as const, label: 'Desactivados', sign: '−', color: 'var(--error)' },
];

export default function ImportDiffPanel({
  diff,
  activeStudents,
  requiresConfirmation,
  confirmed,
  onConfirmedChange,
}: ImportDiffPanelProps) {
  const percentage =
    activeStudents > 0 ? Math.round((diff.deactivated / activeStudents) * 100) : 0;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h4
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--muted)',
          marginBottom: '0.75rem',
        }}
      >
        Qué va a pasar si confirma
      </h4>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {CELLS.map((cell) => (
          <div
            key={cell.key}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '1.25rem',
                color: cell.color,
              }}
            >
              {cell.sign}
              {diff[cell.key].toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{cell.label}</div>
          </div>
        ))}
      </div>

      {requiresConfirmation && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--error)',
            background: 'var(--error-light)',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Este archivo desactivará a la mayor parte del padrón
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', margin: '0.5rem 0 0.875rem' }}>
            Se desactivarán <strong>{diff.deactivated.toLocaleString()}</strong> de los{' '}
            <strong>{activeStudents.toLocaleString()}</strong> estudiantes activos ({percentage}%).
            Un estudiante desactivado no puede votar ni postularse. Suele pasar cuando el archivo
            trae solo una parte del padrón: revise que sea el archivo correcto antes de continuar.
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirmedChange(event.target.checked)}
            />
            Entiendo y confirmo que se desactiven {diff.deactivated.toLocaleString()} estudiantes
          </label>
        </div>
      )}
    </div>
  );
}
