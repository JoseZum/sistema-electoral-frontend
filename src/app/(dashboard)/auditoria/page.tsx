'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '@/lib/api-client';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

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
  // Provided by backend
  actionLabel?: string;
  resourceLabel?: string;
  activityMessage?: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

interface AuditStatRow {
  resource_type: string;
  count: string | number;
  last_activity: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG — stroke-based to match the Swiss aesthetic)
// ────────────────────────────────────────────────────────────────────────────

const Icon = {
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  ballot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
      <path d="M3 9h18" />
    </svg>
  ),
  checkCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5 21 2" />
      <path d="m17 6 3 3" />
      <path d="m14 9 3 3" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Event catalog — maps resource types to user-friendly categories
// ────────────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  resourceTypes: string[];
  tone: string; // css color token
  tint: string; // css background token
}

const CATEGORIES: Category[] = [
  {
    id: 'all',
    label: 'Todas',
    description: 'Todos los eventos del sistema',
    icon: Icon.grid,
    resourceTypes: [],
    tone: 'var(--ink)',
    tint: 'var(--surface-sunken)',
  },
  {
    id: 'padron',
    label: 'Padrón',
    description: 'Estudiantes e importaciones',
    icon: Icon.users,
    resourceTypes: ['student', 'padron', 'padron_upload'],
    tone: '#1E4A7A',
    tint: '#EAF1F9',
  },
  {
    id: 'elecciones',
    label: 'Elecciones',
    description: 'Comicios y opciones',
    icon: Icon.ballot,
    resourceTypes: ['election', 'election_option'],
    tone: '#6B21A8',
    tint: '#F5EFFB',
  },
  {
    id: 'votos',
    label: 'Votos',
    description: 'Boletas registradas',
    icon: Icon.checkCircle,
    resourceTypes: ['vote', 'election_voter'],
    tone: '#0F766E',
    tint: '#E6F4F2',
  },
  {
    id: 'admins',
    label: 'Administradores',
    description: 'Cuentas del panel',
    icon: Icon.shield,
    resourceTypes: ['admin'],
    tone: 'var(--accent)',
    tint: 'var(--accent-light)',
  },
  {
    id: 'seguridad',
    label: 'Seguridad',
    description: 'Llaves y sesiones',
    icon: Icon.key,
    resourceTypes: ['scrutiny_key', 'auth'],
    tone: '#B45309',
    tint: '#FBF4E6',
  },
];

function findCategoryForResource(resourceType: string): Category {
  return (
    CATEGORIES.find((c) => c.resourceTypes.includes(resourceType)) ?? CATEGORIES[0]
  );
}

// Per resource visual metadata for the timeline dot
const RESOURCE_META: Record<
  string,
  { icon: ReactNode; label: string; tone: string; tint: string }
> = {
  student: { icon: Icon.users, label: 'Estudiante', tone: '#1E4A7A', tint: '#EAF1F9' },
  padron: { icon: Icon.upload, label: 'Padrón', tone: '#1E4A7A', tint: '#EAF1F9' },
  padron_upload: { icon: Icon.upload, label: 'Padrón', tone: '#1E4A7A', tint: '#EAF1F9' },
  election: { icon: Icon.ballot, label: 'Elección', tone: '#6B21A8', tint: '#F5EFFB' },
  election_option: { icon: Icon.ballot, label: 'Opción', tone: '#6B21A8', tint: '#F5EFFB' },
  election_voter: { icon: Icon.checkCircle, label: 'Votante', tone: '#0F766E', tint: '#E6F4F2' },
  vote: { icon: Icon.checkCircle, label: 'Voto', tone: '#0F766E', tint: '#E6F4F2' },
  admin: { icon: Icon.shield, label: 'Administrador', tone: 'var(--accent)', tint: 'var(--accent-light)' },
  scrutiny_key: { icon: Icon.key, label: 'Llave', tone: '#B45309', tint: '#FBF4E6' },
};

function resourceMeta(resourceType: string) {
  return (
    RESOURCE_META[resourceType] ?? {
      icon: Icon.system,
      label: resourceType,
      tone: 'var(--muted)',
      tint: 'var(--surface-sunken)',
    }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Translation helpers — field names, status codes, election titles
// ────────────────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  carnet: 'carnet',
  full_name: 'nombre completo',
  name: 'nombre',
  email: 'correo',
  phone: 'teléfono',
  title: 'título',
  description: 'descripción',
  start_time: 'fecha de inicio',
  end_time: 'fecha de cierre',
  status: 'estado',
  is_active: 'activo',
  has_submitted: 'llave entregada',
  token_used: 'voto ejercido',
  scholarship: 'beca',
  degree: 'carrera',
  campus: 'sede',
  role: 'rol',
  password_hash: 'contraseña',
  label: 'etiqueta',
  position: 'posición',
  filename: 'archivo',
  total_rows: 'registros',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

function prettyValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status' && typeof value === 'string') {
    return STATUS_LABELS[value] || value;
  }
  if (field === 'password_hash') return '••••••••';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      return new Date(value).toLocaleString('es-CR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }
  if (typeof value === 'number') return value.toLocaleString('es-CR');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

// ────────────────────────────────────────────────────────────────────────────
// Narrative builder — turns (action + details) into Spanish sentences
// ────────────────────────────────────────────────────────────────────────────

interface Narrative {
  lead: string;
  subject?: string;
  trailer?: string;
  opBadge: { label: string; variant: 'create' | 'update' | 'delete' | 'event' };
}

function getField<T = unknown>(obj: unknown, path: string): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  return (obj as Record<string, T>)[path];
}

function opBadgeFor(op: string): Narrative['opBadge'] {
  if (op === 'insert') return { label: 'Creado', variant: 'create' };
  if (op === 'update') return { label: 'Actualizado', variant: 'update' };
  if (op === 'delete') return { label: 'Eliminado', variant: 'delete' };
  return { label: 'Evento', variant: 'event' };
}

function buildNarrative(log: AuditLog): Narrative {
  const details = (log.details ?? {}) as Record<string, unknown>;
  const [, op] = log.action.split('.');
  const opBadge = opBadgeFor(op);

  const newRow = (getField<Record<string, unknown>>(details, 'new') ?? {}) as Record<string, unknown>;
  const oldRow = (getField<Record<string, unknown>>(details, 'old') ?? {}) as Record<string, unknown>;
  const changes = (getField<Record<string, unknown>>(details, 'changes') ?? {}) as Record<string, unknown>;
  const previous = (getField<Record<string, unknown>>(details, 'previous') ?? {}) as Record<string, unknown>;

  switch (log.action) {
    // ─── Padrón import ──────────────────────────────────────────────
    case 'padron.import': {
      const total = Number(details.total ?? 0);
      const nu = Number(details.new ?? 0);
      const updated = Number(details.updated ?? 0);
      const reactivated = Number(details.reactivated ?? 0);
      const deactivated = Number(details.deactivated ?? 0);
      const parts = [
        nu > 0 ? `${nu.toLocaleString('es-CR')} nuevos` : null,
        updated > 0 ? `${updated.toLocaleString('es-CR')} actualizados` : null,
        reactivated > 0 ? `${reactivated.toLocaleString('es-CR')} reactivados` : null,
        deactivated > 0 ? `${deactivated.toLocaleString('es-CR')} desactivados` : null,
      ].filter(Boolean);
      return {
        lead: 'importó el padrón electoral',
        subject: `${total.toLocaleString('es-CR')} estudiantes`,
        trailer: parts.length > 0 ? parts.join(' · ') : 'sin cambios',
        opBadge: { label: 'Importación', variant: 'event' },
      };
    }

    case 'padron_upload.insert': {
      const filename = newRow.filename as string | undefined;
      return {
        lead: 'subió un archivo de padrón',
        subject: filename ?? 'archivo CSV',
        opBadge,
      };
    }

    // ─── Estudiantes ────────────────────────────────────────────────
    case 'student.insert': {
      const carnet = (newRow.carnet as string | undefined) || log.resource_id || '';
      const name = newRow.full_name as string | undefined;
      return {
        lead: 'agregó al estudiante',
        subject: name ? `${name} · ${carnet}` : carnet,
        opBadge,
      };
    }
    case 'student.update': {
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at');
      const carnet = (newRow.carnet as string | undefined) || log.resource_id || '';
      return {
        lead: 'actualizó al estudiante',
        subject: carnet,
        trailer:
          fields.length > 0
            ? `cambió ${fields.map(fieldLabel).join(', ')}`
            : undefined,
        opBadge,
      };
    }
    case 'student.delete': {
      const carnet = (oldRow.carnet as string | undefined) || log.resource_id || '';
      return { lead: 'eliminó al estudiante', subject: carnet, opBadge };
    }

    // ─── Elecciones ─────────────────────────────────────────────────
    case 'election.insert': {
      const title = (newRow.title as string | undefined) || log.resource_id || '';
      return { lead: 'creó la elección', subject: `«${title}»`, opBadge };
    }
    case 'election.update': {
      const title =
        (newRow.title as string | undefined) ||
        (previous.title as string | undefined) ||
        log.resource_id ||
        '';
      if ('status' in changes) {
        return {
          lead: `cambió el estado de «${title}» a`,
          subject: STATUS_LABELS[String(changes.status)] || String(changes.status),
          trailer: previous.status
            ? `antes: ${STATUS_LABELS[String(previous.status)] || String(previous.status)}`
            : undefined,
          opBadge: { label: 'Estado', variant: 'event' },
        };
      }
      if ('title' in changes) {
        return {
          lead: 'renombró una elección a',
          subject: `«${String(changes.title)}»`,
          trailer: previous.title ? `antes: «${String(previous.title)}»` : undefined,
          opBadge,
        };
      }
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at');
      return {
        lead: 'actualizó la elección',
        subject: `«${title}»`,
        trailer:
          fields.length > 0
            ? `cambios en ${fields.map(fieldLabel).join(', ')}`
            : undefined,
        opBadge,
      };
    }

    case 'election_option.insert': {
      const label = (newRow.label as string | undefined) || log.resource_id || '';
      return { lead: 'agregó la opción', subject: `«${label}»`, opBadge };
    }
    case 'election_option.update': {
      const label =
        (newRow.label as string | undefined) ||
        (previous.label as string | undefined) ||
        log.resource_id ||
        '';
      return { lead: 'modificó la opción', subject: `«${label}»`, opBadge };
    }
    case 'election_option.delete': {
      const label = (oldRow.label as string | undefined) || log.resource_id || '';
      return { lead: 'eliminó la opción', subject: `«${label}»`, opBadge };
    }

    // ─── Votantes y votos ───────────────────────────────────────────
    case 'election_voter.update': {
      const tokenUsed = changes.token_used;
      if (tokenUsed === true) {
        return {
          lead: 'ejerció su voto',
          subject: 'token canjeado',
          opBadge: { label: 'Voto emitido', variant: 'event' },
        };
      }
      return { lead: 'actualizó un votante', subject: log.resource_id || '', opBadge };
    }
    case 'vote.insert': {
      return {
        lead: 'registró una boleta cifrada',
        subject: 'voto anónimo',
        opBadge: { label: 'Voto', variant: 'event' },
      };
    }

    // ─── Administradores ────────────────────────────────────────────
    case 'admin.insert': {
      const carnet = (newRow.carnet as string | undefined) || log.resource_id || '';
      const name = newRow.full_name as string | undefined;
      return {
        lead: 'creó al administrador',
        subject: name ? `${name} · ${carnet}` : carnet,
        opBadge,
      };
    }
    case 'admin.update': {
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at');
      return {
        lead: 'actualizó al administrador',
        subject: log.resource_id || '',
        trailer:
          fields.length > 0
            ? `cambió ${fields.map(fieldLabel).join(', ')}`
            : undefined,
        opBadge,
      };
    }
    case 'admin.delete': {
      const carnet = (oldRow.carnet as string | undefined) || log.resource_id || '';
      return { lead: 'eliminó al administrador', subject: carnet, opBadge };
    }

    // ─── Llaves de escrutinio ───────────────────────────────────────
    case 'scrutiny_key.insert': {
      return {
        lead: 'recibió una llave de escrutinio',
        subject: log.resource_id || '',
        opBadge: { label: 'Llave asignada', variant: 'event' },
      };
    }
    case 'scrutiny_key.update': {
      if (changes.has_submitted === true) {
        return {
          lead: 'entregó su llave de escrutinio',
          subject: log.resource_id || '',
          opBadge: { label: 'Llave entregada', variant: 'event' },
        };
      }
      return { lead: 'actualizó una llave', subject: log.resource_id || '', opBadge };
    }

    default: {
      return {
        lead: log.actionLabel || log.action,
        subject: log.resource_id || '',
        opBadge,
      };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Date helpers
// ────────────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatClock(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayHeader(dateStr: string): { primary: string; secondary: string } {
  const d = new Date(dateStr);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);

  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const full = d.toLocaleDateString('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (isSame(d, today)) return { primary: 'Hoy', secondary: full };
  if (isSame(d, yest)) return { primary: 'Ayer', secondary: full };

  const weekday = d.toLocaleDateString('es-CR', { weekday: 'long' });
  const rest = d.toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return {
    primary: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    secondary: rest,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<AuditStatRow[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCategory =
    CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (currentCategory.resourceTypes.length > 0) {
        params.set('resource_types', currentCategory.resourceTypes.join(','));
      }
      if (search) params.set('search', search);

      const res = await apiClient<AuditResponse>(`/api/audit?${params.toString()}`);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, currentCategory, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiClient<AuditStatRow[]>(`/api/audit/stats`);
        if (!cancelled) setStats(rows);
      } catch (err) {
        console.error('Error fetching audit stats:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchInput = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  const categoryCounts = useMemo(() => {
    const byResource: Record<string, number> = {};
    for (const row of stats) {
      byResource[row.resource_type] = Number(row.count) || 0;
    }
    const counts: Record<string, number> = {};
    for (const c of CATEGORIES) {
      if (c.id === 'all') {
        counts[c.id] = Object.values(byResource).reduce((a, b) => a + b, 0);
      } else {
        counts[c.id] = c.resourceTypes.reduce(
          (sum, rt) => sum + (byResource[rt] ?? 0),
          0,
        );
      }
    }
    return counts;
  }, [stats]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Group logs by local day
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of logs) {
      const k = dayKey(log.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(log);
    }
    return Array.from(map.entries());
  }, [logs]);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleRaw = (id: string) => {
    setShowRaw((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="view-enter audit-page">
      {/* ─── Editorial header ────────────────────────────────────── */}
      <header className="audit-hero">
        <div className="swiss-bar" />
        <div className="audit-hero-row">
          <div>
            <h2 className="audit-hero-title">Registro de actividad</h2>
            <p className="audit-hero-sub">
              Toda acción importante queda registrada automáticamente. Aquí puedes ver
              <em> quién hizo qué</em> y <em>cuándo</em>.
            </p>
          </div>
          <div className="audit-hero-meta">
            <div className="audit-hero-stat">
              <span className="audit-hero-stat-value">
                {total.toLocaleString('es-CR')}
              </span>
              <span className="audit-hero-stat-label">
                evento{total === 1 ? '' : 's'} en esta vista
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Category filter pills ──────────────────────────────── */}
      <nav className="audit-filter-row" aria-label="Filtrar por categoría">
        {CATEGORIES.map((c) => {
          const active = c.id === categoryId;
          const count = categoryCounts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              className={`audit-pill ${active ? 'is-active' : ''}`}
              onClick={() => {
                setCategoryId(c.id);
                setPage(1);
              }}
              style={
                active
                  ? ({
                      ['--pill-tone' as string]: c.tone,
                      ['--pill-tint' as string]: c.tint,
                    } as React.CSSProperties)
                  : undefined
              }
              aria-pressed={active}
            >
              <span className="audit-pill-icon" style={{ color: c.tone, background: c.tint }}>
                {c.icon}
              </span>
              <span className="audit-pill-body">
                <span className="audit-pill-label">{c.label}</span>
                <span className="audit-pill-desc">{c.description}</span>
              </span>
              <span className="audit-pill-count">{count.toLocaleString('es-CR')}</span>
            </button>
          );
        })}
      </nav>

      {/* ─── Search bar ─────────────────────────────────────────── */}
      <div className="audit-toolbar">
        <div className="audit-search">
          <span className="audit-search-icon" aria-hidden="true">{Icon.search}</span>
          <input
            type="text"
            placeholder="Buscar por carnet, nombre o identificador…"
            defaultValue={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            aria-label="Buscar eventos"
          />
        </div>
        <div className="audit-toolbar-meta">
          Mostrando <strong>{logs.length}</strong> de{' '}
          <strong>{total.toLocaleString('es-CR')}</strong>
        </div>
      </div>

      {/* ─── Timeline feed ──────────────────────────────────────── */}
      {loading ? (
        <div className="audit-empty">
          <p>Cargando eventos…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="audit-empty">
          <div className="audit-empty-icon">{Icon.search}</div>
          <h3>No encontramos eventos</h3>
          <p>Intenta con otra categoría o limpia tu búsqueda.</p>
        </div>
      ) : (
        <ol className="audit-timeline" aria-label="Línea de tiempo de eventos">
          {grouped.map(([day, items], di) => {
            const header = dayHeader(items[0].created_at);
            return (
              <li key={day} className="audit-day" style={{ animationDelay: `${di * 0.04}s` }}>
                <div className="audit-day-header">
                  <span className="audit-day-primary">{header.primary}</span>
                  <span className="audit-day-rule" />
                  <span className="audit-day-secondary">{header.secondary}</span>
                </div>

                <ol className="audit-day-events">
                  {items.map((log, i) => {
                    const narrative = buildNarrative(log);
                    const meta = resourceMeta(log.resource_type);
                    const category = findCategoryForResource(log.resource_type);
                    const isExpanded = expandedId === log.id;
                    const actor = log.actor_carnet || 'Sistema';
                    const isSystem = !log.actor_carnet;

                    return (
                      <li
                        key={log.id}
                        className={`audit-event ${isExpanded ? 'is-expanded' : ''}`}
                        style={{ animationDelay: `${i * 0.02}s` }}
                      >
                        <div className="audit-event-rail" aria-hidden="true">
                          <div
                            className="audit-event-dot"
                            style={{ color: meta.tone, background: meta.tint }}
                          >
                            {meta.icon}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="audit-event-body"
                          onClick={() => toggleExpanded(log.id)}
                          aria-expanded={isExpanded}
                        >
                          <div className="audit-event-top">
                            <span
                              className={`audit-actor ${isSystem ? 'is-system' : ''}`}
                              title={actor}
                            >
                              {isSystem ? (
                                <>
                                  <span className="audit-actor-icon">{Icon.system}</span>
                                  Sistema
                                </>
                              ) : (
                                <>
                                  <span className="audit-actor-avatar">
                                    {actor.slice(-2)}
                                  </span>
                                  {actor}
                                </>
                              )}
                            </span>

                            <span
                              className={`audit-op-badge audit-op-${narrative.opBadge.variant}`}
                            >
                              {narrative.opBadge.label}
                            </span>

                            <span
                              className="audit-category-chip"
                              style={{ color: category.tone, background: category.tint }}
                            >
                              {category.label}
                            </span>
                          </div>

                          <p className="audit-event-narrative">
                            <span className="audit-event-lead">{narrative.lead}</span>
                            {narrative.subject && (
                              <>
                                {' '}
                                <span className="audit-event-subject">{narrative.subject}</span>
                              </>
                            )}
                          </p>

                          {narrative.trailer && (
                            <p className="audit-event-trailer">{narrative.trailer}</p>
                          )}

                          <div className="audit-event-foot">
                            <time
                              className="audit-event-time"
                              dateTime={log.created_at}
                              title={formatFullDate(log.created_at)}
                            >
                              {timeAgo(log.created_at)} · {formatClock(log.created_at)}
                            </time>
                            <span className="audit-event-chevron" aria-hidden="true">
                              {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                              <span
                                className="audit-event-chevron-icon"
                                data-expanded={isExpanded}
                              >
                                {Icon.chevron}
                              </span>
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="audit-detail">
                            <EventDetail log={log} narrative={narrative} />

                            <div className="audit-detail-footer">
                              <div className="audit-detail-ids">
                                {log.ip_address && (
                                  <span>
                                    <strong>IP</strong> {log.ip_address}
                                  </span>
                                )}
                                <span>
                                  <strong>Evento</strong>{' '}
                                  <span className="mono">{log.id.slice(0, 8)}</span>
                                </span>
                                <span>
                                  <strong>Fecha</strong> {formatFullDate(log.created_at)}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="audit-raw-toggle"
                                onClick={() => toggleRaw(log.id)}
                              >
                                {showRaw[log.id]
                                  ? 'Ocultar datos técnicos'
                                  : 'Ver datos técnicos'}
                              </button>
                            </div>

                            {showRaw[log.id] && log.details && (
                              <pre className="audit-raw">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
      )}

      {/* ─── Pagination ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="audit-pagination">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="pagination-btns">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              &lsaquo;
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              &rsaquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Detail sub-component — clean change diff, no raw JSON by default
// ────────────────────────────────────────────────────────────────────────────

function EventDetail({ log, narrative }: { log: AuditLog; narrative: Narrative }) {
  const details = (log.details ?? {}) as Record<string, unknown>;

  // padron.import special case — mini stat grid
  if (log.action === 'padron.import') {
    const rows = [
      { label: 'Total', value: Number(details.total ?? 0), tone: 'var(--ink)' },
      { label: 'Nuevos', value: Number(details.new ?? 0), tone: '#0F766E' },
      { label: 'Actualizados', value: Number(details.updated ?? 0), tone: '#1E4A7A' },
      { label: 'Reactivados', value: Number(details.reactivated ?? 0), tone: '#6B21A8' },
      { label: 'Desactivados', value: Number(details.deactivated ?? 0), tone: 'var(--accent)' },
    ];
    return (
      <div className="audit-detail-stats">
        {rows.map((r) => (
          <div key={r.label} className="audit-detail-stat">
            <span className="audit-detail-stat-label">{r.label}</span>
            <span className="audit-detail-stat-value" style={{ color: r.tone }}>
              {r.value.toLocaleString('es-CR')}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const [, op] = log.action.split('.');

  // UPDATE → field diff
  if (op === 'update') {
    const changes = (getField<Record<string, unknown>>(details, 'changes') ?? {}) as Record<
      string,
      unknown
    >;
    const previous = (getField<Record<string, unknown>>(details, 'previous') ?? {}) as Record<
      string,
      unknown
    >;
    const keys = Object.keys(changes).filter((k) => k !== 'updated_at');

    if (keys.length === 0) {
      return (
        <p className="audit-detail-empty">
          Esta actualización no cambió datos visibles al usuario.
        </p>
      );
    }

    return (
      <div className="audit-detail-diff">
        <div className="audit-detail-diff-head">
          <span>Campo</span>
          <span>Antes</span>
          <span aria-hidden="true" />
          <span>Después</span>
        </div>
        {keys.map((k) => (
          <div key={k} className="audit-detail-diff-row">
            <span className="audit-detail-field">{fieldLabel(k)}</span>
            <span className="audit-detail-old">{prettyValue(k, previous[k])}</span>
            <span className="audit-detail-arrow" aria-hidden="true">
              {Icon.arrowRight}
            </span>
            <span className="audit-detail-new">{prettyValue(k, changes[k])}</span>
          </div>
        ))}
      </div>
    );
  }

  // INSERT or DELETE → show notable fields of new/old
  const row = (op === 'delete' ? details.old : details.new) as
    | Record<string, unknown>
    | undefined;
  if (row && typeof row === 'object') {
    const hidden = new Set([
      'id',
      'created_at',
      'updated_at',
      'password_hash',
      'token',
      'ciphertext',
      'nonce',
      'proof',
      'public_key',
      'private_key_encrypted',
    ]);
    const entries = Object.entries(row).filter(
      ([k, v]) =>
        !hidden.has(k) && v !== null && v !== '' && typeof v !== 'object',
    );
    if (entries.length === 0) {
      return (
        <p className="audit-detail-empty">
          {narrative.lead}
          {narrative.subject ? ` ${narrative.subject}` : ''}.
        </p>
      );
    }
    return (
      <dl className="audit-detail-list">
        {entries.map(([k, v]) => (
          <div key={k} className="audit-detail-list-row">
            <dt>{fieldLabel(k)}</dt>
            <dd>{prettyValue(k, v)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <p className="audit-detail-empty">
      {narrative.lead}
      {narrative.subject ? ` ${narrative.subject}` : ''}.
    </p>
  );
}
