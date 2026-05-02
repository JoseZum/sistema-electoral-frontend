'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import TagBadge from '@/components/tags/TagBadge';
import Loader from '@/components/Loader';
import type { Election, ElectionDetail } from '@/types/elections';

type VotesByHour = {
  hour: string;
  count: number;
};

type MonitoringData = {
  votesByHour: VotesByHour[];
};

type HourlyVotePoint = {
  hour: string;
  count: number;
  cumulative: number;
  shortLabel: string;
  fullLabel: string;
};

type MonitoringStatusFilter = 'OPEN' | 'FINISHED' | 'ALL';

const MONITORABLE_STATUSES = new Set<Election['status']>(['OPEN', 'CLOSED', 'SCRUTINIZED', 'ARCHIVED']);
const REFRESH_INTERVAL_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;

const STATUS_LABELS: Record<Election['status'], string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

const STATUS_BADGE: Record<Election['status'], string> = {
  DRAFT: 'badge-draft',
  SCHEDULED: 'badge-scheduled',
  OPEN: 'badge-open',
  CLOSED: 'badge-closed',
  SCRUTINIZED: 'badge-scrutinized',
  ARCHIVED: 'badge-archived',
};

function matchesMonitoringStatus(status: Election['status'], filter: MonitoringStatusFilter) {
  if (filter === 'ALL') {
    return MONITORABLE_STATUSES.has(status);
  }

  if (filter === 'OPEN') {
    return status === 'OPEN';
  }

  return status === 'CLOSED' || status === 'SCRUTINIZED' || status === 'ARCHIVED';
}

function roundToHour(date: Date) {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  return rounded;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHourOnly(value: string) {
  return new Date(value).toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHourWithDate(value: string) {
  return new Date(value).toLocaleString('es-CR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(endTime: string | null | undefined) {
  if (!endTime) {
    return 'Sin cierre definido';
  }

  const now = Date.now();
  const end = new Date(endTime).getTime();

  if (Number.isNaN(end)) {
    return 'Fecha inválida';
  }

  const diffMs = end - now;
  if (diffMs <= 0) {
    return 'Finalizada';
  }

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function buildHourlySeries(election: Election | null, votesByHour: VotesByHour[] | undefined): HourlyVotePoint[] {
  if (!election) {
    return [];
  }

  const rawVotes = (votesByHour || [])
    .map((item) => ({
      hour: roundToHour(new Date(item.hour)),
      count: item.count,
    }))
    .filter((item) => !Number.isNaN(item.hour.getTime()))
    .sort((first, second) => first.hour.getTime() - second.hour.getTime());

  const fallbackStart = rawVotes[0]?.hour
    || roundToHour(
      election.start_time
        ? new Date(election.start_time)
        : new Date(Date.now() - 5 * HOUR_MS)
    );

  let rangeStart = election.start_time ? roundToHour(new Date(election.start_time)) : fallbackStart;
  if (Number.isNaN(rangeStart.getTime())) {
    rangeStart = fallbackStart;
  }

  const now = Date.now();
  const endLimit = election.end_time ? new Date(election.end_time).getTime() : now;
  const endReference = election.status === 'OPEN'
    ? Math.min(endLimit, now)
    : endLimit;

  let rangeEnd = roundToHour(new Date(endReference));
  if (Number.isNaN(rangeEnd.getTime())) {
    rangeEnd = rawVotes[rawVotes.length - 1]?.hour || rangeStart;
  }

  if (rangeEnd.getTime() < rangeStart.getTime()) {
    rangeEnd = rangeStart;
  }

  const countsByHour = new Map(rawVotes.map((item) => [item.hour.toISOString(), item.count]));
  const points: HourlyVotePoint[] = [];
  let cursor = new Date(rangeStart);
  let cumulative = 0;

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const iso = cursor.toISOString();
    const count = countsByHour.get(iso) ?? 0;
    cumulative += count;

    points.push({
      hour: iso,
      count,
      cumulative,
      shortLabel: formatHourOnly(iso),
      fullLabel: formatHourWithDate(iso),
    });

    cursor = addHours(cursor, 1);
  }

  return points;
}

function getPeakPoint(points: HourlyVotePoint[]) {
  return points.reduce<HourlyVotePoint | null>((best, point) => {
    if (!best || point.count > best.count) {
      return point;
    }

    return best;
  }, null);
}

function MonitoringChart({
  points,
  loading,
}: {
  points: HourlyVotePoint[];
  loading: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(points.length > 0 ? points.length - 1 : 0);
  }, [points]);

  if (loading) {
    return (
      <div className="monitoring-chart-empty">
        <Loader />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="monitoring-chart-empty">
        No hay suficientes datos para dibujar la curva.
      </div>
    );
  }

  const width = 760;
  const height = 320;
  const padding = { top: 24, right: 24, bottom: 42, left: 24 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const labelStep = Math.max(1, Math.ceil(points.length / 7));

  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? padding.left + innerWidth / 2 : padding.left + stepX * index;
    const y = padding.top + innerHeight - (point.count / maxCount) * innerHeight;

    return {
      ...point,
      x,
      y,
      leftPercent: (x / width) * 100,
      topPercent: (y / height) * 100,
    };
  });

  const activePoint = chartPoints[Math.min(activeIndex, chartPoints.length - 1)];
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${height - padding.bottom} L ${chartPoints[0].x} ${height - padding.bottom} Z`;

  const gridMarkers = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="monitoring-chart-shell">
      <div className="monitoring-chart-meta">
        <span>Curva horaria de votos emitidos</span>
        <strong>Máximo {maxCount.toLocaleString('es-CR')} por hora</strong>
      </div>

      <div className="monitoring-chart-canvas">
        <div
          className="monitoring-chart-tooltip"
          style={{
            left: `${activePoint.leftPercent}%`,
            top: `${Math.max(activePoint.topPercent - 8, 9)}%`,
          }}
        >
          <span>{activePoint.fullLabel}</span>
          <strong>{activePoint.count.toLocaleString('es-CR')} votos</strong>
        </div>

        <svg
          className="monitoring-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfica interactiva de votos emitidos por hora"
        >
          <defs>
            <linearGradient id="monitoring-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(190, 30, 45, 0.22)" />
              <stop offset="100%" stopColor="rgba(190, 30, 45, 0.02)" />
            </linearGradient>
          </defs>

          {gridMarkers.map((marker) => {
            const y = padding.top + innerHeight - marker * innerHeight;
            return (
              <line
                key={marker}
                className="monitoring-chart-grid"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
            );
          })}

          <path d={areaPath} className="monitoring-chart-area" />
          <path d={linePath} className="monitoring-chart-line" />

          <line
            className="monitoring-chart-guide"
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
          />

          {chartPoints.map((point, index) => (
            <g key={point.hour}>
              {((index % labelStep === 0) || index === chartPoints.length - 1) && (
                <text
                  className="monitoring-chart-axis"
                  x={point.x}
                  y={height - 12}
                  textAnchor="middle"
                >
                  {point.shortLabel}
                </text>
              )}

              <circle
                className={`monitoring-chart-point${index === activeIndex ? ' is-active' : ''}`}
                cx={point.x}
                cy={point.y}
                r={index === activeIndex ? 5.5 : 4}
                tabIndex={0}
                role="button"
                aria-label={`${point.fullLabel}: ${point.count} votos emitidos`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="monitoring-chart-footer">
        <div>
          <span className="label">Tramo activo</span>
          <strong>{activePoint.fullLabel}</strong>
        </div>
        <div>
          <span className="label">Votos en la hora</span>
          <strong>{activePoint.count.toLocaleString('es-CR')}</strong>
        </div>
        <div>
          <span className="label">Acumulado</span>
          <strong>{activePoint.cumulative.toLocaleString('es-CR')}</strong>
        </div>
      </div>
    </div>
  );
}

export default function MonitorPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [statusFilter, setStatusFilter] = useState<MonitoringStatusFilter>('OPEN');
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchElections() {
      try {
        setLoading(true);
        const data = await apiClient<Election[]>('/api/elections');

        if (!cancelled) {
          const monitorable = data.filter((election) => MONITORABLE_STATUSES.has(election.status));
          const firstOpen = monitorable.find((election) => election.status === 'OPEN') || null;

          setElections(data);
          setSelectedElectionId(firstOpen?.id ?? '');
          setSelectedElection(firstOpen);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error(fetchError);
          setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar las votaciones');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchElections();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedElectionId) {
      setSelectedElection(null);
      setMonitoringData(null);
      setLastUpdated(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchMonitoring(isBackgroundRefresh: boolean) {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoadingStats(true);
      }

      try {
        const [election, monitoring] = await Promise.all([
          apiClient<ElectionDetail>(`/api/elections/${selectedElectionId}`),
          apiClient<MonitoringData>(`/api/elections/${selectedElectionId}/monitoring`),
        ]);

        if (!cancelled) {
          setSelectedElection(election);
          setMonitoringData(monitoring);
          setLastUpdated(new Date().toISOString());
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error('Error loading monitoring:', fetchError);
          setError(fetchError instanceof Error ? fetchError.message : 'No se pudo actualizar el monitoreo');
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
          setRefreshing(false);
        }
      }
    }

    fetchMonitoring(false);
    const intervalId = window.setInterval(() => {
      fetchMonitoring(true);
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedElectionId]);

  const monitorableElections = elections.filter((election) => MONITORABLE_STATUSES.has(election.status));
  const filteredElections = monitorableElections.filter((election) => {
    const matchesStatus = matchesMonitoringStatus(election.status, statusFilter);
    return matchesStatus;
  });
  const points = buildHourlySeries(selectedElection, monitoringData?.votesByHour);
  const totalVotes = points.reduce((sum, point) => sum + point.count, 0);
  const turnout = selectedElection?.total_voters
    ? (totalVotes / selectedElection.total_voters) * 100
    : 0;
  const peakPoint = getPeakPoint(points);
  const activeHours = points.filter((point) => point.count > 0).length;
  const averagePerActiveHour = activeHours > 0 ? totalVotes / activeHours : 0;
  const latestPoint = points[points.length - 1] || null;
  const busiestHours = [...points]
    .filter((point) => point.count > 0)
    .sort((first, second) => second.count - first.count)
    .slice(0, 5);

  useEffect(() => {
    if (filteredElections.length === 0) {
      if (selectedElectionId) {
        setSelectedElectionId('');
      }
      setSelectedElection(null);
      setMonitoringData(null);
      setLastUpdated(null);
      setError(null);
      return;
    }

    if (!selectedElectionId || !filteredElections.some((election) => election.id === selectedElectionId)) {
      setSelectedElectionId(filteredElections[0].id);
      setSelectedElection(filteredElections[0]);
      setMonitoringData(null);
      setLastUpdated(null);
      setError(null);
    }
  }, [filteredElections, selectedElectionId]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="view-enter monitoring-page">
      <div className="card monitoring-hero">
        <div className="monitoring-hero__content">
          <div>
            <div className="overline" style={{ marginBottom: '0.8rem' }}>Observación electoral</div>
            <h2 className="monitoring-hero__title">Monitoreo en vivo</h2>
            <p className="monitoring-hero__description">
              Sigue el ritmo horario de emisión, la participación acumulada y el pulso de cada votación desde una sola vista.
            </p>

            {selectedElection && (
              <div className="monitoring-hero__selection">
                <strong>{selectedElection.title}</strong>
                <div className="monitoring-hero__selection-meta">
                  <span className={`badge badge-dot ${STATUS_BADGE[selectedElection.status]}`}>
                    {STATUS_LABELS[selectedElection.status]}
                  </span>
                  {selectedElection.tag_name && (
                    <TagBadge
                      label={selectedElection.tag_name}
                      color={selectedElection.tag_color}
                      size="sm"
                      className="tag-badge--table"
                      leadingIcon="tag"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="monitoring-hero__actions">
            <div className="election-filter-grid election-filter-grid--inline">
              <label className="monitoring-select-group">
                <span>Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as MonitoringStatusFilter)}
                  className="input monitoring-select election-filter-control"
                >
                  <option value="OPEN">Abiertas</option>
                  <option value="FINISHED">Terminadas</option>
                  <option value="ALL">Todas</option>
                </select>
              </label>

              <label className="monitoring-select-group">
                <span>Votación a monitorear</span>
                <select
                  value={selectedElectionId}
                  onChange={(event) => {
                    setSelectedElectionId(event.target.value);
                    setSelectedElection(filteredElections.find((election) => election.id === event.target.value) || null);
                    setMonitoringData(null);
                    setLastUpdated(null);
                    setError(null);
                  }}
                  className="input monitoring-select election-filter-control"
                  disabled={filteredElections.length === 0}
                >
                  <option value="">
                    {filteredElections.length === 0 ? 'Sin votaciones para este filtro' : 'Seleccionar votación...'}
                  </option>
                  {filteredElections.map((election) => (
                    <option key={election.id} value={election.id}>
                      {election.title} ({STATUS_LABELS[election.status]})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={`monitoring-live-pill${selectedElection?.status === 'OPEN' ? ' is-live' : ''}`}>
              <span className="monitoring-live-pill__dot" />
              {selectedElection?.status === 'OPEN' ? 'Actualizando cada 30s' : 'Resumen final'}
            </div>

            {lastUpdated && (
              <div className="monitoring-refresh-note">
                {refreshing ? 'Actualizando...' : `Última lectura: ${formatDateTime(lastUpdated)}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="monitoring-alert">
          {error}
        </div>
      )}

      {!selectedElection ? (
        <div className="card monitoring-empty">
          <div className="overline" style={{ marginBottom: '0.75rem' }}>
            {filteredElections.length === 0 ? 'Sin coincidencias' : 'Panel listo'}
          </div>
          <h3>
            {filteredElections.length === 0
              ? statusFilter === 'OPEN'
                ? 'No hay votaciones abiertas con este filtro'
                : 'No hay votaciones disponibles con este filtro'
              : 'Selecciona una votación para ver actividad horaria'}
          </h3>
          <p>
            {filteredElections.length === 0
              ? 'Prueba otro estado, cambia la tag o limpia la busqueda para cargar una votacion.'
              : 'El monitoreo esta disponible para votaciones abiertas o ya finalizadas. La grafica muestra votos emitidos por hora y se refresca automaticamente.'}
          </p>
        </div>
      ) : (
        <>
          <div className="stats-grid monitoring-stats-grid">
            <div className="stat-card">
              <div className="label">Votos emitidos</div>
              <div className="stat-card-value">{totalVotes.toLocaleString('es-CR')}</div>
              <div className="stat-card-change positive">
                de {selectedElection.total_voters.toLocaleString('es-CR')} electores habilitados
              </div>
            </div>

            <div className="stat-card">
              <div className="label">Participacion</div>
              <div className="stat-card-value">{turnout.toFixed(1)}%</div>
              <div className="monitoring-progress">
                <div className="monitoring-progress__track">
                  <div
                    className="monitoring-progress__fill"
                    style={{ width: `${Math.min(turnout, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="label">Hora pico</div>
              <div className="stat-card-value">{peakPoint ? peakPoint.count.toLocaleString('es-CR') : '0'}</div>
              <div className="stat-card-change">
                {peakPoint ? peakPoint.fullLabel : 'Sin votos registrados'}
              </div>
            </div>

            <div className="stat-card">
              <div className="label">Tiempo restante</div>
              <div className="stat-card-value">{formatCountdown(selectedElection.end_time)}</div>
              <div className="stat-card-change">
                {selectedElection.status === 'OPEN' ? 'ventana abierta' : 'proceso consolidado'}
              </div>
            </div>
          </div>

          <div className="monitoring-layout">
            <div className="card monitoring-panel">
              <div className="monitoring-panel__head">
                <div>
                  <div className="label">Serie principal</div>
                  <h3>Votos emitidos por hora</h3>
                </div>
                <div className="monitoring-panel__meta">
                  {activeHours > 0
                    ? `${activeHours} bloque${activeHours === 1 ? '' : 's'} con actividad`
                    : 'Sin actividad registrada'}
                </div>
              </div>

              <MonitoringChart points={points} loading={loadingStats && !monitoringData} />
            </div>

            <div className="card monitoring-panel monitoring-panel--side">
              <div className="monitoring-panel__head">
                <div>
                  <div className="label">Lectura rapida</div>
                  <h3>Ritmo de emision</h3>
                </div>
              </div>

              <div className="monitoring-insights">
                <div className="monitoring-insight">
                  <span>Promedio por hora activa</span>
                  <strong>{averagePerActiveHour.toFixed(1)}</strong>
                </div>
                <div className="monitoring-insight">
                  <span>Ultimo bloque medido</span>
                  <strong>{latestPoint ? `${latestPoint.shortLabel} · ${latestPoint.count}` : 'Sin datos'}</strong>
                </div>
                <div className="monitoring-insight">
                  <span>Modalidad</span>
                  <strong>{selectedElection.is_anonymous ? 'Voto anonimo' : 'Voto nominal'}</strong>
                </div>
                <div className="monitoring-insight">
                  <span>Opciones registradas</span>
                  <strong>{selectedElection.options_count.toLocaleString('es-CR')}</strong>
                </div>
              </div>

              <div className="monitoring-hours">
                <div className="monitoring-hours__title">Horas mas activas</div>
                {busiestHours.length === 0 ? (
                  <div className="monitoring-hours__empty">Todavia no hay horas con votos emitidos.</div>
                ) : (
                  busiestHours.map((point) => (
                    <div key={point.hour} className="monitoring-hours__row">
                      <div>
                        <strong>{point.fullLabel}</strong>
                        <span>{point.count.toLocaleString('es-CR')} votos</span>
                      </div>
                      <div className="monitoring-hours__bar">
                        <div
                          className="monitoring-hours__bar-fill"
                          style={{
                            width: `${peakPoint && peakPoint.count > 0 ? (point.count / peakPoint.count) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card monitoring-panel monitoring-panel--details">
            <div className="monitoring-panel__head">
              <div>
                <div className="label">Contexto operativo</div>
                <h3>Detalle del proceso</h3>
              </div>
            </div>

            <div className="monitoring-detail-grid">
              <div className="monitoring-detail-item">
                <span>Inicio</span>
                <strong>{formatDateTime(selectedElection.start_time || selectedElection.created_at)}</strong>
              </div>
              <div className="monitoring-detail-item">
                <span>Cierre</span>
                <strong>{formatDateTime(selectedElection.end_time)}</strong>
              </div>
              <div className="monitoring-detail-item">
                <span>Electores</span>
                <strong>{selectedElection.total_voters.toLocaleString('es-CR')}</strong>
              </div>
              <div className="monitoring-detail-item">
                <span>Estado</span>
                <strong>{STATUS_LABELS[selectedElection.status]}</strong>
              </div>
              <div className="monitoring-detail-item">
                <span>Fuente de votantes</span>
                <strong>{selectedElection.voter_source.replace(/_/g, ' ')}</strong>
              </div>
              <div className="monitoring-detail-item">
                <span>Identificador</span>
                <strong className="mono">{selectedElection.id.split('-')[0]}</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
