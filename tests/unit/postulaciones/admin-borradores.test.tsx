import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationFormEditor from '@/components/postulaciones/ApplicationFormEditor';
import PostulacionesPage from '@/app/(dashboard)/postulaciones/page';
import { apiClient } from '@/lib/api-client';
import { listForms, updateForm } from '@/lib/postulaciones-api';
import type { ApplicationFormWithStats } from '@/types/postulaciones';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

vi.mock('@/lib/postulaciones-api', () => ({
  createForm: vi.fn(),
  updateForm: vi.fn(),
  listForms: vi.fn(),
  deleteForm: vi.fn(),
}));

vi.mock('@/components/postulaciones/PositionsEditor', () => ({
  default: () => <div>Puestos editables</div>,
}));

const draftForm: ApplicationFormWithStats = {
  id: 'form-1',
  title: 'Postulación TEE 2026',
  description: 'Convocatoria inicial',
  status: 'DRAFT',
  start_time: '2026-09-10T14:00:00.000Z',
  end_time: '2026-09-20T23:59:00.000Z',
  allow_other_documents: false,
  other_documents_label: null,
  voter_source: 'FULL_PADRON',
  voter_filter: null,
  tag_id: null,
  election_id: null,
  created_by: 'admin-1',
  created_at: '2026-08-29T12:00:00.000Z',
  updated_at: '2026-08-29T12:00:00.000Z',
  tag_name: null,
  tag_color: null,
  election_title: null,
  positions: [],
  eligible_count: 25,
  submitted_count: 0,
  approved_count: 0,
  conditioned_count: 0,
  rejected_count: 0,
  draft_count: 0,
};

describe('borradores administrativos de postulaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient).mockImplementation(async (path: string) =>
      path.includes('/catalog') ? ({ sedes: ['Cartago'], careers: ['Computación'] } as never) : ([] as never)
    );
    vi.mocked(updateForm).mockResolvedValue(draftForm);
    vi.mocked(listForms).mockResolvedValue([draftForm]);
  });

  it('ofrece editar el borrador desde el listado administrativo', async () => {
    render(<PostulacionesPage />);

    const link = await screen.findByRole(
      'link',
      { name: 'Editar borrador' },
      { timeout: 15_000 }
    );
    expect(link).toHaveAttribute('href', '/postulaciones/form-1/editar');
  });

  it('precarga el borrador y permite guardarlo sin publicarlo', async () => {
    const user = userEvent.setup();
    render(<ApplicationFormEditor initialForm={draftForm} />);

    const title = screen.getByLabelText('Título del formulario');
    expect(title).toHaveValue('Postulación TEE 2026');
    expect(screen.getByText('Puestos editables')).toBeInTheDocument();

    await user.clear(title);
    await user.type(title, 'Postulación TEE actualizada');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() =>
      expect(updateForm).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({
          title: 'Postulación TEE actualizada',
          status: 'DRAFT',
          voter_source: 'FULL_PADRON',
        })
      )
    );
    expect(push).toHaveBeenCalledWith('/postulaciones/form-1');
  });

  it('publica el borrador mediante una accion separada', async () => {
    const user = userEvent.setup();
    render(<ApplicationFormEditor initialForm={draftForm} />);

    await user.click(screen.getByRole('button', { name: 'Publicar formulario' }));

    await waitFor(() =>
      expect(updateForm).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({ status: 'OPEN' })
      )
    );
  });
});
