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
import { buildApiUrl } from '@/lib/api-url';
import Loader from '@/components/Loader';
import { buildAuditXlsxBlob, type AuditLogRow } from '@/lib/audit-xlsx';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_carnet: string | null;
  actor_name?: string | null;
  target_name?: string | null;
  target_carnet?: string | null;
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
  election_title?: string | null;
  holder_name?: string | null;
  holder_carnet?: string | null;
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
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 13.5 13.5 20.5a2.2 2.2 0 0 1-3.1 0L3 13.1V3h10.1l7.4 7.4a2.2 2.2 0 0 1 0 3.1Z" />
      <circle cx="8" cy="8" r="1.25" />
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
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  ),
  badge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5 7 22l5-2.5L17 22l-1.5-8.5" />
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
    id: 'postulaciones',
    label: 'Postulaciones',
    description: 'Convocatorias, puestos y candidaturas',
    icon: Icon.clipboard,
    resourceTypes: ['application_form', 'application', 'application_position'],
    tone: '#0F766E',
    tint: '#E6F4F2',
  },
  {
    id: 'tags',
    label: 'Tags',
    description: 'Agrupaciones de votantes',
    icon: Icon.tag,
    resourceTypes: ['tag', 'tag_member'],
    tone: '#AD1457',
    tint: '#FCE7F3',
  },
  // La categoría individual "Votos" se eliminó por privacidad: la auditoría
  // no expone canjeo de token ni votos individuales. El cierre de votación
  // (con su total agregado de boletas) se reporta dentro de "Elecciones".
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
  tag: { icon: Icon.tag, label: 'Tag', tone: '#AD1457', tint: '#FCE7F3' },
  tag_member: { icon: Icon.users, label: 'Miembro de tag', tone: '#AD1457', tint: '#FCE7F3' },
  election_voter: { icon: Icon.checkCircle, label: 'Votante', tone: '#0F766E', tint: '#E6F4F2' },
  vote: { icon: Icon.checkCircle, label: 'Voto', tone: '#0F766E', tint: '#E6F4F2' },
  admin: { icon: Icon.shield, label: 'Administrador', tone: 'var(--accent)', tint: 'var(--accent-light)' },
  scrutiny_key: { icon: Icon.key, label: 'Llave', tone: '#B45309', tint: '#FBF4E6' },
  application_form: { icon: Icon.clipboard, label: 'Convocatoria', tone: '#0F766E', tint: '#E6F4F2' },
  application: { icon: Icon.checkCircle, label: 'Postulación', tone: '#0F766E', tint: '#E6F4F2' },
  application_position: { icon: Icon.badge, label: 'Puesto', tone: '#0F766E', tint: '#E6F4F2' },
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
  career: 'carrera',
  degree_level: 'nivel académico',
  sede: 'sede',
  campus: 'sede',
  email: 'correo',
  role: 'rol',
  password_hash: 'contraseña',
  label: 'etiqueta',
  position: 'posición',
  filename: 'archivo',
  total_rows: 'registros',
  member_count: 'integrantes',
  members_summary: 'personas',
  option_count: 'cantidad de opciones',
  options_summary: 'opciones',
  eligible_count: 'votantes elegibles',
  voter_scope: 'alcance',
  privacy_mode: 'privacidad',
  publication_mode: 'publicación',
  // Postulaciones
  form_title: 'convocatoria',
  position_name: 'puesto',
  position_count: 'cantidad de puestos',
  positions_summary: 'puestos',
  display_order: 'orden',
  allow_other_documents: 'otros documentos',
  other_documents_label: 'rótulo de otros documentos',
  voter_source: 'audiencia',
  review_comment: 'comentario de revisión',
  unlocked_fields: 'campos habilitados',
  correction_deadline: 'plazo de corrección',
  submitted_at: 'enviada el',
  reviewed_at: 'revisada el',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
  // Estados de una postulación
  SUBMITTED: 'Enviada',
  APPROVED: 'Aprobada',
  CONDITIONED: 'Condicionada',
  REJECTED: 'Denegada',
  // Audiencia de una convocatoria
  FULL_PADRON: 'Todo el padrón',
  FILTERED: 'Padrón filtrado',
  MANUAL: 'Selección manual',
  TAG: 'Tag',
};

function prettyValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if ((field === 'status' || field === 'voter_source') && typeof value === 'string') {
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

function formatPersonLabel(
  name: string | null | undefined,
  carnet: string | null | undefined,
  fallback: string
): string {
  if (name && carnet) return `${name} · ${carnet}`;
  return name || carnet || fallback;
}

function opBadgeFor(op: string): Narrative['opBadge'] {
  if (op === 'insert') return { label: 'Creado', variant: 'create' };
  if (op === 'update') return { label: 'Actualizado', variant: 'update' };
  if (op === 'delete') return { label: 'Eliminado', variant: 'delete' };
  return { label: 'Evento', variant: 'event' };
}

function getTagAuditName(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
  log: AuditLog
): string {
  return (
    (primary.name as string | undefined) ||
    (secondary.name as string | undefined) ||
    (primary.tag_name as string | undefined) ||
    (secondary.tag_name as string | undefined) ||
    (log.target_name as string | undefined) ||
    log.resource_id ||
    'tag'
  );
}

/**
 * El trigger adjunta el título de la convocatoria a todo evento del módulo,
 * pero los registros anteriores a esa migración no lo llevan: en ese caso se
 * busca en el cuerpo del propio evento antes de rendirse.
 */
function formTitle(log: AuditLog): string | undefined {
  const details = (log.details ?? {}) as Record<string, unknown>;
  const newRow = (getField<Record<string, unknown>>(details, 'new') ?? {}) as Record<string, unknown>;
  const oldRow = (getField<Record<string, unknown>>(details, 'old') ?? {}) as Record<string, unknown>;

  const candidatos = [
    details.form_title,
    log.resource_type === 'application_form' ? newRow.title : undefined,
    log.resource_type === 'application_form' ? oldRow.title : undefined,
  ];

  return candidatos.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function positionName(log: AuditLog, fallbackRow: Record<string, unknown>): string | undefined {
  const details = (log.details ?? {}) as Record<string, unknown>;
  const candidatos = [details.position_name, fallbackRow.name];

  return candidatos.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
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
      const carnet =
        (newRow.carnet as string | undefined) || log.target_carnet || '';
      const name = (newRow.full_name as string | undefined) || log.target_name || undefined;
      const subject = name && carnet ? `${name} · ${carnet}` : name || carnet || log.resource_id || '';
      return {
        lead: 'agregó al estudiante',
        subject,
        opBadge,
      };
    }
    case 'student.update': {
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at' && k !== 'email');
      const carnet =
        (newRow.carnet as string | undefined) ||
        (previous.carnet as string | undefined) ||
        log.target_carnet ||
        '';
      const name =
        (newRow.full_name as string | undefined) ||
        (previous.full_name as string | undefined) ||
        log.target_name ||
        undefined;
      const subject = name && carnet ? `${name} · ${carnet}` : name || carnet || log.resource_id || '';
      return {
        lead: 'actualizó al estudiante',
        subject,
        trailer:
          fields.length > 0
            ? `cambió ${fields.map(fieldLabel).join(', ')}`
            : undefined,
        opBadge,
      };
    }
    case 'student.delete': {
      const carnet =
        (oldRow.carnet as string | undefined) || log.target_carnet || '';
      const name = (oldRow.full_name as string | undefined) || log.target_name || undefined;
      const subject = name && carnet ? `${name} · ${carnet}` : name || carnet || log.resource_id || '';
      return { lead: 'eliminó al estudiante', subject, opBadge };
    }

    // ─── Elecciones ─────────────────────────────────────────────────
    case 'election.insert': {
      const optionCount = Number(newRow.option_count ?? 0);
      const title = (newRow.title as string | undefined) || log.resource_id || '';
      const eligibleCount = Number(newRow.eligible_count ?? 0);
      const voterScope = typeof newRow.voter_scope === 'string' ? newRow.voter_scope : undefined;
      const privacyMode = typeof newRow.privacy_mode === 'string' ? newRow.privacy_mode : undefined;
      const publicationMode = typeof newRow.publication_mode === 'string' ? newRow.publication_mode : undefined;
      const optionsSummary = typeof newRow.options_summary === 'string' ? newRow.options_summary : undefined;
      const trailerParts = [
        optionCount > 0 ? `${optionCount} opciones` : null,
        eligibleCount > 0 ? `${eligibleCount} votantes elegibles` : null,
        publicationMode || null,
        privacyMode || null,
        voterScope ? `alcance: ${voterScope}` : null,
        optionsSummary ? `opciones: ${optionsSummary}` : null,
      ].filter(Boolean);
      return {
        lead: 'creó la elección',
        subject: `«${title}»`,
        trailer: trailerParts.length > 0 ? trailerParts.join(' | ') : undefined,
        opBadge,
      };
    }
    case 'election.update': {
      const title =
        (details.election_title as string | undefined) ||
        log.election_title ||
        (newRow.title as string | undefined) ||
        (previous.title as string | undefined) ||
        'sin título';
      if ('status' in changes) {
        const newStatus = String(changes.status);
        const ballotsRaw = details.ballots_count;
        const ballotsCount =
          typeof ballotsRaw === 'number'
            ? ballotsRaw
            : typeof ballotsRaw === 'string'
            ? Number(ballotsRaw)
            : null;

        if (newStatus === 'CLOSED' && ballotsCount !== null && Number.isFinite(ballotsCount)) {
          return {
            lead: `cerró la votación «${title}»`,
            subject: `${ballotsCount.toLocaleString('es-CR')} boletas emitidas`,
            opBadge: { label: 'Votación cerrada', variant: 'event' },
          };
        }

        return {
          lead: `cambió el estado de «${title}» a`,
          subject: STATUS_LABELS[newStatus] || newStatus,
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
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at' && k !== 'email');
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

    case 'election.delete': {
      const title =
        (details.election_title as string | undefined) ||
        log.election_title ||
        (oldRow.title as string | undefined) ||
        log.resource_id ||
        'sin título';
      const previousStatus = oldRow.status as string | undefined;
      return {
        lead: 'eliminó la votación',
        subject: `«${title}»`,
        trailer: previousStatus
          ? `estaba en ${STATUS_LABELS[previousStatus] || previousStatus}`
          : undefined,
        opBadge: { label: 'Votación eliminada', variant: 'delete' },
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
    case 'tag.insert': {
      const tagName = getTagAuditName(newRow, details, log);
      const memberCount = Number(newRow.member_count ?? 0);
      return {
        lead: 'creó la tag',
        subject: `"${tagName}"`,
        trailer: memberCount > 0 ? `${memberCount} integrante${memberCount === 1 ? '' : 's'}` : undefined,
        opBadge,
      };
    }
    case 'tag.update': {
      const tagName = getTagAuditName(newRow, previous, log);
      if ('name' in changes) {
        return {
          lead: 'renombró la tag a',
          subject: `"${String(changes.name)}"`,
          trailer: previous.name ? `antes: "${String(previous.name)}"` : undefined,
          opBadge,
        };
      }

      const fields = Object.keys(changes).filter((field) => field !== 'updated_at');
      return {
        lead: 'actualizó la tag',
        subject: `"${tagName}"`,
        trailer: fields.length > 0 ? `cambios en ${fields.map(fieldLabel).join(', ')}` : undefined,
        opBadge,
      };
    }
    case 'tag.delete': {
      const tagName = getTagAuditName(oldRow, details, log);
      return { lead: 'eliminó la tag', subject: `"${tagName}"`, opBadge };
    }

    case '__tag_member_insert_old': {
      const tagName =
        (newRow.tag_name as string | undefined) ||
        (details.tag_name as string | undefined) ||
        'tag';
      const studentName =
        (newRow.student_name as string | undefined) ||
        (details.target_name as string | undefined) ||
        log.target_name ||
        'persona';
      const studentCarnet =
        (newRow.student_carnet as string | undefined) ||
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        undefined;

      return {
        lead: 'agregó a la tag',
        subject: `Â«${tagName}Â»`,
        trailer: formatPersonLabel(studentName, studentCarnet, 'persona agregada'),
        opBadge,
      };
    }
    case '__tag_member_delete_old': {
      const tagName =
        (oldRow.tag_name as string | undefined) ||
        (details.tag_name as string | undefined) ||
        'tag';
      const studentName =
        (oldRow.student_name as string | undefined) ||
        (details.target_name as string | undefined) ||
        log.target_name ||
        'persona';
      const studentCarnet =
        (oldRow.student_carnet as string | undefined) ||
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        undefined;

      return {
        lead: 'quitó de la tag',
        subject: `"${tagName}"`,
        trailer: formatPersonLabel(studentName, studentCarnet, 'persona removida'),
        opBadge,
      };
    }

    case 'tag_member.insert': {
      const tagName =
        (newRow.tag_name as string | undefined) ||
        (details.tag_name as string | undefined) ||
        'tag';
      const studentName =
        (newRow.student_name as string | undefined) ||
        (details.target_name as string | undefined) ||
        log.target_name ||
        'persona';
      const studentCarnet =
        (newRow.student_carnet as string | undefined) ||
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        undefined;

      return {
        lead: 'agregó a la tag',
        subject: `"${tagName}"`,
        trailer: formatPersonLabel(studentName, studentCarnet, 'persona agregada'),
        opBadge,
      };
    }
    case 'tag_member.delete': {
      const tagName =
        (oldRow.tag_name as string | undefined) ||
        (details.tag_name as string | undefined) ||
        'tag';
      const studentName =
        (oldRow.student_name as string | undefined) ||
        (details.target_name as string | undefined) ||
        log.target_name ||
        'persona';
      const studentCarnet =
        (oldRow.student_carnet as string | undefined) ||
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        undefined;

      return {
        lead: 'quitó de la tag',
        subject: `"${tagName}"`,
        trailer: formatPersonLabel(studentName, studentCarnet, 'persona removida'),
        opBadge,
      };
    }

    // Privacidad: los eventos individuales de voto y canjeo de token no se exponen en
    // auditoría. El backend ya los filtra; estos cases existen como defensa por si quedaran
    // registros antiguos en la BD — los rendereamos genéricos y sin trazabilidad.
    case 'election_voter.update':
    case 'vote.insert': {
      return {
        lead: 'actividad de votación registrada',
        subject: '',
        opBadge: { label: 'Votación', variant: 'event' },
      };
    }

    // ─── Administradores ────────────────────────────────────────────
    case 'admin.insert': {
      const name =
        (details.target_name as string | undefined) ||
        log.target_name ||
        (newRow.full_name as string | undefined);
      const carnet =
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        (newRow.carnet as string | undefined) ||
        log.resource_id ||
        '';
      return {
        lead: 'creó al administrador',
        subject: formatPersonLabel(name, carnet, log.resource_id || ''),
        opBadge,
      };
    }
    case 'admin.update': {
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at' && k !== 'email');
      const name =
        (details.target_name as string | undefined) ||
        log.target_name ||
        (newRow.full_name as string | undefined) ||
        (previous.full_name as string | undefined) ||
        (oldRow.full_name as string | undefined);
      const carnet =
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        (newRow.carnet as string | undefined) ||
        (previous.carnet as string | undefined) ||
        (oldRow.carnet as string | undefined) ||
        log.resource_id ||
        '';
      return {
        lead: 'actualizó al administrador',
        subject: formatPersonLabel(name, carnet, log.resource_id || ''),
        trailer:
          fields.length > 0
            ? `cambió ${fields.map(fieldLabel).join(', ')}`
            : undefined,
        opBadge,
      };
    }
    case 'admin.delete': {
      const name =
        (details.target_name as string | undefined) ||
        log.target_name ||
        (oldRow.full_name as string | undefined);
      const carnet =
        (details.target_carnet as string | undefined) ||
        log.target_carnet ||
        (oldRow.carnet as string | undefined) ||
        log.resource_id ||
        '';
      return {
        lead: 'eliminó al administrador',
        subject: formatPersonLabel(name, carnet, log.resource_id || ''),
        opBadge,
      };
    }

    // ─── Llaves de escrutinio ───────────────────────────────────────
    case 'scrutiny_key.insert': {
      const electionTitle =
        log.election_title ||
        (details.election_title as string | undefined) ||
        'una elección';
      const holder =
        log.holder_name ||
        (details.holder_name as string | undefined) ||
        null;
      return {
        lead: holder
          ? `asignó una llave de escrutinio a ${holder}`
          : 'asignó una llave de escrutinio',
        subject: `«${electionTitle}»`,
        opBadge: { label: 'Llave asignada', variant: 'event' },
      };
    }
    case 'scrutiny_key.update': {
      const electionTitle =
        log.election_title ||
        (details.election_title as string | undefined) ||
        'una elección';
      const holder =
        log.holder_name ||
        (details.holder_name as string | undefined) ||
        null;
      if (changes.has_submitted === true) {
        return {
          lead: holder
            ? `${holder} entregó su llave de escrutinio`
            : 'se entregó una llave de escrutinio',
          subject: `«${electionTitle}»`,
          opBadge: { label: 'Llave entregada', variant: 'event' },
        };
      }
      return {
        lead: 'actualizó una llave de escrutinio',
        subject: `«${electionTitle}»`,
        opBadge,
      };
    }
    case 'scrutiny.finalize': {
      const electionTitle =
        log.election_title ||
        (details.election_title as string | undefined) ||
        'una elección';
      const submittedRaw = details.submitted_keys;
      const submitted =
        typeof submittedRaw === 'number'
          ? submittedRaw
          : typeof submittedRaw === 'string'
          ? Number(submittedRaw)
          : null;
      return {
        lead: `finalizó el escrutinio de «${electionTitle}»`,
        subject:
          submitted !== null && Number.isFinite(submitted)
            ? `${submitted} llaves entregadas`
            : '',
        opBadge: { label: 'Escrutinio', variant: 'event' },
      };
    }

    // ─── Postulaciones ──────────────────────────────────────────────
    case 'application_form.insert': {
      const title = (newRow.title as string | undefined) || formTitle(log) || '';
      const positionCount = Number(newRow.position_count ?? 0);
      const eligibleCount = Number(newRow.eligible_count ?? 0);
      const positionsSummary =
        typeof newRow.positions_summary === 'string' ? newRow.positions_summary : undefined;
      const voterScope = typeof newRow.voter_scope === 'string' ? newRow.voter_scope : undefined;
      const trailerParts = [
        positionCount > 0 ? `${positionCount} puestos` : null,
        eligibleCount > 0 ? `${eligibleCount} personas convocadas` : null,
        voterScope ? `alcance: ${voterScope}` : null,
        positionsSummary ? `puestos: ${positionsSummary}` : null,
      ].filter(Boolean);
      return {
        lead: 'creó la convocatoria',
        subject: `«${title}»`,
        trailer: trailerParts.length > 0 ? trailerParts.join(' | ') : undefined,
        opBadge,
      };
    }

    case 'application_form.update': {
      const title = formTitle(log) || (newRow.title as string | undefined) || 'sin título';
      const fields = Object.keys(changes).filter((k) => k !== 'updated_at');

      if (fields.length === 1 && fields[0] === 'status') {
        const nuevo = String(changes.status);
        return {
          lead: `cambió la convocatoria «${title}» a`,
          subject: STATUS_LABELS[nuevo] || nuevo,
          opBadge,
        };
      }

      return {
        lead: 'actualizó la convocatoria',
        subject: `«${title}»`,
        trailer:
          fields.length > 0 ? `cambió ${fields.map(fieldLabel).join(', ')}` : undefined,
        opBadge,
      };
    }

    case 'application_form.delete': {
      const title = formTitle(log) || (oldRow.title as string | undefined) || 'sin título';
      return { lead: 'eliminó la convocatoria', subject: `«${title}»`, opBadge };
    }

    case 'application_position.insert':
    case 'application_position.delete': {
      const name = positionName(log, op === 'delete' ? oldRow : newRow) || 'sin nombre';
      const title = formTitle(log);
      return {
        lead: op === 'delete' ? 'quitó el puesto' : 'agregó el puesto',
        subject: `«${name}»`,
        trailer: title ? `en «${title}»` : undefined,
        opBadge,
      };
    }

    case 'application_position.update': {
      const anterior = (previous.name as string | undefined) || undefined;
      const actual = positionName(log, changes) || 'sin nombre';
      const title = formTitle(log);
      return {
        lead: anterior ? `renombró el puesto «${anterior}» a` : 'actualizó el puesto',
        subject: `«${actual}»`,
        trailer: title ? `en «${title}»` : undefined,
        opBadge,
      };
    }

    case 'application.insert':
    case 'application.update':
    case 'application.delete': {
      const persona = formatPersonLabel(log.target_name, log.target_carnet, 'un postulante');
      const title = formTitle(log);
      const puesto = positionName(log, {});
      const destino = [
        puesto ? `al puesto «${puesto}»` : null,
        title ? `de «${title}»` : null,
      ]
        .filter(Boolean)
        .join(' ');

      if (log.action === 'application.delete') {
        return {
          lead: 'eliminó la postulación de',
          subject: persona,
          trailer: destino || undefined,
          opBadge,
        };
      }

      // Solo se auditan los cambios de estado, así que la frase se arma
      // alrededor de la resolución: enviada, aprobada, condicionada…
      const nuevoEstado = typeof changes.status === 'string' ? changes.status : undefined;
      const leads: Record<string, string> = {
        SUBMITTED: 'recibió la postulación de',
        APPROVED: 'aprobó la postulación de',
        CONDITIONED: 'condicionó la postulación de',
        REJECTED: 'denegó la postulación de',
        DRAFT: 'reabrió la postulación de',
      };
      const badges: Record<string, Narrative['opBadge']> = {
        SUBMITTED: { label: 'Enviada', variant: 'create' },
        APPROVED: { label: 'Aprobada', variant: 'create' },
        CONDITIONED: { label: 'Condicionada', variant: 'update' },
        REJECTED: { label: 'Denegada', variant: 'delete' },
        DRAFT: { label: 'Reabierta', variant: 'update' },
      };

      const trailerParts = [destino || null];
      if (nuevoEstado === 'CONDITIONED') {
        const campos = Array.isArray(changes.unlocked_fields)
          ? (changes.unlocked_fields as unknown[]).filter(
              (f): f is string => typeof f === 'string',
            )
          : [];
        if (campos.length > 0) {
          trailerParts.push(`puede corregir: ${campos.map(fieldLabel).join(', ')}`);
        }
        if (typeof changes.correction_deadline === 'string') {
          trailerParts.push(`hasta ${prettyValue('correction_deadline', changes.correction_deadline)}`);
        }
      }

      return {
        lead: (nuevoEstado && leads[nuevoEstado]) || 'actualizó la postulación de',
        subject: persona,
        trailer: trailerParts.filter(Boolean).join(' · ') || undefined,
        opBadge: (nuevoEstado && badges[nuevoEstado]) || opBadge,
      };
    }

    default: {
      // El backend ya redacta una frase para cada evento que conoce; usarla
      // antes de caer al identificador crudo evita que un tipo de evento
      // nuevo aparezca en pantalla como un UUID.
      return {
        lead: log.activityMessage || log.actionLabel || log.action,
        subject: log.activityMessage ? '' : log.resource_id || '',
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
  const [exportOpen, setExportOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button
            type="button"
            className="audit-export-trigger"
            onClick={() => setExportOpen(true)}
          >
            <span aria-hidden="true">{Icon.upload}</span>
            Exportar
          </button>
          <button
            type="button"
            className="audit-export-trigger audit-export-trigger--danger"
            onClick={() => setPurgeOpen(true)}
            style={{
              borderColor: 'rgba(220, 38, 38, 0.35)',
              color: '#B91C1C',
              background: 'rgba(220, 38, 38, 0.06)',
            }}
          >
            <span aria-hidden="true">{Icon.trash ?? Icon.upload}</span>
            Vaciar registros
          </button>
        </div>
      </div>

      {exportOpen && (
        <ExportPanel onClose={() => setExportOpen(false)} />
      )}

      {purgeOpen && (
        <PurgePanel
          onClose={() => setPurgeOpen(false)}
          onPurged={() => {
            setPurgeOpen(false);
            setPage(1);
            fetchLogs();
            apiClient<AuditStatRow[]>(`/api/audit/stats`)
              .then((rows) => setStats(rows))
              .catch(() => {});
          }}
        />
      )}

      {/* ─── Timeline feed ──────────────────────────────────────── */}
      {loading ? (
        <Loader />
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
                    const actorName = log.actor_name?.trim();
                    const actorCarnet = log.actor_carnet?.trim();
                    const actor = actorName || actorCarnet || 'Sistema';
                    const actorTitle = actorName && actorCarnet
                      ? `${actorName} · ${actorCarnet}`
                      : actor;
                    const actorAvatar = actorName
                      ? actorName
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()
                      : (actorCarnet || '?').slice(-2).toUpperCase();
                    const isSystem = !actorName && !actorCarnet;

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
                              title={actorTitle}
                            >
                              {isSystem ? (
                                <>
                                  <span className="audit-actor-icon">{Icon.system}</span>
                                  Sistema
                                </>
                              ) : (
                                <>
                                  <span className="audit-actor-avatar">
                                    {actorAvatar}
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

  if (log.action === 'tag.insert') {
    const row = (getField<Record<string, unknown>>(details, 'new') ?? {}) as Record<string, unknown>;
    const description = typeof row.description === 'string' ? row.description : '';
    const color = typeof row.color === 'string' ? row.color : '';
    const members = Array.isArray(row.members)
      ? row.members.filter((member): member is Record<string, unknown> => Boolean(member) && typeof member === 'object')
      : [];

    return (
      <div className="audit-detail-list">
        <div className="audit-detail-list-row">
          <dt>Nombre</dt>
          <dd>{prettyValue('name', row.name)}</dd>
        </div>
        {description && (
          <div className="audit-detail-list-row">
            <dt>Descripción</dt>
            <dd>{prettyValue('description', description)}</dd>
          </div>
        )}
        {color && (
          <div className="audit-detail-list-row">
            <dt>Color</dt>
            <dd>{prettyValue('color', color)}</dd>
          </div>
        )}
        <div className="audit-detail-list-row">
          <dt>Integrantes</dt>
          <dd>{Number(row.member_count ?? members.length).toLocaleString('es-CR')}</dd>
        </div>
        {members.map((member, index) => {
          const name = typeof member.full_name === 'string' ? member.full_name : 'Persona';
          const carnet = typeof member.carnet === 'string' ? member.carnet : undefined;
          const sede = typeof member.sede === 'string' ? member.sede : undefined;
          const career = typeof member.career === 'string' ? member.career : undefined;
          const parts = [sede, career].filter(Boolean);

          return (
            <div key={`${carnet || name}-${index}`} className="audit-detail-list-row">
              <dt>{index + 1}</dt>
              <dd>
                {formatPersonLabel(name, carnet, 'persona')}
                {parts.length > 0 ? ` - ${parts.join(' | ')}` : ''}
              </dd>
            </div>
          );
        })}
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
    const keys = Object.keys(changes).filter((k) => k !== 'updated_at' && k !== 'email');

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
      'email',
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
        !hidden.has(k) &&
        v !== null &&
        v !== '' &&
        typeof v !== 'object' &&
        // Las llaves foráneas no le dicen nada a quien lee la bitácora: el
        // nombre legible del recurso ya viaja en la narrativa del evento, y
        // el identificador sigue disponible en los datos técnicos.
        !isUuid(v),
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

// ────────────────────────────────────────────────────────────────────────────
// Export + purge panel
// ────────────────────────────────────────────────────────────────────────────

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildAuditQuery(params: {
  from: string;
  to: string;
  selectedCategoryIds: string[];
}): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  // Resolve selected category IDs → resource_types list
  const types = new Set<string>();
  let allSelected = false;
  for (const id of params.selectedCategoryIds) {
    const cat = CATEGORIES.find((c) => c.id === id);
    if (!cat) continue;
    if (cat.id === 'all') {
      allSelected = true;
      break;
    }
    cat.resourceTypes.forEach((t) => types.add(t));
  }
  if (!allSelected && types.size > 0) {
    qs.set('resource_types', Array.from(types).join(','));
  }
  return qs;
}

type ActiveDay = { date: string; count: number };
type RangePreset = 'today' | '7d' | '30d' | 'all';

function formatActiveDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-CR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function isWithinDays(date: string, days: number): boolean {
  const today = todayISO();
  const cutoff = todayISO(-days + 1);
  return date >= cutoff && date <= today;
}

function getPresetRange(
  days: ActiveDay[],
  preset: RangePreset,
): { from: string; to: string } | null {
  if (days.length === 0) {
    return null;
  }

  const earliest = days[days.length - 1].date;
  const latest = days[0].date;

  if (preset === 'all') {
    return { from: earliest, to: latest };
  }

  const window =
    preset === 'today'
      ? days.filter((d) => d.date === todayISO())
      : preset === '7d'
        ? days.filter((d) => isWithinDays(d.date, 7))
        : days.filter((d) => isWithinDays(d.date, 30));

  if (window.length === 0) {
    return { from: latest, to: latest };
  }

  return {
    from: window[window.length - 1].date,
    to: window[0].date,
  };
}

function ExportPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [activeDays, setActiveDays] = useState<ActiveDay[] | null>(null);
  const [activeDaysError, setActiveDaysError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [activePreset, setActivePreset] = useState<RangePreset | null>('all');
  const [format, setFormat] = useState<'xlsx' | 'json'>('xlsx');
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient<ActiveDay[]>('/api/audit/active-days');
        if (cancelled) return;
        setActiveDays(res);
        const fullRange = getPresetRange(res, 'all');
        if (fullRange) {
          setFrom(fullRange.from);
          setTo(fullRange.to);
          setActivePreset('all');
        }
      } catch (err) {
        if (cancelled) return;
        setActiveDaysError(err instanceof Error ? err.message : 'No se pudieron cargar los días con actividad');
        setActiveDays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalEvents = useMemo(
    () => (activeDays ?? []).reduce((acc, d) => acc + d.count, 0),
    [activeDays],
  );

  const applyPreset = (preset: RangePreset) => {
    const range = getPresetRange(activeDays ?? [], preset);
    if (!range) return;
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(preset);
  };

  // Debounced live preview of matching count.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!from || !to) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const qs = buildAuditQuery({ from, to, selectedCategoryIds: selectedCats });
        qs.set('page', '1');
        qs.set('limit', '1');
        const res = await apiClient<AuditResponse>(`/api/audit?${qs.toString()}`);
        setPreviewCount(res.total);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Error al consultar');
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [from, to, selectedCats]);

  const toggleCat = (id: string) => {
    setSelectedCats((prev) => {
      if (id === 'all') return ['all'];
      const without = prev.filter((p) => p !== 'all');
      if (without.includes(id)) {
        const next = without.filter((p) => p !== id);
        return next.length === 0 ? ['all'] : next;
      }
      return [...without, id];
    });
  };

  const datesValid = Boolean(from && to && from <= to);

  const handleExport = async () => {
    if (!datesValid) return;
    setExporting(true);
    setPreviewError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tee_token') : null;
      const qs = buildAuditQuery({ from, to, selectedCategoryIds: selectedCats });
      // El backend sólo conoce csv/json. Para xlsx pedimos JSON y lo construimos en el cliente.
      const backendFormat = format === 'xlsx' ? 'json' : format;
      qs.set('format', backendFormat);

      const res = await fetch(`${buildApiUrl('/api/audit/export')}?${qs.toString()}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const headerCount = parseInt(res.headers.get('X-Audit-Export-Count') ?? '0', 10);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      let blob: Blob;
      let filename: string;
      let count = headerCount;

      if (format === 'xlsx') {
        const payload = await res.json();
        const logs = (Array.isArray(payload) ? payload : payload?.logs ?? []) as AuditLogRow[];
        count = headerCount || logs.length;
        const categoryLabels = selectedCats.includes('all')
          ? ['Todas']
          : selectedCats
              .map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id)
              .filter(Boolean);
        blob = await buildAuditXlsxBlob(logs, {
          from,
          to,
          categories: categoryLabels,
          generatedAt: new Date(),
        });
        filename = `auditoria_${from}_a_${to}_${stamp}.xlsx`;
      } else {
        blob = await res.blob();
        filename = `auditoria_${from}_a_${to}_${stamp}.${format}`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExportCount(count);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="audit-export-overlay" role="dialog" aria-modal="true">
      <div className="audit-export-panel">
        <header className="audit-export-head">
          <h3>Exportar auditoría</h3>
          <button
            type="button"
            className="audit-export-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <p className="audit-export-intro">
          Descarga los eventos del rango y categorías seleccionadas en formato Excel o JSON.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600, marginRight: '0.25rem' }}>
              Rango:
            </span>
            {([
              { id: 'today', label: 'Hoy' },
              { id: '7d', label: 'Últimos 7 días' },
              { id: '30d', label: 'Últimos 30 días' },
              { id: 'all', label: 'Todo el historial' },
            ] as const).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`filter-chip ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset.id)}
                disabled={!activeDays || activeDays.length === 0}
                aria-pressed={activePreset === preset.id}
              >
                {preset.label}
              </button>
            ))}
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Formato:</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'xlsx' | 'json')}
                style={{ padding: '0.375rem 0.5rem', borderRadius: 6, border: '1px solid var(--border, #d4d2cf)' }}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>

          <div
            style={{
              border: '1px solid var(--border, #d4d2cf)',
              borderRadius: 8,
              padding: '0.75rem 0.875rem',
              background: 'var(--surface, #faf9f7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Desde</span>
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setActivePreset(null);
                  }}
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: 6,
                    border: '1px solid var(--border, #d4d2cf)',
                    fontSize: '0.8125rem',
                  }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Hasta</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setActivePreset(null);
                  }}
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: 6,
                    border: '1px solid var(--border, #d4d2cf)',
                    fontSize: '0.8125rem',
                  }}
                />
              </label>
              {from && to && (
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                  {from === to
                    ? formatActiveDayLabel(from)
                    : `${formatActiveDayLabel(from)} → ${formatActiveDayLabel(to)}`}
                </span>
              )}
            </div>

            {activeDaysError ? (
              <span className="audit-export-warn">{activeDaysError}</span>
            ) : activeDays === null ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Cargando actividad…</span>
            ) : activeDays.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                No hay eventos de auditoría registrados todavía.
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {(() => {
                  const inRange = activeDays.filter((d) => from && to && d.date >= from && d.date <= to);
                  const dayCount = inRange.length;
                  const eventCount = inRange.reduce((acc, d) => acc + d.count, 0);
                  return `${dayCount.toLocaleString('es-CR')} día${dayCount === 1 ? '' : 's'} con actividad en el rango · ${eventCount.toLocaleString('es-CR')} evento${eventCount === 1 ? '' : 's'} · Total histórico: ${totalEvents.toLocaleString('es-CR')}`;
                })()}
              </span>
            )}
          </div>
        </div>

        <fieldset className="audit-export-cats">
          <legend>Categorías</legend>
          {CATEGORIES.map((c) => {
            const checked = selectedCats.includes(c.id);
            return (
              <label key={c.id} className="audit-export-cat">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCat(c.id)}
                />
                <span style={{ color: c.tone, background: c.tint }} className="audit-export-cat-chip">
                  {c.label}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="audit-export-preview">
          {!datesValid ? (
            <span className="audit-export-warn">El rango de fechas no es válido.</span>
          ) : previewLoading ? (
            <span>Calculando…</span>
          ) : previewError ? (
            <span className="audit-export-warn">{previewError}</span>
          ) : previewCount !== null ? (
            <>
              <strong>{previewCount.toLocaleString('es-CR')}</strong> evento
              {previewCount === 1 ? '' : 's'} coinciden con estos filtros.
            </>
          ) : null}
        </div>

        <div className="audit-export-actions">
          <button
            type="button"
            className="audit-export-btn primary"
            onClick={handleExport}
            disabled={!datesValid || exporting || previewCount === 0}
          >
            {exporting
              ? 'Exportando…'
              : format === 'xlsx'
                ? 'Descargar Excel (.xlsx)'
                : 'Descargar JSON'}
          </button>
        </div>

        {lastExportCount !== null && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 8,
              background: 'rgba(45, 134, 83, 0.10)',
              color: '#1F6B43',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            Se descargaron {lastExportCount.toLocaleString('es-CR')} evento
            {lastExportCount === 1 ? '' : 's'}. Para borrar registros usa el botón
            <strong> «Vaciar registros»</strong> en la barra de auditoría.
          </div>
        )}
      </div>
    </div>
  );
}

function PurgePanel({
  onClose,
  onPurged,
}: {
  onClose: () => void;
  onPurged: () => void;
}) {
  const [activeDays, setActiveDays] = useState<ActiveDay[] | null>(null);
  const [activeDaysError, setActiveDaysError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [activePreset, setActivePreset] = useState<RangePreset | null>('all');
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [purgeText, setPurgeText] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient<ActiveDay[]>('/api/audit/active-days');
        if (cancelled) return;
        setActiveDays(res);
        const fullRange = getPresetRange(res, 'all');
        if (fullRange) {
          setFrom(fullRange.from);
          setTo(fullRange.to);
          setActivePreset('all');
        }
      } catch (err) {
        if (cancelled) return;
        setActiveDaysError(
          err instanceof Error ? err.message : 'No se pudieron cargar los días con actividad',
        );
        setActiveDays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreset = (preset: RangePreset) => {
    const range = getPresetRange(activeDays ?? [], preset);
    if (!range) return;
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(preset);
  };

  const toggleCat = (id: string) => {
    setSelectedCats((prev) => {
      if (id === 'all') return ['all'];
      const without = prev.filter((p) => p !== 'all');
      if (without.includes(id)) {
        const next = without.filter((p) => p !== id);
        return next.length === 0 ? ['all'] : next;
      }
      return [...without, id];
    });
  };

  const datesValid = Boolean(from && to && from <= to);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!datesValid) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const qs = buildAuditQuery({ from, to, selectedCategoryIds: selectedCats });
        qs.set('page', '1');
        qs.set('limit', '1');
        const res = await apiClient<AuditResponse>(`/api/audit?${qs.toString()}`);
        setPreviewCount(res.total);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Error al consultar');
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [from, to, selectedCats, datesValid]);

  const handlePurge = async () => {
    if (!datesValid) return;
    if (purgeText.trim().toUpperCase() !== 'ELIMINAR') {
      setPurgeError('Escriba ELIMINAR para confirmar.');
      return;
    }
    setPurging(true);
    setPurgeError(null);
    try {
      const qs = buildAuditQuery({ from, to, selectedCategoryIds: selectedCats });
      const res = await apiClient<{ deleted: number }>(`/api/audit?${qs.toString()}`, {
        method: 'DELETE',
      });
      alert(`Se eliminaron ${res.deleted.toLocaleString('es-CR')} eventos de auditoría.`);
      onPurged();
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : 'Error al purgar');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="audit-export-overlay" role="dialog" aria-modal="true">
      <div className="audit-export-panel">
        <header className="audit-export-head">
          <h3 style={{ color: '#B91C1C' }}>Vaciar registros de auditoría</h3>
          <button
            type="button"
            className="audit-export-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <p
          className="audit-export-intro"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 8, padding: '0.625rem 0.875rem', color: '#7F1D1D' }}
        >
          Esta acción es <strong>irreversible</strong>. Eliminará permanentemente los eventos
          que coincidan con el rango y categorías. <strong>Antes de continuar, exporta una
          copia desde el botón «Exportar».</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600, marginRight: '0.25rem' }}>
              Rango:
            </span>
            {(
              [
                { id: 'today', label: 'Hoy' },
                { id: '7d', label: 'Últimos 7 días' },
                { id: '30d', label: 'Últimos 30 días' },
                { id: 'all', label: 'Todo el historial' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`filter-chip ${activePreset === preset.id ? 'active filter-chip-danger-active' : ''}`}
                onClick={() => applyPreset(preset.id)}
                disabled={!activeDays || activeDays.length === 0}
                aria-pressed={activePreset === preset.id}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div
            style={{
              border: '1px solid var(--border, #d4d2cf)',
              borderRadius: 8,
              padding: '0.75rem 0.875rem',
              background: 'var(--surface, #faf9f7)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Desde</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setActivePreset(null);
                }}
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: 6,
                  border: '1px solid var(--border, #d4d2cf)',
                  fontSize: '0.8125rem',
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Hasta</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setActivePreset(null);
                }}
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: 6,
                  border: '1px solid var(--border, #d4d2cf)',
                  fontSize: '0.8125rem',
                }}
              />
            </label>
            {activeDaysError && (
              <span className="audit-export-warn" style={{ marginLeft: 'auto' }}>{activeDaysError}</span>
            )}
          </div>
        </div>

        <fieldset className="audit-export-cats">
          <legend>Categorías</legend>
          {CATEGORIES.map((c) => {
            const checked = selectedCats.includes(c.id);
            return (
              <label key={c.id} className="audit-export-cat">
                <input type="checkbox" checked={checked} onChange={() => toggleCat(c.id)} />
                <span style={{ color: c.tone, background: c.tint }} className="audit-export-cat-chip">
                  {c.label}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="audit-export-preview">
          {!datesValid ? (
            <span className="audit-export-warn">El rango de fechas no es válido.</span>
          ) : previewLoading ? (
            <span>Calculando…</span>
          ) : previewError ? (
            <span className="audit-export-warn">{previewError}</span>
          ) : previewCount !== null ? (
            <>
              Se eliminarán <strong>{previewCount.toLocaleString('es-CR')}</strong> evento
              {previewCount === 1 ? '' : 's'}.
            </>
          ) : null}
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 600 }}>
            Para confirmar, escribe <code>ELIMINAR</code> a continuación:
          </label>
          <input
            type="text"
            className="audit-export-confirm-input"
            placeholder="ELIMINAR"
            value={purgeText}
            onChange={(e) => setPurgeText(e.target.value)}
            autoCapitalize="characters"
          />
          {purgeError && <span className="audit-export-warn">{purgeError}</span>}
        </div>

        <div className="audit-export-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="audit-export-btn danger"
            onClick={handlePurge}
            disabled={
              !datesValid ||
              purging ||
              previewCount === 0 ||
              purgeText.trim().toUpperCase() !== 'ELIMINAR'
            }
          >
            {purging ? 'Eliminando…' : 'Vaciar registros'}
          </button>
        </div>
      </div>
    </div>
  );
}
