import ExcelJS from 'exceljs';

export interface AuditLogRow {
  id: string;
  actor_id?: string | null;
  actor_carnet?: string | null;
  actor_name?: string | null;
  target_name?: string | null;
  target_carnet?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  actionLabel?: string;
  resourceLabel?: string;
  activityMessage?: string;
  election_title?: string | null;
  holder_name?: string | null;
  holder_carnet?: string | null;
}

export interface AuditXlsxMeta {
  from: string;
  to: string;
  categories: string[];
  generatedAt?: Date;
}

const TRIBUNAL_NAVY = 'FF0F1E40';
const TRIBUNAL_CREAM = 'FFFDFAF4';
const TRIBUNAL_CREAM_DARK = 'FFF3EFE5';
const ZEBRA_GREY = 'FFFAFAF8';
const BORDER_GREY = 'FFC4BDB0';
const MUTED_TEXT = 'FF6B6557';

function formatPerson(name?: string | null, carnet?: string | null): string {
  if (name && carnet) return `${name} · ${carnet}`;
  return name ?? carnet ?? '';
}

function pickActor(log: AuditLogRow): string {
  return formatPerson(log.actor_name, log.actor_carnet);
}

function pickTarget(log: AuditLogRow): string {
  const direct = formatPerson(log.target_name, log.target_carnet);
  if (direct) return direct;
  const holder = formatPerson(log.holder_name, log.holder_carnet);
  if (holder) return holder;
  return log.resource_id ?? '';
}

function pickMessage(log: AuditLogRow): string {
  if (log.activityMessage) return log.activityMessage;
  const verb = log.actionLabel ?? log.action;
  const subj = log.resourceLabel ?? log.resource_type;
  return `${verb} · ${subj}`;
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

function safeSheetName(input: string): string {
  return input.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Hoja';
}

export async function buildAuditXlsxBlob(
  logs: AuditLogRow[],
  meta: AuditXlsxMeta,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tribunal Electoral Estudiantil';
  workbook.company = 'Tribunal Electoral Estudiantil';
  workbook.created = meta.generatedAt ?? new Date();

  // ── Hoja "Resumen" ────────────────────────────────────────────────────────
  const summary = workbook.addWorksheet(safeSheetName('Resumen'), {
    properties: { defaultColWidth: 22 },
    views: [{ showGridLines: false, state: 'normal' }],
  });
  summary.columns = [
    { header: 'Campo', key: 'k', width: 32 },
    { header: 'Valor', key: 'v', width: 60 },
  ];

  // Título (merged row)
  summary.mergeCells('A1:B1');
  const titleCell = summary.getCell('A1');
  titleCell.value = 'Reporte de auditoría — Tribunal Electoral Estudiantil';
  titleCell.font = { name: 'Georgia', size: 16, bold: true, color: { argb: TRIBUNAL_NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: TRIBUNAL_CREAM },
  };
  summary.getRow(1).height = 32;

  // Sub-título
  summary.mergeCells('A2:B2');
  const subCell = summary.getCell('A2');
  subCell.value = `Generado el ${(meta.generatedAt ?? new Date()).toLocaleString('es-CR')}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED_TEXT } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Filtros usados
  const filtersRows: Array<[string, string | number]> = [
    ['', ''],
    ['Rango — desde', meta.from || 'No especificado'],
    ['Rango — hasta', meta.to || 'No especificado'],
    ['Categorías', meta.categories.length > 0 ? meta.categories.join(', ') : 'Todas'],
    ['Total de eventos exportados', logs.length],
  ];
  filtersRows.forEach(([k, v]) => {
    const row = summary.addRow({ k, v });
    row.getCell('k').font = { bold: true, color: { argb: MUTED_TEXT }, name: 'Calibri', size: 10 };
    row.getCell('v').font = { name: 'Calibri', size: 10, color: { argb: 'FF172033' } };
    row.getCell('k').alignment = { vertical: 'top' };
    row.getCell('v').alignment = { vertical: 'top', wrapText: true };
  });

  // Espaciado y sección "Eventos por categoría"
  summary.addRow({});
  const catHeaderRow = summary.addRow({ k: 'Categoría', v: 'Eventos' });
  catHeaderRow.getCell('k').font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
  catHeaderRow.getCell('v').font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
  catHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TRIBUNAL_NAVY } };
    cell.alignment = { vertical: 'middle' };
  });

  const byCategory = new Map<string, number>();
  logs.forEach((log) => {
    const key = log.resourceLabel ?? log.resource_type ?? '—';
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  });
  const sortedCats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  sortedCats.forEach(([cat, count]) => {
    const row = summary.addRow({ k: cat, v: count });
    row.getCell('v').alignment = { horizontal: 'right' };
    row.getCell('v').numFmt = '#,##0';
  });

  // ── Hoja "Eventos" ────────────────────────────────────────────────────────
  const events = workbook.addWorksheet(safeSheetName('Eventos'), {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  events.columns = [
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Acción', key: 'accion', width: 22 },
    { header: 'Actor', key: 'actor', width: 30 },
    { header: 'Objetivo', key: 'objetivo', width: 30 },
    { header: 'Mensaje', key: 'mensaje', width: 60 },
    { header: 'Elección', key: 'eleccion', width: 30 },
    { header: 'IP', key: 'ip', width: 18 },
    { header: 'ID del evento', key: 'id', width: 38 },
  ];
  applyHeaderStyle(events.getRow(1));

  logs.forEach((log) => {
    const createdAt = (() => {
      const d = new Date(log.created_at);
      return Number.isNaN(d.getTime()) ? log.created_at : d;
    })();
    events.addRow({
      fecha: createdAt,
      categoria: log.resourceLabel ?? log.resource_type ?? '',
      accion: log.actionLabel ?? log.action ?? '',
      actor: pickActor(log) || '—',
      objetivo: pickTarget(log) || '—',
      mensaje: pickMessage(log),
      eleccion: log.election_title ?? '',
      ip: log.ip_address ?? '',
      id: log.id,
    });
  });

  // Date formatting for the "fecha" column
  events.getColumn('fecha').numFmt = 'yyyy-mm-dd hh:mm:ss';

  const lastRow = events.rowCount;
  if (lastRow > 1) {
    applyBodyZebra(events, 2, lastRow);
  }

  // AutoFilter sobre las columnas
  events.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: events.columnCount },
  };

  // Misma cosa para summary
  summary.getColumn('k').width = 32;
  summary.getColumn('v').width = 60;

  // Empty state
  if (logs.length === 0) {
    const emptyRow = events.addRow({
      fecha: '',
      categoria: '',
      accion: '',
      actor: '',
      objetivo: '',
      mensaje: 'No hay eventos que coincidan con los filtros aplicados.',
      eleccion: '',
      ip: '',
      id: '',
    });
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
