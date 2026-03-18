'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import type { Election, ElectionDetail } from '@/types/elections';

type StatusFilter = 'ALL' | 'OPEN' | 'DRAFT' | 'CLOSED' | 'ARCHIVED' | 'SCHEDULED' | 'SCRUTINIZED';

type ElectionEditor = {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_anonymous: boolean;
  optionLabels: Record<string, string>;
  optionDescriptions: Record<string, string>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-draft',
  SCHEDULED: 'badge-scheduled',
  OPEN: 'badge-open',
  CLOSED: 'badge-closed',
  SCRUTINIZED: 'badge-scrutinized',
  ARCHIVED: 'badge-archived',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toInputValue(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function getOptionDescription(metadata: Record<string, unknown> | null) {
  return typeof metadata?.description === 'string' ? metadata.description : '';
}

function isPreOpenStatus(status: Election['status']) {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

function buildEditorState(election: ElectionDetail): ElectionEditor {
  return {
    title: election.title,
    description: election.description || '',
    start_time: toInputValue(election.start_time),
    end_time: toInputValue(election.end_time),
    is_anonymous: election.is_anonymous,
    optionLabels: Object.fromEntries(
      election.options.map((option) => [option.id, option.label])
    ),
    optionDescriptions: Object.fromEntries(
      election.options.map((option) => [option.id, getOptionDescription(option.metadata)])
    ),
  };
}

export default function EleccionesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selectedElection, setSelectedElection] = useState<ElectionDetail | null>(null);
  const [editor, setEditor] = useState<ElectionEditor | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<Election[]>('/api/elections');
      setElections(data);
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  async function openElectionModal(id: string) {
    try {
      setModalLoading(true);
      setModalError(null);
      const detail = await apiClient<ElectionDetail>(`/api/elections/${id}`);
      setSelectedElection(detail);
      setEditor(buildEditorState(detail));
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No se pudo cargar la votacion');
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setSelectedElection(null);
    setEditor(null);
    setModalError(null);
  }

  async function handleSaveElection() {
    if (!selectedElection || !editor) return;

    const canEditElectionFields = isPreOpenStatus(selectedElection.status);

    try {
      setSaving(true);
      setModalError(null);

      if (canEditElectionFields) {
        await apiClient(`/api/elections/${selectedElection.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: editor.title,
            description: editor.description || null,
            start_time: editor.start_time || null,
            end_time: editor.end_time || null,
            is_anonymous: editor.is_anonymous,
          }),
        });
      }

      for (const option of selectedElection.options) {
        const payload: Record<string, unknown> = {};
        const nextLabel = editor.optionLabels[option.id] || '';
        const nextDescription = editor.optionDescriptions[option.id] || '';

        if (canEditElectionFields && nextLabel !== option.label) {
          payload.label = nextLabel;
        }
        if (nextDescription !== getOptionDescription(option.metadata)) {
          payload.description = nextDescription;
        }

        if (Object.keys(payload).length > 0) {
          await apiClient(`/api/elections/${selectedElection.id}/options/${option.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        }
      }

      await fetchElections();
      await openElectionModal(selectedElection.id);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No se pudo guardar la votacion');
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter === 'ALL' ? elections : elections.filter((election) => election.status === filter);

  const counts: Record<string, number> = {};
  for (const election of elections) {
    counts[election.status] = (counts[election.status] || 0) + 1;
  }

  const canEditElectionFields = selectedElection ? isPreOpenStatus(selectedElection.status) : false;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Votaciones</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Gestion de procesos electorales
          </p>
        </div>
        <Link href="/elecciones/crear" className="btn btn-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva votacion
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
          Todas ({elections.length})
        </button>
        {(['OPEN', 'DRAFT', 'SCHEDULED', 'CLOSED', 'SCRUTINIZED', 'ARCHIVED'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            className={`filter-chip ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {STATUS_LABELS[status]} ({counts[status] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>Cargando votaciones...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
          <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: '0.5rem' }}>Sin votaciones</h3>
          <p>No hay votaciones que coincidan con el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Estado</th>
                <th>Elegibles</th>
                <th>Participacion</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((election, index) => {
                const participation = election.total_voters > 0
                  ? Math.round((election.votes_cast / election.total_voters) * 100)
                  : 0;

                return (
                  <tr key={election.id} className="table-row-enter" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{election.title}</td>
                    <td>
                      <span className={`badge badge-dot ${STATUS_BADGE[election.status]}`}>
                        {STATUS_LABELS[election.status]}
                      </span>
                    </td>
                    <td>{election.total_voters.toLocaleString()}</td>
                    <td>
                      {election.status === 'DRAFT' || election.status === 'SCHEDULED' ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>-</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ width: 80, height: 6 }}>
                            <div className={`progress-bar-fill ${participation >= 70 ? 'success' : 'accent'}`} style={{ width: `${participation}%` }} />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{participation}%</span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(election.start_time || election.created_at)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openElectionModal(election.id)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(modalLoading || selectedElection) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 860, maxHeight: '85vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>Editar votacion</div>
                {selectedElection && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                    {STATUS_LABELS[selectedElection.status]} · {selectedElection.total_voters} votantes elegibles
                  </div>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeModal} disabled={saving}>Cerrar</button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {modalLoading || !selectedElection || !editor ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Cargando...</div>
              ) : (
                <>
                  {modalError && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--error-light)', color: 'var(--error)', border: '1px solid var(--error)' }}>
                      {modalError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Titulo</label>
                      <input
                        className="input"
                        value={editor.title}
                        disabled={!canEditElectionFields || saving}
                        onChange={(event) => setEditor((prev) => prev ? { ...prev, title: event.target.value } : prev)}
                      />
                    </div>

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Descripcion</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={editor.description}
                        disabled={!canEditElectionFields || saving}
                        onChange={(event) => setEditor((prev) => prev ? { ...prev, description: event.target.value } : prev)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Apertura</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={editor.start_time}
                        disabled={!canEditElectionFields || saving}
                        onChange={(event) => setEditor((prev) => prev ? { ...prev, start_time: event.target.value } : prev)}
                      />
                    </div>

                    <div className="input-group">
                      <label>Cierre</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={editor.end_time}
                        disabled={!canEditElectionFields || saving}
                        onChange={(event) => setEditor((prev) => prev ? { ...prev, end_time: event.target.value } : prev)}
                      />
                    </div>
                  </div>

                  <label style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-soft)' }}>
                    <input
                      type="checkbox"
                      checked={editor.is_anonymous}
                      disabled={!canEditElectionFields || saving}
                      onChange={(event) => setEditor((prev) => prev ? { ...prev, is_anonymous: event.target.checked } : prev)}
                    />
                    Voto anonimo
                  </label>

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Opciones de voto</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                      Antes de abrir la votacion puedes cambiar la etiqueta. Cuando ya esta activa o finalizada, solo se puede editar la descripcion.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {selectedElection.options.map((option) => (
                        <div key={option.id} className="card" style={{ padding: '1rem' }}>
                          <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                            <label>Etiqueta de la opcion</label>
                            <input
                              className="input"
                              value={editor.optionLabels[option.id] || ''}
                              disabled={!canEditElectionFields || saving}
                              onChange={(event) =>
                                setEditor((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        optionLabels: {
                                          ...prev.optionLabels,
                                          [option.id]: event.target.value,
                                        },
                                      }
                                    : prev
                                )
                              }
                            />
                          </div>

                          <div className="input-group">
                            <label>Descripcion de la opcion</label>
                            <textarea
                              className="input"
                              rows={2}
                              value={editor.optionDescriptions[option.id] || ''}
                              disabled={saving}
                              onChange={(event) =>
                                setEditor((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        optionDescriptions: {
                                          ...prev.optionDescriptions,
                                          [option.id]: event.target.value,
                                        },
                                      }
                                    : prev
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', maxWidth: 420 }}>
                {canEditElectionFields
                  ? 'Mientras la votacion siga en borrador o programada, puedes editar datos generales y las etiquetas de las opciones.'
                  : 'Como la votacion ya esta activa o finalizada, solo se permite ajustar la descripcion de cada opcion.'}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cerrar</button>
                {selectedElection && (
                  <button className="btn btn-accent" onClick={handleSaveElection} disabled={saving || modalLoading}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
