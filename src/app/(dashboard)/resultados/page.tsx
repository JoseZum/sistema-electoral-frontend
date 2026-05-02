'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { exportResultsToPDF, exportResultsToDOCX } from '@/lib/export-results';
import { listTags } from '@/lib/tags-api';
import TagBadge from '@/components/tags/TagBadge';
import type { Election, ElectionResults } from '@/types/elections';
import type { TagSummary } from '@/types/tags';
import Loader from '@/components/Loader';

const RESULT_COLORS = ['var(--accent)', 'var(--ink-soft)', 'var(--muted)', '#7C3AED', '#0EA5E9', '#D97706'];

export default function ResultadosPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<Election[]>('/api/elections');
      // Elections that require scrutiny only expose results after finalization.
      const withResults = data.filter((e) =>
        ['SCRUTINIZED', 'ARCHIVED'].includes(e.status)
        || (e.status === 'CLOSED' && !e.requires_keys)
      );
      setElections(withResults);
      setSelectedId(withResults[0]?.id ?? null);
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const data = await listTags();
      setTags(data || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setTags([]);
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

  const handleExport = useCallback(async (format: 'pdf' | 'docx') => {
    if (!results) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      if (format === 'pdf') await exportResultsToPDF(results);
      else await exportResultsToDOCX(results);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [results]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredElections = elections.filter((election) => {
    const matchesTag = selectedTagId === 'all'
      ? true
      : selectedTagId === 'untagged'
        ? !election.tag_id
        : election.tag_id === selectedTagId;

    return matchesTag;
  });

  const selectedElection = elections.find((election) => election.id === selectedId) || null;

  useEffect(() => {
    if (filteredElections.length === 0) {
      setSelectedId(null);
      setResults(null);
      return;
    }

    if (!selectedId || !filteredElections.some((election) => election.id === selectedId)) {
      setSelectedId(filteredElections[0].id);
    }
  }, [filteredElections, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setResults(null);
      return;
    }

    fetchResults(selectedId);
  }, [selectedId, fetchResults]);

  if (loading) {
    return <Loader />;
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
            {selectedElection?.title ?? results?.election.title ?? 'Selecciona una votación'}
          </p>
          {selectedElection?.tag_name && (
            <div style={{ marginTop: '0.75rem' }}>
              <TagBadge
                label={selectedElection.tag_name}
                color={selectedElection.tag_color}
                size="sm"
                leadingIcon="tag"
              />
            </div>
          )}
        </div>

        {results && (
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              )}
              {exporting ? 'Exportando...' : 'Exportar reporte'}
              {!exporting && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>

            {exportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 50,
                  minWidth: '160px',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => handleExport('pdf')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    color: 'var(--ink)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-alt, var(--border))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Exportar PDF
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    width: '100%',
                    padding: '0.625rem 1rem',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    color: 'var(--ink)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-alt, var(--border))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                  Exportar Word (.doc)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card election-filters-card" style={{ marginBottom: '1.5rem' }}>
        <div className="election-filter-grid election-filter-grid--inline">
          <label className="monitoring-select-group">
            <span>Tag</span>
            <select
              className="input election-filter-control"
              value={selectedTagId}
              onChange={(event) => setSelectedTagId(event.target.value)}
            >
              <option value="all">Todas las tags</option>
              <option value="untagged">Sin tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>

          <label className="monitoring-select-group">
            <span>Votación</span>
            <select
              className="input election-filter-control"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value || null)}
              disabled={filteredElections.length === 0}
            >
              <option value="">
                {filteredElections.length === 0 ? 'Sin coincidencias' : 'Selecciona una votación'}
              </option>
              {filteredElections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredElections.length === 0 && (
        <div className="card election-filters-empty">
          <h3>No hay votaciones que coincidan con los filtros</h3>
          <p>Ajusta la búsqueda o cambia la tag para volver a cargar resultados.</p>
        </div>
      )}

      {filteredElections.length > 0 && loadingResults ? (
        <Loader />
      ) : filteredElections.length > 0 && results && (
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
              <div className="label">Participación</div>
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

          {/* Voter list */}
          {results.election.is_anonymous ? (
            <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem', background: 'var(--surface-alt, var(--surface))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Votación anónima</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    La lista de votantes no está disponible porque esta votación es anónima.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                  Personas votantes ({(results.voters ?? []).length})
                </h3>
              </div>
              {!results.voters || results.voters.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Ninguna persona votó.</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Nombre</th>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Carnet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.voters.map((voter, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{voter.full_name}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{voter.carnet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
