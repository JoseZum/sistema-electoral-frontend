import { describe, it, expect } from 'vitest';
import {
  FIELD_LABELS,
  FILE_FIELDS,
  REQUIRED_FILE_FIELDS,
  SELECT_FIELDS,
  TEXT_FIELDS,
  UNLOCKABLE_FIELDS,
  formatFileSize,
} from '@/lib/postulaciones-fields';

describe('definicion de campos del formulario', () => {
  it('incluye los siete campos escritos que pidio el cliente', () => {
    expect(TEXT_FIELDS.map((f) => f.key)).toEqual([
      'last_name_1',
      'last_name_2',
      'first_name',
      'email',
      'national_id',
      'carnet',
      'phone',
    ]);
  });

  it('marca como numericos los campos "sin guiones ni espacios"', () => {
    const numeric = TEXT_FIELDS.filter((f) => f.numeric).map((f) => f.key);
    expect(numeric).toEqual(['national_id', 'carnet', 'phone']);
  });

  it('ofrece sede y carrera como listas desplegables', () => {
    expect(SELECT_FIELDS.map((f) => f.key)).toEqual(['sede', 'career']);
  });

  it('define los cinco adjuntos obligatorios y uno opcional', () => {
    expect(REQUIRED_FILE_FIELDS).toEqual([
      'enrollment_report',
      'id_copy',
      'carnet_copy',
      'tdf_letter',
      'th_letter',
    ]);

    const optional = FILE_FIELDS.filter((f) => f.optional).map((f) => f.key);
    expect(optional).toEqual(['other']);
  });

  it('permite varios archivos solo en "otros documentos"', () => {
    const multiple = FILE_FIELDS.filter((f) => f.multiple).map((f) => f.key);
    expect(multiple).toEqual(['other']);
  });

  it('tiene etiqueta en espanol para cada campo', () => {
    const allKeys = [
      ...TEXT_FIELDS.map((f) => f.key),
      ...SELECT_FIELDS.map((f) => f.key),
      ...FILE_FIELDS.map((f) => f.key),
    ];

    for (const key of allKeys) {
      expect(FIELD_LABELS[key]).toBeTruthy();
    }
  });
});

describe('campos desbloqueables al condicionar', () => {
  it('nunca deja desbloquear el correo institucional', () => {
    expect(UNLOCKABLE_FIELDS).not.toContain('email');
  });

  it('incluye el resto de los campos y todos los adjuntos', () => {
    expect(UNLOCKABLE_FIELDS).toContain('last_name_2');
    expect(UNLOCKABLE_FIELDS).toContain('national_id');
    expect(UNLOCKABLE_FIELDS).toContain('sede');
    expect(UNLOCKABLE_FIELDS).toContain('carnet_copy');
    expect(UNLOCKABLE_FIELDS).toContain('other');
  });
});

describe('formatFileSize', () => {
  it('muestra bytes, KB y MB segun el tamano', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(4 * 1024 * 1024)).toBe('4.0 MB');
  });
});
