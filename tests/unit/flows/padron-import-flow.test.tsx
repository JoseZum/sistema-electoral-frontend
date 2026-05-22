/**
 * Flujo de integracion: carga de padron electoral.
 *
 * Pendiente:
 * - simular drag and drop o seleccion de archivo
 * - mockear POST de carga de archivo
 * - verificar barra de progreso y resumen de importacion
 * - cubrir errores de archivo invalido y error de red
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CargarPadronPage from '@/app/(dashboard)/padron/cargar/page';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiUpload: vi.fn(),
}));

const mockImportSummary = {
    total: 120,
    new: 50,
    updated: 40,
    reactivated: 20,
    deactivated: 10,
};

describe('Flujo de integración: carga de padrón electoral', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createExcelFile(name = 'padron.xlsx') {
        return new File(['mock excel content'], name, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
    }

    it('renderiza el flujo inicial de carga', () => {
        render(<CargarPadronPage />);

        expect(
            screen.getByText('Cargar padrón estudiantil')
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Arrastra el archivo aquí/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Formato aceptado: \.xlsx/i)
        ).toBeInTheDocument();
    });

    it('sube archivo seleccionado y muestra resumen de importación', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        const file = createExcelFile();

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

        await waitFor(() => {
            expect(
                screen.getByText('Resultado de la importación')
            ).toBeInTheDocument();
        });

        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();

        expect(screen.getByText('Nuevos')).toBeInTheDocument();
        expect(screen.getByText('Actualizados')).toBeInTheDocument();
        expect(screen.getByText('Reactivados')).toBeInTheDocument();
        expect(screen.getByText('Desactivados')).toBeInTheDocument();
    });

    it('simula drag and drop de archivo y llama al backend', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        render(<CargarPadronPage />);

        const dropZone = screen.getByRole('button', {
            name: /Seleccionar archivo Excel del padron/i,
        });

        const file = createExcelFile();

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
            },
        });

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import',
                expect.any(FormData)
            );
        });

        await waitFor(() => {
            expect(
                screen.getByText('Resultado de la importación')
            ).toBeInTheDocument();
        });
    });

    it('muestra barra de progreso mientras la carga está pendiente', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);

        apiUploadMock.mockImplementationOnce(
            () =>
                new Promise(() => {
                    // Mantiene la promesa pendiente para dejar visible el estado uploading
                })
        );

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        fireEvent.change(input, {
            target: {
                files: [createExcelFile()],
            },
        });

        await waitFor(() => {
            expect(
                screen.getByText(/Procesando archivo/i)
            ).toBeInTheDocument();
        });

        expect(screen.getByText(/0%/)).toBeInTheDocument();
    });

    it('muestra error cuando el backend rechaza archivo inválido', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockRejectedValueOnce(new Error('Archivo inválido'));

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        const invalidFile = createExcelFile('padron-invalido.xlsx');

        fireEvent.change(input, {
            target: {
                files: [invalidFile],
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Error al importar')).toBeInTheDocument();
            expect(screen.getByText('Archivo inválido')).toBeInTheDocument();
        });

        expect(
            screen.queryByText('Resultado de la importación')
        ).not.toBeInTheDocument();
    });

    it('muestra error de red cuando falla la carga', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockRejectedValueOnce(
            new Error('No se pudo conectar con el servidor.')
        );

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        fireEvent.change(input, {
            target: {
                files: [createExcelFile()],
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Error al importar')).toBeInTheDocument();
            expect(
                screen.getByText('No se pudo conectar con el servidor.')
            ).toBeInTheDocument();
        });
    });

    it('permite reiniciar el flujo después de una importación exitosa', async () => {
        const user = userEvent.setup();
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        const { container } = render(<CargarPadronPage />);

        const input = container.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;

        fireEvent.change(input, {
            target: {
                files: [createExcelFile()],
            },
        });

        await waitFor(() => {
            expect(
                screen.getByText('Resultado de la importación')
            ).toBeInTheDocument();
        });

        await user.click(
            screen.getByRole('button', { name: /Subir otro archivo/i })
        );

        expect(
            screen.queryByText('Resultado de la importación')
        ).not.toBeInTheDocument();

        expect(
            screen.getByText(/Arrastra el archivo aquí/i)
        ).toBeInTheDocument();
    });
});