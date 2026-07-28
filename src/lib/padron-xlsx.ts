import writeXlsxFile, { type Cell, type SheetData } from 'write-excel-file/browser';

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

const TRIBUNAL_NAVY = '#0F1E40';
const TRIBUNAL_CREAM = '#FDFAF4';
const TRIBUNAL_CREAM_DARK = '#F3EFE5';
const ZEBRA_GREY = '#FAFAF8';
const BORDER_GREY = '#C4BDB0';
const MUTED_TEXT = '#6B6557';
const BODY_TEXT = '#172033';

function headerCell(value: string): Cell {
  return {
    value,
    fontFamily: 'Calibri',
    fontSize: 11,
    fontWeight: 'bold',
    textColor: '#FFFFFF',
    backgroundColor: TRIBUNAL_NAVY,
    alignVertical: 'center',
    bottomBorderColor: TRIBUNAL_NAVY,
    bottomBorderStyle: 'medium',
    leftBorderColor: TRIBUNAL_NAVY,
    leftBorderStyle: 'thin',
    rightBorderColor: TRIBUNAL_NAVY,
    rightBorderStyle: 'thin',
    topBorderColor: TRIBUNAL_NAVY,
    topBorderStyle: 'thin',
    height: 24,
  };
}

function bodyCell(value: string, zebra = false): Cell {
  return {
    value,
    fontFamily: 'Calibri',
    fontSize: 10,
    textColor: BODY_TEXT,
    alignVertical: 'top',
    wrap: true,
    backgroundColor: zebra ? ZEBRA_GREY : undefined,
    bottomBorderColor: BORDER_GREY,
    bottomBorderStyle: 'hair',
    rightBorderColor: BORDER_GREY,
    rightBorderStyle: 'hair',
  };
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
