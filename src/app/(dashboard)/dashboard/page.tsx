'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Election } from '@/types/elections';
import Loader from '@/components/Loader';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  actor_carnet: string | null;
  actor_name?: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  actionLabel?: string;
  resourceLabel?: string;
  activityMessage?: string;
  ip_address: string | null;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  elections: Election[];
  auditLogs: AuditLog[];
}

interface OngoingElection {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  votesCount: number;
  totalVoters: number;
  progressPercentage: number;
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalElections: number;
  openElections: number;
  totalVotes: number;
  participation: number;
  ongoingElections: OngoingElection[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  student: { label: 'Estudiante', color: '#2563eb', bg: '#eff6ff' },
  admin: { label: 'Admin', color: 'var(--accent)', bg: 'var(--accent-light)' },
  election: { label: 'Elección', color: '#7c3aed', bg: '#f5f3ff' },
  election_option: { label: 'Opción', color: '#7c3aed', bg: '#f5f3ff' },
  election_voter: { label: 'Votante', color: '#0891b2', bg: '#ecfeff' },
  tag: { label: 'Tag', color: '#b45309', bg: 'var(--warning-light)' },
  tag_member: { label: 'Tag', color: '#b45309', bg: 'var(--warning-light)' },
  vote: { label: 'Voto', color: 'var(--success)', bg: 'var(--success-light)' },
  scrutiny_key: { label: 'Llave', color: '#d97706', bg: 'var(--warning-light)' },
  padron: { label: 'Padrón', color: '#64748b', bg: '#f8fafc' },
  padron_upload: { label: 'Padrón', color: '#64748b', bg: '#f8fafc' },
};

const OP_LABELS: Record<string, { label: string; icon: string }> = {
  insert: { label: 'Creado', icon: '+' },
  update: { label: 'Modificado', icon: '~' },
  delete: { label: 'Eliminado', icon: '-' },
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatResourceId(resourceId: string | null) {
  if (!resourceId || resourceId.trim().length === 0) {
    return 'Sin recurso';
  }
  return resourceId.length > 8 ? resourceId.slice(0, 8) : resourceId;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className={`dash-stat${accent ? ' is-accent' : ''}`}>
      <div className="dash-stat-head">
        <div className="dash-stat-label">{label}</div>
        <div className="dash-stat-icon">{icon}</div>
      </div>
      <div className="dash-stat-value">{value}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    stats: {
      totalStudents: 0,
      activeStudents: 0,
      totalElections: 0,
      openElections: 0,
      totalVotes: 0,
      participation: 0,
      ongoingElections: [],
    },
    elections: [],
    auditLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, elections, auditRes] = await Promise.allSettled([
        apiClient<DashboardStats>('/api/dashboard/stats'),
        apiClient<Election[]>('/api/elections'),
        apiClient<{ logs: AuditLog[]; total: number }>('/api/audit?limit=3'),
      ]);

      setData({
        stats:
          statsRes.status === 'fulfilled'
            ? statsRes.value
            : {
                totalStudents: 0,
                activeStudents: 0,
                totalElections: 0,
                openElections: 0,
                totalVotes: 0,
                participation: 0,
                ongoingElections: [],
              },
        elections: elections.status === 'fulfilled' ? elections.value : [],
        auditLogs: auditRes.status === 'fulfilled' ? auditRes.value.logs : [],
      });
    } catch (err) {
      setError('Error cargando el dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Derived metrics ───
  const openElectionItems = data.stats.ongoingElections;
  const recentAuditLogs = data.auditLogs.slice(0, 3);
  const scheduledElections = data.elections.filter((e) => e.status === 'SCHEDULED');
  const closedElections = data.elections.filter(
    (e) => e.status === 'CLOSED' || e.status === 'SCRUTINIZED'
  );
  const participationLabel = Number(data.stats.participation).toFixed(1);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--muted)' }}>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={fetchAll} style={{ marginTop: '1rem' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.fullName?.split(' ')[0] ?? 'Administrador';

  return (
    <div className="dash-page view-enter">
      {/* ─── Editorial hero ─── */}
      <header className="dash-hero">
        <div className="swiss-bar" />
        <div className="dash-hero-row">
          <div>
            <h2 className="dash-hero-title">
              {greeting}, <em>{firstName}</em>
            </h2>
            <p className="dash-hero-sub">
              Panel de control · TEE Sistema Electoral. Una vista rápida del estado actual
              de los procesos, padrón y actividad del sistema.
            </p>
          </div>
          <div className="dash-hero-meta">
            <div className="dash-hero-stat">
              <span className="dash-hero-stat-value">{participationLabel}%</span>
              <span className="dash-hero-stat-label">Participación promedio</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Live banner ─── */}
      {data.stats.openElections > 0 && (
        <div className="dash-live" role="status">
          <span className="dash-live-pulse" aria-hidden="true" />
          <span className="dash-live-text">
            <strong>
              {data.stats.openElections === 1
                ? 'Hay 1 votación abierta ahora mismo'
                : `Hay ${data.stats.openElections} votaciones abiertas ahora mismo`}
            </strong>
            {openElectionItems[0]?.endTime && (
              <span>· Cierra {formatDate(openElectionItems[0].endTime)}</span>
            )}
          </span>
          <Link href="/elecciones" className="dash-live-link">
            Ver →
          </Link>
        </div>
      )}

      {/* ─── Stat cards ─── */}
      <section className="dash-stats" aria-label="Métricas generales">
        <StatCard
          label="Elecciones activas"
          value={data.stats.openElections}
          sub={
            scheduledElections.length > 0
              ? `${scheduledElections.length} programada${scheduledElections.length > 1 ? 's' : ''}`
              : 'Ninguna programada'
          }
          accent={data.stats.openElections > 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <StatCard
          label="Total de elecciones"
          value={data.stats.totalElections}
          sub={`${closedElections.length} cerrada${closedElections.length === 1 ? '' : 's'}`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          }
        />
        <StatCard
          label="Votos emitidos"
          value={data.stats.totalVotes.toLocaleString()}
          sub={`${participationLabel}% participación promedio`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
        />
        <StatCard
          label="Estudiantes activos"
          value={data.stats.activeStudents.toLocaleString()}
          sub={`De ${data.stats.totalStudents.toLocaleString()} en el padrón`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </section>

      {/* ─── Two-column panels ─── */}
      <div className="dash-grid">
        {/* Ongoing elections */}
        <section className="dash-panel" aria-label="Elecciones en curso">
          <div className="dash-panel-head">
            <h3 className="dash-panel-title">Elecciones en curso</h3>
            <Link href="/elecciones" className="dash-panel-link">
              Ver elecciones →
            </Link>
          </div>

          {data.stats.ongoingElections.length === 0 ? (
            <div className="dash-panel-empty">No hay elecciones en curso</div>
          ) : (
            <div>
              {data.stats.ongoingElections.map((e) => {
                const progress = Math.max(0, Math.min(100, Number(e.progressPercentage || 0)));
                return (
                  <div key={e.id} className="dash-election">
                    <div className="dash-election-top">
                      <div className="dash-election-title">{e.title}</div>
                      <div className="dash-election-meta">
                        {e.totalVoters > 0 && (
                          <div>{e.votesCount.toLocaleString()} / {e.totalVoters.toLocaleString()} votos</div>
                        )}
                        <div>Cierra {formatDate(e.endTime)}</div>
                      </div>
                    </div>
                    <div className="dash-progress-track">
                      <div
                        className="dash-progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="dash-progress-foot">
                      <span>Participación</span>
                      <strong>{progress.toFixed(0)}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="dash-panel" aria-label="Actividad reciente">
          <div className="dash-panel-head">
            <h3 className="dash-panel-title">Actividad reciente</h3>
            <Link href="/auditoria" className="dash-panel-link">
              Ver log →
            </Link>
          </div>

          {recentAuditLogs.length === 0 ? (
            <div className="dash-panel-empty">Sin actividad registrada</div>
          ) : (
            <div>
              {recentAuditLogs.map((log) => {
                const [resourceKey, opKey] = log.action.split('.');
                const resource = RESOURCE_LABELS[resourceKey] || {
                  label: resourceKey || log.resource_type || 'Sistema',
                  color: 'var(--muted)',
                  bg: 'var(--surface-sunken)',
                };
                const op = OP_LABELS[opKey] || { label: opKey || log.action, icon: '?' };
                const summary = log.activityMessage || formatResourceId(log.resource_id);
                const actor = log.actor_name?.trim() || log.actor_carnet?.trim();

                return (
                  <div key={log.id} className="dash-activity">
                    <div
                      className="dash-activity-dot"
                      style={{ background: resource.bg, color: resource.color }}
                    >
                      {op.icon}
                    </div>
                    <div className="dash-activity-body">
                      <div className="dash-activity-head">
                        <span
                          className="dash-activity-tag"
                          style={{ background: resource.bg, color: resource.color }}
                        >
                          {resource.label}
                        </span>
                        <span className="dash-activity-op">{op.label}</span>
                      </div>
                      <div className="dash-activity-summary" title={summary}>
                        {summary}
                      </div>
                      {actor && <div className="dash-activity-actor">por {actor}</div>}
                    </div>
                    <span
                      className="dash-activity-time"
                      title={formatDate(log.created_at)}
                    >
                      {formatRelative(log.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
