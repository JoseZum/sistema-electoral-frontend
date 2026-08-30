'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from '@/lib/postulaciones-api';
import type { ApplicationPositionWithUsage } from '@/types/postulaciones';

interface PositionsEditorProps {
  formId: string;
  /** Se avisa al padre para que refresque los contadores del formulario. */
  onChange?: () => void;
}

/**
 * Editor de puestos de un formulario ya creado.
 *
 * El cliente pidió poder añadir puestos sobre una convocatoria existente, así
 * que cada cambio se guarda contra el servidor en el momento en vez de
 * esperar a un botón de guardar general.
 */
export default function PositionsEditor({ formId, onChange }: PositionsEditorProps) {
  const [positions, setPositions] = useState<ApplicationPositionWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edición en línea del nombre de un puesto.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');

  const cargar = useCallback(async () => {
    try {
      setPositions(await listPositions(formId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los puestos');
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleAgregar() {
    if (!nuevo.trim()) return;

    setGuardando(true);
    setError(null);
    try {
      await createPosition(formId, nuevo.trim());
      setNuevo('');
      await cargar();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el puesto');
    } finally {
      setGuardando(false);
    }
  }

  async function handleRenombrar(positionId: string) {
    const nombre = nombreEditado.trim();
    if (!nombre) return;

    setGuardando(true);
    setError(null);
    try {
      await updatePosition(positionId, nombre);
      setEditandoId(null);
      await cargar();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar el puesto');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(position: ApplicationPositionWithUsage) {
    setGuardando(true);
    setError(null);
    try {
      await deletePosition(position.id);
      await cargar();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el puesto');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Cargando puestos…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {positions.length === 0 ? (
        <div className="postulacion-file-empty">
          Todavía no hay puestos. Si no agregas ninguno, el postulante no tendrá que elegir.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {positions.map((position) => (
            <div key={position.id} className="postulacion-position-row">
              {editandoId === position.id ? (
                <>
                  <input
                    className="input"
                    value={nombreEditado}
                    autoFocus
                    onChange={(e) => setNombreEditado(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRenombrar(position.id);
                      }
                      if (e.key === 'Escape') setEditandoId(null);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={() => handleRenombrar(position.id)}
                    disabled={guardando}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditandoId(null)}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="postulacion-position-name">{position.name}</span>
                  {position.application_count > 0 && (
                    <span className="postulacion-position-count">
                      {position.application_count} postulación
                      {position.application_count === 1 ? '' : 'es'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditandoId(position.id);
                      setNombreEditado(position.name);
                    }}
                    disabled={guardando}
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleEliminar(position)}
                    disabled={guardando || position.application_count > 0}
                    title={
                      position.application_count > 0
                        ? 'No se puede eliminar un puesto que ya tiene postulaciones'
                        : undefined
                    }
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="input"
          value={nuevo}
          placeholder="Ej. Presidencia, Tesorería…"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAgregar();
            }
          }}
          disabled={guardando}
          aria-label="Nombre del puesto nuevo"
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={guardando || !nuevo.trim()}
          onClick={() => void handleAgregar()}
        >
          {guardando ? 'Guardando…' : 'Agregar puesto'}
        </button>
      </div>

      {error && <div className="postulacion-field-error">{error}</div>}
    </div>
  );
}
