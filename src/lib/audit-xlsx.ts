import writeXlsxFile, { type Cell, type SheetData } from 'write-excel-file/browser';

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

const TRIBUNAL_NAVY = '#0F1E40';
const TRIBUNAL_CREAM = '#FDFAF4';
const TRIBUNAL_CREAM_DARK = '#F3EFE5';
const ZEBRA_GREY = '#FAFAF8';
const BORDER_GREY = '#C4BDB0';
const MUTED_TEXT = '#6B6557';
const BODY_TEXT = '#172033';

function formatPerson(name?: string | null, carnet?: string | null): string {
  if (name && carnet) return `${name} · ${carnet}`;
  return name ?? carnet ?? '';
}

function pickActor(log: AuditLogRow): string {
  return formatPerson(log.actor_name, log.actor_carnet);
}

function pickTarget(log: AuditLogRow): string {
  return (
    formatPerson(log.target_name, log.target_carnet) ||
    formatPerson(log.holder_name, log.holder_carnet) ||
    log.resource_id ||
    ''
  );
}

function pickMessage(log: AuditLogRow): string {
  if (log.activityMessage) return log.activityMessage;
  return `${log.actionLabel ?? log.action} · ${log.resourceLabel ?? log.resource_type}`;
}

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

function bodyCell(value: string | number | Date, zebra = false): Cell {
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

function summarySheet(logs: AuditLogRow[], meta: AuditXlsxMeta, generatedAt: Date): SheetData {
  const byCategory = new Map<string, number>();
  logs.forEach((log) => {
    const category = log.resourceLabel ?? log.resource_type ?? '—';
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  });

  const title: Cell = {
    value: 'Reporte de auditoría — Tribunal Electoral Estudiantil',
    columnSpan: 2,
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: 'bold',
    textColor: TRIBUNAL_NAVY,
    backgroundColor: TRIBUNAL_CREAM,
    alignVertical: 'center',
    height: 32,
  };
  const subtitle: Cell = {
    value: `Generado el ${generatedAt.toLocaleString('es-CR')}`,
    columnSpan: 2,
    fontFamily: 'Calibri',
    fontSize: 10,
    fontStyle: 'italic',
    textColor: MUTED_TEXT,
  };
  const labelCell = (value: string): Cell => ({
    value,
    fontFamily: 'Calibri',
    fontSize: 10,
    fontWeight: 'bold',
    textColor: MUTED_TEXT,
    alignVertical: 'top',
  });
  const valueCell = (value: string | number): Cell => ({
    value,
    fontFamily: 'Calibri',
    fontSize: 10,
    textColor: BODY_TEXT,
    alignVertical: 'top',
    wrap: true,
  });

  return [
    [title, null],
    [subtitle, null],
    [null, null],
    [labelCell('Rango — desde'), valueCell(meta.from || 'No especificado')],
    [labelCell('Rango — hasta'), valueCell(meta.to || 'No especificado')],
    [labelCell('Categorías'), valueCell(meta.categories.length ? meta.categories.join(', ') : 'Todas')],
    [labelCell('Total de eventos exportados'), valueCell(logs.length)],
    [null, null],
    [headerCell('Categoría'), headerCell('Eventos')],
    ...[...byCategory.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, count], index) => [bodyCell(category, index % 2 === 1), bodyCell(count, index % 2 === 1)]),
  ];
}

function eventsSheet(logs: AuditLogRow[]): SheetData {
  const header = ['Fecha', 'Categoría', 'Acción', 'Actor', 'Objetivo', 'Mensaje', 'Elección', 'IP', 'ID del evento'];
  const rows = logs.map((log, index) => {
    const parsedDate = new Date(log.created_at);
    const dateCell = Number.isNaN(parsedDate.getTime())
      ? bodyCell(log.created_at, index % 2 === 1)
      : { ...bodyCell(parsedDate, index % 2 === 1), format: 'yyyy-mm-dd hh:mm:ss' };
    const zebra = index % 2 === 1;
    return [
      dateCell,
      bodyCell(log.resourceLabel ?? log.resource_type ?? '', zebra),
      bodyCell(log.actionLabel ?? log.action ?? '', zebra),
      bodyCell(pickActor(log) || '—', zebra),
      bodyCell(pickTarget(log) || '—', zebra),
      bodyCell(pickMessage(log), zebra),
      bodyCell(log.election_title ?? '', zebra),
      bodyCell(log.ip_address ?? '', zebra),
      bodyCell(log.id, zebra),
    ];
  });

  if (rows.length === 0) {
    rows.push([
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
      {
        ...bodyCell('No hay eventos que coincidan con los filtros aplicados.', false),
        fontStyle: 'italic',
        textColor: MUTED_TEXT,
        backgroundColor: TRIBUNAL_CREAM_DARK,
      },
      bodyCell('', false),
      bodyCell('', false),
      bodyCell('', false),
    ]);
  }

  return [[...header.map(headerCell)], ...rows];
}

export async function buildAuditXlsxBlob(logs: AuditLogRow[], meta: AuditXlsxMeta): Promise<Blob> {
  const generatedAt = meta.generatedAt ?? new Date();
  const workbook = writeXlsxFile([
    {
      sheet: 'Resumen',
      data: summarySheet(logs, meta, generatedAt),
      columns: [{ width: 32 }, { width: 60 }],
      showGridLines: false,
    },
    {
      sheet: 'Eventos',
      data: eventsSheet(logs),
      columns: [{ width: 22 }, { width: 18 }, { width: 22 }, { width: 30 }, { width: 30 }, { width: 60 }, { width: 30 }, { width: 18 }, { width: 38 }],
      showGridLines: false,
    },
  ]);

  return workbook.toBlob();
}
