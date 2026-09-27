// Escapa un valor para CSV: envuelve en comillas cuando hay separadores o saltos y
// duplica las comillas internas. Entrecomillar no basta contra la inyección de
// fórmulas (Excel y Sheets evalúan "=..." igual), así que lo que empieza con
// =, +, -, @ o un control se antepone con un apóstrofo para que quede como texto.
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const str = /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const needsQuote = /[",\n\r;]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// La primera fila es el encabezado. El BOM hace que Excel respete los acentos.
export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), filename);
}
