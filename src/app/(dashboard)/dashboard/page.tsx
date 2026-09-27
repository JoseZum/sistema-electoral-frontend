'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { getElectionCountdown } from '@/lib/election-countdown';
import { downloadCsv } from '@/lib/csv';
import type { Election } from '@/types/elections';
import Loader from '@/components/Loader';
import { resourceMeta } from '@/lib/audit-visuals';

interface AuditLog {
  id: string;
  actor_carnet: string | null;
  actor_name?: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  target_name?: string | null;
  actionLabel?: string;
  resourceLabel?: string;
  activityMessage?: string;
  ip_address: string | null;
  created_at: string;
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalElections: number;
  openElections: number;
  totalVotes: number;
  participation: number;
}

// Lo que no se pudo cargar se muestra como tal: nunca como un cero.
type Source = 'stats' | 'elections' | 'audit';

const SOURCE_LABELS: Record<Source, string> = {
  stats: 'el resumen del padrón',
  elections: 'las elecciones',
  audit: 'la actividad reciente',
};

interface DashboardData {
  stats: DashboardStats | null;
  elections: Election[] | null;
  auditLogs: AuditLog[] | null;
}

const STATUS_LABELS: Record<Election['status'], string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sin fecha';

  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Los mismos trazos del laboratorio de diseño (propuesta 04).
function LabIcon({ d, className = 'ess-icon' }: { d: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const PATHS = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  vote: 'm8 3 9 3-3 9-9-3 3-9ZM5 13l-2 4v4h18v-4l-3-5M3 17h18m-10-9 1 2 3-2',
  users: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2',
  file: 'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
};

const OP_BADGES: Record<string, { label: string; variant: string }> = {
  insert: { label: 'Creado', variant: 'create' },
  update: { label: 'Actualizado', variant: 'update' },
  delete: { label: 'Eliminado', variant: 'delete' },
};

const Arrow = () => <LabIcon d={PATHS.arrow} className="ess-arrow" />;

/**
 * Resumen de una línea para la actividad: el backend redacta frases largas como
 * 'Postulacion enviada a "Puesto" en "Convocatoria" · Nombre · carnet'. El titular es
 * lo que va antes de la primera comilla; el detalle, lo primero que viene citado.
 */
function summarizeLog(log: AuditLog) {
  const message = log.activityMessage?.trim() || log.actionLabel || log.action;
  const quote = message.indexOf('"');
  const title = (quote > 0 ? message.slice(0, quote) : message)
    .replace(/(\s+(a|en|de|del|para|en tag))+\s*:?$/i, '')
    .trim();
  const quoted = message.match(/"([^"]+)"/)?.[1];
  const actor = log.actor_name?.trim() || log.actor_carnet?.trim();
  const detail = [quoted, log.target_name?.trim()].filter(Boolean).join(' · ');
  return { title: title || log.action, detail: detail || (actor ? `por ${actor}` : '') };
}

function initials(title: string) {
  return title
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

const ACCESS_LINKS: { href: string; title: string; description: string; icon: ReactNode }[] = [
  {
    href: '/elecciones',
    title: 'Procesos electorales',
    description: 'Consulta las elecciones activas y próximas.',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="m7 10 2-6h6l2 6" />
        <path d="M10 14h4" />
      </svg>
    ),
  },
  {
    href: '/padron',
    title: 'Padrón estudiantil',
    description: 'Revisa quiénes pueden participar.',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    href: '/postulaciones',
    title: 'Postulaciones',
    description: 'Da seguimiento a las candidaturas.',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<DashboardData>({
    stats: null,
    elections: null,
    auditLogs: null,
  });
  const [failed, setFailed] = useState<Source[]>([]);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);

    const [statsRes, electionsRes, auditRes] = await Promise.allSettled([
      apiClient<DashboardStats>('/api/dashboard/stats'),
      apiClient<Election[]>('/api/elections'),
      apiClient<{ logs: AuditLog[]; total: number }>('/api/audit?limit=3'),
    ]);

    setData({
      stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
      elections: electionsRes.status === 'fulfilled' ? electionsRes.value : null,
      auditLogs: auditRes.status === 'fulfilled' ? auditRes.value.logs : null,
    });
    setFailed(
      (
        [
          [statsRes, 'stats'],
          [electionsRes, 'elections'],
          [auditRes, 'audit'],
        ] as const
      )
        .filter(([result]) => result.status === 'rejected')
        .map(([, source]) => source),
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const elections = data.elections;
  const openElections = elections?.filter((election) => election.status === 'OPEN') ?? [];

  useEffect(() => {
    if (openElections.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [openElections.length]);

  if (loading) {
    return <Loader />;
  }

  const { stats } = data;
  const recentAuditLogs = data.auditLogs?.slice(0, 3) ?? [];
  const scheduledElections = elections?.filter((election) => election.status === 'SCHEDULED') ?? [];
  const closedElections =
    elections?.filter(
      (election) => election.status === 'CLOSED' || election.status === 'SCRUTINIZED',
    ) ?? [];
  const pendingScrutiny = elections?.filter((election) => election.status === 'CLOSED') ?? [];

  // El filtro decide sobre qué elecciones se calcula la participación. Se cuentan
  // habilitaciones de voto, no personas: alguien puede estar habilitado en varias.
  const scopedElections =
    scope === 'all'
      ? (elections ?? [])
      : scope === 'open'
        ? openElections
        : (elections ?? []).filter((election) => election.id === scope);
  const scopedVotes = scopedElections.reduce(
    (sum, election) => sum + Number(election.votes_cast || 0),
    0,
  );
  const scopedVoters = scopedElections.reduce(
    (sum, election) => sum + Number(election.total_voters || 0),
    0,
  );
  const participation = scopedVoters > 0 ? (scopedVotes / scopedVoters) * 100 : null;
  const participationLabel =
    participation === null ? null : participation.toFixed(1).replace('.', ',');

  // El saludo del dashboard anterior: barra roja y serif, con el nombre en cursiva.
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.fullName?.split(' ')[0] ?? 'Administrador';

  const headline = !elections
    ? 'No se pudieron cargar las elecciones.'
    : openElections.length > 0
      ? 'Todo listo. Tu comunidad está votando.'
      : scheduledElections.length > 0
        ? 'Hay votaciones listas para abrir.'
        : pendingScrutiny.length > 0
          ? 'La jornada cerró. Falta el escrutinio.'
          : 'Sin votaciones activas por ahora.';

  const nextStep = !elections
    ? { text: 'Vuelve a cargar los datos para ver qué sigue.', href: '/elecciones', cta: 'Ir a elecciones' }
    : openElections.length > 0
      ? { text: 'Sigue la participación de las elecciones abiertas.', href: '/monitoreo', cta: 'Ir al monitor' }
      : pendingScrutiny.length > 0
        ? {
            text: `${pendingScrutiny.length} elección${pendingScrutiny.length > 1 ? 'es' : ''} cerrada${pendingScrutiny.length > 1 ? 's' : ''} sin escrutar.`,
            href: '/escrutinio',
            cta: 'Abrir escrutinio',
          }
        : scheduledElections.length > 0
          ? {
              text: `${scheduledElections.length} elección${scheduledElections.length > 1 ? 'es' : ''} programada${scheduledElections.length > 1 ? 's' : ''} por abrir.`,
              href: '/elecciones',
              cta: 'Revisar elecciones',
            }
          : { text: 'No hay pendientes. Puedes programar una votación.', href: '/elecciones/crear', cta: 'Crear elección' };

  const exportSummary = () => {
    downloadCsv(`participacion-tee-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Elección', 'Estado', 'Inicio', 'Cierre', 'Habilitaciones', 'Votos', 'Participación (%)'],
      ...scopedElections.map((election) => {
        const voters = Number(election.total_voters || 0);
        const votes = Number(election.votes_cast || 0);
        return [
          election.title,
          STATUS_LABELS[election.status] ?? election.status,
          formatDate(election.start_time),
          formatDate(election.end_time),
          voters,
          votes,
          voters > 0 ? ((votes / voters) * 100).toFixed(1) : 'Sin habilitaciones',
        ];
      }),
    ]);
  };

  return (
    <div className="ess-page view-enter">
      <header className="dash-hero ess-greeting">
        <div className="swiss-bar" />
        <div className="dash-hero-row">
          <div>
            <h2 className="dash-hero-title">
              {greeting}, <em>{firstName}</em>
            </h2>
            <p className="dash-hero-sub">{headline}</p>
          </div>
          <div className="ess-greeting-actions">
            <Link href="/elecciones/crear" className="btn btn-primary ess-cta">
              <LabIcon d={PATHS.plus} />
              Crear elección
            </Link>
          </div>
        </div>
      </header>

      {failed.length > 0 && (
        <div className="ess-alert" role="alert">
          <span>
            No se pudo cargar {failed.map((source) => SOURCE_LABELS[source]).join(' ni ')}. Los
            datos que faltan aparecen como “sin datos”, no como cero.
          </span>
          <button type="button" className="btn btn-secondary" onClick={fetchAll} disabled={refreshing}>
            Reintentar
          </button>
        </div>
      )}

      <section className="ess-hero" aria-label="Participación de la jornada">
        <div className="ess-hero-main">
          <span className="ess-eyebrow">Participación de la jornada</span>
          {participationLabel ? (
            <div className="ess-number">
              {participationLabel}
              <span>%</span>
            </div>
          ) : (
            <div className="ess-number ess-number-empty">Sin datos</div>
          )}
          <p>
            {participationLabel ? (
              <>
                <strong>{scopedVotes.toLocaleString('es-CR')}</strong> votos de{' '}
                <strong>{scopedVoters.toLocaleString('es-CR')}</strong> posibles.
              </>
            ) : !elections ? (
              <>No hay datos de elecciones para calcular la participación.</>
            ) : (
              <>
                No hay votos posibles en la selección actual.
                {stats && (
                  <>
                    <br />
                    El padrón tiene{' '}
                    <strong>{stats.activeStudents.toLocaleString('es-CR')}</strong> estudiantes
                    activos.
                  </>
                )}
              </>
            )}
          </p>
          {elections && elections.length > 0 && (
            <label className="ess-filter">
              <LabIcon d={PATHS.vote} />
              <select
              aria-label="Filtrar participación por elección"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="all">Todas las elecciones</option>
              <option value="open">Solo elecciones abiertas</option>
              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.title}
                </option>
              ))}
              </select>
            </label>
          )}
        </div>

        <div className="ess-visual" aria-hidden="true">
          <div className="ess-orbit ess-orbit-one" />
          <div className="ess-orbit ess-orbit-two" />
          <div className="ess-paper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="ess-box">
            <span>TEE</span>
            <div />
          </div>
          <span className="ess-dot ess-dot-one" />
          <span className="ess-dot ess-dot-two" />
        </div>

        <aside className="ess-aside">
          <span className={`ess-live${openElections.length > 0 ? ' is-live' : ''}`}>
            <i aria-hidden="true" />
            {!elections
              ? 'Elecciones sin datos'
              : openElections.length === 1
                ? '1 elección abierta'
                : `${openElections.length} elecciones abiertas`}
          </span>
          <strong>Tu siguiente paso</strong>
          <p>{nextStep.text}</p>
          <Link href={nextStep.href} className="ess-step">
            <Arrow />
            {nextStep.cta}
          </Link>
        </aside>
      </section>

      <nav className="ess-links" aria-label="Accesos principales">
        {ACCESS_LINKS.map((link, index) => (
          <Link key={link.href} href={link.href}>
            <span className="ess-link-index">0{index + 1}</span>
            <span className="ess-link-icon">{link.icon}</span>
            <h3>{link.title}</h3>
            <p>{link.description}</p>
            <span className="ess-link-more">Explorar <Arrow /></span>
          </Link>
        ))}
      </nav>

      <div className="ess-bottom">
        <section className="ess-panel" aria-label="Elecciones en curso">
          <div className="ess-panel-head">
            <div>
              <h3>
                Elecciones en curso
                {openElections.length > 0 && (
                  <span className="ess-count">{openElections.length}</span>
                )}
              </h3>
              <p>Un vistazo a cada proceso activo.</p>
            </div>
            <Link href="/elecciones" className="ess-panel-link">
              Ver todas <Arrow />
            </Link>
          </div>

          {!elections ? (
            <div className="dash-panel-empty">No se pudieron cargar las elecciones</div>
          ) : openElections.length === 0 ? (
            <div className="dash-panel-empty">
              No hay elecciones en curso
              {closedElections.length > 0 && ` · ${closedElections.length} cerrada${closedElections.length > 1 ? 's' : ''}`}
            </div>
          ) : (
            <div className="ess-election-list">
              {openElections.map((election) => {
                const voters = Number(election.total_voters || 0);
                const votes = Number(election.votes_cast || 0);
                const percentage = voters > 0 ? (votes / voters) * 100 : null;
                const countdown = getElectionCountdown(
                  { status: election.status, endTime: election.end_time },
                  now,
                );

                return (
                  <Link key={election.id} href="/monitoreo" className="ess-election">
                    <span className="ess-election-initial" aria-hidden="true">
                      {initials(election.title)}
                    </span>
                    <span className="ess-election-name">
                      <strong>{election.title}</strong>
                      <small>
                        {formatDate(election.end_time)} · {countdown.label} {countdown.value}
                      </small>
                    </span>
                    <span className="ess-election-progress">
                      <span className="ess-election-figures">
                        <strong>{percentage === null ? 'Sin datos' : `${percentage.toFixed(1)}%`}</strong>
                        <small>
                          {votes.toLocaleString('es-CR')} de {voters.toLocaleString('es-CR')}
                        </small>
                      </span>
                      <span
                        className="dash-progress-track"
                        role="progressbar"
                        aria-label={`Participación de ${election.title}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percentage ?? 0)}
                      >
                        <span
                          className="dash-progress-fill"
                          style={{ width: `${Math.max(0, Math.min(100, percentage ?? 0))}%` }}
                        />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="ess-panel" aria-label="Actividad reciente">
          <div className="ess-panel-head">
            <div>
              <h3>Actividad reciente</h3>
              <p>Los últimos movimientos del equipo.</p>
            </div>
            <Link href="/auditoria" className="ess-panel-link">
              Ver registro <Arrow />
            </Link>
          </div>

          {!data.auditLogs ? (
            <div className="dash-panel-empty">No se pudo cargar la actividad</div>
          ) : recentAuditLogs.length === 0 ? (
            <div className="dash-panel-empty">Sin actividad registrada</div>
          ) : (
            <div className="ess-activity-list">
              {recentAuditLogs.map((log) => {
                const meta = resourceMeta(log.resource_type ?? log.action.split('.')[0]);
                const { title, detail } = summarizeLog(log);
                const op = OP_BADGES[log.action.split('.')[1]];

                return (
                  <div key={log.id} className="ess-activity">
                    <span
                      className="ess-activity-icon"
                      style={{ color: meta.tone, background: meta.tint }}
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                    <div className="ess-activity-body">
                      <span className="ess-activity-title">
                        <strong title={log.activityMessage}>{title}</strong>
                        {op && (
                          <span className={`audit-op-badge audit-op-${op.variant}`}>{op.label}</span>
                        )}
                      </span>
                      {detail && <small title={detail}>{detail}</small>}
                    </div>
                    <time dateTime={log.created_at} title={formatDate(log.created_at)}>
                      {formatRelative(log.created_at)}
                    </time>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="ess-quick" aria-label="Acciones rápidas">
        <Link href="/padron">
          <LabIcon d={PATHS.users} />
          <span>Consultar padrón</span>
          <Arrow />
        </Link>
        <Link href="/postulaciones">
          <LabIcon d={PATHS.file} />
          <span>Revisar postulaciones</span>
          <Arrow />
        </Link>
        <button type="button" onClick={exportSummary} disabled={scopedElections.length === 0}>
          <LabIcon d={PATHS.download} />
          <span>Exportar resumen</span>
          <Arrow />
        </button>
      </nav>
    </div>
  );
}
