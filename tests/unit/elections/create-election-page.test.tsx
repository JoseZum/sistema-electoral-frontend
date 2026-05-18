/**
 * Suite objetivo: src/app/(dashboard)/elecciones/crear/page.tsx
 *
 * Pendiente:
 * - validaciones del formulario
 * - gestion de opciones de candidatura
 * - configuracion de fechas y modo inmediato
 * - envio correcto del payload al backend
 * - manejo de respuestas de exito y error
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CrearEleccionPage from '@/app/(dashboard)/elecciones/crear/page';
import { apiClient } from '@/lib/api-client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}));

vi.mock('@/lib/api-client', () => ({
    apiClient: vi.fn(),
}));

vi.mock('@/components/elections/ImmediateStartConfig', () => ({
    default: ({ onChange, startTime, endTime, startsImmediately, durationValue, durationUnit }: any) => (
        <div>
            <label>
                Inicio inmediato
                <input
                    type="checkbox"
                    checked={startsImmediately}
                    onChange={(event) =>
                        onChange({ startsImmediately: event.target.checked })
                    }
                />
            </label>

            <input
                aria-label="Fecha de apertura"
                value={startTime}
                onChange={(event) => onChange({ startTime: event.target.value })}
            />

            <input
                aria-label="Fecha de cierre"
                value={endTime}
                onChange={(event) => onChange({ endTime: event.target.value })}
            />

            <input
                aria-label="Duración inmediata"
                value={durationValue}
                onChange={(event) => onChange({ durationValue: event.target.value })}
            />

            <select
                aria-label="Unidad de duración"
                value={durationUnit}
                onChange={(event) => onChange({ durationUnit: event.target.value })}
            >
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Días</option>
            </select>
        </div>
    ),
    getImmediateDurationMinutes: (value: string, unit: string) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        if (unit === 'hours') return parsed * 60;
        if (unit === 'days') return parsed * 60 * 24;
        return parsed;
    },
    formatImmediateDuration: (value: string, unit: string) =>
        value ? `${value} ${unit}` : null,
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
                        sede: 'Central',
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

describe('CrearEleccionPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pushMock.mockClear();

        class MockIntersectionObserver {
            observe = vi.fn();
            disconnect = vi.fn();
            unobserve = vi.fn();
        }

        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
        Element.prototype.scrollIntoView = vi.fn();

        vi.mocked(apiClient).mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    });

    async function fillBasicValidForm() {
        const user = userEvent.setup();

        await user.type(
            screen.getByLabelText(/Titulo de la votacion/i),
            'Elección estudiantil'
        );

        await user.type(
            screen.getByLabelText(/Descripcion de la votacion/i),
            'Descripción de prueba'
        );

        await user.type(
            screen.getByLabelText(/Nombre de la opcion 1/i),
            'Candidato A'
        );

        await user.type(
            screen.getByLabelText(/Nombre de la opcion 2/i),
            'Candidato B'
        );

        await user.type(
            screen.getByLabelText(/Fecha de apertura/i),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText(/Fecha de cierre/i),
            '2026-06-01T18:00'
        );
    }

    it('renders create election page', async () => {
        render(<CrearEleccionPage />);

        expect(
            screen.getByText('Crear proceso electoral')
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Nueva votación/i)
        ).toBeInTheDocument();
    });

    it('validates required title', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/Escribe un título para la votación/i)
        ).toBeInTheDocument();
    });

    it('validates at least two vote options', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.type(
            screen.getByLabelText(/Titulo de la votacion/i),
            'Elección sin opciones'
        );

        await user.type(
            screen.getByLabelText(/Fecha de apertura/i),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText(/Fecha de cierre/i),
            '2026-06-01T18:00'
        );

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/Agrega al menos 2 opciones de voto/i)
        ).toBeInTheDocument();
    });

    it('validates duplicated vote options', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.type(screen.getByLabelText(/Titulo de la votacion/i), 'Elección');

        await user.type(screen.getByLabelText(/Nombre de la opcion 1/i), 'Lista A');
        await user.type(screen.getByLabelText(/Nombre de la opcion 2/i), 'Lista A');

        await user.type(
            screen.getByLabelText(/Fecha de apertura/i),
            '2026-06-01T08:00'
        );

        await user.type(
            screen.getByLabelText(/Fecha de cierre/i),
            '2026-06-01T18:00'
        );

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/Las opciones de voto no pueden repetirse/i)
        ).toBeInTheDocument();
    });

    it('adds another candidate option', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.click(screen.getByRole('button', { name: /Agregar opción/i }));

        expect(
            screen.getByLabelText(/Nombre de la opcion 3/i)
        ).toBeInTheDocument();
    });

    it('validates scheduled date window', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.type(screen.getByLabelText(/Titulo de la votacion/i), 'Elección');

        await user.type(screen.getByLabelText(/Nombre de la opcion 1/i), 'A');
        await user.type(screen.getByLabelText(/Nombre de la opcion 2/i), 'B');

        await user.type(
            screen.getByLabelText(/Fecha de apertura/i),
            '2026-06-01T18:00'
        );

        await user.type(
            screen.getByLabelText(/Fecha de cierre/i),
            '2026-06-01T08:00'
        );

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/La fecha de cierre debe ser posterior/i)
        ).toBeInTheDocument();
    });

    it('submits correct payload for scheduled full padron election', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }, { id: 'admin-2' }])
            .mockResolvedValueOnce({ id: 'election-1' });

        render(<CrearEleccionPage />);

        await fillBasicValidForm();

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

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
                title: 'Elección estudiantil',
                description: 'Descripción de prueba',
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
                    display_order: 1,
                }),
                expect.objectContaining({
                    label: 'Candidato B',
                    option_type: 'CANDIDATE',
                    display_order: 2,
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

    it('submits immediate election payload', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockResolvedValueOnce({ id: 'election-1' });

        render(<CrearEleccionPage />);

        await user.type(screen.getByLabelText(/Titulo de la votacion/i), 'Elección inmediata');
        await user.type(screen.getByLabelText(/Nombre de la opcion 1/i), 'Sí');
        await user.type(screen.getByLabelText(/Nombre de la opcion 2/i), 'No');

        await user.click(screen.getByLabelText(/Inicio inmediato/i));

        await user.clear(screen.getByLabelText(/Duración inmediata/i));
        await user.type(screen.getByLabelText(/Duración inmediata/i), '2');

        await user.selectOptions(screen.getByLabelText(/Unidad de duración/i), 'hours');

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

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
    });

    it('validates manual voter source without selected students', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await user.type(screen.getByLabelText(/Titulo de la votacion/i), 'Manual');
        await user.type(screen.getByLabelText(/Nombre de la opcion 1/i), 'A');
        await user.type(screen.getByLabelText(/Nombre de la opcion 2/i), 'B');
        await user.type(screen.getByLabelText(/Fecha de apertura/i), '2026-06-01T08:00');
        await user.type(screen.getByLabelText(/Fecha de cierre/i), '2026-06-01T18:00');

        await user.click(screen.getByText('Selección por filtros'));

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/Selecciona al menos una persona del padrón/i)
        ).toBeInTheDocument();
    });

    it('submits manual voter payload when students are selected', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockResolvedValueOnce({ id: 'election-1' });

        render(<CrearEleccionPage />);

        await fillBasicValidForm();

        await user.click(screen.getByText('Selección por filtros'));
        await user.click(screen.getByText('Agregar votante mock'));

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

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

        expect(payload.voter_source).toBe('MANUAL');
        expect(payload.populate).toEqual({
            student_ids: ['student-1'],
        });
    });

    it('validates tag voter source without selected tag', async () => {
        const user = userEvent.setup();

        render(<CrearEleccionPage />);

        await fillBasicValidForm();

        await user.click(screen.getByText('Grupo por tag'));

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText(/Selecciona una tag para la votación/i)
        ).toBeInTheDocument();
    });

    it('submits tag voter payload when tag is selected', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockResolvedValueOnce({ id: 'election-1' });

        render(<CrearEleccionPage />);

        await fillBasicValidForm();

        await user.click(screen.getByText('Grupo por tag'));
        await user.click(screen.getByText('Seleccionar tag mock'));

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

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

        expect(payload.voter_source).toBe('TAG');
        expect(payload.tag_id).toBe('tag-1');
        expect(payload.populate).toEqual({
            tag_id: 'tag-1',
        });
    });

    it('shows backend error when creation fails', async () => {
        const user = userEvent.setup();
        const apiClientMock = vi.mocked(apiClient);

        apiClientMock
            .mockResolvedValueOnce([{ id: 'admin-1' }])
            .mockRejectedValueOnce(new Error('Error del backend'));

        render(<CrearEleccionPage />);

        await fillBasicValidForm();

        await user.click(screen.getByRole('button', { name: /Crear votación/i }));

        expect(
            await screen.findByText('Error del backend')
        ).toBeInTheDocument();

        expect(pushMock).not.toHaveBeenCalled();
    });
});