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
    <div
      className="stat-card"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          background: accent ? 'var(--accent-light)' : 'var(--surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: accent ? 'var(--accent)' : 'var(--muted)',
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '0.25rem',
          }}
        >
          {label}
        </div>
        <div
          className="stat-card-value"
          style={{
            fontSize: '1.75rem',
            color: accent ? 'var(--accent)' : 'var(--ink)',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {sub}
          </div>
        )}
      </div>
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

  return (
    <div className="animate-fadeInUp">
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 500,
            marginBottom: '0.25rem',
          }}
        >
          {greeting}, {user?.fullName?.split(' ')[0] ?? 'Administrador'}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Panel de control · TEE Sistema Electoral
        </p>
      </div>

      {/* ─── Alert: elecciones abiertas ─── */}
      {data.stats.openElections > 0 && (
        <div
          className="card"
          style={{
            background: 'var(--accent-light)',
            borderColor: 'var(--accent)',
            borderLeft: '3px solid var(--accent)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              flexShrink: 0,
              boxShadow: '0 0 0 3px rgba(190,30,45,0.2)',
            }}
          />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--accent)' }}>
            {data.stats.openElections === 1
              ? `Hay 1 votación abierta ahora mismo`
              : `Hay ${data.stats.openElections} votaciones abiertas ahora mismo`}
            {openElectionItems[0]?.endTime && ` · Cierra ${formatDate(openElectionItems[0].endTime)}`}
          </span>
          <Link
            href="/elecciones"
            style={{
              marginLeft: 'auto',
              fontSize: '0.8125rem',
              color: 'var(--accent)',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Ver →
          </Link>
        </div>
      )}

      {/* ─── Stat Cards ─── */}
      <div
        className="stats-grid animation-delay-200 animate-fadeInUp"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}
      >
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <StatCard
          label="Total de elecciones"
          value={data.stats.totalElections}
          sub={`${data.elections.filter((e) => e.status === 'CLOSED' || e.status === 'SCRUTINIZED').length} cerradas`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </div>

      {/* ─── Ongoing Elections ─── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Elecciones en curso</h3>
            <Link
              href="/elecciones"
              style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
            >
              Ver elecciones →
            </Link>
          </div>

          {data.stats.ongoingElections.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              No hay elecciones en curso
            </div>
          ) : (
            <div>
              {data.stats.ongoingElections.map((e, i) => {
                const progress = Math.max(0, Math.min(100, Number(e.progressPercentage || 0)));
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: i < data.stats.ongoingElections.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          marginBottom: '0.35rem',
                        }}
                      >
                        {e.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {e.totalVoters > 0
                          ? `${e.votesCount} / ${e.totalVoters} votos · Cierra ${formatDate(e.endTime)}`
                          : `Cierra ${formatDate(e.endTime)}`}
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          borderRadius: 999,
                          background: 'var(--surface-sunken)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #be1e2d 0%, #df4a58 100%)',
                            transition: 'width 0.35s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: '0.45rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                        }}
                      >
                        <span>Participación</span>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{progress.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Auditoría reciente ─── */}
      <div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Actividad reciente</h3>
            <Link
              href="/auditoria"
              style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
            >
              Ver log →
            </Link>
          </div>

          {recentAuditLogs.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              Sin actividad registrada
            </div>
          ) : (
            <div>
              {recentAuditLogs.map((log, i) => {
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
                  <div
                    key={log.id}
                    className="table-row-enter"
                    style={{
                      borderBottom: i < recentAuditLogs.length - 1 ? '1px solid var(--border)' : 'none',
                      animationDelay: `${i * 0.015}s`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1.25rem',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-glow)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: resource.bg,
                          color: resource.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          fontFamily: 'var(--font-mono)',
                          flexShrink: 0,
                        }}
                      >
                        {op.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '100px',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              background: resource.bg,
                              color: resource.color,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {resource.label}
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                            {op.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={summary}
                          >
                            {summary}
                          </span>
                          {actor && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                              por {actor}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        style={{ fontSize: '0.75rem', color: 'var(--muted-light)', whiteSpace: 'nowrap', flexShrink: 0 }}
                        title={formatDate(log.created_at)}
                      >
                        {formatRelative(log.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
