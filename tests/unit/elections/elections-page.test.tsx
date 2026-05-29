/**
 * Suite objetivo: src/app/(dashboard)/elecciones/page.tsx
 *
 * Pendiente:
 * - listado de elecciones
 * - filtros o busquedas si existen
 * - acciones sobre estados
 * - estados vacio, loading y error
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import EleccionesPage from '@/app/(dashboard)/elecciones/page';
import * as apiClientModule from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiClient: vi.fn(),
}));

vi.mock('next/link', () => ({
    default: ({ children, href }: any) => (
        <a href={href}>{children}</a>
    ),
}));

vi.mock('@/components/Loader', () => ({
    default: () => <div>Loading...</div>,
}));

vi.mock('@/components/tags/TagBadge', () => ({
    default: ({ label }: any) => <span>{label}</span>,
}));

vi.mock('@/components/ui/Badge', () => ({
    default: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/lib/tag-colors', () => ({
    resolveTagColor: vi.fn(() => '#000'),
}));

const mockElection1 = {
    id: '1',
    title: 'Elección FEITEC',
    status: 'OPEN',
    total_voters: 100,
    votes_cast: 50,
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2099-01-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    requires_keys: false,
    starts_immediately: false,
    immediate_minutes: null,
    tag_id: 'tag-1',
    tag_name: 'General',
    tag_color: '#ff0000',
};

const mockElection2 = {
    id: '2',
    title: 'Consejo Institucional',
    status: 'DRAFT',
    total_voters: 200,
    votes_cast: 0,
    start_time: '2026-01-02T00:00:00Z',
    end_time: null,
    created_at: '2026-01-02T00:00:00Z',
    requires_keys: false,
    starts_immediately: false,
    immediate_minutes: null,
    tag_id: null,
    tag_name: null,
    tag_color: null,
};

describe('EleccionesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(apiClientModule.apiClient).mockResolvedValue([
            mockElection1,
            mockElection2,
        ]);
    });

    it('renders page title', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(screen.getByText('Votaciones')).toBeInTheDocument();
        });
    });

    it('loads elections on mount', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(apiClientModule.apiClient).toHaveBeenCalledWith(
                '/api/elections'
            );
        });
    });

    it('renders elections list', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(
                screen.getByText('Elección FEITEC')
            ).toBeInTheDocument();

            expect(
                screen.getByText('Consejo Institucional')
            ).toBeInTheDocument();
        });
    });

    it('renders election statuses', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(screen.getByText('Abierta')).toBeInTheDocument();
            expect(screen.getByText('Borrador')).toBeInTheDocument();
        });
    });

    it('renders participation percentage', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(screen.getByText('50%')).toBeInTheDocument();
        });
    });

    it('renders a live countdown for open elections', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(screen.getByText(/Cierra en/i)).toBeInTheDocument();
        });
    });

    it('renders tag badge when election has tag', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(screen.getByText('General')).toBeInTheDocument();
        });
    });

    it('filters elections by status', async () => {
        const user = userEvent.setup();

        render(<EleccionesPage />);

        await waitFor(() => {
            expect(
                screen.getByText('Consejo Institucional')
            ).toBeInTheDocument();
        });

        const draftFilter = screen.getByRole('button', {
            name: /Borrador/i,
        });

        await user.click(draftFilter);

        expect(
            screen.getByText('Consejo Institucional')
        ).toBeInTheDocument();

        expect(
            screen.queryByText('Elección FEITEC')
        ).not.toBeInTheDocument();
    });

    it('shows loading state', () => {
        vi.mocked(apiClientModule.apiClient).mockImplementation(
            () => new Promise(() => { })
        );

        render(<EleccionesPage />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows empty state when there are no elections', async () => {
        vi.mocked(apiClientModule.apiClient).mockResolvedValue([]);

        render(<EleccionesPage />);

        await waitFor(() => {
            expect(
                screen.getByText(/Sin votaciones/i)
            ).toBeInTheDocument();
        });
    });

    it('handles fetch error gracefully', async () => {
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => { });

        vi.mocked(apiClientModule.apiClient).mockRejectedValue(
            new Error('Failed to fetch')
        );

        render(<EleccionesPage />);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        consoleSpy.mockRestore();
    });

    it('renders create election link', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            const link = screen.getByRole('link', {
                name: /Nueva votación/i,
            });

            expect(link).toHaveAttribute(
                'href',
                '/elecciones/crear'
            );
        });
    });

    it('opens delete modal for high severity elections', async () => {
        const user = userEvent.setup();

        const openElection = {
            ...mockElection1,
            status: 'OPEN',
        };

        vi.mocked(apiClientModule.apiClient).mockResolvedValue([
            openElection,
        ]);

        render(<EleccionesPage />);

        await waitFor(() => {
            expect(
                screen.getByText('Elección FEITEC')
            ).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByRole('button', {
            name: /Eliminar votación/i,
        });

        await user.click(deleteButtons[0]);

        expect(
            screen.getByText(/Eliminar votación/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Esta acción es irreversible/i)
        ).toBeInTheDocument();
    });

    it('renders archive buttons', async () => {
        render(<EleccionesPage />);

        await waitFor(() => {
            expect(
                screen.getAllByRole('button', { name: /No disponible/i })
            ).toHaveLength(2);
        });
    });

});
