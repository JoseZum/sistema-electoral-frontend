'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Election } from '@/types/elections';

const templates = [
  { value: 'reminder', label: 'Recordatorio de votación' },
  { value: 'open', label: 'Notificación de apertura' },
  { value: 'custom', label: 'Mensaje personalizado' },
] as const;

export default function CorreosMasivosPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState('');
  const [emailType, setEmailType] = useState<typeof templates[number]['value']>('reminder');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const election = elections.find((item) => item.id === electionId);
  const requiresOpenElection = emailType !== 'custom' && election?.status !== 'OPEN';
  const closingDate = election?.end_time
    ? new Date(election.end_time).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })
    : null;
  const preview = emailType === 'custom' ? message : [
    emailType === 'open' ? `La votación «${election?.title || '…'}» ha iniciado.` : `La votación «${election?.title || '…'}» sigue abierta.`,
    closingDate ? `Cierre: ${closingDate}.` : '',
    'Ingresa al sistema con tu cuenta institucional de Microsoft para votar.',
  ].filter(Boolean).join('\n\n');

  useEffect(() => {
    apiClient<Election[]>('/api/elections')
      .then(setElections)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las votaciones.'))
      .finally(() => setLoading(false));
  }, []);

  async function sendEmails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !election || requiresOpenElection || (emailType === 'custom' && !message.trim())) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiClient<{ total: number }>('/api/notifications/send', {
        method: 'POST',
        body: JSON.stringify({ electionId, emailType, message: message.trim() }),
      });
      setSuccess(`Se enviaron ${response.total} correos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron enviar los correos.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="view-enter max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl">Correos masivos</h1>
        <p className="text-muted text-sm mt-2">Envía avisos a los votantes activos de una votación.</p>
      </div>

      <form onSubmit={sendEmails} className="space-y-4">
        <fieldset disabled={loading || sending} className="card p-6 space-y-5">
          <div className="input-group">
            <label htmlFor="email-election">1 — Seleccionar votación</label>
            <select id="email-election" className="input" required value={electionId} onChange={(event) => { setElectionId(event.target.value); setSuccess(null); }}>
              <option value="">{loading ? 'Cargando votaciones…' : 'Elegir una votación…'}</option>
              {elections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="label mb-3">2 — Tipo de correo</legend>
            <div className="flex flex-wrap gap-4">
              {templates.map((template) => (
                <label key={template.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="email-type" checked={emailType === template.value} onChange={() => { setEmailType(template.value); setSuccess(null); }} />
                  {template.label}
                </label>
              ))}
            </div>
          </fieldset>
          {emailType === 'custom' && (
            <div className="input-group">
              <label htmlFor="email-message">Contenido del mensaje</label>
              <textarea id="email-message" className="input" rows={5} required maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
          )}
          {election && requiresOpenElection && <p className="text-sm text-error">Selecciona una votación abierta para enviar este aviso.</p>}
        </fieldset>

        <div className="card p-6">
          <h2 className="label mb-3">3 — Vista previa del correo</h2>
          <p className="text-sm whitespace-pre-wrap">{preview || 'Aquí se mostrará el mensaje personalizado.'}</p>
        </div>

        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        {success && <p role="status" className="text-sm">{success}</p>}
        <button type="submit" className="btn btn-accent" disabled={loading || sending || !election || requiresOpenElection || (emailType === 'custom' && !message.trim())}>
          {sending ? 'Enviando…' : 'Enviar correos'}
        </button>
      </form>
    </div>
  );
}
