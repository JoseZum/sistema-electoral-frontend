/**
 * Suite objetivo: src/app/(dashboard)/padron/page.tsx
 *
 * Pendiente:
 * - carga del listado
 * - aplicacion de filtros y paginacion
 * - apertura de acciones sobre estudiantes
 * - estados vacio, loading y error
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PadronPage from '@/app/(dashboard)/padron/page';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiClient: vi.fn(),
}));

vi.mock('@/components/padron/StudentFilters', () => ({
    default: ({
        onSearchChange,
        onSedeChange,
        onCareerChange,
    }: any) => (
        <div>
            <button onClick={() => onSearchChange('Juan')}>
                Buscar Juan
            </button>

            <button onClick={() => onSedeChange('Sede Central')}>
                Cambiar sede
            </button>

            <button onClick={() => onCareerChange('Ingeniería')}>
                Cambiar carrera
            </button>
        </div>
    ),
}));

vi.mock('@/components/padron/StudentTable', () => ({
    default: ({ students, onSaveStudent }: any) => (
        <div>
            <div>Tabla estudiantes</div>

            {students.map((student: any) => (
                <div key={student.id}>{student.full_name}</div>
            ))}

            <button
                onClick={() =>
                    onSaveStudent('1', {
                        full_name: 'Nombre actualizado',
                    })
                }
            >
                Guardar estudiante
            </button>
        </div>
    ),
}));

vi.mock('@/components/padron/Pagination', () => ({
    default: ({ onPageChange }: any) => (
        <button onClick={() => onPageChange(2)}>
            Cambiar página
        </button>
    ),
}));

vi.mock('@/components/Loader', () => ({
    default: () => <div>Loading...</div>,
}));

const mockStudentsResponse = {
    students: [
        {
            id: '1',
            carnet: 'A123456',
            full_name: 'Juan Pérez',
            sede: 'Sede Central',
            career: 'Ingeniería',
            degree_level: 'Licenciatura',
        },
    ],
    total: 1,
};

const mockCatalogResponse = {
    sedes: ['Sede Central'],
    careers: ['Ingeniería'],
};

describe('PadronPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders page title', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValueOnce(mockStudentsResponse)
            .mockResolvedValueOnce(mockCatalogResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(
                screen.getByText('Padrón Estudiantil')
            ).toBeInTheDocument();
        });
    });

    it('loads students on mount', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValueOnce(mockStudentsResponse)
            .mockResolvedValueOnce(mockCatalogResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('/api/users/students?page=1&limit=25')
            );
        });
    });

    it('loads catalog on mount', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValueOnce(mockStudentsResponse)
            .mockResolvedValueOnce(mockCatalogResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                '/api/users/students/catalog'
            );
        });
    });

    it('renders student table data', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValueOnce(mockStudentsResponse)
            .mockResolvedValueOnce(mockCatalogResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });
    });

    it('applies search filters', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValue(mockStudentsResponse)
            .mockResolvedValue(mockCatalogResponse);

        render(<PadronPage />);

        const searchButton = await screen.findByText('Buscar Juan');

        await userEvent.click(searchButton);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('search=Juan')
            );
        });
    });

    it('applies sede filters', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        const sedeButton = await screen.findByText('Cambiar sede');

        await userEvent.click(sedeButton);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('sede=Sede+Central')
            );
        });
    });

    it('applies career filters', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        const careerButton = await screen.findByText('Cambiar carrera');

        await userEvent.click(careerButton);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('career=Ingenier%C3%ADa')
            );
        });
    });

    it('handles pagination changes', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        const paginationButton = await screen.findByText('Cambiar página');

        await userEvent.click(paginationButton);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('page=2')
            );
        });
    });

    it('calls save student action', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        const saveButton = await screen.findByText('Guardar estudiante');

        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(apiClient).toHaveBeenCalledWith(
                '/api/users/students/1',
                expect.objectContaining({
                    method: 'PUT',
                })
            );
        });
    });

    it('shows loading state', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockImplementation(
            () =>
                new Promise(() => {
                    // pending promise
                })
        );

        render(<PadronPage />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('handles empty students state', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient
            .mockResolvedValueOnce({
                students: [],
                total: 0,
            })
            .mockResolvedValueOnce(mockCatalogResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(
                screen.getByText('Tabla estudiantes')
            ).toBeInTheDocument();
        });
    });

    it('handles fetch errors gracefully', async () => {
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => { });

        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockRejectedValue(new Error('Fetch error'));

        render(<PadronPage />);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        consoleSpy.mockRestore();
    });

    it('renders import excel link', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        await waitFor(() => {
            const link = screen.getByRole('link', {
                name: /Importar Excel/i,
            });

            expect(link).toHaveAttribute('href', '/padron/cargar');
        });
    });

    it('renders export button', async () => {
        const apiClient = vi.mocked(apiClientModule.apiClient);

        apiClient.mockResolvedValue(mockStudentsResponse);

        render(<PadronPage />);

        await waitFor(() => {
            expect(
                screen.getByRole('button', {
                    name: /Exportar/i,
                })
            ).toBeInTheDocument();
        });
    });
});