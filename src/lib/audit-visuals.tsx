import type { ReactNode } from 'react';

// Iconos y colores por tipo de recurso de la auditoría. Los comparten la página de
// auditoría y la actividad reciente del dashboard, para que un mismo evento se vea igual.

export const Icon = {
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

// Per resource visual metadata for the timeline dot
export const RESOURCE_META: Record<
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

export function resourceMeta(resourceType: string) {
  return (
    RESOURCE_META[resourceType] ?? {
      icon: Icon.system,
      label: resourceType,
      tone: 'var(--muted)',
      tint: 'var(--surface-sunken)',
    }
  );
}
