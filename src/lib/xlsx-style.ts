import type { Cell } from 'write-excel-file/browser';

/**
 * Paleta y celdas base de los reportes XLSX del Tribunal.
 *
 * Estaban duplicadas entre el reporte de auditoria y el del padron, con la
 * copia de padron ya divergiendo en el tipo que acepta bodyCell. Si cambia la
 * marca del TEE, cambia aca y sale en los dos reportes.
 */

export const TRIBUNAL_NAVY = '#0F1E40';
export const TRIBUNAL_CREAM = '#FDFAF4';
export const TRIBUNAL_CREAM_DARK = '#F3EFE5';
export const ZEBRA_GREY = '#FAFAF8';
export const BORDER_GREY = '#C4BDB0';
export const MUTED_TEXT = '#6B6557';
export const BODY_TEXT = '#172033';

export function headerCell(value: string): Cell {
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

export function bodyCell(value: string | number | Date, zebra = false): Cell {
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
