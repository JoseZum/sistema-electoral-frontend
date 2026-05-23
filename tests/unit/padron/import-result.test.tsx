/**
 * Suite objetivo: src/components/padron/ImportResult.tsx
 *
 * Pendiente:
 * - render del resumen de importacion
 * - conteos de insertados/actualizados/error
 * - mensajes de feedback al usuario
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImportResult from '@/components/padron/ImportResult';

const mockSummary = {
    total: 120,
    new: 40,
    updated: 50,
    reactivated: 20,
    deactivated: 10,
};

describe('ImportResult', () => {
    const mockOnReset = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders import result title', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(
            screen.getByText('Resultado de la importación')
        ).toBeInTheDocument();
    });

    it('renders completed status badge', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('Completado')).toBeInTheDocument();
    });

    it('renders total processed students', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('120')).toBeInTheDocument();

        expect(
            screen.getByText(/Estudiantes procesados en total/i)
        ).toBeInTheDocument();
    });

    it('renders new students count', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('Nuevos')).toBeInTheDocument();
    });

    it('renders updated students count', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('Actualizados')).toBeInTheDocument();
    });

    it('renders reactivated students count', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('Reactivados')).toBeInTheDocument();
    });

    it('renders deactivated students count', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('Desactivados')).toBeInTheDocument();
    });

    it('calls onReset when clicking upload another file button', async () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        const resetButton = screen.getByRole('button', {
            name: /Subir otro archivo/i,
        });

        await userEvent.click(resetButton);

        expect(mockOnReset).toHaveBeenCalled();
    });

    it('renders link to padron page', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        const link = screen.getByRole('link', {
            name: /Ver padrón/i,
        });

        expect(link).toHaveAttribute('href', '/padron');
    });

    it('formats large numbers correctly', () => {
        const largeSummary = {
            total: 1500,
            new: 1000,
            updated: 300,
            reactivated: 150,
            deactivated: 50,
        };

        render(
            <ImportResult summary={largeSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText(/1[,\s]*500/)).toBeInTheDocument();
        expect(screen.getByText(/1[,\s]*000/)).toBeInTheDocument();
    });

    it('renders all breakdown labels', () => {
        render(
            <ImportResult summary={mockSummary} onReset={mockOnReset} />
        );

        expect(screen.getByText('Nuevos')).toBeInTheDocument();
        expect(screen.getByText('Actualizados')).toBeInTheDocument();
        expect(screen.getByText('Reactivados')).toBeInTheDocument();
        expect(screen.getByText('Desactivados')).toBeInTheDocument();
    });
});
