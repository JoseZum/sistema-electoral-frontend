'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { exportResultsToPDF, exportResultsToDOCX } from '@/lib/export-results';
import {
  getElectionStatusLabel,
  getNoVoteLabel,
  getParticipationLabel,
  getSuffrageDescription,
  getSuffrageLabel,
} from '@/lib/suffrage';
import { listTags } from '@/lib/tags-api';
import TagBadge from '@/components/tags/TagBadge';
import type { Election, ElectionResultOption, ElectionResults } from '@/types/elections';
import type { TagSummary } from '@/types/tags';
import Loader from '@/components/Loader';

const RESULT_COLORS = ['#0F766E', '#1D4ED8', '#7C2D12', '#7E22CE', '#1E3A8A', '#374151'];

function isSpecialResultOption(option: ElectionResultOption) {
  return option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE';
}

function getResultGroups(options: ElectionResultOption[]) {
  const flatChildren = options.filter((option) => option.parent_option_id);
  const topLevelOptions = options.filter((option) => !option.parent_option_id);

  return topLevelOptions
    .filter((option) => option.suboptions?.length || flatChildren.some((child) => child.parent_option_id === option.id))
    .map((option) => {
      const nestedSuboptions = option.suboptions?.length
        ? option.suboptions
        : flatChildren.filter((child) => child.parent_option_id === option.id);

      return {
        ...option,
        suboptions: nestedSuboptions,
      };
    });
}

function getResultOptionTotal(option: ElectionResultOption) {
  if (option.suboptions?.length) {
    return option.suboptions.reduce((total, suboption) => total + suboption.vote_count, 0);
  }

  return option.vote_count;
}

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
      const withResults = data.filter((election) =>
        ['SCRUTINIZED', 'ARCHIVED'].includes(election.status) ||
        (election.status === 'CLOSED' && !election.requires_keys)
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
      if (format === 'pdf') {
        await exportResultsToPDF(results);
      } else {
        await exportResultsToDOCX(results);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [results]);

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handler = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
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
  const voterRows = results?.voters ?? [];
  const abstentionCount = voterRows.filter((voter) => !voter.has_voted).length;
  const resultGroups = results ? getResultGroups(results.options) : [];
  const hasSuboptionResults = resultGroups.length > 0;

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
        <svg
          aria-hidden="true"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ opacity: 0.3, marginBottom: '1rem' }}
        >
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Resultados</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {selectedElection?.title ?? results?.election.title ?? 'Selecciona una votación'}
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {selectedElection?.tag_name && (
              <TagBadge
                label={selectedElection.tag_name}
                color={selectedElection.tag_color}
                size="sm"
                className="tag-badge--table"
                leadingIcon="tag"
              />
            )}
            {results && (
              <>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    background: results.election.is_anonymous ? 'rgba(30, 64, 175, 0.12)' : 'rgba(15, 118, 110, 0.12)',
                    color: results.election.is_anonymous ? '#1D4ED8' : '#0F766E',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {getSuffrageLabel(results.election.is_anonymous)}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    background: 'rgba(71, 85, 105, 0.12)',
                    color: '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {getElectionStatusLabel(results.election.status)}
                </span>
              </>
            )}
          </div>
        </div>

        {results && (
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((value) => !value)}
              disabled={exporting}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              aria-controls="results-export-menu"
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
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              )}
              {exporting ? 'Exportando...' : 'Exportar reporte'}
              {!exporting && (
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>

            {exportMenuOpen && (
              <div
                id="results-export-menu"
                role="menu"
                aria-label="Opciones de exportacion"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                  zIndex: 1000,
                  minWidth: '200px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
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
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = 'var(--surface-alt, var(--border))';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = 'none';
                  }}
                >
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Exportar PDF
                </button>
                <button
                  type="button"
                  role="menuitem"
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
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = 'var(--surface-alt, var(--border))';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = 'none';
                  }}
                >
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <p>Ajusta la busqueda o cambia la tag para volver a cargar resultados.</p>
        </div>
      )}

      {filteredElections.length > 0 && loadingResults ? (
        <Loader />
      ) : filteredElections.length > 0 && results ? (
        <>
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

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              Desglose de resultados
            </h3>

            {hasSuboptionResults ? (
              <div className="results-suboption-groups">
                {resultGroups.map((parentOption, parentIndex) => {
                  const regularSuboptions = (parentOption.suboptions ?? []).filter((option) => !isSpecialResultOption(option));
                  const specialSuboptions = (parentOption.suboptions ?? []).filter(isSpecialResultOption);

                  return (
                    <section key={parentOption.id} className="results-suboption-group">
                      <div className="results-suboption-group__header">
                        <div>
                          <div className="results-suboption-group__eyebrow">Grupo {parentIndex + 1}</div>
                          <h4>{parentOption.label}</h4>
                        </div>
                        <span>{getResultOptionTotal(parentOption).toLocaleString()} votos</span>
                      </div>

                      {regularSuboptions.map((option, optionIndex) => (
                        <div key={option.id} className="results-bar results-bar--nested">
                          <div className="results-bar-label">{option.label}</div>
                          <div className="results-bar-track">
                            <div
                              className="results-bar-fill"
                              style={{
                                width: `${option.percentage}%`,
                                background: RESULT_COLORS[(parentIndex + optionIndex) % RESULT_COLORS.length],
                              }}
                            >
                              {option.percentage.toFixed(1)}%
                            </div>
                          </div>
                          <div className="results-bar-count">{option.vote_count.toLocaleString()}</div>
                        </div>
                      ))}

                      {specialSuboptions.length > 0 && (
                        <div className="results-suboption-specials">
                          {specialSuboptions.map((option) => (
                            <div key={option.id} className="results-bar results-bar--nested">
                              <div className="results-bar-label" style={{ color: 'var(--muted)' }}>
                                {option.label}
                              </div>
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
                    </section>
                  );
                })}
              </div>
            ) : (
              <>
                {results.options
                  .filter((option) => option.option_type !== 'BLANK' && option.option_type !== 'NULL_VOTE')
                  .map((option, index) => (
                    <div key={option.id} className="results-bar">
                      <div className="results-bar-label">{option.label}</div>
                      <div className="results-bar-track">
                        <div
                          className="results-bar-fill"
                          style={{
                            width: `${option.percentage}%`,
                            background: RESULT_COLORS[index % RESULT_COLORS.length],
                          }}
                        >
                          {option.percentage.toFixed(1)}%
                        </div>
                      </div>
                      <div className="results-bar-count">{option.vote_count.toLocaleString()}</div>
                    </div>
                  ))}

                {results.options.some((option) => option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE') && (
                  <div style={{ borderTop: '1px dashed var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                    {results.options
                      .filter((option) => option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE')
                      .map((option) => (
                        <div key={option.id} className="results-bar">
                          <div className="results-bar-label" style={{ color: 'var(--muted)' }}>
                            {option.label}
                          </div>
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
              </>
            )}
          </div>

          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                    Participación por persona ({voterRows.length})
                  </h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {getSuffrageDescription(results.election.is_anonymous)}
                  </p>
                </div>
              </div>

              {abstentionCount > 0 && (
                <div
                  style={{
                    padding: '0.55rem 0.8rem',
                    borderRadius: '0.85rem',
                    background: 'rgba(220, 38, 38, 0.08)',
                    color: '#B91C1C',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                  }}
                >
                  Abstencionismo detectado: {abstentionCount}
                </div>
              )}
            </div>

            {voterRows.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No hay personas elegibles registradas.</p>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <caption className="sr-only">Detalle de participación por persona</caption>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Nombre</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Carnet</th>
                      {results.election.is_anonymous ? (
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Voto emitido</th>
                      ) : (
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Opcion elegida</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {voterRows.map((voter, index) => {
                      const isAbstention = !voter.has_voted;

                      return (
                        <tr
                          key={`${voter.carnet}-${index}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isAbstention ? 'rgba(220, 38, 38, 0.04)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.625rem 0.75rem' }}>{voter.full_name}</td>
                          <td style={{ padding: '0.625rem 0.75rem', color: 'var(--muted)' }}>{voter.carnet}</td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            {results.election.is_anonymous ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '3rem',
                                  padding: '0.28rem 0.65rem',
                                  borderRadius: '999px',
                                  background: voter.has_voted ? 'rgba(15, 118, 110, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                                  color: voter.has_voted ? '#0F766E' : '#B91C1C',
                                  fontWeight: 700,
                                }}
                              >
                                {getParticipationLabel(voter.has_voted)}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: isAbstention ? '#B91C1C' : 'var(--ink)',
                                }}
                              >
                                {voter.has_voted
                                  ? voter.selected_option_label ?? 'Sin detalle disponible'
                                  : getNoVoteLabel()}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
