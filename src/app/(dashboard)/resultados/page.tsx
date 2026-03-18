'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Election, ElectionResults } from '@/types/elections';

const RESULT_COLORS = ['var(--accent)', 'var(--ink-soft)', 'var(--muted)', '#7C3AED', '#0EA5E9', '#D97706'];

export default function ResultadosPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<Election[]>('/api/elections');
      // Only elections that have been closed or later can show results
      const withResults = data.filter((e) =>
        ['CLOSED', 'SCRUTINIZED', 'ARCHIVED'].includes(e.status)
      );
      setElections(withResults);
      if (withResults.length > 0) {
        setSelectedId(withResults[0].id);
      }
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async (id: string) => {
    try {
      setLoadingResults(true);
      const data = await apiClient<ElectionResults>(`/api/elections/${id}/results`);
      setResults(data);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  useEffect(() => {
    if (selectedId) fetchResults(selectedId);
  }, [selectedId, fetchResults]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>Cargando...</div>;
  }

  if (elections.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '1rem' }}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Sin resultados</h3>
        <p>No hay votaciones cerradas con resultados disponibles.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Resultados</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {results?.election.title ?? 'Selecciona una votacion'}
          </p>
        </div>
      </div>

      {/* Election selector */}
      {elections.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {elections.map((e) => (
            <button
              key={e.id}
              className={`filter-chip ${selectedId === e.id ? 'active' : ''}`}
              onClick={() => setSelectedId(e.id)}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      {loadingResults ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Cargando resultados...</div>
      ) : results && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="label">Total votos</div>
              <div className="stat-card-value" style={{ fontSize: '1.75rem' }}>
                {results.total_votes.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Participacion</div>
              <div className="stat-card-value" style={{ fontSize: '1.75rem', color: 'var(--success)' }}>
                {results.participation_rate.toFixed(1)}%
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Elegibles</div>
              <div className="stat-card-value" style={{ fontSize: '1.75rem' }}>
                {results.total_eligible.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Abstenciones</div>
              <div className="stat-card-value" style={{ fontSize: '1.75rem', color: 'var(--muted)' }}>
                {(results.total_eligible - results.total_votes).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Results bars */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1rem', marginBottom: '1.5rem' }}>
              Desglose de resultados
            </h3>

            {results.options
              .filter((o) => o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE')
              .map((option, i) => (
                <div key={option.id} className="results-bar">
                  <div className="results-bar-label">{option.label}</div>
                  <div className="results-bar-track">
                    <div
                      className="results-bar-fill"
                      style={{
                        width: `${option.percentage}%`,
                        background: RESULT_COLORS[i % RESULT_COLORS.length],
                      }}
                    >
                      {option.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="results-bar-count">{option.vote_count.toLocaleString()}</div>
                </div>
              ))}

            {/* Special votes */}
            {results.options.some((o) => o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE') && (
              <div style={{ borderTop: '1px dashed var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                {results.options
                  .filter((o) => o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE')
                  .map((option) => (
                    <div key={option.id} className="results-bar">
                      <div className="results-bar-label" style={{ color: 'var(--muted)' }}>{option.label}</div>
                      <div className="results-bar-track">
                        <div
                          className="results-bar-fill"
                          style={{
                            width: `${option.percentage}%`,
                            background: 'var(--border-strong)',
                            color: 'var(--muted)',
                          }}
                        >
                          {option.percentage.toFixed(1)}%
                        </div>
                      </div>
                      <div className="results-bar-count" style={{ color: 'var(--muted)' }}>
                        {option.vote_count.toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Winner announcement */}
          {results.options.length > 0 && (() => {
            const validOptions = results.options.filter(
              (o) => o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE'
            );
            const winner = validOptions.reduce((prev, curr) =>
              curr.vote_count > prev.vote_count ? curr : prev
            , validOptions[0]);

            if (!winner) return null;

            return (
              <div className="card" style={{ background: 'var(--success-light)', borderColor: '#BBF7D0', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600, color: '#065F46' }}>
                      Resultado: {winner.label}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#059669' }}>
                      {winner.percentage.toFixed(1)}% de los votos
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
