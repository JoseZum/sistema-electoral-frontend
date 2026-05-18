/**
 * Suite objetivo: src/components/padron/EditStudentModal.tsx
 *
 * Pendiente:
 * - render del modal
 * - precarga de datos del estudiante
 * - validacion de campos editables
 * - envio y cierre del modal
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditStudentModal from '@/components/padron/EditStudentModal';

const mockStudent = {
  id: '1',
  carnet: 'A123456',
  full_name: 'Juan Pérez',
  sede: 'Sede Central',
  career: 'Ingeniería',
  degree_level: 'Licenciatura',
};

const mockSedes = ['Sede Central', 'Sede Regional'];
const mockCareers = ['Ingeniería', 'Derecho'];

describe('EditStudentModal', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <table>
        <tbody>
          <tr>
            <EditStudentModal
              student={mockStudent}
              sedes={mockSedes}
              careers={mockCareers}
              onSave={mockOnSave}
              onCancel={mockOnCancel}
            />
          </tr>
        </tbody>
      </table>
    );
  };

  it('renders student information', async () => {
    renderComponent();

    expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Licenciatura')).toBeInTheDocument();
    expect(screen.getByText('A123456')).toBeInTheDocument();
  });

  it('preloads student data into editable fields', async () => {
    renderComponent();

    const nameInput = screen.getByDisplayValue('Juan Pérez');
    const degreeInput = screen.getByDisplayValue('Licenciatura');

    expect(nameInput).toBeInTheDocument();
    expect(degreeInput).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');

    expect(selects[0]).toHaveValue('Sede Central');
    expect(selects[1]).toHaveValue('Ingeniería');
  });

  it('updates editable text fields', async () => {
    renderComponent();

    const nameInput = screen.getByDisplayValue('Juan Pérez');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'María López');

    expect(nameInput).toHaveValue('María López');
  });

  it('updates editable select fields', async () => {
    renderComponent();

    const selects = screen.getAllByRole('combobox');

    await userEvent.selectOptions(selects[0], 'Sede Regional');
    await userEvent.selectOptions(selects[1], 'Derecho');

    expect(selects[0]).toHaveValue('Sede Regional');
    expect(selects[1]).toHaveValue('Derecho');
  });

  it('calls onSave with updated form data', async () => {
    mockOnSave.mockResolvedValueOnce(undefined);

    renderComponent();

    const nameInput = screen.getByDisplayValue('Juan Pérez');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Carlos Ramírez');

    const okButton = screen.getByRole('button', { name: 'OK' });
    await userEvent.click(okButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('1', {
        full_name: 'Carlos Ramírez',
        sede: 'Sede Central',
        career: 'Ingeniería',
        degree_level: 'Licenciatura',
      });
    });
  });

  it('disables save button while saving', async () => {
    mockOnSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 100);
        })
    );

    renderComponent();

    const okButton = screen.getByRole('button', { name: 'OK' });

    await userEvent.click(okButton);

    expect(screen.getByRole('button', { name: '...' })).toBeDisabled();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    renderComponent();

    const cancelButton = screen.getByRole('button', { name: 'X' });

    await userEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows alert when save fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    mockOnSave.mockRejectedValueOnce(new Error('Error guardando'));

    renderComponent();

    const okButton = screen.getByRole('button', { name: 'OK' });

    await userEvent.click(okButton);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Error guardando');
    });

    alertMock.mockRestore();
  });

  it('renders available sede options', async () => {
    renderComponent();

    expect(screen.getByRole('option', { name: 'Sede Central' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sede Regional' })).toBeInTheDocument();
  });

  it('renders available career options', async () => {
    renderComponent();

    expect(screen.getByRole('option', { name: 'Ingeniería' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Derecho' })).toBeInTheDocument();
  });
});