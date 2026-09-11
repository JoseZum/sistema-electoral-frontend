import writeXlsxFile, { type Cell, type SheetData } from 'write-excel-file/browser';
import {
  BODY_TEXT,
  MUTED_TEXT,
  TRIBUNAL_CREAM,
  TRIBUNAL_CREAM_DARK,
  TRIBUNAL_NAVY,
  bodyCell,
  headerCell,
} from './xlsx-style';

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


function formatPerson(name?: string | null, carnet?: string | null): string {
  if (name && carnet) return `${name} · ${carnet}`;
  return name ?? carnet ?? '';
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
      bodyCell(formatPerson(log.actor_name, log.actor_carnet) || '—', zebra),
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
