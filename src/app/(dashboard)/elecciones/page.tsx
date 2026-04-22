'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
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

function getTagChipStyle(tagName: string): CSSProperties {
  const hash = Array.from(tagName).reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0,
    17
  );
  const hue = hash % 360;
  const saturation = 62 + (hash % 16);
  const tone = 28 + (hash % 14);

  return {
    color: `hsl(${hue} ${saturation}% ${tone}%)`,
    backgroundColor: `hsla(${hue} ${Math.max(40, saturation - 18)}% 90% / 0.98)`,
    boxShadow: `inset 2px 2px 4px rgba(255, 255, 255, 0.72), 0 8px 18px hsla(${hue} ${saturation}% ${tone}% / 0.12)`,
  };
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
                const tagChipStyle = election.tag_name ? getTagChipStyle(election.tag_name) : undefined;

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
                        <span className="admin-election-tag-chip" style={tagChipStyle}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v3.379c0 .398.158.779.439 1.061l5.121 5.121a1.5 1.5 0 0 0 2.122 0l4.379-4.379a1.5 1.5 0 0 0 0-2.122L7.94 1.439A1.5 1.5 0 0 0 6.879 1H3.5A1.5 1.5 0 0 0 2.5 2Zm1.75 1.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                          </svg>
                          <span>{election.tag_name}</span>
                        </span>
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
