import writeXlsxFile, { type Cell, type SheetData } from 'write-excel-file/browser';
import {
  MUTED_TEXT,
  TRIBUNAL_CREAM,
  TRIBUNAL_CREAM_DARK,
  TRIBUNAL_NAVY,
  bodyCell,
  headerCell,
} from './xlsx-style';

export interface PadronStudentRow {
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
  degree_level: string;
}

export interface PadronXlsxMeta {
  search?: string;
  sede?: string;
  career?: string;
  generatedAt?: Date;
}

function createPadronSheet(students: PadronStudentRow[], meta: PadronXlsxMeta, generatedAt: Date): SheetData {
  const filterParts: string[] = [];
  if (meta.search) filterParts.push(`búsqueda "${meta.search}"`);
  if (meta.sede) filterParts.push(`sede ${meta.sede}`);
  if (meta.career) filterParts.push(`carrera ${meta.career}`);
  const filterText = filterParts.length ? filterParts.join(' · ') : 'sin filtros';

  const title: Cell = {
    value: 'Padrón estudiantil — Tribunal Electoral Estudiantil',
    columnSpan: 6,
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: 'bold',
    textColor: TRIBUNAL_NAVY,
    backgroundColor: TRIBUNAL_CREAM,
    alignVertical: 'center',
    height: 30,
  };
  const subtitle: Cell = {
    value: `Generado el ${generatedAt.toLocaleString('es-CR')} · ${students.length.toLocaleString('es-CR')} estudiantes · ${filterText}`,
    columnSpan: 6,
    fontFamily: 'Calibri',
    fontSize: 10,
    fontStyle: 'italic',
    textColor: MUTED_TEXT,
  };

  const rows = students.map((student, index) => {
    const zebra = index % 2 === 1;
    return [
      bodyCell(student.carnet ?? '', zebra),
      bodyCell(student.full_name ?? '', zebra),
      bodyCell(student.email ?? '', zebra),
      bodyCell(student.sede ?? '', zebra),
      bodyCell(student.career ?? '', zebra),
      bodyCell(student.degree_level ?? '', zebra),
    ];
  });

  if (rows.length === 0) {
    rows.push([
      bodyCell('', false),
      {
        ...bodyCell('No hay estudiantes que coincidan con los filtros aplicados.', false),
        fontStyle: 'italic',
        textColor: MUTED_TEXT,
        backgroundColor: TRIBUNAL_CREAM_DARK,
      },
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
    ]);
  }

  return [
    [title, null, null, null, null, null],
    [subtitle, null, null, null, null, null],
    [null, null, null, null, null, null],
    ['Carnet', 'Nombre completo', 'Correo', 'Sede', 'Carrera', 'Grado'].map(headerCell),
    ...rows,
  ];
}

export async function buildPadronXlsxBlob(
  students: PadronStudentRow[],
  meta: PadronXlsxMeta = {},
): Promise<Blob> {
  const generatedAt = meta.generatedAt ?? new Date();
  const workbook = writeXlsxFile(createPadronSheet(students, meta, generatedAt), {
    sheet: 'Padrón',
    columns: [{ width: 16 }, { width: 34 }, { width: 30 }, { width: 22 }, { width: 34 }, { width: 20 }],
    showGridLines: false,
  });

  return workbook.toBlob();
}
