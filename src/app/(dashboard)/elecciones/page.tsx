'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import TagBadge from '@/components/tags/TagBadge';
import type { Election } from '@/types/elections';
import Loader from '@/components/Loader';

type StatusFilter = 'ALL' | 'OPEN' | 'DRAFT' | 'CLOSED' | 'ARCHIVED' | 'SCHEDULED' | 'SCRUTINIZED';

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

export default function EleccionesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

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

  const filtered = filter === 'ALL' ? elections : elections.filter((election) => election.status === filter);

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
              </tr>
            </thead>
            <tbody>
              {filtered.map((election, index) => {
                const participation = election.total_voters > 0
                  ? Math.round((election.votes_cast / election.total_voters) * 100)
                  : 0;

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
                        <TagBadge label={election.tag_name} size="sm" className="tag-badge--table" />
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>-</span>
                      )}
                    </td>
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
