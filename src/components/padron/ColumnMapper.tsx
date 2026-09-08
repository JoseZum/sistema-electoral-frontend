'use client';

import { useMemo, useState } from 'react';
import ImportDiffPanel from './ImportDiffPanel';
import {
  PADRON_FIELDS,
  PADRON_FIELD_LABELS,
  REQUIRED_PADRON_FIELDS,
  type ColumnMapping,
  type PadronAnalysis,
  type PadronField,
} from '@/types/padron';

interface ColumnMapperProps {
  analysis: PadronAnalysis;
  /** Vuelve a pedir el análisis al backend con la estructura que el admin ajustó. */
  onRecalculate: (options: {
    sheetIndex: number;
    headerRowIndex: number;
    mapping: ColumnMapping;
  }) => void;
  onConfirm: (options: {
    sheetIndex: number;
    headerRowIndex: number;
    mapping: ColumnMapping;
    confirmDeactivation: boolean;
  }) => void;
  onCancel: () => void;
  busy?: boolean;
}

const NONE = '';

/** El estado natural del backend es campo → columna; la UI pregunta al revés. */
function invertMapping(mapping: ColumnMapping | undefined): Map<number, PadronField> {
  const byColumn = new Map<number, PadronField>();
  if (!mapping) return byColumn;
  for (const field of PADRON_FIELDS) {
    const index = mapping[field];
    if (index !== undefined) byColumn.set(index, field);
  }
  return byColumn;
}

function toMapping(byColumn: Map<number, PadronField>): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const [index, field] of byColumn) {
    mapping[field] = index;
  }
  return mapping;
}

function sourceHint(source: string): string | null {
  if (source === 'content') return 'deducido del contenido';
  if (source === 'manual') return 'elegido por usted';
  return null;
}

export default function ColumnMapper({
  analysis,
  onRecalculate,
  onConfirm,
  onCancel,
  busy = false,
}: ColumnMapperProps) {
  const [byColumn, setByColumn] = useState(() => invertMapping(analysis.mapping));
  const [sheetIndex, setSheetIndex] = useState(analysis.sheetIndex);
  const [headerRowIndex, setHeaderRowIndex] = useState(analysis.headerRowIndex);
  const [confirmed, setConfirmed] = useState(false);
  // El diff que llegó vale para el mapeo con el que se pidió; si el admin lo
  // toca, hay que recalcular antes de dejarlo aplicar a ciegas.
  const [stale, setStale] = useState(false);

  const mapping = useMemo(() => toMapping(byColumn), [byColumn]);

  const missingRequired = REQUIRED_PADRON_FIELDS.filter(
    (field) => mapping[field] === undefined
  );

  const handleFieldChange = (columnIndex: number, value: string) => {
    setByColumn((previous) => {
      const next = new Map(previous);
      next.delete(columnIndex);

      if (value !== NONE) {
        const field = value as PadronField;
        // Un campo solo puede venir de una columna: liberar la anterior.
        for (const [index, assigned] of next) {
          if (assigned === field) next.delete(index);
        }
        next.set(columnIndex, field);
      }

      return next;
    });
    setStale(true);
    setConfirmed(false);
  };

  const handleStructureChange = (nextSheet: number, nextHeaderRow: number) => {
    setSheetIndex(nextSheet);
    setHeaderRowIndex(nextHeaderRow);
    // Cambiar de hoja o de fila de encabezado reordena todo: se vuelve a
    // detectar el mapeo desde cero en vez de arrastrar índices que ya no aplican.
    onRecalculate({ sheetIndex: nextSheet, headerRowIndex: nextHeaderRow, mapping: {} });
  };

  const headerOptions = useMemo(() => {
    const seen = new Set<number>([headerRowIndex]);
    const options = [{ index: headerRowIndex, label: describeHeaderRow(headerRowIndex) }];
    for (const candidate of analysis.headerRowCandidates) {
      if (seen.has(candidate.index)) continue;
      seen.add(candidate.index);
      options.push({ index: candidate.index, label: describeHeaderRow(candidate.index) });
    }
    if (!seen.has(-1)) {
      options.push({ index: -1, label: describeHeaderRow(-1) });
    }
    return options;
  }, [analysis.headerRowCandidates, headerRowIndex]);

  const canConfirm =
    !busy &&
    !stale &&
    missingRequired.length === 0 &&
    analysis.validRows > 0 &&
    (!analysis.requiresConfirmation || confirmed);

  return (
    <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
          Revise cómo se leerá el archivo
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
          El sistema ya propuso a qué campo corresponde cada columna. Corrija lo que haga falta
          antes de confirmar.
        </p>
      </div>

      {/* Estructura del archivo */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {analysis.sheets.length > 1 && (
          <label style={{ fontSize: '0.8125rem' }}>
            <span style={{ display: 'block', color: 'var(--muted)', marginBottom: '0.25rem' }}>
              Hoja
            </span>
            <select
              className="input input-sm"
              value={sheetIndex}
              disabled={busy}
              onChange={(event) =>
                handleStructureChange(Number(event.target.value), headerRowIndex)
              }
            >
              {analysis.sheets.map((sheet) => (
                <option key={sheet.index} value={sheet.index}>
                  {sheet.name} ({sheet.rowCount} filas)
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', color: 'var(--muted)', marginBottom: '0.25rem' }}>
            Fila de encabezados
          </span>
          <select
            className="input input-sm"
            value={headerRowIndex}
            disabled={busy}
            onChange={(event) => handleStructureChange(sheetIndex, Number(event.target.value))}
          >
            {headerOptions.map((option) => (
              <option key={option.index} value={option.index}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: '0.8125rem', alignSelf: 'flex-end', paddingBottom: '0.35rem' }}>
          <span style={{ color: 'var(--muted)' }}>Filas de datos: </span>
          <strong>{analysis.validRows.toLocaleString()}</strong>
          {analysis.invalidRows > 0 && (
            <span style={{ color: 'var(--error)' }}>
              {' '}
              · {analysis.invalidRows.toLocaleString()} descartadas
            </span>
          )}
        </div>
      </div>

      {/* Mapeo columna → campo */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Columna del archivo</th>
              <th style={thStyle}>Ejemplos</th>
              <th style={{ ...thStyle, width: '15rem' }}>Campo del sistema</th>
            </tr>
          </thead>
          <tbody>
            {analysis.columns.map((column) => {
              const assigned = byColumn.get(column.index);
              const hint = assigned ? sourceHint(analysis.mappingSource[assigned]) : null;

              return (
                <tr key={column.index}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{column.label}</div>
                    {hint && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{hint}</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', fontSize: '0.75rem' }}>
                    <span className="mono">{column.samples.slice(0, 2).join(' · ') || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <select
                      className="input input-sm"
                      style={{ width: '100%' }}
                      value={assigned ?? NONE}
                      disabled={busy}
                      aria-label={`Campo para la columna ${column.label}`}
                      onChange={(event) => handleFieldChange(column.index, event.target.value)}
                    >
                      <option value={NONE}>— No importar —</option>
                      {PADRON_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {PADRON_FIELD_LABELS[field]}
                          {REQUIRED_PADRON_FIELDS.includes(field) ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingRequired.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--error-light)',
            color: 'var(--error)',
            fontSize: '0.8125rem',
          }}
        >
          Falta indicar qué columna trae:{' '}
          <strong>
            {missingRequired.map((field) => PADRON_FIELD_LABELS[field]).join(', ')}
          </strong>
          . Sin esos datos no se puede importar una fila.
        </div>
      )}

      {analysis.issues.length > 0 && (
        <details style={{ marginTop: '1rem', fontSize: '0.8125rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>
            Ver {analysis.invalidRows.toLocaleString()} filas que se descartarán
          </summary>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--ink-soft)' }}>
            {analysis.issues.map((issue) => (
              <li key={`${issue.row}-${issue.reason}`}>
                Fila {issue.row}: {issue.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {analysis.preview.length > 0 && (
        <details style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }} open>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>
            Vista previa de las primeras filas
          </summary>
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  {['Carnet', 'Nombre', 'Correo', 'Sede', 'Carrera', 'Grado'].map((label) => (
                    <th key={label} style={thStyle}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.preview.map((row) => (
                  <tr key={row.Carnet}>
                    <td style={tdStyle}>{row.Carnet}</td>
                    <td style={tdStyle}>{row.Nombre}</td>
                    <td style={tdStyle}>{row.Correo}</td>
                    <td style={tdStyle}>{row.Sede ?? '—'}</td>
                    <td style={tdStyle}>{row.Carrera ?? '—'}</td>
                    <td style={tdStyle}>{row.Grado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {analysis.diff && !stale && (
        <ImportDiffPanel
          diff={analysis.diff}
          activeStudents={analysis.activeStudents}
          requiresConfirmation={analysis.requiresConfirmation}
          confirmed={confirmed}
          onConfirmedChange={setConfirmed}
        />
      )}

      {stale && (
        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--muted)',
          }}
        >
          Cambió el mapeo. Recalcule para ver qué efecto tendrá antes de aplicarlo.
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <button className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={busy || missingRequired.length > 0}
            onClick={() => {
              setStale(false);
              onRecalculate({ sheetIndex, headerRowIndex, mapping });
            }}
          >
            Recalcular
          </button>
          <button
            className="btn btn-accent btn-sm"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                sheetIndex,
                headerRowIndex,
                mapping,
                confirmDeactivation: confirmed,
              })
            }
          >
            {busy ? 'Importando…' : 'Confirmar e importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function describeHeaderRow(index: number): string {
  if (index < 0) return 'El archivo no trae encabezados';
  return `Fila ${index + 1}`;
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};
