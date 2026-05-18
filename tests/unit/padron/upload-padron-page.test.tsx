/**
 * Suite objetivo: src/app/(dashboard)/padron/cargar/page.tsx
 *
 * Pendiente:
 * - render del flujo de carga
 * - seleccion de archivo
 * - envio al backend
 * - resumen posterior a la importacion
 */

/**
 * Suite objetivo: src/app/(dashboard)/padron/cargar/page.tsx
 *
 * Cobertura:
 * - render del flujo de carga
 * - seleccion de archivo
 * - envio al backend
 * - resumen posterior a la importacion
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CargarPadronPage from '@/app/(dashboard)/padron/cargar/page';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiUpload: vi.fn(),
}));

const mockImportResult = {
    total: 100,
    new: 40,
    updated: 30,
    reactivated: 20,
    deactivated: 10,
};

describe('CargarPadronPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders upload page title', () => {
        render(<CargarPadronPage />);

        expect(
            screen.getByText('Cargar padrón estudiantil')
        ).toBeInTheDocument();
    });

    it('renders upload description', () => {
        render(<CargarPadronPage />);

        expect(
            screen.getByText(/Importa el archivo Excel/i)
        ).toBeInTheDocument();
    });

    it('renders drop zone initially', () => {
        render(<CargarPadronPage />);

        expect(
            screen.getByText(/Arrastra el archivo aquí/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Formato aceptado: \.xlsx/i)
        ).toBeInTheDocument();
    });

    it('does not render import result initially', () => {
        render(<CargarPadronPage />);

        expect(
            screen.queryByText(/Resultado de la importación/i)
        ).not.toBeInTheDocument();
    });

    it('uploads selected file to backend', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);

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

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import',
                expect.any(FormData)
            );
        });
    });

    it('shows upload progress while uploading', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);

        apiUploadMock.mockImplementationOnce(
            () =>
                new Promise(() => {
                    // pending promise to keep uploading state active
                })
        );

        const { container } = render(<CargarPadronPage />);

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

        await waitFor(() => {
            expect(
                screen.getByText(/Procesando archivo/i)
            ).toBeInTheDocument();
        });
    });

    it('renders import result after successful upload', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);

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

        await waitFor(() => {
            expect(
                screen.getByText(/Resultado de la importación/i)
            ).toBeInTheDocument();
        });

        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('hides drop zone after successful upload result', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);

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

        await waitFor(() => {
            expect(
                screen.getByText(/Resultado de la importación/i)
            ).toBeInTheDocument();
        });

        expect(
            screen.queryByText(/Arrastra el archivo aquí/i)
        ).not.toBeInTheDocument();
    });

    it('shows error message when upload fails', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockRejectedValueOnce(new Error('Archivo inválido'));

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        const file = new File(['bad-data'], 'padron.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Error al importar')).toBeInTheDocument();
            expect(screen.getByText('Archivo inválido')).toBeInTheDocument();
        });
    });

    it('resets result when clicking upload another file', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);

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

        await waitFor(() => {
            expect(
                screen.getByText(/Resultado de la importación/i)
            ).toBeInTheDocument();
        });

        const resetButton = screen.getByRole('button', {
            name: /Subir otro archivo/i,
        });

        await userEvent.click(resetButton);

        expect(
            screen.queryByText(/Resultado de la importación/i)
        ).not.toBeInTheDocument();

        expect(
            screen.getByText(/Arrastra el archivo aquí/i)
        ).toBeInTheDocument();
    });

    it('renders final preservation message', () => {
        render(<CargarPadronPage />);

        expect(
            screen.getByText(/El padrón anterior NO se borra/i)
        ).toBeInTheDocument();
    });
});