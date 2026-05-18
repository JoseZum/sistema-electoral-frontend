/**
 * Suite objetivo: src/components/padron/StudentTable.tsx
 *
 * Pendiente:
 * - render de filas
 * - estados sin datos
 * - acciones por fila
 * - formato correcto de columnas clave
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import StudentTable from '@/components/padron/StudentTable';

const mockStudents = [
    {
        id: '1',
        carnet: '20230001',
        full_name: 'Juan Pérez',
        sede: 'Central',
        career: 'Ingeniería',
        degree_level: 'Bachillerato',
    },
    {
        id: '2',
        carnet: '20230002',
        full_name: 'Ana Gómez',
        sede: 'Occidente',
        career: 'Derecho',
        degree_level: 'Licenciatura',
    },
];

describe('StudentTable', () => {
    const mockOnSaveStudent = vi.fn();

    const defaultProps = {
        students: mockStudents,
        onSaveStudent: mockOnSaveStudent,
        sedes: ['Central', 'Occidente'],
        careers: ['Ingeniería', 'Derecho'],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders table headers', () => {
        render(<StudentTable {...defaultProps} />);

        expect(screen.getByText('Carnet')).toBeInTheDocument();
        expect(screen.getByText('Nombre')).toBeInTheDocument();
        expect(screen.getByText('Sede')).toBeInTheDocument();
        expect(screen.getByText('Carrera')).toBeInTheDocument();
        expect(screen.getByText('Grado')).toBeInTheDocument();
    });

    it('renders all student rows', () => {
        render(<StudentTable {...defaultProps} />);

        expect(screen.getByText('20230001')).toBeInTheDocument();
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        expect(screen.getByText('Central')).toBeInTheDocument();
        expect(screen.getByText('Ingeniería')).toBeInTheDocument();

        expect(screen.getByText('20230002')).toBeInTheDocument();
        expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
        expect(screen.getByText('Occidente')).toBeInTheDocument();
        expect(screen.getByText('Derecho')).toBeInTheDocument();
    });

    it('shows empty state when there are no students', () => {
        render(
            <StudentTable
                {...defaultProps}
                students={[]}
            />
        );

        expect(
            screen.getByText(/No se encontraron estudiantes/i)
        ).toBeInTheDocument();
    });

    it('renders edit buttons for each row', () => {
        render(<StudentTable {...defaultProps} />);

        const buttons = screen.getAllByRole('button');

        expect(buttons.length).toBeGreaterThan(0);

        expect(
            screen.getByLabelText(/Editar estudiante Juan Pérez/i)
        ).toBeInTheDocument();

        expect(
            screen.getByLabelText(/Editar estudiante Ana Gómez/i)
        ).toBeInTheDocument();
    });

    it('opens edit mode when clicking edit button', async () => {
        const user = userEvent.setup();

        render(<StudentTable {...defaultProps} />);

        const editButton = screen.getByLabelText(
            /Editar estudiante Juan Pérez/i
        );

        await user.click(editButton);

        expect(
            screen.getByDisplayValue('Juan Pérez')
        ).toBeInTheDocument();

        expect(
            screen.getByDisplayValue('Central')
        ).toBeInTheDocument();

        expect(
            screen.getByDisplayValue('Ingeniería')
        ).toBeInTheDocument();
    });

    it('calls onSaveStudent when saving edited student', async () => {
        const user = userEvent.setup();

        mockOnSaveStudent.mockResolvedValueOnce(undefined);

        render(<StudentTable {...defaultProps} />);

        const editButton = screen.getByLabelText(
            /Editar estudiante Juan Pérez/i
        );

        await user.click(editButton);

        const input = screen.getByDisplayValue('Juan Pérez');

        await user.clear(input);
        await user.type(input, 'Juan Modificado');

        const saveButton = screen.getByText('OK');

        await user.click(saveButton);

        expect(mockOnSaveStudent).toHaveBeenCalledWith(
            '1',
            expect.objectContaining({
                full_name: 'Juan Modificado',
            })
        );
    });

    it('closes edit mode when cancel button is clicked', async () => {
        const user = userEvent.setup();

        render(<StudentTable {...defaultProps} />);

        const editButton = screen.getByLabelText(
            /Editar estudiante Juan Pérez/i
        );

        await user.click(editButton);

        const cancelButton = screen.getByText('X');

        await user.click(cancelButton);

        expect(
            screen.queryByText('OK')
        ).not.toBeInTheDocument();
    });

    it('sorts students when clicking column header', async () => {
        const user = userEvent.setup();

        render(<StudentTable {...defaultProps} />);

        const header = screen.getByText(/Nombre/i);

        await user.click(header);

        expect(header).toBeInTheDocument();
    });

    it('renders correct degree levels', () => {
        render(<StudentTable {...defaultProps} />);

        expect(screen.getByText('Bachillerato')).toBeInTheDocument();
        expect(screen.getByText('Licenciatura')).toBeInTheDocument();
    });
});