/** Campos del padrón a los que se puede mapear una columna del archivo. */
export type PadronField =
  | 'carnet'
  | 'full_name'
  | 'email'
  | 'sede'
  | 'career'
  | 'degree_level';

export const PADRON_FIELDS: PadronField[] = [
  'carnet',
  'full_name',
  'email',
  'sede',
  'career',
  'degree_level',
];

export const REQUIRED_PADRON_FIELDS: PadronField[] = ['carnet', 'full_name', 'email'];

/**
 * Etiquetas de los campos. `degree_level` se nombra «Grado / dato institucional»
 * porque el padrón del TEC dejó de mandar el grado académico en esa columna y
 * hoy trae la cédula.
 */
export const PADRON_FIELD_LABELS: Record<PadronField, string> = {
  carnet: 'Carnet',
  full_name: 'Nombre completo',
  email: 'Correo',
  sede: 'Sede',
  career: 'Carrera',
  degree_level: 'Grado / dato institucional',
};

export type ColumnMapping = Partial<Record<PadronField, number>>;

export type MappingSource = 'header' | 'content' | 'manual' | 'none';

export interface SheetInfo {
  index: number;
  name: string;
  rowCount: number;
}

export interface DetectedColumn {
  index: number;
  header: string;
  label: string;
  samples: string[];
}

export interface HeaderCandidate {
  index: number;
  score: number;
  label: string;
}

export interface RowIssue {
  row: number;
  reason: string;
}

export interface PadronPreviewRow {
  Carnet: string;
  Nombre: string;
  Correo: string;
  Sede: string | null;
  Carrera: string | null;
  Grado: string;
}

export interface ImportSummary {
  total: number;
  new: number;
  updated: number;
  reactivated: number;
  deactivated: number;
}

export interface PadronAnalysis {
  sheets: SheetInfo[];
  sheetIndex: number;
  headerRowIndex: number;
  headerRowCandidates: HeaderCandidate[];
  columns: DetectedColumn[];
  mapping: ColumnMapping;
  mappingSource: Record<PadronField, MappingSource>;
  missingRequired: PadronField[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: RowIssue[];
  preview: PadronPreviewRow[];
  diff: ImportSummary | null;
  requiresConfirmation: boolean;
  activeStudents: number;
}

export interface PadronImportOptions {
  sheetIndex?: number;
  headerRowIndex?: number;
  mapping?: ColumnMapping;
  confirmDeactivation?: boolean;
}
