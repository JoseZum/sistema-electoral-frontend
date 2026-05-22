/**
 * Flujo de integracion: gestion de tags.
 *
 * Pendiente:
 * - listar tags iniciales
 * - crear una tag con miembros
 * - editar nombre, color y miembros
 * - eliminar una tag
 * - verificar mensajes de exito y error
 */

/**
 * Flujo de integracion: gestion de tags.
 *
 * Cobertura:
 * - listar tags iniciales
 * - crear una tag con miembros
 * - editar nombre, color y miembros
 * - eliminar una tag
 * - verificar mensajes de exito y error
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import TagsPage from '@/app/(dashboard)/tags/page';

import * as tagsApiModule from '@/lib/tags-api';

vi.mock('@/lib/tags-api', () => ({
    listTags: vi.fn(),
    getTag: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
}));

vi.mock('@/components/tags/TagMembersEditor', () => ({
    default: ({ value, onChange }: any) => (
        <div>
            <div>Mock Members Editor</div>

            <button
                type="button"
                onClick={() =>
                    onChange([
                        {
                            id: 'student-1',
                            carnet: '20220001',
                            full_name: 'Juan Pérez',
                            sede: 'Cartago',
                            career: 'Computación',
                            degree_level: 'Bachillerato',
                            is_active: true,
                        },
                    ])
                }
            >
                Agregar miembro mock
            </button>

            <div>Miembros actuales: {value.length}</div>
        </div>
    ),
}));

const mockTag = {
    id: 'tag-1',
    name: 'AGE',
    description: 'Tag inicial',
    color: '#C62828',
    member_count: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
};

const mockTagDetail = {
    ...mockTag,
    members: [
        {
            id: 'student-1',
            carnet: '20220001',
            full_name: 'Juan Pérez',
            sede: 'Cartago',
            career: 'Computación',
            degree_level: 'Bachillerato',
            is_active: true,
        },
    ],
};

describe('Flujo de integración: gestión de tags', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        window.confirm = vi.fn(() => true);

        vi.mocked(tagsApiModule.listTags).mockResolvedValue([mockTag]);
        vi.mocked(tagsApiModule.getTag).mockResolvedValue(mockTagDetail);
    });

    it('lista las tags iniciales', async () => {
        render(<TagsPage />);

        await waitFor(() => {
            expect(screen.getByText('AGE')).toBeInTheDocument();
        });

        expect(
            screen.getByText(/1 integrante/i)
        ).toBeInTheDocument();

        expect(tagsApiModule.listTags).toHaveBeenCalled();
    });

    it('crea una nueva tag con miembros', async () => {
        const user = userEvent.setup();

        vi.mocked(tagsApiModule.listTags).mockResolvedValue([]);

        vi.mocked(tagsApiModule.createTag).mockResolvedValue({
            ...mockTag,
            id: 'tag-created',
            name: 'Nueva Tag',
        });

        render(<TagsPage />);

        const nameInput = await screen.findByLabelText(/Nombre/i);

        await user.type(nameInput, 'Nueva Tag');

        await user.type(
            screen.getByLabelText(/Descripción/i),
            'Descripción integración'
        );

        await user.click(
            screen.getByRole('button', {
                name: /Agregar miembro mock/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: /Crear tag/i,
            })
        );

        await waitFor(() => {
            expect(tagsApiModule.createTag).toHaveBeenCalled();
        });

        expect(tagsApiModule.createTag).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Nueva Tag',
                description: 'Descripción integración',
                student_ids: ['student-1'],
            })
        );
    });

    it('edita nombre y color de una tag existente', async () => {
        const user = userEvent.setup();

        vi.mocked(tagsApiModule.updateTag).mockResolvedValue({
            ...mockTagDetail,
            name: 'AGE Actualizada',
            color: '#1565C0',
        });

        render(<TagsPage />);

        const tagButton = await screen.findByText('AGE');

        await user.click(tagButton);

        await waitFor(() => {
            expect(tagsApiModule.getTag).toHaveBeenCalledWith('tag-1');
        });

        const input = screen.getByLabelText(/Nombre/i);

        await user.clear(input);
        await user.type(input, 'AGE Actualizada');

        const colorButtons = screen
            .getAllByRole('button')
            .filter((btn) => btn.getAttribute('title'));

        await user.click(colorButtons[1]);

        await user.click(
            screen.getByRole('button', {
                name: /Guardar cambios/i,
            })
        );

        await waitFor(() => {
            expect(tagsApiModule.updateTag).toHaveBeenCalled();
        });

        expect(tagsApiModule.updateTag).toHaveBeenCalledWith(
            'tag-1',
            expect.objectContaining({
                name: 'AGE Actualizada',
            })
        );
    });

    it('elimina una tag existente', async () => {
        const user = userEvent.setup();

        vi.mocked(tagsApiModule.deleteTag).mockResolvedValue({
            success: true,
        });

        render(<TagsPage />);

        const tagButton = await screen.findByText('AGE');

        await user.click(tagButton);

        const deleteButton = await screen.findByRole('button', {
            name: /Eliminar/i,
        });

        await user.click(deleteButton);

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalled();
        });

        expect(tagsApiModule.deleteTag).toHaveBeenCalledWith('tag-1');
    });

    it('muestra errores de validación del formulario', async () => {
        const user = userEvent.setup();

        vi.mocked(tagsApiModule.listTags).mockResolvedValue([]);

        render(<TagsPage />);

        await user.click(
            screen.getByRole('button', {
                name: /Crear tag/i,
            })
        );

        await waitFor(() => {
            expect(
                screen.getByText(/Ingresa un nombre para la tag/i)
            ).toBeInTheDocument();
        });

        expect(
            screen.getByText(/Selecciona al menos una persona/i)
        ).toBeInTheDocument();
    });

    it('muestra error cuando falla la creación de una tag', async () => {
        const user = userEvent.setup();

        vi.mocked(tagsApiModule.listTags).mockResolvedValue([]);

        vi.mocked(tagsApiModule.createTag).mockRejectedValue(
            new Error('No se pudo guardar la tag')
        );

        render(<TagsPage />);

        await user.type(
            screen.getByLabelText(/Nombre/i),
            'Tag Error'
        );

        await user.click(
            screen.getByRole('button', {
                name: /Agregar miembro mock/i,
            })
        );

        await user.click(
            screen.getByRole('button', {
                name: /Crear tag/i,
            })
        );

        await waitFor(() => {
            expect(
                screen.getByText('No se pudo guardar la tag')
            ).toBeInTheDocument();
        });
    });
});