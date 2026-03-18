'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { VoterElectionDetail } from '@/types/elections';

type VoteStage = 'loading' | 'voting' | 'confirm-dialog' | 'submitting' | 'success' | 'error';

interface VoteTokenResponse {
  token: string;
}

interface CastVoteResponse {
  message: string;
}

export default function VotingBoothPage() {
  const params = useParams();
  const router = useRouter();
  const electionId = params.id as string;

  const [election, setElection] = useState<VoterElectionDetail | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [stage, setStage] = useState<VoteStage>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchElection = useCallback(async () => {
    try {
      const data = await apiClient<VoterElectionDetail>(`/api/voting/elections/${electionId}`);
      setElection(data);

      if (data.has_voted) {
        setStage('success');
      } else {
        setStage('voting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la votacion');
      setStage('error');
    }
  }, [electionId]);

  useEffect(() => {
    fetchElection();
  }, [fetchElection]);

  async function handleSubmitVote() {
    if (!selectedOption || !election) return;

    try {
      setStage('submitting');
      setError(null);

      const castBody: Record<string, string> = {
        electionId: electionId,
        optionId: selectedOption,
      };

      // For anonymous elections, request a token first
      if (election.is_anonymous) {
        const tokenRes = await apiClient<VoteTokenResponse>(
          `/api/voting/elections/${electionId}/token`,
          { method: 'POST' }
        );
        castBody.token = tokenRes.token;
      }

      await apiClient<CastVoteResponse>('/api/voting/cast', {
        method: 'POST',
        body: JSON.stringify(castBody),
      });

      setStage('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al emitir el voto');
      setStage('voting');
    }
  }

  // Loading state
  if (stage === 'loading') {
    return (
      <div className="voting-booth">
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>Cargando votacion...</div>
      </div>
    );
  }

  // Error state
  if (stage === 'error') {
    return (
      <div className="voting-booth">
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Error</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-outline" onClick={() => router.push('/votaciones')}>
            Volver a votaciones
          </button>
        </div>
      </div>
    );
  }

  // Success/Confirmation state
  if (stage === 'success') {
    const selectedLabel = election?.options.find((o) => o.id === selectedOption)?.label;

    return (
      <div className="vote-confirmation guilloche-bg">
        <div className="confirmation-card">
          <div className="stamp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.75rem' }}>Voto registrado</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.7 }}>
            Tu voto fue emitido exitosamente y registrado de forma segura.
            {election?.is_anonymous && ' No es posible modificarlo ni vincularlo a tu identidad.'}
          </p>

          <div className="receipt">
            <div className="receipt-row">
              <span className="receipt-label">Votacion</span>
              <span className="receipt-value">{election?.title}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Fecha y hora</span>
              <span className="receipt-value">
                {new Date().toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
                {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {selectedLabel && !election?.is_anonymous && (
              <div className="receipt-row">
                <span className="receipt-label">Seleccion</span>
                <span className="receipt-value">{selectedLabel}</span>
              </div>
            )}
          </div>

          <button
            className="btn btn-accent btn-lg"
            onClick={() => router.push('/votaciones')}
            style={{ width: '100%' }}
          >
            Volver a mis votaciones
          </button>
        </div>
      </div>
    );
  }

  if (!election) return null;

  // Separate regular options from special (blank/null)
  const regularOptions = election.options.filter(
    (o) => o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE'
  );
  const specialOptions = election.options.filter(
    (o) => o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE'
  );

  const canSubmit = selectedOption !== null && stage === 'voting';

  return (
    <>
      {/* Confirm Dialog */}
      {stage === 'confirm-dialog' && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.75rem' }}>Confirmar voto</h3>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
              Estas a punto de emitir tu voto por{' '}
              <strong style={{ color: 'var(--ink)' }}>
                {election.options.find((o) => o.id === selectedOption)?.label}
              </strong>
              . Esta accion no se puede deshacer.
            </p>
            {error && (
              <div style={{ padding: '0.75rem', background: 'var(--error-light)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => { setStage('voting'); setError(null); }}>
                Cancelar
              </button>
              <button className="btn btn-accent" onClick={handleSubmitVote}>
                Confirmar voto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting overlay */}
      {stage === 'submitting' && (
        <div className="modal-overlay active">
          <div className="modal" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
            </div>
            <p style={{ fontWeight: 600 }}>Registrando tu voto...</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
              {election.is_anonymous ? 'Generando token anonimo y registrando...' : 'Registrando voto...'}
            </p>
          </div>
        </div>
      )}

      <div className="voting-booth guilloche-bg">
        <div className="ballot">
          <div className="ballot-header">
            <div className="label" style={{ marginBottom: '0.5rem' }}>
              {election.is_anonymous ? 'Voto secreto y anonimo' : 'Voto nominal'}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>{election.title}</h2>
            <p>Selecciona una opcion para emitir tu voto</p>
          </div>

          <div className="ballot-body">
            {/* Regular vote cards */}
            <div className="vote-cards-grid">
              {regularOptions.map((option) => (
                <div
                  key={option.id}
                  className={`vote-card ${selectedOption === option.id ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(option.id)}
                >
                  <div className="vote-card-header">
                    <div className="vote-card-name">{option.label}</div>
                  </div>
                  <div className="vote-card-checkbox">
                    <div className="vote-card-x">
                      <span className="vote-card-x-icon">&#10005;</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Special vote cards (blank/null) */}
            {specialOptions.length > 0 && (
              <div className="vote-cards-special">
                {specialOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`vote-card vote-card-special ${selectedOption === option.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(option.id)}
                  >
                    <div className="vote-card-header">
                      <div className="vote-card-name">
                        {option.option_type === 'BLANK' ? 'Voto en blanco' : 'Voto nulo'}
                      </div>
                      <div className="vote-card-desc">
                        {option.option_type === 'BLANK'
                          ? 'No seleccionar ninguna opcion'
                          : 'Anular mi voto intencionalmente'}
                      </div>
                    </div>
                    <div className="vote-card-checkbox">
                      <div className="vote-card-x">
                        <span className="vote-card-x-icon">&#10005;</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ballot-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/votaciones')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Volver
            </button>
            <button
              className="btn btn-accent"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.5 }}
              onClick={() => setStage('confirm-dialog')}
            >
              Emitir voto
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
