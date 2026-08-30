import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('auditoría de postulaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nombra el puesto y su convocatoria en vez de mostrar el identificador', async () => {
    mockLogs([
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
    ]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('agregó el puesto')).toBeInTheDocument();
    });
    expect(screen.getByText('«Presidencia»')).toBeInTheDocument();
    expect(screen.getByText('en «Convocatoria TEE 2026»')).toBeInTheDocument();
    expect(screen.queryByText(/fd188816/)).not.toBeInTheDocument();
  });

  it('resume los puestos y la audiencia al crear una convocatoria', async () => {
    mockLogs([
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
    ]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('creó la convocatoria')).toBeInTheDocument();
    });
    expect(screen.getByText('«Convocatoria TEE 2026»')).toBeInTheDocument();
    expect(screen.getByText(/3 puestos/)).toBeInTheDocument();
    expect(screen.getByText(/120 personas convocadas/)).toBeInTheDocument();
    expect(screen.queryByText(/14c6fd1f/)).not.toBeInTheDocument();
  });

  it('describe una postulación aprobada con la persona y el puesto', async () => {
    mockLogs([
      makeLog({
        id: 'log-3',
        action: 'application.update',
        resource_type: 'application',
        resource_id: 'app-1',
        target_name: 'Ana García',
        target_carnet: '2021009999',
        details: {
          changes: { status: 'APPROVED' },
          previous: { status: 'SUBMITTED' },
          position_name: 'Presidencia',
          form_title: 'Convocatoria TEE 2026',
        },
      }),
    ]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('aprobó la postulación de')).toBeInTheDocument();
    });
    expect(screen.getByText('Ana García · 2021009999')).toBeInTheDocument();
    expect(screen.getByText(/al puesto «Presidencia»/)).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
  });

  it('ofrece la categoría Postulaciones para filtrar y purgar', async () => {
    mockLogs([]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Postulaciones/ }),
      ).toBeInTheDocument();
    });
  });

  it('usa la frase del backend antes que el identificador para eventos sin caso propio', async () => {
    mockLogs([
      makeLog({
        id: 'log-4',
        action: 'application_review.insert',
        resource_type: 'application_review',
        resource_id: '99999999-0000-0000-0000-000000000000',
        details: null,
        activityMessage: 'Revision registrada en postulacion',
      }),
    ]);

    render(<AuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Revision registrada en postulacion')).toBeInTheDocument();
    });
    expect(screen.queryByText(/99999999/)).not.toBeInTheDocument();
  });
});
