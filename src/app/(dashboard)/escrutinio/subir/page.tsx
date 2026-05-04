'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Election } from '@/types/elections';
import Loader from '@/components/Loader';

type ElectionInfo = {
  id: string;
  title: string;
  status: string;
  requires_keys: boolean;
  min_keys: number;
};

type ScrutinyMember = {
  id: string;
  full_name: string;
  carnet: string;
  date: string | null;
  has_submitted: boolean;
};

type ProgressScrutiny = {
  total_Members: number;
  submittedKeys: number;
  membersPending: ScrutinyMember[];
  can_finalize: boolean;
};

type GeneralMetrics = {
  total_votes: number;
  total_elegibles: number;
  participation_rate: number;
};

type ScrutinyResponse = {
  electionInfo: ElectionInfo;
  progressScrutiny: ProgressScrutiny;
  general_Metric: GeneralMetrics;
  publication_status: string;
};

type SubmitKeyResponse = {
  submitted: boolean;
  finalized: boolean;
};

const AVATAR_COLORS = [
  '#BE1E2D', '#059669', '#7C3AED',
  '#D97706', '#0EA5E9', '#DC2626',
];

function getInitials(fullName: string): string {
  const initials = fullName
    .trim()
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .slice(0, 2)
    .join('');

  return initials || '??';
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseLegacyElectionId(rawData: string | null): string | null {
  if (!rawData) return null;

  const parse = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed?.id === 'string' ? parsed.id : null;
    } catch {
      return null;
    }
  };

  try {
    return parse(rawData) || parse(decodeURIComponent(rawData));
  } catch {
    return parse(rawData);
  }
}

function EscrutinioSubirContent() {
  const [electionFull, setElectionFull] = useState<ScrutinyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const electionId = useMemo(() => {
    return searchParams.get('id') || parseLegacyElectionId(searchParams.get('data'));
  }, [searchParams]);

  const fetchScrutiny = useCallback(async (options?: { silent?: boolean }) => {
    if (!electionId) return;

    try {
      if (options?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await apiClient<ScrutinyResponse>(`/api/scrutiny/${electionId}`);
      setElectionFull(data);
    } catch (err) {
      console.error('Error fetching scrutiny:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el progreso de escrutinio');
    } finally {
      if (options?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    if (!electionId) {
      router.replace('/escrutinio');
      return;
    }

    fetchScrutiny();
  }, [electionId, fetchScrutiny, router]);

  const electionInfo = electionFull?.electionInfo ?? null;
  const progress = electionFull?.progressScrutiny ?? null;
  const metrics = electionFull?.general_Metric ?? null;
  const members = progress?.membersPending ?? [];
  const submittedCount = progress?.submittedKeys ?? 0;
  const requiredKeys = electionInfo?.min_keys ?? 0;
  const missingKeys = Math.max(requiredKeys - submittedCount, 0);
  const totalMembers = progress?.total_Members ?? members.length;
  const isFinalized = electionInfo?.status === 'SCRUTINIZED';
  const canFinalize = !isFinalized && Boolean(progress?.can_finalize || submittedCount >= requiredKeys);
  const progressPercent = requiredKeys > 0
    ? Math.min(100, Math.round((submittedCount / requiredKeys) * 100))
    : canFinalize ? 100 : 0;
  const currentMember = members.find((member) => member.id === user?.studentId);
  const currentUserSubmitted = Boolean(currentMember?.has_submitted);
  const canSubmit = Boolean(currentMember) && !currentUserSubmitted && !isFinalized;

  const handleRefresh = async () => {
    setActionError(null);
    setActionMessage(null);
    await fetchScrutiny({ silent: true });
  };

  const handleSubmit = async () => {
    if (!electionId || !value.trim() || submitting || !canSubmit) return;

    if (!user?.studentId) {
      setActionError('No se pudo identificar al usuario autenticado.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await apiClient<SubmitKeyResponse>(`/api/scrutiny/${electionId}/submit-key`, {
        method: 'POST',
        body: JSON.stringify({
          memberId: user.studentId,
          key: value.trim(),
        }),
      });

      if (!response.submitted) {
        setActionError('No se logro canjear la llave.');
        return;
      }

      setValue('');
      setActionMessage(
        response.finalized
          ? 'Llave canjeada. Se alcanzo el minimo y el escrutinio quedo finalizado.'
          : 'Llave canjeada. El progreso fue actualizado.'
      );
      await fetchScrutiny({ silent: true });
    } catch (err) {
      console.error('Error submitting key:', err);
      setActionError(err instanceof Error ? err.message : 'Error al canjear la llave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!electionId || !canFinalize || finalizing) return;

    setFinalizing(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await apiClient<Election>(`/api/scrutiny/${electionId}/finalize`, {
        method: 'POST',
      });
      setActionMessage('Escrutinio finalizado. Los resultados ya pueden publicarse como finalizados.');
      await fetchScrutiny({ silent: true });
    } catch (err) {
      console.error('Error finalizing scrutiny:', err);
      setActionError(err instanceof Error ? err.message : 'Error al finalizar el escrutinio');
    } finally {
      setFinalizing(false);
    }
  };

  if (!electionId) return null;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {loading ? (
        <Loader />
      ) : error || !electionInfo || !progress ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <h3 className="font-semibold text-gray-900 mb-2">No se pudo cargar el escrutinio</h3>
          <p className="text-sm text-gray-600 mb-5">
            {error || 'No se pudo cargar la informacion de la eleccion.'}
          </p>
          <button type="button" className="btn btn-outline" onClick={() => router.push('/escrutinio')}>
            Volver
          </button>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--warning-light)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-3xl font-serif font-normal mb-1">Escrutinio de resultados</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{electionInfo.title}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="badge">
                {isFinalized ? 'Finalizada' : 'Pendiente de llaves'}
              </span>
              <span className="badge">
                {submittedCount} de {requiredKeys} requeridas
              </span>
              <span className="badge" style={{ color: missingKeys === 0 ? 'var(--success)' : 'var(--accent)' }}>
                Faltan {missingKeys} {missingKeys === 1 ? 'llave' : 'llaves'}
              </span>
            </div>
          </div>

          <div className="card p-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Canjeadas</div>
                <div className="text-3xl font-serif text-red-600 mt-1">{submittedCount}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Faltan</div>
                <div className="text-3xl font-serif text-red-600 mt-1">{missingKeys}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Minimo</div>
                <div className="text-3xl font-serif text-red-600 mt-1">{requiredKeys}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Custodios</div>
                <div className="text-3xl font-serif text-red-600 mt-1">{totalMembers}</div>
              </div>
            </div>

            <div className="progress-bar mb-3">
              <div
                className={`progress-bar-fill ${missingKeys === 0 ? 'success' : 'accent'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
              <span style={{ color: 'var(--muted)' }}>
                {missingKeys === 0
                  ? 'Ya se alcanzo el minimo de llaves para finalizar.'
                  : `Faltan ${missingKeys} ${missingKeys === 1 ? 'llave' : 'llaves'} para poder finalizar.`}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Actualizando...' : 'Actualizar progreso'}
              </button>
            </div>
          </div>

          {metrics && (
            <div className="card p-5 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Votos</div>
                  <div className="font-semibold mt-1">{metrics.total_votes.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Elegibles</div>
                  <div className="font-semibold mt-1">{metrics.total_elegibles.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Participacion</div>
                  <div className="font-semibold mt-1">{Math.round(metrics.participation_rate)}%</div>
                </div>
              </div>
            </div>
          )}

          <div
            className="rounded-lg overflow-hidden mb-5"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-raised)' }}
          >
            <div
              className="flex justify-between items-center px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                Custodios de llaves
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: missingKeys === 0 ? 'var(--success)' : 'var(--warning)' }}
              >
                {missingKeys === 0 ? 'Minimo alcanzado' : `${missingKeys} pendientes`}
              </span>
            </div>

            <div>
              {members.map((holder, index) => {
                const submitted = Boolean(holder.has_submitted);
                const isLast = index === members.length - 1;
                const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                const submittedAt = formatDateTime(holder.date);

                return (
                  <div
                    key={holder.id}
                    className="flex items-center gap-4 px-6 py-4 transition-colors"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      background: submitted ? 'var(--success-light)' : 'transparent',
                      opacity: submitted ? 1 : 0.72,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: color }}
                    >
                      {getInitials(holder.full_name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: 'var(--ink)' }}>
                        {holder.full_name}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: submitted ? 'var(--success)' : 'var(--muted)' }}
                      >
                        {submitted
                          ? `Llave canjeada${submittedAt ? ` - ${submittedAt}` : ''}`
                          : `Pendiente - ${holder.carnet}`}
                      </div>
                    </div>

                    {submitted ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full"
                        aria-hidden="true"
                        style={{ border: '2px solid var(--border)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-lg p-6 guilloche-bg mb-5"
            style={{ border: '2px dashed var(--border)' }}
          >
            <div className="text-center mb-4">
              <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                Ingresar tu llave
              </div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {currentUserSubmitted
                  ? 'Tu llave ya fue canjeada.'
                  : currentMember
                    ? 'Pega la llave de escrutinio asignada a tu usuario.'
                    : 'Tu usuario no aparece como custodio de llave en esta eleccion.'}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <label className="sr-only" htmlFor="scrutiny-key-input">
                  Llave de escrutinio
                </label>
                <input
                  id="scrutiny-key-input"
                  type={visible ? 'text' : 'password'}
                  className="input w-full pr-10"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                  placeholder="Pegar llave..."
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSubmit();
                  }}
                  disabled={!canSubmit || submitting || finalizing}
                />
                <button
                  type="button"
                  onClick={() => setVisible((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  aria-label={visible ? 'Ocultar llave' : 'Mostrar llave'}
                  disabled={!canSubmit}
                >
                  {visible ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleSubmit}
                disabled={submitting || !value.trim() || !canSubmit}
                style={{ opacity: submitting || !value.trim() || !canSubmit ? 0.6 : 1 }}
              >
                {submitting ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : 'Canjear'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                  Finalizacion del escrutinio
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  {isFinalized
                    ? 'Esta eleccion ya fue marcada como escrutada.'
                    : canFinalize
                      ? 'El minimo de llaves fue alcanzado. Ya puedes finalizar.'
                      : `Faltan ${missingKeys} ${missingKeys === 1 ? 'llave' : 'llaves'} para habilitar la finalizacion.`}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleFinalize}
                disabled={!canFinalize || finalizing}
                style={{ opacity: !canFinalize || finalizing ? 0.6 : 1 }}
              >
                {finalizing ? 'Finalizando...' : isFinalized ? 'Finalizada' : 'Finalizar escrutinio'}
              </button>
            </div>
          </div>

          {(actionMessage || actionError) && (
            <div
              className="mt-5 rounded-lg p-4 text-sm"
              style={{
                border: `1px solid ${actionError ? 'var(--error)' : 'var(--border)'}`,
                background: actionError ? 'var(--error-light)' : 'var(--success-light)',
                color: actionError ? 'var(--error)' : 'var(--ink)',
              }}
            >
              {actionError || actionMessage}
            </div>
          )}

          <p className="text-center mt-6 text-xs" style={{ color: 'var(--muted)' }}>
            Cada canje y la finalizacion quedan registrados en el log de auditoria.
          </p>
        </>
      )}
    </div>
  );
}

export default function EscrutinioSubirPage() {
  return (
    <Suspense fallback={<Loader />}>
      <EscrutinioSubirContent />
    </Suspense>
  );
}
