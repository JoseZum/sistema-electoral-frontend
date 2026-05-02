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

export default function EleccionesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [archivingId, setArchivingId] = useState<string | null>(null);
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
                <th>Titulo</th>
                <th>Tag</th>
                <th>Estado</th>
                <th>Elegibles</th>
                <th>Participacion</th>
                <th>Fecha</th>
                <th style={{ width: '150px' }}>Archivar</th>
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
                const archiveDisabled = !canArchive || isArchiving;
                const archiveHint = isArchived
                  ? 'Esta votacion ya fue archivada'
                  : canArchive
                    ? 'Archivar votacion'
                    : 'Solo se pueden archivar votaciones escrutadas o cerradas sin escrutinio';

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
                          className={`btn btn-sm ${canArchive ? 'btn-outline' : 'btn-ghost'}`}
                          onClick={() => void handleArchive(election)}
                          disabled={archiveDisabled}
                          style={{
                            minWidth: '122px',
                            justifyContent: 'center',
                            opacity: archiveDisabled ? 0.65 : 1,
                            cursor: archiveDisabled ? 'not-allowed' : 'pointer',
                            color: canArchive ? 'var(--ink)' : isArchived ? 'var(--ink-soft)' : 'var(--muted)',
                          }}
                        >
                          {isArchiving ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                              Archivando...
                            </>
                          ) : isArchived ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="4" rx="1" />
                                <path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                                <path d="M10 12h4" />
                              </svg>
                              Archivada
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
