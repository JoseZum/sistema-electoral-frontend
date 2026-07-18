import ExcelJS from 'exceljs';

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

const TRIBUNAL_NAVY = 'FF0F1E40';
const TRIBUNAL_CREAM = 'FFFDFAF4';
const TRIBUNAL_CREAM_DARK = 'FFF3EFE5';
const ZEBRA_GREY = 'FFFAFAF8';
const BORDER_GREY = 'FFC4BDB0';
const MUTED_TEXT = 'FF6B6557';

function safeSheetName(input: string): string {
  return input.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Hoja';
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TRIBUNAL_NAVY },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: TRIBUNAL_NAVY } },
      bottom: { style: 'medium', color: { argb: TRIBUNAL_NAVY } },
      left: { style: 'thin', color: { argb: TRIBUNAL_NAVY } },
      right: { style: 'thin', color: { argb: TRIBUNAL_NAVY } },
    };
  });
}

function applyBodyZebra(sheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r += 1) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_GREY } },
        right: { style: 'hair', color: { argb: BORDER_GREY } },
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF172033' } };
      if ((r - startRow) % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ZEBRA_GREY },
        };
      }
    });
  }
}

export async function buildPadronXlsxBlob(
  students: PadronStudentRow[],
  meta: PadronXlsxMeta = {},
): Promise<Blob> {
  const generatedAt = meta.generatedAt ?? new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tribunal Electoral Estudiantil';
  workbook.company = 'Tribunal Electoral Estudiantil';
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(safeSheetName('Padrón'), {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });

  // ── Encabezado / título ────────────────────────────────────────────────────
  // Estructura alineada con la plantilla que espera el import del padrón:
  // fila 1 título, fila 2 subtítulo, fila 3 vacía, fila 4 encabezados, fila 5+ datos.
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Padrón estudiantil — Tribunal Electoral Estudiantil';
  titleCell.font = { name: 'Georgia', size: 16, bold: true, color: { argb: TRIBUNAL_NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TRIBUNAL_CREAM } };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:F2');
  const subCell = sheet.getCell('A2');
  const filterParts: string[] = [];
  if (meta.search) filterParts.push(`búsqueda "${meta.search}"`);
  if (meta.sede) filterParts.push(`sede ${meta.sede}`);
  if (meta.career) filterParts.push(`carrera ${meta.career}`);
  const filterText = filterParts.length > 0 ? filterParts.join(' · ') : 'sin filtros';
  subCell.value = `Generado el ${generatedAt.toLocaleString('es-CR')} · ${students.length.toLocaleString('es-CR')} estudiantes · ${filterText}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED_TEXT } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(3).height = 6;

  // ── Cabecera de la tabla (fila 4) ──────────────────────────────────────────
  // Los nombres de encabezado replican la plantilla del import para el round-trip.
  sheet.columns = [
    { key: 'carnet', width: 16 },
    { key: 'nombre', width: 34 },
    { key: 'correo', width: 30 },
    { key: 'sede', width: 22 },
    { key: 'carrera', width: 34 },
    { key: 'grado', width: 20 },
  ];
  const headerRow = sheet.getRow(4);
  headerRow.values = ['Carnet', 'Nombre completo', 'Correo', 'Sede', 'Carrera', 'Grado'];
  applyHeaderStyle(headerRow);

  students.forEach((student) => {
    sheet.addRow({
      carnet: student.carnet ?? '',
      nombre: student.full_name ?? '',
      correo: student.email ?? '',
      sede: student.sede ?? '',
      carrera: student.career ?? '',
      grado: student.degree_level ?? '',
    });
  });

  const lastRow = sheet.rowCount;
  if (lastRow > 4) {
    applyBodyZebra(sheet, 5, lastRow);
  }

  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 6 } };

  if (students.length === 0) {
    const emptyRow = sheet.addRow(['', 'No hay estudiantes que coincidan con los filtros aplicados.', '', '', '', '']);
    emptyRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: MUTED_TEXT }, name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TRIBUNAL_CREAM_DARK } };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
