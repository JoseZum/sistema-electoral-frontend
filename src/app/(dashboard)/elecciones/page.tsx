'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import TagBadge from '@/components/tags/TagBadge';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import type { Election } from '@/types/elections';
import Loader from '@/components/Loader';

type StatusFilter = 'ALL' | 'OPEN' | 'DRAFT' | 'CLOSED' | 'ARCHIVED' | 'SCHEDULED' | 'SCRUTINIZED';
type FeedbackState = { tone: 'success' | 'error'; message: string } | null;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

const STATUS_BADGE_VARIANTS: Record<Election['status'], BadgeVariant> = {
  DRAFT: 'gray',
  SCHEDULED: 'blue',
  OPEN: 'green',
  CLOSED: 'red',
  SCRUTINIZED: 'amber',
  ARCHIVED: 'purple',
};

const STATUS_BADGE_ICONS: Record<Election['status'], ReactNode> = {
  DRAFT: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  SCHEDULED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  OPEN: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 12 1.8 1.8L15 10.2" />
    </svg>
  ),
  CLOSED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  ),
  SCRUTINIZED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
    </svg>
  ),
  ARCHIVED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
      <path d="M10 12h4" />
    </svg>
  ),
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';

  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function canArchiveElection(election: Election) {
  return election.status === 'SCRUTINIZED'
    || (election.status === 'CLOSED' && !election.requires_keys);
}

function unarchiveTargetStatus(election: Election): Election['status'] {
  // requires_keys=true → only path to ARCHIVED was via SCRUTINIZED, so revert there.
  // requires_keys=false → safest reverse is CLOSED (admin can re-scrutinize from there).
  return election.requires_keys ? 'SCRUTINIZED' : 'CLOSED';
}

type DeleteSeverity = 'low' | 'high';

function deleteSeverity(status: Election['status']): DeleteSeverity {
  return status === 'DRAFT' || status === 'SCHEDULED' ? 'low' : 'high';
}

export default function EleccionesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Election | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);

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

  async function handleArchive(election: Election) {
    if (!canArchiveElection(election)) {
      return;
    }

    const confirmed = window.confirm(
      `Se archivará la votación "${election.title}". ¿Deseas continuar?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setArchivingId(election.id);
      setFeedback(null);

      const updatedElection = await apiClient<Partial<Election> & Pick<Election, 'id' | 'status'>>(`/api/elections/${election.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });

      setElections((current) =>
        current.map((item) => (item.id === updatedElection.id ? { ...item, ...updatedElection } : item))
      );
      setFeedback({
        tone: 'success',
        message: `La votación "${election.title}" fue archivada.`,
      });
    } catch (err) {
      console.error('Error archiving election:', err);
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'No se pudo archivar la votación.',
      });
    } finally {
      setArchivingId(null);
    }
  }

  async function handleUnarchive(election: Election) {
    if (election.status !== 'ARCHIVED') {
      return;
    }

    const target = unarchiveTargetStatus(election);
    const targetLabel = STATUS_LABELS[target] ?? target;
    const confirmed = window.confirm(
      `Se desarchivará la votación "${election.title}" y volverá a estado "${targetLabel}". ¿Deseas continuar?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setUnarchivingId(election.id);
      setFeedback(null);

      const updatedElection = await apiClient<Partial<Election> & Pick<Election, 'id' | 'status'>>(`/api/elections/${election.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: target }),
      });

      setElections((current) =>
        current.map((item) => (item.id === updatedElection.id ? { ...item, ...updatedElection } : item))
      );
      setFeedback({
        tone: 'success',
        message: `La votación "${election.title}" fue desarchivada (${targetLabel}).`,
      });
    } catch (err) {
      console.error('Error unarchiving election:', err);
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'No se pudo desarchivar la votación.',
      });
    } finally {
      setUnarchivingId(null);
    }
  }

  function requestDelete(election: Election) {
    setFeedback(null);
    if (deleteSeverity(election.status) === 'low') {
      const confirmed = window.confirm(
        `Se eliminará la votación "${election.title}" (${STATUS_LABELS[election.status]}). ¿Deseas continuar?`
      );
      if (!confirmed) return;
      void performDelete(election);
      return;
    }

    setDeleteConfirmText('');
    setDeleteTarget(election);
  }

  async function performDelete(election: Election) {
    try {
      setDeletingId(election.id);
      setFeedback(null);

      await apiClient<{ success: boolean }>(`/api/elections/${election.id}`, {
        method: 'DELETE',
      });

      setElections((current) => current.filter((item) => item.id !== election.id));
      setFeedback({
        tone: 'success',
        message: `La votación "${election.title}" fue eliminada.`,
      });
    } catch (err) {
      console.error('Error deleting election:', err);
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'No se pudo eliminar la votación.',
      });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
      setDeleteConfirmText('');
    }
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeleteConfirmText('');
  }

  const visibleElections = elections.filter((election) => election.status !== 'ARCHIVED');
  const filtered = filter === 'ALL'
    ? visibleElections
    : elections.filter((election) => election.status === filter);

  const counts: Record<string, number> = {};
  for (const election of elections) {
    counts[election.status] = (counts[election.status] || 0) + 1;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Votaciones</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Gestión de procesos electorales
          </p>
        </div>
        <Link href="/elecciones/crear" className="btn btn-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva votación
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
          Todas ({visibleElections.length})
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

      {feedback && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${feedback.tone === 'error' ? 'var(--error)' : 'var(--success)'}`,
            background: feedback.tone === 'error' ? 'var(--error-light)' : 'var(--success-light)',
            color: feedback.tone === 'error' ? 'var(--error)' : 'var(--success)',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {feedback.message}
        </div>
      )}

      {loading ? (
        <Loader />
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
                <th>Título</th>
                <th>Tag</th>
                <th>Estado</th>
                <th>Elegibles</th>
                <th>Participación</th>
                <th>Fecha</th>
                <th style={{ width: '150px' }}>Archivar</th>
                <th style={{ width: '140px' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((election, index) => {
                const totalVoters = election.total_voters ?? 0;
                const votesCast = election.votes_cast ?? 0;
                const participation = totalVoters > 0
                  ? Math.round((votesCast / totalVoters) * 100)
                  : 0;
                const canArchive = canArchiveElection(election);
                const isArchived = election.status === 'ARCHIVED';
                const isArchiving = archivingId === election.id;
                const isUnarchiving = unarchivingId === election.id;
                const archiveDisabled = !canArchive || isArchiving;
                const archiveHint = isArchived
                  ? `Restaurar a ${STATUS_LABELS[unarchiveTargetStatus(election)]}`
                  : canArchive
                    ? 'Archivar votación'
                    : 'Solo se pueden archivar votaciones escrutadas o cerradas sin escrutinio';
                const isDeleting = deletingId === election.id;
                const severity = deleteSeverity(election.status);
                const deleteHint = severity === 'low'
                  ? 'Eliminar votación'
                  : 'Eliminar votación (acción destructiva: borra votos, opciones y configuración)';

                return (
                  <tr key={election.id} className="table-row-enter" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{election.title}</div>
                      {election.starts_immediately && election.immediate_minutes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                          {`Inicio inmediato: ${election.immediate_minutes} min`}
                        </div>
                      )}
                    </td>
                    <td>
                      {election.tag_name ? (
                        <TagBadge
                          label={election.tag_name}
                          color={election.tag_color}
                          size="sm"
                          className="tag-badge--table"
                          leadingIcon="tag"
                        />
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        variant={STATUS_BADGE_VARIANTS[election.status]}
                        size="md"
                        capitalize={false}
                        icon={STATUS_BADGE_ICONS[election.status]}
                      >
                        {STATUS_LABELS[election.status]}
                      </Badge>
                    </td>
                    <td>{totalVoters.toLocaleString()}</td>
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
                      <span title={archiveHint} style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${isArchived || canArchive ? 'btn-outline' : 'btn-ghost'}`}
                          onClick={() =>
                            isArchived
                              ? void handleUnarchive(election)
                              : void handleArchive(election)
                          }
                          disabled={isArchived ? isUnarchiving : archiveDisabled}
                          style={{
                            minWidth: '122px',
                            justifyContent: 'center',
                            opacity: (isArchived ? isUnarchiving : archiveDisabled) ? 0.65 : 1,
                            cursor: (isArchived ? isUnarchiving : archiveDisabled) ? 'not-allowed' : 'pointer',
                            color: canArchive || isArchived ? 'var(--ink)' : 'var(--muted)',
                          }}
                        >
                          {isArchiving || isUnarchiving ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                              {isArchiving ? 'Archivando...' : 'Desarchivando...'}
                            </>
                          ) : isArchived ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M21 8v13H3V8" />
                                <path d="M1 3h22v5H1z" />
                                <path d="M9 12h6" />
                                <path d="M12 9v6" />
                              </svg>
                              Desarchivar
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="4" rx="1" />
                                <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                                <path d="M10 12h4" />
                              </svg>
                              {canArchive ? 'Archivar' : 'No disponible'}
                            </>
                          )}
                        </button>
                      </span>
                    </td>
                    <td>
                      <span title={deleteHint} style={{ display: 'inline-flex' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => requestDelete(election)}
                          disabled={isDeleting}
                          style={{
                            minWidth: '112px',
                            justifyContent: 'center',
                            opacity: isDeleting ? 0.65 : 1,
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            color: severity === 'high' ? 'var(--error)' : 'var(--ink)',
                            borderColor: severity === 'high' ? 'var(--error)' : undefined,
                          }}
                        >
                          {isDeleting ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                              Eliminando...
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                              Eliminar
                            </>
                          )}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteElectionModal
          election={deleteTarget}
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onCancel={cancelDelete}
          onConfirm={() => void performDelete(deleteTarget)}
          deleting={deletingId === deleteTarget.id}
        />
      )}
    </>
  );
}

const DELETE_CONFIRM_PHRASE = 'ELIMINAR';

function DeleteElectionModal({
  election,
  confirmText,
  onConfirmTextChange,
  onCancel,
  onConfirm,
  deleting,
}: {
  election: Election;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const statusLabel = STATUS_LABELS[election.status] ?? election.status;
  const canConfirm = confirmText.trim().toUpperCase() === DELETE_CONFIRM_PHRASE && !deleting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-election-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 18, 32, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '520px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          border: '1px solid var(--error)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--error-light)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3
            id="delete-election-title"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', margin: 0 }}
          >
            Eliminar votación
          </h3>
        </div>

        <p style={{ fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
          Estás por eliminar la votación{' '}
          <strong>«{election.title}»</strong> que se encuentra en estado{' '}
          <strong>{statusLabel}</strong>.
        </p>

        <div
          style={{
            background: 'var(--error-light)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Esta acción es irreversible.</strong>
          Se eliminarán de forma permanente la votación y <strong>todos sus datos asociados</strong>:
          opciones, padrón de votantes elegibles, votos emitidos, llaves de escrutinio y tokens.
          {election.status === 'OPEN' && (
            <> La votación está <strong>abierta</strong>: los votos en curso se perderán.</>
          )}
        </div>

        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Para confirmar, escribe <code style={{ background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{DELETE_CONFIRM_PHRASE}</code>:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(event) => onConfirmTextChange(event.target.value)}
          autoFocus
          disabled={deleting}
          className="input"
          style={{ width: '100%', marginBottom: '1.25rem' }}
          placeholder={DELETE_CONFIRM_PHRASE}
        />

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              background: 'var(--error)',
              color: '#fff',
              opacity: canConfirm ? 1 : 0.6,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
