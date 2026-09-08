import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnMapper from '@/components/padron/ColumnMapper';
import type { PadronAnalysis } from '@/types/padron';

function buildAnalysis(overrides: Partial<PadronAnalysis> = {}): PadronAnalysis {
  return {
    sheets: [{ index: 0, name: 'Hoja1', rowCount: 3 }],
    sheetIndex: 0,
    headerRowIndex: 3,
    headerRowCandidates: [{ index: 3, score: 60, label: 'carne · nombre · correo' }],
    columns: [
      { index: 0, header: 'carne', label: 'carne', samples: ['2024302905'] },
      { index: 1, header: 'nombre', label: 'nombre', samples: ['BRENES MOLINA MARCELA'] },
      { index: 2, header: 'correo', label: 'correo', samples: ['m.brenes.4@estudiantec.cr'] },
    ],
    mapping: { carnet: 0, full_name: 1, email: 2 },
    mappingSource: {
      carnet: 'header',
      full_name: 'header',
      email: 'header',
      sede: 'none',
      career: 'none',
      degree_level: 'none',
    },
    missingRequired: [],
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    issues: [],
    preview: [
      {
        Carnet: '2024302905',
        Nombre: 'BRENES MOLINA MARCELA',
        Correo: 'm.brenes.4@estudiantec.cr',
        Sede: null,
        Carrera: null,
        Grado: 'NO_ESPECIFICADO',
      },
    ],
    diff: { total: 1, new: 1, updated: 0, reactivated: 0, deactivated: 0 },
    requiresConfirmation: false,
    activeStudents: 10_282,
    ...overrides,
  };
}

const handlers = {
  onRecalculate: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ColumnMapper', () => {
  it('muestra el mapeo detectado para cada columna', () => {
    render(<ColumnMapper analysis={buildAnalysis()} {...handlers} />);

    expect(screen.getByLabelText('Campo para la columna carne')).toHaveValue('carnet');
    expect(screen.getByLabelText('Campo para la columna nombre')).toHaveValue('full_name');
    expect(screen.getByLabelText('Campo para la columna correo')).toHaveValue('email');
  });

  it('confirma con el mapeo detectado sin tocar nada', () => {
    render(<ColumnMapper analysis={buildAnalysis()} {...handlers} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));

    expect(handlers.onConfirm).toHaveBeenCalledWith({
      sheetIndex: 0,
      headerRowIndex: 3,
      mapping: { carnet: 0, full_name: 1, email: 2 },
      confirmDeactivation: false,
    });
  });

  // Cambiar el mapeo invalida el diff que se calculó con el anterior.
  it('obliga a recalcular después de cambiar una columna', () => {
    render(<ColumnMapper analysis={buildAnalysis()} {...handlers} />);

    fireEvent.change(screen.getByLabelText('Campo para la columna correo'), {
      target: { value: 'sede' },
    });

    expect(screen.getByRole('button', { name: 'Confirmar e importar' })).toBeDisabled();
    expect(screen.getByText(/Recalcule para ver qué efecto tendrá/)).toBeInTheDocument();
  });

  it('libera la columna anterior cuando un campo se reasigna', () => {
    render(<ColumnMapper analysis={buildAnalysis()} {...handlers} />);

    // El correo pasa a leerse de la columna del nombre.
    fireEvent.change(screen.getByLabelText('Campo para la columna nombre'), {
      target: { value: 'email' },
    });

    expect(screen.getByLabelText('Campo para la columna correo')).toHaveValue('');
    expect(screen.getByLabelText('Campo para la columna nombre')).toHaveValue('email');
  });

  it('avisa y bloquea cuando falta un campo obligatorio', () => {
    render(<ColumnMapper analysis={buildAnalysis()} {...handlers} />);

    fireEvent.change(screen.getByLabelText('Campo para la columna carne'), {
      target: { value: '' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Carnet');
    expect(screen.getByRole('button', { name: 'Confirmar e importar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Recalcular' })).toBeDisabled();
  });

  it('vuelve a detectar el mapeo cuando cambia la fila de encabezados', () => {
    render(
      <ColumnMapper
        analysis={buildAnalysis({
          headerRowCandidates: [
            { index: 3, score: 60, label: 'carne · nombre' },
            { index: 0, score: 12, label: 'Reporte' },
          ],
        })}
        {...handlers}
      />
    );

    fireEvent.change(screen.getByLabelText('Fila de encabezados'), { target: { value: '0' } });

    expect(handlers.onRecalculate).toHaveBeenCalledWith({
      sheetIndex: 0,
      headerRowIndex: 0,
      mapping: {},
    });
  });

  describe('desactivación masiva', () => {
    const massive = buildAnalysis({
      diff: { total: 1, new: 1, updated: 0, reactivated: 0, deactivated: 10_282 },
      requiresConfirmation: true,
    });

    it('no deja importar mientras no se marque la confirmación', () => {
      render(<ColumnMapper analysis={massive} {...handlers} />);

      expect(
        screen.getByText(/Este archivo desactivará a la mayor parte del padrón/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar e importar' })).toBeDisabled();
    });

    it('habilita la importación al marcar la casilla', () => {
      render(<ColumnMapper analysis={massive} {...handlers} />);

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));

      expect(handlers.onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ confirmDeactivation: true })
      );
    });
  });

  it('lista las filas descartadas con su motivo', () => {
    render(
      <ColumnMapper
        analysis={buildAnalysis({
          invalidRows: 2,
          issues: [
            { row: 6, reason: 'sin carnet' },
            { row: 9, reason: 'correo inválido (roto)' },
          ],
        })}
        {...handlers}
      />
    );

    expect(screen.getByText('Fila 6: sin carnet')).toBeInTheDocument();
    expect(screen.getByText('Fila 9: correo inválido (roto)')).toBeInTheDocument();
  });
});
