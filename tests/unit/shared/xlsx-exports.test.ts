import { describe, expect, it } from 'vitest';

import { buildAuditXlsxBlob } from '@/lib/audit-xlsx';
import { buildPadronXlsxBlob } from '@/lib/padron-xlsx';

async function readSignature(blob: Blob): Promise<number[]> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });

  return [...new Uint8Array(buffer).slice(0, 2)];
}

describe('XLSX exports', () => {
  it('creates a ZIP-based audit workbook with summary and event data', async () => {
    const blob = await buildAuditXlsxBlob(
      [
        {
          id: 'audit-1',
          action: 'CREATE',
          resource_type: 'election',
          actor_name: 'Ada Lovelace',
          actor_carnet: '20240001',
          created_at: '2026-07-28T12:00:00.000Z',
        },
      ],
      { from: '2026-07-01', to: '2026-07-28', categories: ['Elecciones'] },
    );

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(await readSignature(blob)).toEqual([0x50, 0x4b]);
  });

  it('creates a ZIP-based padrón workbook compatible with the import columns', async () => {
    const blob = await buildPadronXlsxBlob(
      [
        {
          carnet: '20240001',
          full_name: 'Ada Lovelace',
          email: 'ada@estudiantec.cr',
          sede: 'Cartago',
          career: 'Ingeniería en Computación',
          degree_level: 'Bachillerato',
        },
      ],
      { sede: 'Cartago' },
    );

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(await readSignature(blob)).toEqual([0x50, 0x4b]);
  });
});
