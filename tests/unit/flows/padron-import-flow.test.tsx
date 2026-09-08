/**
 * Flujo de integracion: carga de padron electoral.
 *
 * Cubre el recorrido completo: seleccion del archivo, analisis previo,
 * revision del mapeo de columnas, confirmacion e importacion, mas los
 * caminos de error y el guardia de desactivacion masiva.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CargarPadronPage from '@/app/(dashboard)/padron/cargar/page';
import * as apiClientModule from '@/lib/api-client';
import type { PadronAnalysis } from '@/types/padron';

vi.mock('@/lib/api-client', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api-client')>(
        '@/lib/api-client'
    );
    return {
        ...actual,
        apiUpload: vi.fn(),
    };
});

const mockImportSummary = {
    total: 120,
    new: 50,
    updated: 40,
    reactivated: 20,
    deactivated: 10,
};

const mockAnalysis: PadronAnalysis = {
    sheets: [{ index: 0, name: 'Hoja1', rowCount: 120 }],
    sheetIndex: 0,
    headerRowIndex: 3,
    headerRowCandidates: [{ index: 3, score: 60, label: 'carne · nombre · correo' }],
    columns: [
        { index: 0, header: 'carne', label: 'carne', samples: ['2021001234'] },
        { index: 1, header: 'nombre', label: 'nombre', samples: ['GARCIA MORA ANA'] },
        { index: 2, header: 'correo', label: 'correo', samples: ['a.garcia@estudiantec.cr'] },
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
    totalRows: 120,
    validRows: 120,
    invalidRows: 0,
    issues: [],
    preview: [
        {
            Carnet: '2021001234',
            Nombre: 'GARCIA MORA ANA',
            Correo: 'a.garcia@estudiantec.cr',
            Sede: null,
            Carrera: null,
            Grado: 'NO_ESPECIFICADO',
        },
    ],
    diff: mockImportSummary,
    requiresConfirmation: false,
    activeStudents: 10_282,
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

    function selectFile(container: HTMLElement, file = createExcelFile()) {
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });
    }

    async function confirmImport() {
        await waitFor(() => {
            expect(screen.getByText(/Revise cómo se leerá el archivo/i)).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    }

    it('renderiza el flujo inicial de carga', () => {
        render(<CargarPadronPage />);

        expect(screen.getByText('Cargar padrón estudiantil')).toBeInTheDocument();
        expect(screen.getByText(/Arrastra el archivo aquí/i)).toBeInTheDocument();
        expect(screen.getByText(/Formato aceptado: \.xlsx/i)).toBeInTheDocument();
    });

    it('analiza el archivo, muestra el mapeo y al confirmar importa', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import/analyze',
                expect.any(FormData)
            );
        });

        await confirmImport();

        await waitFor(() => {
            expect(screen.getByText('Resultado de la importación')).toBeInTheDocument();
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
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        render(<CargarPadronPage />);

        const dropZone = screen.getByRole('button', {
            name: /Seleccionar archivo Excel del padr[oó]n/i,
        });

        fireEvent.drop(dropZone, { dataTransfer: { files: [createExcelFile()] } });

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import/analyze',
                expect.any(FormData)
            );
        });

        await confirmImport();

        await waitFor(() => {
            expect(screen.getByText('Resultado de la importación')).toBeInTheDocument();
        });
    });

    it('muestra barra de progreso mientras el análisis está pendiente', async () => {
        vi.mocked(apiClientModule.apiUpload).mockImplementationOnce(
            () =>
                new Promise(() => {
                    // Mantiene la promesa pendiente para dejar visible el estado de carga
                })
        );

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(screen.getByText(/Procesando archivo/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/0%/i)).toBeInTheDocument();
    });

    it('muestra error cuando el backend rechaza archivo inválido', async () => {
        vi.mocked(apiClientModule.apiUpload).mockRejectedValueOnce(
            new Error('Archivo inválido')
        );

        const { container } = render(<CargarPadronPage />);
        selectFile(container, createExcelFile('padron-invalido.xlsx'));

        await waitFor(() => {
            expect(screen.getByText('No se pudo importar')).toBeInTheDocument();
            expect(screen.getByText('Archivo inválido')).toBeInTheDocument();
        });

        expect(screen.queryByText('Resultado de la importación')).not.toBeInTheDocument();
    });

    it('muestra error de red cuando falla la carga', async () => {
        vi.mocked(apiClientModule.apiUpload).mockRejectedValueOnce(
            new Error('No se pudo conectar con el servidor.')
        );

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(screen.getByText('No se pudo importar')).toBeInTheDocument();
            expect(
                screen.getByText('No se pudo conectar con el servidor.')
            ).toBeInTheDocument();
        });
    });

    // Un archivo parcial vaciaria el padron: el backend responde 409 y la UI
    // tiene que pedir el visto bueno explicito en vez de dar el import por hecho.
    it('exige confirmación antes de aplicar una desactivación masiva', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockRejectedValueOnce(
            new apiClientModule.ApiError({
                endpoint: '/api/users/students/import',
                message: 'Este archivo desactivaría a 10282 de 10282 estudiantes activos.',
                status: 409,
                code: 'PADRON_IMPORT_NEEDS_CONFIRMATION',
                meta: {
                    total: 1,
                    new: 0,
                    updated: 1,
                    reactivated: 0,
                    deactivated: 10_282,
                    activeStudents: 10_282,
                },
            })
        );
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        const { container } = render(<CargarPadronPage />);
        selectFile(container);
        await confirmImport();

        // Primer intento: frenado, con la advertencia y sin resultado.
        await waitFor(() => {
            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });
        expect(screen.queryByText('Resultado de la importación')).not.toBeInTheDocument();

        // Segundo intento: marcando la casilla, ya pasa.
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));

        await waitFor(() => {
            expect(screen.getByText('Resultado de la importación')).toBeInTheDocument();
        });

        const lastCall = apiUploadMock.mock.calls[apiUploadMock.mock.calls.length - 1];
        const options = JSON.parse((lastCall[1] as FormData).get('options') as string);
        expect(options.confirmDeactivation).toBe(true);
    });

    it('permite reiniciar el flujo después de una importación exitosa', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportSummary);

        const { container } = render(<CargarPadronPage />);
        selectFile(container);
        await confirmImport();

        await waitFor(() => {
            expect(screen.getByText('Resultado de la importación')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: /Subir otro archivo/i }));

        expect(screen.queryByText('Resultado de la importación')).not.toBeInTheDocument();
        expect(screen.getByText(/Arrastra el archivo aquí/i)).toBeInTheDocument();
    });
});
