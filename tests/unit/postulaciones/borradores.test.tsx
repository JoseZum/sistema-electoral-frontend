import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MisPostulacionesPage from '@/app/(voter)/mis-postulaciones/page';
import type { MyApplicationFormSummary } from '@/types/postulaciones';

/**
 * Los borradores quedaban en un limbo: no se anunciaban en ningún lado, así
 * que ni el estudiante sabía que no había enviado nada ni el administrador
 * que había gente a medias. Estas pruebas fijan ese comportamiento.
 */

vi.mock('@/lib/postulaciones-api', () => ({
  listMyForms: vi.fn(),
}));

import { listMyForms } from '@/lib/postulaciones-api';

function buildForm(overrides: Partial<MyApplicationFormSummary> = {}): MyApplicationFormSummary {
  return {
    id: 'form-1',
    title: 'Presidencia FEITEC 2026',
    description: null,
    status: 'OPEN',
    start_time: null,
    end_time: '2026-12-15T23:00:00Z',
    allow_other_documents: false,
    other_documents_label: null,
    application_status: null,
    submitted_at: null,
    correction_deadline: null,
    review_comment: null,
    can_edit: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('borradores en el listado del postulante', () => {
  it('avisa que un borrador todavía no entró a revisión', async () => {
    vi.mocked(listMyForms).mockResolvedValue([
      buildForm({ application_status: 'DRAFT', can_edit: true }),
    ]);

    render(<MisPostulacionesPage />);

    expect(await screen.findByText('Borrador sin enviar')).toBeInTheDocument();
    expect(screen.getByText(/no entra a revisión/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuar borrador' })).toBeInTheDocument();
  });

  it('avisa cuando la convocatoria cerró y el borrador nunca se envió', async () => {
    vi.mocked(listMyForms).mockResolvedValue([
      buildForm({ application_status: 'DRAFT', status: 'CLOSED', can_edit: false }),
    ]);

    render(<MisPostulacionesPage />);

    expect(await screen.findByText('Borrador no enviado a tiempo')).toBeInTheDocument();
    // No se le invita a continuar algo que ya no puede continuar.
    expect(screen.getByRole('link', { name: 'Ver borrador' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continuar borrador' })).not.toBeInTheDocument();
  });

  it('no muestra el aviso cuando la postulación sí fue enviada', async () => {
    vi.mocked(listMyForms).mockResolvedValue([
      buildForm({ application_status: 'SUBMITTED', can_edit: false }),
    ]);

    render(<MisPostulacionesPage />);

    await waitFor(() => expect(listMyForms).toHaveBeenCalled());
    expect(screen.queryByText('Borrador sin enviar')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi postulación' })).toBeInTheDocument();
  });

  it('invita a postularse cuando todavía no hay nada empezado', async () => {
    vi.mocked(listMyForms).mockResolvedValue([buildForm()]);

    render(<MisPostulacionesPage />);

    expect(await screen.findByRole('link', { name: 'Postularme' })).toBeInTheDocument();
  });
});
