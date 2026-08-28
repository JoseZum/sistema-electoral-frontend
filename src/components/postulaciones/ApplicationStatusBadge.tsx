'use client';

import { type ReactNode } from 'react';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { APPLICATION_STATUS_LABELS, FORM_STATUS_LABELS } from '@/lib/postulaciones-fields';
import type { ApplicationFormStatus, ApplicationStatus } from '@/types/postulaciones';

/**
 * El cliente pidió explícitamente los tres colores del semáforo:
 * Aprobado verde, Condicionado amarillo, Denegado rojo.
 */
const STATUS_VARIANTS: Record<ApplicationStatus, BadgeVariant> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  CONDITIONED: 'amber',
  REJECTED: 'red',
};

const STATUS_ICONS: Record<ApplicationStatus, ReactNode> = {
  DRAFT: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  SUBMITTED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  APPROVED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L15.5 9.5" />
    </svg>
  ),
  CONDITIONED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  REJECTED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
};

const FORM_STATUS_VARIANTS: Record<ApplicationFormStatus, BadgeVariant> = {
  DRAFT: 'gray',
  SCHEDULED: 'blue',
  OPEN: 'green',
  CLOSED: 'red',
  ARCHIVED: 'purple',
};

export default function ApplicationStatusBadge({
  status,
  size = 'md',
}: {
  status: ApplicationStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} size={size} icon={STATUS_ICONS[status]} capitalize={false}>
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function FormStatusBadge({
  status,
  size = 'sm',
}: {
  status: ApplicationFormStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Badge variant={FORM_STATUS_VARIANTS[status]} size={size} capitalize={false}>
      {FORM_STATUS_LABELS[status]}
    </Badge>
  );
}
