'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_carnet: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

const RESOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  student: { label: 'Estudiante', color: '#2563eb', bg: '#eff6ff' },
  admin: { label: 'Admin', color: 'var(--accent)', bg: 'var(--accent-light)' },
  election: { label: 'Eleccion', color: '#7c3aed', bg: '#f5f3ff' },
  election_option: { label: 'Opcion', color: '#7c3aed', bg: '#f5f3ff' },
  election_voter: { label: 'Votante', color: '#0891b2', bg: '#ecfeff' },
  vote: { label: 'Voto', color: 'var(--success)', bg: 'var(--success-light)' },
  scrutiny_key: { label: 'Llave', color: '#d97706', bg: 'var(--warning-light)' },
  padron: { label: 'Padron', color: '#64748b', bg: '#f8fafc' },
  padron_upload: { label: 'Padron', color: '#64748b', bg: '#f8fafc' },
};

const OP_LABELS: Record<string, { label: string; icon: string }> = {
  insert: { label: 'Creado', icon: '+' },
  update: { label: 'Modificado', icon: '~' },
  delete: { label: 'Eliminado', icon: '-' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const PAGE_SIZE = 30;
const RESOURCE_TYPES = ['student', 'admin', 'election', 'election_option', 'election_voter', 'vote', 'scrutiny_key', 'padron', 'padron_upload'];

function formatResourceId(resourceId: string | null) {
  if (!resourceId || resourceId.trim().length === 0) {
    return 'Sin recurso';
  }

  return resourceId.length > 8 ? resourceId.slice(0, 8) : resourceId;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [resourceType, setResourceType] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (resourceType) params.set('resource_type', resourceType);
      if (search) params.set('search', search);

      const res = await apiClient<AuditResponse>(`/api/audit?${params.toString()}`);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, resourceType, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchInput = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="view-enter" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="swiss-bar" />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>
          Audit Log
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {total.toLocaleString()} evento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''} &mdash; Todas las acciones del sistema se registran automaticamente
        </p>
      </div>

      {/* Filters */}
      <div className="padron-toolbar" style={{ marginBottom: '1rem' }}>
        <div className="padron-toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por carnet, ID o detalle..."
            defaultValue={search}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
        </div>
        <div className="padron-toolbar-right">
          <select
            className="input"
            style={{ width: 'auto', paddingRight: '2rem' }}
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          >
            <option value="">Todos los recursos</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {RESOURCE_LABELS[rt]?.label || rt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Cargando...</div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontSize: '0.875rem' }}>No se encontraron eventos</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {logs.map((log, i) => {
            const [resourceKey, opKey] = log.action.split('.');
            const resource = RESOURCE_LABELS[resourceKey] || { label: resourceKey, color: 'var(--muted)', bg: 'var(--surface-sunken)' };
            const op = OP_LABELS[opKey] || { label: opKey, icon: '?' };
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                className="table-row-enter"
                style={{
                  borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                  animationDelay: `${i * 0.015}s`,
                }}
              >
                {/* Main row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1.25rem',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-glow)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Op icon */}
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

                  {/* Info */}
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
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--muted-light)' }}>
                        {formatResourceId(log.resource_id)}
                      </span>
                    </div>
                    {log.actor_carnet && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        por {log.actor_carnet}
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <span
                    style={{ fontSize: '0.75rem', color: 'var(--muted-light)', whiteSpace: 'nowrap', flexShrink: 0 }}
                    title={formatDate(log.created_at)}
                  >
                    {timeAgo(log.created_at)}
                  </span>

                  {/* Expand chevron */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted-light)"
                    strokeWidth="2"
                    style={{
                      flexShrink: 0,
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Expanded detail */}
                {isExpanded && log.details && (
                  <div
                    style={{
                      padding: '0 1.25rem 1rem 3.75rem',
                      animation: 'viewFadeIn 0.2s ease',
                    }}
                  >
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        lineHeight: 1.6,
                        color: 'var(--ink-soft)',
                        background: 'var(--surface-sunken)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'auto',
                        maxHeight: '240px',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.6875rem', color: 'var(--muted-light)' }}>
                      <span>ID: {log.id}</span>
                      <span>{formatDate(log.created_at)}</span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="table-pagination" style={{ marginTop: '0.5rem', border: 'none' }}>
          <span>
            Pagina {page} de {totalPages} ({total.toLocaleString()} eventos)
          </span>
          <div className="pagination-btns">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>&lsaquo;</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>&rsaquo;</button>
          </div>
        </div>
      )}
    </div>
  );
}
