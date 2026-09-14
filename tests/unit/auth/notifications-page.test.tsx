import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CorreosMasivosPage from '@/app/(dashboard)/correos/page';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiClient: vi.fn() }));
const election = { id: 'election-1', title: 'Elección estudiantil', status: 'OPEN', end_time: '2026-09-20T18:00:00Z' };

describe('Correos masivos', () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset().mockResolvedValue([election]);
  });

  it('sends a reminder for the selected election and displays the delivered count', async () => {
    const user = userEvent.setup();
    render(<CorreosMasivosPage />);
    await screen.findByRole('option', { name: election.title });
    await user.selectOptions(screen.getByLabelText('1 — Seleccionar votación'), election.id);
    vi.mocked(apiClient).mockResolvedValueOnce({ total: 2 });
    await user.click(screen.getByRole('button', { name: 'Enviar correos' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se enviaron 2 correos.');
    expect(apiClient).toHaveBeenLastCalledWith('/api/notifications/send', {
      method: 'POST', body: JSON.stringify({ electionId: election.id, emailType: 'reminder', message: '' }),
    });
    expect(screen.queryByText(/token de acceso/i)).not.toBeInTheDocument();
  });

  it('blocks reminders for a closed election and displays SMTP errors for custom messages', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ ...election, status: 'CLOSED' }]);
    const user = userEvent.setup();
    render(<CorreosMasivosPage />);
    await screen.findByRole('option', { name: election.title });
    await user.selectOptions(screen.getByLabelText('1 — Seleccionar votación'), election.id);
    expect(screen.getByRole('button', { name: 'Enviar correos' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Mensaje personalizado' }));
    expect(screen.getByRole('button', { name: 'Enviar correos' })).toBeDisabled();
    await user.type(screen.getByLabelText('Contenido del mensaje'), 'Aviso del TEE');
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('El servicio de correo no está configurado.'));
    await user.click(screen.getByRole('button', { name: 'Enviar correos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio de correo no está configurado.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar correos' })).toBeEnabled());
  });
});
