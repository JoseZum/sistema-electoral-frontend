/**
 * Flujo de integracion: creacion de elecciones desde el dashboard.
 *
 * Pendiente:
 * - renderizar la pagina de creacion de elecciones
 * - completar formulario con opciones y configuracion de fechas
 * - cubrir publicacion inmediata y programada
 * - mockear llamadas al backend
 * - verificar estados de exito y errores de validacion
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import CrearEleccionPage from '@/app/(dashboard)/elecciones/crear/page';
import * as apiClientModule from '@/lib/api-client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}));

vi.mock('@/lib/api-client', () => ({
    apiClient: vi.fn(),
}));

vi.mock('@/components/tags/TagSelector', () => ({
    default: ({ onChange }: any) => (
        <button type="button" onClick={() => onChange('tag-1')}>
            Seleccionar tag mock
        </button>
    ),
}));

vi.mock('@/components/tags/TagMembersEditor', () => ({
    default: ({ onChange }: any) => (
        <button
            type="button"
            onClick={() =>
                onChange([
                    {
                        id: 'student-1',
                        carnet: 'A001',
                        full_name: 'Juan Pérez',
                        sede: 'Cartago',
                        career: 'Ingeniería',
                        degree_level: 'Bachillerato',
                        is_active: true,
                    },
                ])
            }
        >
            Agregar votante mock
        </button>
    ),
}));

describe('Flujo de integración: creación de elecciones', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pushMock.mockClear();

        // Las fechas hardcodeadas (2026-06-01) deben mantenerse en el futuro respecto al "ahora" del
        // test; fakeamos solo Date para no afectar los timers de userEvent.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-05-15T08:00:00'));

        class MockIntersectionObserver {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        }

        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
        Element.prototype.scrollIntoView = vi.fn();

        vi.mocked(apiClientModule.apiClient).mockResolvedValue([
            { id: 'admin-1' },
            { id: 'admin-2' },
            { id: 'admin-3' },
        ]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function fillBaseForm() {
        const user = userEvent.setup();

        await user.type(
            screen.getByLabelText(/t[íi]tulo\ de\ la\ votaci[oó]n/i),
            'Elección de integración'
        );

        await user.type(
            screen.getByLabelText(/Descripci[oó]n de la votaci[oó]n/i),
            'Prueba de integración desde el dashboard'
        );

        await user.type(
            screen.getByLabelText(/Nombre de la opci[oó]n 1/i),
            'Candidato A'
        );

        const expandOption2 = screen.getByRole('button', {
            name: /Editar (opci[oó]n|cargo de elecci[oó]n) 2\b/i,
        });
        await user.click(expandOption2);

        await user.type(
            screen.getByLabelText(/Nombre de la opci[oó]n 2/i),
            'Candidato B'
        );
    }

    it('renderiza la página de creación de elecciones', async () => {
        render(<CrearEleccionPage />);

        expect(
            screen.getByText('Crear proceso electoral')
        ).toBeInTheDocument();

        expect(screen.getByText('Nueva votación')).toBeInTheDocument();

        expect(
            screen.getByLabelText(/t[íi]tulo\ de\ la\ votaci[oó]n/i)
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(apiClientModule.apiClient).toHaveBeenCalledWith('/api/users/admins');
        });
    });

    it('muestra error de validación si se intenta crear sin título', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.click(
            screen.getByRole('button', { name: /Crear votación/i })
        );

        expect(
            await screen.findByText('Escribe un título para la votación')
        ).toBeInTheDocument();
    });

    it('muestra error si faltan opciones de voto', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.type(
            screen.getByLabelText(/t[íi]tulo\ de\ la\ votaci[oó]n/i),
            'Elección incompleta'
        );

        await user.type(
            screen.getByLabelText('Fecha y hora de apertura'),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText('Fecha y hora de cierre'),
            '2026-06-01T18:00'
        );

        await user.click(
            screen.getByRole('button', { name: /Crear votación/i })
        );

        expect(
            await screen.findByText('Agrega al menos 2 opciones de voto')
        ).toBeInTheDocument();
    });

    it('crea una elección programada y envía el payload correcto', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClientModule.apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }, { id: 'admin-2' }])
            .mockResolvedValueOnce({ id: 'election-1' });

        render(<CrearEleccionPage />);

        await fillBaseForm();

        await user.type(
            screen.getByLabelText('Fecha y hora de apertura'),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText('Fecha y hora de cierre'),
            '2026-06-01T18:00'
        );

        await user.click(
            screen.getByRole('button', { name: /Crear votación/i })
        );

        await waitFor(() => {
            expect(apiClientMock).toHaveBeenCalledWith(
                '/api/elections',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(String),
                })
            );
        });

        const postCall = apiClientMock.mock.calls.find(
            (call) => call[0] === '/api/elections'
        );

        const payload = JSON.parse((postCall?.[1] as RequestInit).body as string);

        expect(payload).toEqual(
            expect.objectContaining({
                title: 'Elección de integración',
                description: 'Prueba de integración desde el dashboard',
                voter_source: 'FULL_PADRON',
                starts_immediately: false,
                start_time: '2026-06-01T08:00',
                end_time: '2026-06-01T18:00',
                requires_keys: false,
                min_keys: 1,
                allow_suboptions: false,
                status: 'AUTO',
            })
        );

        expect(payload.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    label: 'Candidato A',
                    option_type: 'CANDIDATE',
                }),
                expect.objectContaining({
                    label: 'Candidato B',
                    option_type: 'CANDIDATE',
                }),
                expect.objectContaining({
                    label: 'Voto en blanco',
                    option_type: 'BLANK',
                }),
                expect.objectContaining({
                    label: 'Voto nulo',
                    option_type: 'NULL_VOTE',
                }),
            ])
        );

        expect(pushMock).toHaveBeenCalledWith('/elecciones');
    });

    it('crea una elección inmediata y calcula duración en minutos', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClientModule.apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockResolvedValueOnce({ id: 'election-2' });

        render(<CrearEleccionPage />);

        await fillBaseForm();

        await user.click(
            screen.getByRole('button', { name: /Iniciar cuando se cree/i })
        );

        await user.selectOptions(
            screen.getByLabelText(/^Duraci[oó]n de la votaci[oó]n inmediata$/i),
            '2'
        );

        await user.selectOptions(
            screen.getByLabelText(/^Unidad de duraci[oó]n de la votaci[oó]n inmediata$/i),
            'hours'
        );

        await user.click(
            screen.getByRole('button', { name: /Crear votación/i })
        );

        await waitFor(() => {
            expect(apiClientMock).toHaveBeenCalledWith(
                '/api/elections',
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        const postCall = apiClientMock.mock.calls.find(
            (call) => call[0] === '/api/elections'
        );

        const payload = JSON.parse((postCall?.[1] as RequestInit).body as string);

        expect(payload.starts_immediately).toBe(true);
        expect(payload.immediate_minutes).toBe(120);
        expect(payload.start_time).toBeUndefined();
        expect(payload.end_time).toBeUndefined();

        expect(pushMock).toHaveBeenCalledWith('/elecciones');
    });

    it('muestra error si el backend falla al crear la elección', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClientModule.apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockRejectedValueOnce(new Error('No se pudo crear la votación'));

        render(<CrearEleccionPage />);

        await fillBaseForm();

        await user.type(
            screen.getByLabelText('Fecha y hora de apertura'),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText('Fecha y hora de cierre'),
            '2026-06-01T18:00'
        );

        await user.click(
            screen.getByRole('button', { name: /Crear votación/i })
        );

        expect(
            await screen.findByText('No se pudo crear la votación')
        ).toBeInTheDocument();

        expect(pushMock).not.toHaveBeenCalled();
    });
});