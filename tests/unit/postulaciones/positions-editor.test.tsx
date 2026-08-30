import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PositionsEditor from '@/components/postulaciones/PositionsEditor';
import { createPosition, listPositions } from '@/lib/postulaciones-api';

vi.mock('@/lib/postulaciones-api', () => ({
  createPosition: vi.fn(),
  deletePosition: vi.fn(),
  listPositions: vi.fn(),
  updatePosition: vi.fn(),
}));

describe('PositionsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPositions).mockResolvedValue([]);
    vi.mocked(createPosition).mockResolvedValue({
      id: 'position-1',
      form_id: 'form-1',
      name: 'Presidencia',
      display_order: 0,
      created_at: '2026-08-30T00:00:00.000Z',
      updated_at: '2026-08-30T00:00:00.000Z',
    });
  });

  it('se puede usar dentro del editor general sin anidar formularios', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <PositionsEditor formId="form-1" />
      </form>
    );

    await screen.findByText(/Todavía no hay puestos/);
    expect(container.querySelectorAll('form')).toHaveLength(1);

    await user.type(screen.getByLabelText('Nombre del puesto nuevo'), 'Presidencia');
    await user.click(screen.getByRole('button', { name: 'Agregar puesto' }));

    await waitFor(() => expect(createPosition).toHaveBeenCalledWith('form-1', 'Presidencia'));
  });
});
