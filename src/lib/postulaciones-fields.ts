import type {
  ApplicationFieldKey,
  ApplicationFormStatus,
  ApplicationStatus,
  FileFieldKey,
} from '@/types/postulaciones';

/**
 * Los campos fijos del formulario de postulación, en el orden en que el
 * cliente los listó en la especificación.
 */

export interface TextFieldDef {
  key: Extract<
    ApplicationFieldKey,
    'last_name_1' | 'last_name_2' | 'first_name' | 'email' | 'national_id' | 'carnet' | 'phone'
  >;
  label: string;
  hint?: string;
  /** Solo dígitos: "no guiones ni espacios". */
  numeric?: boolean;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}

export const TEXT_FIELDS: TextFieldDef[] = [
  { key: 'last_name_1', label: 'Apellido 1' },
  { key: 'last_name_2', label: 'Apellido 2' },
  { key: 'first_name', label: 'Nombre' },
  {
    key: 'email',
    label: 'Correo estudiantil',
    hint: 'Se toma de tu sesión institucional y no se puede cambiar',
    inputMode: 'email',
  },
  {
    key: 'national_id',
    label: 'Número de identificación',
    hint: 'Sin guiones ni espacios',
    numeric: true,
    inputMode: 'numeric',
  },
  {
    key: 'carnet',
    label: 'Número de carné',
    hint: 'Sin guiones ni espacios',
    numeric: true,
    inputMode: 'numeric',
  },
  {
    key: 'phone',
    label: 'Número de teléfono',
    hint: 'Sin guiones ni espacios',
    numeric: true,
    inputMode: 'tel',
  },
];

export interface SelectFieldDef {
  key: Extract<ApplicationFieldKey, 'sede' | 'career'>;
  label: string;
  placeholder: string;
}

export const SELECT_FIELDS: SelectFieldDef[] = [
  { key: 'sede', label: 'Sede', placeholder: 'Selecciona tu sede' },
  { key: 'career', label: 'Carrera', placeholder: 'Selecciona tu carrera' },
];

export interface FileFieldDef {
  key: FileFieldKey;
  label: string;
  hint: string;
  /** `other` solo aparece si el admin habilitó documentos adicionales. */
  optional?: boolean;
  multiple?: boolean;
}

export const FILE_FIELDS: FileFieldDef[] = [
  { key: 'enrollment_report', label: 'Informe de matrícula', hint: 'PDF o imagen' },
  { key: 'id_copy', label: 'Copia de la identificación', hint: 'PDF o imagen' },
  { key: 'carnet_copy', label: 'Copia del carné', hint: 'PDF o imagen' },
  { key: 'tdf_letter', label: 'Carta de sanciones del TDF', hint: 'PDF o imagen' },
  { key: 'th_letter', label: 'Carta de sanciones del TH', hint: 'PDF o imagen' },
  {
    key: 'other',
    label: 'Otros documentos',
    hint: 'Puedes adjuntar varios archivos',
    optional: true,
    multiple: true,
  },
];

/** Todas las etiquetas juntas, para mensajes y para la vista de revisión. */
export const FIELD_LABELS: Record<ApplicationFieldKey, string> = {
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.label])),
  ...Object.fromEntries(SELECT_FIELDS.map((f) => [f.key, f.label])),
  ...Object.fromEntries(FILE_FIELDS.map((f) => [f.key, f.label])),
} as Record<ApplicationFieldKey, string>;

/**
 * Campos que el admin puede reabrir al condicionar. El correo queda fuera
 * porque siempre proviene de la sesión de Microsoft.
 */
export const UNLOCKABLE_FIELDS: ApplicationFieldKey[] = [
  ...TEXT_FIELDS.filter((f) => f.key !== 'email').map((f) => f.key),
  ...SELECT_FIELDS.map((f) => f.key),
  ...FILE_FIELDS.map((f) => f.key),
];

export const REQUIRED_FILE_FIELDS: FileFieldKey[] = FILE_FIELDS.filter(
  (f) => !f.optional
).map((f) => f.key);

export const ACCEPTED_FILE_TYPES = 'application/pdf,image/jpeg,image/png,image/webp';
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

// ============================================
// Etiquetas de estado
// ============================================

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviada',
  APPROVED: 'Aprobado',
  CONDITIONED: 'Condicionado',
  REJECTED: 'Denegado',
};

export const FORM_STATUS_LABELS: Record<ApplicationFormStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programado',
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
  ARCHIVED: 'Archivado',
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';

  return new Date(value).toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
