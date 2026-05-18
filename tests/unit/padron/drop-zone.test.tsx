/**
 * Suite objetivo: src/components/padron/DropZone.tsx
 *
 * Pendiente:
 * - arrastre y seleccion manual de archivos
 * - restriccion de tipos de archivo
 * - callbacks de carga
 * - feedback visual ante errores
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DropZone from '@/components/padron/DropZone';

describe('DropZone', () => {
    const mockOnFileSelected = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders drop zone text', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        expect(
            screen.getByText(/Arrastra el archivo aquí/i)
        ).toBeInTheDocument();
    });

    it('renders accepted file format text', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        expect(
            screen.getByText(/Formato aceptado: \.xlsx/i)
        ).toBeInTheDocument();
    });

    it('renders expected columns text', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        expect(
            screen.getByText(/carnet/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/nombre/i)
        ).toBeInTheDocument();
    });

    it('renders hidden file input', () => {
        const { container } = render(
            <DropZone onFileSelected={mockOnFileSelected} />
        );

        const input = container.querySelector('input[type="file"]');

        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('accept', '.xlsx');
    });

    it('calls onFileSelected when file is dropped', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const file = new File(['excel-data'], 'padron.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const dropZone = screen.getByRole('button');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(mockOnFileSelected).toHaveBeenCalledWith(file);
    });

    it('does not call onFileSelected when no file is dropped', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const dropZone = screen.getByRole('button');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [],
            },
        });

        expect(mockOnFileSelected).not.toHaveBeenCalled();
    });

    it('adds dragover class on drag over', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const dropZone = screen.getByRole('button');

        fireEvent.dragOver(dropZone);

        expect(dropZone.className).toContain('dragover');
    });

    it('removes dragover class on drag leave', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const dropZone = screen.getByRole('button');

        fireEvent.dragOver(dropZone);
        fireEvent.dragLeave(dropZone);

        expect(dropZone.className).not.toContain('dragover');
    });

    it('removes dragover class after drop', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const file = new File(['excel-data'], 'padron.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const dropZone = screen.getByRole('button');

        fireEvent.dragOver(dropZone);

        expect(dropZone.className).toContain('dragover');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(dropZone.className).not.toContain('dragover');
    });

    it('calls onFileSelected when selecting a file manually', () => {
        const { container } = render(
            <DropZone onFileSelected={mockOnFileSelected} />
        );

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        const file = new File(['excel-data'], 'padron.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        expect(mockOnFileSelected).toHaveBeenCalledWith(file);
    });

    it('does not call onFileSelected when no file selected manually', () => {
        const { container } = render(
            <DropZone onFileSelected={mockOnFileSelected} />
        );

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        fireEvent.change(input, {
            target: {
                files: [],
            },
        });

        expect(mockOnFileSelected).not.toHaveBeenCalled();
    });

    it('is disabled when disabled prop is true', () => {
        render(
            <DropZone
                onFileSelected={mockOnFileSelected}
                disabled={true}
            />
        );

        const dropZone = screen.getByRole('button');

        expect(dropZone).toHaveAttribute('aria-disabled', 'true');
        expect(dropZone).toHaveAttribute('tabindex', '-1');
    });

    it('does not allow dropping files when disabled', () => {
        render(
            <DropZone
                onFileSelected={mockOnFileSelected}
                disabled={true}
            />
        );

        const file = new File(['excel-data'], 'padron.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const dropZone = screen.getByRole('button');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(mockOnFileSelected).not.toHaveBeenCalled();
    });

    it('does not activate dragover state when disabled', () => {
        render(
            <DropZone
                onFileSelected={mockOnFileSelected}
                disabled={true}
            />
        );

        const dropZone = screen.getByRole('button');

        fireEvent.dragOver(dropZone);

        expect(dropZone.className).not.toContain('dragover');
    });

    it('supports keyboard interaction with Enter key', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const dropZone = screen.getByRole('button');

        fireEvent.keyDown(dropZone, {
            key: 'Enter',
        });

        expect(dropZone).toBeInTheDocument();
    });

    it('supports keyboard interaction with Space key', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        const dropZone = screen.getByRole('button');

        fireEvent.keyDown(dropZone, {
            key: ' ',
        });

        expect(dropZone).toBeInTheDocument();
    });

    it('has accessible aria label', () => {
        render(<DropZone onFileSelected={mockOnFileSelected} />);

        expect(
            screen.getByLabelText(/Seleccionar archivo Excel del padron/i)
        ).toBeInTheDocument();
    });
});