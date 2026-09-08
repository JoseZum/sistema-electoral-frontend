/**
 * Suite objetivo: src/app/(dashboard)/padron/cargar/page.tsx
 *
 * Cobertura:
 * - render del flujo de carga
 * - seleccion de archivo y analisis previo
 * - confirmacion del mapeo y envio al backend
 * - resumen posterior a la importacion
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

const mockImportResult = {
    total: 100,
    new: 40,
    updated: 30,
    reactivated: 20,
    deactivated: 10,
};

const mockAnalysis: PadronAnalysis = {
    sheets: [{ index: 0, name: 'Hoja1', rowCount: 5 }],
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
};

function selectFile(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['excel-data'], 'padron.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(input, { target: { files: [file] } });
}

/** Sube el archivo, espera la pantalla de mapeo y confirma la importación. */
async function uploadAndConfirm(container: HTMLElement) {
    selectFile(container);

    await waitFor(() => {
        expect(screen.getByText(/Revise cómo se leerá el archivo/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
}

describe('CargarPadronPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders upload page title', () => {
        render(<CargarPadronPage />);

        expect(screen.getByText('Cargar padrón estudiantil')).toBeInTheDocument();
    });

    it('renders upload description', () => {
        render(<CargarPadronPage />);

        expect(screen.getByText(/Suba el archivo Excel/i)).toBeInTheDocument();
    });

    it('renders drop zone initially', () => {
        render(<CargarPadronPage />);

        expect(screen.getByText(/Arrastra el archivo aquí/i)).toBeInTheDocument();
        expect(screen.getByText(/Formato aceptado: \.xlsx/i)).toBeInTheDocument();
    });

    it('does not render import result initially', () => {
        render(<CargarPadronPage />);

        expect(screen.queryByText(/Resultado de la importación/i)).not.toBeInTheDocument();
    });

    // El archivo ya no se aplica al soltarlo: primero se analiza.
    it('analyses the selected file before importing anything', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import/analyze',
                expect.any(FormData)
            );
        });

        expect(apiUploadMock).not.toHaveBeenCalledWith(
            '/api/users/students/import',
            expect.anything(),
            expect.anything()
        );
    });

    it('shows the detected mapping for review', async () => {
        vi.mocked(apiClientModule.apiUpload).mockResolvedValueOnce(mockAnalysis);

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(screen.getByText(/Revise cómo se leerá el archivo/i)).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Campo para la columna carne')).toHaveValue('carnet');
        // El correo aparece en la muestra de la columna y en la vista previa.
        expect(screen.getAllByText('m.brenes.4@estudiantec.cr').length).toBeGreaterThan(0);
    });

    it('shows upload progress while analysing', async () => {
        vi.mocked(apiClientModule.apiUpload).mockImplementationOnce(
            () =>
                new Promise(() => {
                    // pending promise to keep the analysing state active
                })
        );

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(screen.getByText(/Procesando archivo/i)).toBeInTheDocument();
        });
    });

    it('sends the confirmed mapping to the import endpoint', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);
        await uploadAndConfirm(container);

        await waitFor(() => {
            expect(apiUploadMock).toHaveBeenCalledWith(
                '/api/users/students/import',
                expect.any(FormData),
                expect.objectContaining({ suppressErrorDetailLog: true })
            );
        });

        const formData = apiUploadMock.mock.calls[1][1] as FormData;
        expect(JSON.parse(formData.get('options') as string)).toEqual({
            sheetIndex: 0,
            headerRowIndex: 3,
            mapping: { carnet: 0, full_name: 1, email: 2 },
            confirmDeactivation: false,
        });
    });

    it('renders import result after a confirmed import', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);
        await uploadAndConfirm(container);

        await waitFor(() => {
            expect(screen.getByText(/Resultado de la importación/i)).toBeInTheDocument();
        });

        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('hides drop zone after successful upload result', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);
        await uploadAndConfirm(container);

        await waitFor(() => {
            expect(screen.getByText(/Resultado de la importación/i)).toBeInTheDocument();
        });

        expect(screen.queryByText(/Arrastra el archivo aquí/i)).not.toBeInTheDocument();
    });

    it('shows error message when the analysis fails', async () => {
        vi.mocked(apiClientModule.apiUpload).mockRejectedValueOnce(
            new Error('Archivo inválido')
        );

        const { container } = render(<CargarPadronPage />);
        selectFile(container);

        await waitFor(() => {
            expect(screen.getByText('No se pudo importar')).toBeInTheDocument();
            expect(screen.getByText('Archivo inválido')).toBeInTheDocument();
        });
    });

    // El backend revalida el umbral de bajas y puede pedir confirmación aunque
    // el análisis previo no la exigiera.
    it('asks for confirmation when the backend reports a mass deactivation', async () => {
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
                    new: 1,
                    updated: 0,
                    reactivated: 0,
                    deactivated: 10_282,
                    activeStudents: 10_282,
                },
            })
        );

        const { container } = render(<CargarPadronPage />);
        await uploadAndConfirm(container);

        await waitFor(() => {
            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });

        expect(
            screen.getByText(/Este archivo desactivará a la mayor parte del padrón/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/Resultado de la importación/i)).not.toBeInTheDocument();
    });

    // El componente de mapeo no se desmonta entre analisis, asi que su estado
    // local puede quedar describiendo un archivo que ya no es el que se va a
    // importar. Estos tres casos cubren esa desincronizacion.
    describe('sincronización con un análisis nuevo', () => {
        const dosHojas: PadronAnalysis = {
            ...mockAnalysis,
            sheets: [
                { index: 0, name: 'Hoja1', rowCount: 5 },
                { index: 1, name: 'Padrón', rowCount: 90 },
            ],
        };

        // Mismo archivo, otra hoja: columnas en otro orden y mapeo distinto.
        const otraHoja: PadronAnalysis = {
            ...dosHojas,
            sheetIndex: 1,
            headerRowIndex: 0,
            columns: [
                { index: 0, header: 'nombre', label: 'nombre', samples: ['BRENES MOLINA'] },
                { index: 1, header: 'correo', label: 'correo', samples: ['m.brenes.4@estudiantec.cr'] },
                { index: 2, header: 'carne', label: 'carne', samples: ['2024302905'] },
            ],
            mapping: { full_name: 0, email: 1, carnet: 2 },
        };

        it('muestra el mapeo del análisis nuevo, no el anterior', async () => {
            const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
            apiUploadMock.mockResolvedValueOnce(dosHojas);
            apiUploadMock.mockResolvedValueOnce(otraHoja);

            const { container } = render(<CargarPadronPage />);
            selectFile(container);

            await waitFor(() => {
                expect(screen.getByLabelText('Hoja')).toBeInTheDocument();
            });

            fireEvent.change(screen.getByLabelText('Hoja'), { target: { value: '1' } });

            await waitFor(() => {
                expect(screen.getByLabelText('Campo para la columna carne')).toHaveValue('carnet');
            });
            // Con el estado viejo, la columna 0 seguiria marcada como carnet.
            expect(screen.getByLabelText('Campo para la columna nombre')).toHaveValue('full_name');
            expect(screen.getByLabelText('Campo para la columna correo')).toHaveValue('email');
        });

        it('vuelve a pedir la confirmación de bajas tras recalcular', async () => {
            const masiva: PadronAnalysis = {
                ...dosHojas,
                diff: { total: 1, new: 1, updated: 0, reactivated: 0, deactivated: 10_000 },
                requiresConfirmation: true,
            };
            const masivaOtroDiff: PadronAnalysis = {
                ...otraHoja,
                diff: { total: 1, new: 1, updated: 0, reactivated: 0, deactivated: 9_000 },
                requiresConfirmation: true,
            };

            const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
            apiUploadMock.mockResolvedValueOnce(masiva);
            apiUploadMock.mockResolvedValueOnce(masivaOtroDiff);

            const { container } = render(<CargarPadronPage />);
            selectFile(container);

            await waitFor(() => {
                expect(screen.getByRole('checkbox')).toBeInTheDocument();
            });

            // El admin acepta 10 000 bajas...
            await userEvent.click(screen.getByRole('checkbox'));
            expect(screen.getByRole('button', { name: 'Confirmar e importar' })).toBeEnabled();

            // ...y despues cambia de hoja, con lo que el diff pasa a ser otro.
            fireEvent.change(screen.getByLabelText('Hoja'), { target: { value: '1' } });

            await waitFor(() => {
                expect(screen.getByRole('checkbox')).not.toBeChecked();
            });
            expect(screen.getByRole('button', { name: 'Confirmar e importar' })).toBeDisabled();
        });

        it('no muestra el banner de error cuando el backend solo pide confirmación', async () => {
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
                        new: 1,
                        updated: 0,
                        reactivated: 0,
                        deactivated: 10_282,
                        activeStudents: 10_282,
                    },
                })
            );

            const { container } = render(<CargarPadronPage />);
            await uploadAndConfirm(container);

            await waitFor(() => {
                expect(screen.getByRole('checkbox')).toBeInTheDocument();
            });
            // Pedir confirmacion no es un fallo.
            expect(screen.queryByText('No se pudo importar')).not.toBeInTheDocument();
        });
    });

    it('resets result when clicking upload another file', async () => {
        const apiUploadMock = vi.mocked(apiClientModule.apiUpload);
        apiUploadMock.mockResolvedValueOnce(mockAnalysis);
        apiUploadMock.mockResolvedValueOnce(mockImportResult);

        const { container } = render(<CargarPadronPage />);
        await uploadAndConfirm(container);

        await waitFor(() => {
            expect(screen.getByText(/Resultado de la importación/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: /Subir otro archivo/i }));

        expect(screen.queryByText(/Resultado de la importación/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Arrastra el archivo aquí/i)).toBeInTheDocument();
    });

    it('renders final preservation message', () => {
        render(<CargarPadronPage />);

        expect(screen.getByText(/El padrón anterior NO se borra/i)).toBeInTheDocument();
    });
});
