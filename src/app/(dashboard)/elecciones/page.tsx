'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import TagBadge from '@/components/tags/TagBadge';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import type { Election } from '@/types/elections';
import Loader from '@/components/Loader';
import { resolveTagColor } from '@/lib/tag-colors';

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
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);
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

  const availableTags = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null; count: number }>();
    for (const election of elections) {
      if (!election.tag_id || !election.tag_name) continue;
      const existing = map.get(election.tag_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(election.tag_id, {
          id: election.tag_id,
          name: election.tag_name,
          color: election.tag_color ?? null,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [elections]);

  const activeTag = tagFilter ? availableTags.find((t) => t.id === tagFilter) ?? null : null;

  useEffect(() => {
    if (tagFilter && !availableTags.some((t) => t.id === tagFilter)) {
      setTagFilter(null);
    }
  }, [availableTags, tagFilter]);

  useEffect(() => {
    if (!tagMenuOpen) return;
    const handler = (event: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
    };
    const escHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTagMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [tagMenuOpen]);

  const tagFiltered = tagFilter
    ? elections.filter((election) => election.tag_id === tagFilter)
    : elections;
  const visibleElections = tagFiltered.filter((election) => election.status !== 'ARCHIVED');
  const filtered = filter === 'ALL'
    ? visibleElections
    : tagFiltered.filter((election) => election.status === filter);

  const counts: Record<string, number> = {};
  for (const election of tagFiltered) {
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 5 }}>
        <div ref={tagMenuRef} style={{ position: 'relative', display: 'inline-flex', zIndex: 200 }}>
          <button
            type="button"
            onClick={() => setTagMenuOpen((open) => !open)}
            disabled={availableTags.length === 0}
            aria-label={activeTag ? `Filtro de tag: ${activeTag.name}` : 'Filtrar por tag'}
            aria-haspopup="true"
            aria-expanded={tagMenuOpen}
            title={
              availableTags.length === 0
                ? 'No hay tags asociados a votaciones'
                : activeTag
                  ? `Filtrando por tag «${activeTag.name}»`
                  : 'Filtrar por tag'
            }
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `1.5px solid ${activeTag ? resolveTagColor(activeTag.name, activeTag.color) : 'var(--border, #d4d2cf)'}`,
              background: activeTag ? resolveTagColor(activeTag.name, activeTag.color) : 'var(--surface-raised, #fff)',
              color: activeTag ? '#fff' : 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: availableTags.length === 0 ? 'not-allowed' : 'pointer',
              opacity: availableTags.length === 0 ? 0.5 : 1,
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" />
              <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
            </svg>
          </button>

          {tagMenuOpen && availableTags.length > 0 && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 1000,
                minWidth: 240,
                maxHeight: 320,
                overflowY: 'auto',
                background: 'var(--surface-raised, #fff)',
                border: '1px solid var(--border, #d4d2cf)',
                borderRadius: 8,
                boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                padding: '0.375rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setTagFilter(null);
                  setTagMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 6,
                  border: 'none',
                  background: !tagFilter ? 'var(--surface-sunken, #ececea)' : 'transparent',
                  color: 'var(--ink)',
                  fontSize: '0.8125rem',
                  fontWeight: !tagFilter ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>Todas las tags</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{elections.length}</span>
              </button>
              {availableTags.map((tag) => {
                const selected = tag.id === tagFilter;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setTagFilter(selected ? null : tag.id);
                      setTagMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 6,
                      border: 'none',
                      background: selected ? 'var(--surface-sunken, #ececea)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: resolveTagColor(tag.name, tag.color),
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tag.name}
                      </span>
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{tag.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeTag && (
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className="filter-chip active"
            title="Quitar filtro de tag"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: resolveTagColor(activeTag.name, activeTag.color),
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            Tag: {activeTag.name}
            <span aria-hidden="true" style={{ fontSize: '0.85rem', lineHeight: 1 }}>×</span>
          </button>
        )}

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
                <th style={{ width: '56px' }} />
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
                          className="btn btn-sm btn-ghost"
                          onClick={() => requestDelete(election)}
                          disabled={isDeleting}
                          aria-label={deleteHint}
                          style={{
                            padding: '0.25rem',
                            width: 32,
                            height: 32,
                            justifyContent: 'center',
                            opacity: isDeleting ? 0.65 : 1,
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            color: severity === 'high' ? 'var(--error)' : 'var(--muted)',
                          }}
                        >
                          {isDeleting ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
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
          background: 'var(--surface-raised, #ffffff)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '520px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          border: '1px solid var(--error)',
          position: 'relative',
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
