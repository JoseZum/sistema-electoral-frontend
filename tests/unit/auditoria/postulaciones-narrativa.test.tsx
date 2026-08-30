import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditPage from '@/app/(dashboard)/auditoria/page';
import { apiClient } from '@/lib/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}));

interface LogSeed {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  target_name?: string | null;
  target_carnet?: string | null;
  activityMessage?: string;
}

function makeLog(seed: LogSeed) {
  return {
    actor_name: 'Portuguez Retana Aldden Josue',
    actor_carnet: '2021001234',
    target_name: null,
    target_carnet: null,
    ip_address: null,
    created_at: '2026-08-30T04:45:00.000Z',
    ...seed,
  };
}

function mockLogs(logs: ReturnType<typeof makeLog>[]) {
  vi.mocked(apiClient).mockImplementation(async (path: string) => {
    if (path.includes('/stats')) {
      return [{ resource_type: 'application_position', count: '4' }] as never;
    }
    if (path.includes('/active-days')) {
      return [{ date: '2026-08-30', count: logs.length }] as never;
    }
    return { logs, total: logs.length, page: 1, limit: 30 } as never;
  });
}

// La página es cara de montar, así que los casos que solo leen la narrativa
// comparten un único render con todos los eventos dentro.
const eventos = [
  makeLog({
    id: 'log-1',
    action: 'application_position.insert',
    resource_type: 'application_position',
    resource_id: 'fd188816-0309-40c3-b6d3-58ed8f869295',
    details: {
      new: { name: 'Presidencia', display_order: 1 },
      position_name: 'Presidencia',
      form_title: 'Convocatoria TEE 2026',
    },
  }),
  makeLog({
    id: 'log-2',
    action: 'application_form.insert',
    resource_type: 'application_form',
    resource_id: '14c6fd1f-da88-4421-810b-f8b4a4419594',
    details: {
      new: {
        title: 'Convocatoria TEE 2026',
        position_count: 3,
        positions_summary: 'Presidencia, Vicepresidencia, Secretaria',
        eligible_count: 120,
        voter_scope: 'Todo el padron activo',
      },
      form_title: 'Convocatoria TEE 2026',
    },
  }),
  makeLog({
    id: 'log-3',
    action: 'application.update',
    resource_type: 'application',
    resource_id: 'a0000000-0000-0000-0000-000000000003',
    target_name: 'Ana García',
    target_carnet: '2021009999',
    details: {
      changes: { status: 'APPROVED' },
      previous: { status: 'SUBMITTED' },
      position_name: 'Presidencia',
      form_title: 'Convocatoria TEE 2026',
    },
  }),
  makeLog({
    id: 'log-4',
    action: 'application_review.insert',
    resource_type: 'application_review',
    resource_id: '99999999-0000-0000-0000-000000000000',
    details: null,
    activityMessage: 'Revision registrada en postulacion',
  }),
];

describe('auditoría de postulaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('narra los eventos del módulo sin mostrar identificadores', async () => {
    mockLogs(eventos);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('agregó el puesto')).toBeInTheDocument();
    });

    // Puesto: nombre y convocatoria en vez del UUID de la captura original.
    expect(screen.getByText('«Presidencia»')).toBeInTheDocument();
    expect(screen.getByText('en «Convocatoria TEE 2026»')).toBeInTheDocument();

    // Convocatoria: los puestos silenciados aparecen resumidos aquí.
    expect(screen.getByText('creó la convocatoria')).toBeInTheDocument();
    expect(screen.getByText(/3 puestos/)).toBeInTheDocument();
    expect(screen.getByText(/120 personas convocadas/)).toBeInTheDocument();

    // Resolución de una postulación: quién, a qué puesto y con qué decisión.
    expect(screen.getByText('aprobó la postulación de')).toBeInTheDocument();
    expect(screen.getByText('Ana García · 2021009999')).toBeInTheDocument();
    expect(screen.getByText(/al puesto «Presidencia»/)).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();

    // Un tipo de evento sin caso propio cae a la frase que redacta el backend.
    expect(screen.getByText('Revision registrada en postulacion')).toBeInTheDocument();

    // Ningún identificador crudo sobrevive en la narrativa.
    for (const fragmento of ['fd188816', '14c6fd1f', '99999999']) {
      expect(screen.queryByText(new RegExp(fragmento))).not.toBeInTheDocument();
    }

    // La categoría propia habilita filtrar y purgar el módulo por separado.
    expect(
      screen.getByRole('button', { name: /Convocatorias, puestos y candidaturas/ }),
    ).toBeInTheDocument();
  });

  it('esconde las llaves foráneas al abrir el detalle', async () => {
    const user = userEvent.setup();
    mockLogs([
      makeLog({
        id: 'log-5',
        action: 'application_position.insert',
        resource_type: 'application_position',
        resource_id: 'e62e39a7-b7b3-4878-a824-020321c4b9ec',
        details: {
          new: {
            id: 'e62e39a7-b7b3-4878-a824-020321c4b9ec',
            form_id: '36ce087a-a6cf-4661-871e-1ae1ccbbe6a4',
            name: 'Tesoreria',
            display_order: 3,
          },
          position_name: 'Tesoreria',
          form_title: 'Convocatoria TEE 2026',
        },
      }),
    ]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('agregó el puesto')).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Ver detalles/));

    await waitFor(() => {
      expect(screen.getByText('nombre')).toBeInTheDocument();
    });
    expect(screen.getByText('orden')).toBeInTheDocument();
    expect(screen.queryByText('36ce087a-a6cf-4661-871e-1ae1ccbbe6a4')).not.toBeInTheDocument();
  });
});
