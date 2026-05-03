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

function formatVoteCount(count: number) {
  return `${count.toLocaleString('es-CR')} voto${count === 1 ? '' : 's'}`;
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
        No hay actividad horaria disponible.
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
        {(() => {
          const tooltipBelow = activePoint.topPercent < 28;
          const tooltipLeft = Math.max(10, Math.min(90, activePoint.leftPercent));
          return (
            <div
              className={`monitoring-chart-tooltip${tooltipBelow ? ' is-below' : ''}`}
              style={{
                left: `${tooltipLeft}%`,
                top: `${activePoint.topPercent}%`,
              }}
            >
              <span>{activePoint.fullLabel}</span>
              <strong>
                {activePoint.count.toLocaleString('es-CR')}{' '}
                {activePoint.count === 1 ? 'voto' : 'votos'}
              </strong>
            </div>
          );
        })()}

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

function MonitoringBarChart({
  points,
  loading,
}: {
  points: HourlyVotePoint[];
  loading: boolean;
}) {
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
        No hay actividad horaria disponible.
      </div>
    );
  }

  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="monitoring-bar-chart" role="img" aria-label="Votos emitidos por hora">
      {points.map((point, index) => {
        const heightPercent = Math.max(point.count > 0 ? 8 : 0, (point.count / maxCount) * 100);
        const showLabel = index % labelStep === 0 || index === points.length - 1;

        return (
          <div key={point.hour} className="monitoring-bar-chart__item">
            <div className="monitoring-bar-chart__value">
              {point.count > 0 ? point.count.toLocaleString('es-CR') : ''}
            </div>
            <div className="monitoring-bar-chart__track" title={`${point.fullLabel}: ${formatVoteCount(point.count)}`}>
              <div
                className="monitoring-bar-chart__bar"
                style={{ height: `${heightPercent}%` }}
              />
            </div>
            <div className="monitoring-bar-chart__label">
              {showLabel ? point.shortLabel : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonitoringActivityList({
  title,
  rows,
  emptyText,
  showZeroRows = false,
}: {
  title: string;
  rows: HourlyVotePoint[];
  emptyText: string;
  showZeroRows?: boolean;
}) {
  return (
    <div className="monitoring-activity-list">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="monitoring-activity-list__empty">{emptyText}</div>
      ) : (
        <div className="monitoring-activity-list__rows">
          {rows.map((point) => (
            <div key={`${title}-${point.hour}`} className="monitoring-activity-list__row">
              <span>{point.shortLabel}</span>
              <strong>
                {point.count === 0 && showZeroRows
                  ? 'Sin votos nuevos'
                  : `${formatVoteCount(point.count)} emitido${point.count === 1 ? '' : 's'}`}
              </strong>
            </div>
          ))}
        </div>
      )}
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
  const activeHours = points.filter((point) => point.count > 0).length;
  const lastVotePoint = [...points].reverse().find((point) => point.count > 0) || null;
  const peakHours = [...points]
    .filter((point) => point.count > 0)
    .sort((first, second) => second.count - first.count)
    .slice(0, 3);
  const recentEvents = points.slice(-3).reverse();

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
              ? 'Prueba otro estado, cambia la tag o limpia la búsqueda para cargar una votación.'
              : 'El monitoreo está disponible para votaciones abiertas o ya finalizadas. La gráfica muestra votos emitidos por hora y se refresca automáticamente.'}
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
              <div className="label">Participación</div>
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
              <div className="label">Última emisión</div>
              <div className="stat-card-value">{lastVotePoint ? lastVotePoint.shortLabel : '-'}</div>
              <div className="stat-card-change">
                {lastVotePoint ? `${formatVoteCount(lastVotePoint.count)} en ese bloque` : 'Sin votos registrados'}
              </div>
            </div>

            <div className="stat-card">
              <div className="label">Estado</div>
              <div className="stat-card-value">{STATUS_LABELS[selectedElection.status]}</div>
              <div className="stat-card-change">
                {selectedElection.status === 'OPEN' ? 'Actualizando cada 30s' : formatCountdown(selectedElection.end_time)}
              </div>
            </div>
          </div>

          <div className="monitoring-layout">
            <div className="card monitoring-panel monitoring-panel--chart">
              <div className="monitoring-panel__head">
                <div>
                  <div className="label">Actividad por hora</div>
                  <h3>Gráfica de barras</h3>
                </div>
                <div className="monitoring-panel__meta">
                  {activeHours > 0
                    ? `${activeHours} bloque${activeHours === 1 ? '' : 's'} con actividad`
                    : 'Sin actividad registrada'}
                </div>
              </div>

              <MonitoringBarChart points={points} loading={loadingStats && !monitoringData} />
            </div>

            <div className="monitoring-activity-column">
              <div className="card monitoring-panel monitoring-panel--compact">
              <div className="monitoring-panel__head">
                <div>
                  <div className="label">Actividad</div>
                  <h3>Picos de actividad</h3>
                </div>
              </div>

              <div className="monitoring-hours">
                {peakHours.length === 0 ? (
                  <div className="monitoring-hours__empty">Todavía no hay horas con votos emitidos.</div>
                ) : (
                  peakHours.map((point) => (
                    <div key={point.hour} className="monitoring-hours__row">
                      <div>
                        <strong>{point.shortLabel}</strong>
                        <span>{formatVoteCount(point.count)} emitido{point.count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

              <div className="card monitoring-panel monitoring-panel--compact">
                <MonitoringActivityList
                  title="Eventos recientes"
                  rows={recentEvents}
                  emptyText="No hay bloques recientes para mostrar."
                  showZeroRows
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
