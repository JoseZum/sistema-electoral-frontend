/**
 * Suite objetivo: src/components/padron/StudentFilters.tsx
 *
 * Pendiente:
 * - cambios en sede, carrera y texto
 * - emision de filtros al componente padre
 * - limpieza y reseteo de filtros
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import StudentFilters from '@/components/padron/StudentFilters';

describe('StudentFilters', () => {
    const mockOnSearchChange = vi.fn();
    const mockOnSedeChange = vi.fn();
    const mockOnCareerChange = vi.fn();

    const defaultProps = {
        search: '',
        sede: '',
        career: '',
        onSearchChange: mockOnSearchChange,
        onSedeChange: mockOnSedeChange,
        onCareerChange: mockOnCareerChange,
        sedes: ['Central', 'Occidente'],
        careers: ['Ingeniería', 'Derecho'],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders search input', () => {
        render(<StudentFilters {...defaultProps} />);

        expect(
            screen.getByPlaceholderText(/Buscar por carnet o nombre/i)
        ).toBeInTheDocument();
    });

    it('renders sede options', () => {
        render(<StudentFilters {...defaultProps} />);

        expect(screen.getByText('Central')).toBeInTheDocument();
        expect(screen.getByText('Occidente')).toBeInTheDocument();
    });

    it('renders career options', () => {
        render(<StudentFilters {...defaultProps} />);

        expect(screen.getByText('Ingeniería')).toBeInTheDocument();
        expect(screen.getByText('Derecho')).toBeInTheDocument();
    });

    it('calls onSearchChange after debounce', async () => {
        const user = userEvent.setup();

        render(<StudentFilters {...defaultProps} />);

        const input = screen.getByRole('textbox');

        await user.type(input, 'Fabricio');

        await waitFor(
            () => {
                expect(mockOnSearchChange).toHaveBeenCalledWith('Fabricio');
            },
            { timeout: 1000 }
        );
    });

    it('calls onSedeChange when selecting sede', async () => {
        const user = userEvent.setup();

        render(<StudentFilters {...defaultProps} />);

        const select = screen.getByLabelText(/Filtrar por sede/i);

        await user.selectOptions(select, 'Central');

        expect(mockOnSedeChange).toHaveBeenCalledWith('Central');
    });

    it('calls onCareerChange when selecting career', async () => {
        const user = userEvent.setup();

        render(<StudentFilters {...defaultProps} />);

        const select = screen.getByLabelText(/Filtrar por carrera/i);

        await user.selectOptions(select, 'Ingeniería');

        expect(mockOnCareerChange).toHaveBeenCalledWith('Ingeniería');
    });

    it('renders current selected values', () => {
        render(
            <StudentFilters
                {...defaultProps}
                search="Carlos"
                sede="Central"
                career="Derecho"
            />
        );

        expect(
            screen.getByDisplayValue('Central')
        ).toBeInTheDocument();

        expect(
            screen.getByDisplayValue('Derecho')
        ).toBeInTheDocument();
    });

    it('allows clearing sede filter', async () => {
        const user = userEvent.setup();

        render(
            <StudentFilters
                {...defaultProps}
                sede="Central"
            />
        );

        const select = screen.getByLabelText(/Filtrar por sede/i);

        await user.selectOptions(select, '');

        expect(mockOnSedeChange).toHaveBeenCalledWith('');
    });

    it('allows clearing career filter', async () => {
        const user = userEvent.setup();

        render(
            <StudentFilters
                {...defaultProps}
                career="Ingeniería"
            />
        );

        const select = screen.getByLabelText(/Filtrar por carrera/i);

        await user.selectOptions(select, '');

        expect(mockOnCareerChange).toHaveBeenCalledWith('');
    });

    it('cleans previous debounce before new typing', async () => {
        const user = userEvent.setup();

        render(<StudentFilters {...defaultProps} />);

        const input = screen.getByRole('textbox');

        await user.type(input, 'Fab');
        await user.type(input, 'ricio');

        await waitFor(
            () => {
                expect(mockOnSearchChange).toHaveBeenLastCalledWith('Fabricio');
            },
            { timeout: 1000 }
        );
    });
});