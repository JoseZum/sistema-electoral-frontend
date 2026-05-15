'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { getSuffrageLabel } from '@/lib/suffrage';
import type { ElectionOption, VoterElectionDetail } from '@/types/elections';
import Loader from '@/components/Loader';

type VoteStage = 'loading' | 'voting' | 'confirm-dialog' | 'submitting' | 'success' | 'error';

interface CastVoteResponse {
  message: string;
}

function getOptionDescription(option: ElectionOption) {
  const metadataDescription = option.metadata?.description;
  if (typeof metadataDescription === 'string') {
    return metadataDescription;
  }

  const legacyDescription = (option as ElectionOption & { description?: unknown }).description;
  return typeof legacyDescription === 'string' ? legacyDescription : null;
}

function getGroupedOptions(options: ElectionOption[]) {
  const flatChildren = options.filter((option) => option.parent_option_id);
  const topLevelOptions = options.filter((option) => !option.parent_option_id);

  return topLevelOptions
    .filter((option) => option.suboptions?.length || flatChildren.some((child) => child.parent_option_id === option.id))
    .map((option) => {
      const nestedSuboptions = option.suboptions?.length
        ? option.suboptions
        : flatChildren.filter((child) => child.parent_option_id === option.id);
      return {
        ...option,
        suboptions: nestedSuboptions,
      };
    });
}

function OptionImage({ option }: { option: ElectionOption }) {
  if (!option.image_url) {
    return null;
  }

  return <img className="vote-card-image" src={option.image_url} alt="" />;
}

export default function VotingBoothPage() {
  const params = useParams();
  const router = useRouter();
  const electionId = params.id as string;

  const [election, setElection] = useState<VoterElectionDetail | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedSuboptions, setSelectedSuboptions] = useState<Record<string, string>>({});
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
      setError(err instanceof Error ? err.message : 'Error al cargar la votación');
      setStage('error');
    }
  }, [electionId]);

  useEffect(() => {
    fetchElection();
  }, [fetchElection]);

  async function handleSubmitVote() {
    if (!election) return;

    const groupedOptions = getGroupedOptions(election.options);
    const hasSuboptionBallot = Boolean(election.allow_suboptions || groupedOptions.length > 0) && groupedOptions.length > 0;

    if (!hasSuboptionBallot && !selectedOption) return;

    if (hasSuboptionBallot && groupedOptions.some((option) => !selectedSuboptions[option.id])) {
      setError('Selecciona una subopcion para cada grupo');
      setStage('voting');
      return;
    }

    try {
      setStage('submitting');
      setError(null);

      let castBody: Record<string, unknown>;

      if (hasSuboptionBallot) {
        const selections = groupedOptions.map((option) => ({
          parentOptionId: option.id,
          optionId: selectedSuboptions[option.id],
        }));

        if (selections.some((selection) => !selection.optionId)) {
          throw new Error('Selecciona una subopcion para cada grupo');
        }

        castBody = { electionId, selections };
      } else {
        if (!selectedOption) return;
        castBody = { electionId, optionId: selectedOption };
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
    return <Loader fullscreen />;
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

  const groupedOptions = election ? getGroupedOptions(election.options) : [];
  const hasSuboptionBallot = Boolean(election?.allow_suboptions || groupedOptions.length > 0) && groupedOptions.length > 0;
  const selectedSuboptionLabels = groupedOptions
    .map((parentOption) => {
      const selectedSuboption = parentOption.suboptions?.find((option) => (
        option.id === selectedSuboptions[parentOption.id]
      ));

      return selectedSuboption
        ? { parentLabel: parentOption.label, optionLabel: selectedSuboption.label }
        : null;
    })
    .filter((selection): selection is { parentLabel: string; optionLabel: string } => selection !== null);

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
            {election?.is_anonymous && ' La opcion elegida no puede vincularse a tu identidad.'}
          </p>

          <div className="receipt">
            <div className="receipt-row">
              <span className="receipt-label">Votación</span>
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
                <span className="receipt-label">Selección</span>
                <span className="receipt-value">{selectedLabel}</span>
              </div>
            )}
            {!election?.is_anonymous && hasSuboptionBallot && selectedSuboptionLabels.map((selection) => (
              <div key={selection.parentLabel} className="receipt-row">
                <span className="receipt-label">{selection.parentLabel}</span>
                <span className="receipt-value">{selection.optionLabel}</span>
              </div>
            ))}
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
    (o) => !o.parent_option_id && !o.suboptions?.length && o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE'
  );
  const specialOptions = election.options.filter(
    (o) => !o.parent_option_id && (o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE')
  );

  const allSuboptionGroupsSelected = groupedOptions.length > 0
    && groupedOptions.every((option) => Boolean(selectedSuboptions[option.id]));
  const canSubmit = (hasSuboptionBallot ? allSuboptionGroupsSelected : selectedOption !== null) && stage === 'voting';

  return (
    <>
      {/* Confirm Dialog */}
      {stage === 'confirm-dialog' && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.75rem' }}>Confirmar voto</h3>
            {hasSuboptionBallot ? (
              <div style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                  Estas a punto de emitir tus selecciones para {selectedSuboptionLabels.length} grupo
                  {selectedSuboptionLabels.length === 1 ? '' : 's'}. Esta accion no se puede deshacer.
                </p>
                <div className="vote-confirm-selection-list">
                  {selectedSuboptionLabels.map((selection) => (
                    <div key={selection.parentLabel} className="vote-confirm-selection">
                      <span>{selection.parentLabel}</span>
                      <strong>{selection.optionLabel}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
                Estás a punto de emitir tu voto por{' '}
                <strong style={{ color: 'var(--ink)' }}>
                  {election.options.find((o) => o.id === selectedOption)?.label}
                </strong>
                . Esta acción no se puede deshacer.
              </p>
            )}
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
              {election.is_anonymous ? 'Registrando sufragio por papeleta...' : 'Registrando sufragio publico...'}
            </p>
          </div>
        </div>
      )}

      <div className="voting-booth guilloche-bg">
        <div className="ballot">
          <div className="ballot-header">
            <div className="label" style={{ marginBottom: '0.5rem' }}>
              {getSuffrageLabel(election.is_anonymous)}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>{election.title}</h2>
            <p>{hasSuboptionBallot ? 'Selecciona una subopcion por grupo para emitir tu voto' : 'Selecciona una opción para emitir tu voto'}</p>
          </div>

          <div className="ballot-body">
            {hasSuboptionBallot ? (
              <div className="suboption-ballot-groups">
                {groupedOptions.map((parentOption, parentIndex) => (
                  <section key={parentOption.id} className="suboption-ballot-group">
                    <div className="suboption-ballot-group__header">
                      <div>
                        <div className="suboption-ballot-group__eyebrow">Grupo {parentIndex + 1}</div>
                        <h3>{parentOption.label}</h3>
                        {getOptionDescription(parentOption) && (
                          <p>{getOptionDescription(parentOption)}</p>
                        )}
                      </div>
                      <span className={selectedSuboptions[parentOption.id] ? 'suboption-status complete' : 'suboption-status'}>
                        {selectedSuboptions[parentOption.id] ? 'Seleccionado' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="vote-cards-grid vote-cards-grid--suboptions">
                      {(parentOption.suboptions ?? []).map((option) => {
                        const isSpecialOption = option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE';
                        const description = getOptionDescription(option);

                        return (
                          <div
                            key={option.id}
                            className={`vote-card ${isSpecialOption ? 'vote-card-special' : ''} ${selectedSuboptions[parentOption.id] === option.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedSuboptions((current) => ({ ...current, [parentOption.id]: option.id }));
                              setError(null);
                            }}
                          >
                            <div className="vote-card-header">
                              <OptionImage option={option} />
                              <div className="vote-card-name">
                                {isSpecialOption && option.option_type === 'BLANK' ? 'Voto en blanco' : option.label}
                              </div>
                              {description && <div className="vote-card-desc">{description}</div>}
                            </div>
                            <div className="vote-card-checkbox">
                              <div className="vote-card-x">
                                <span className="vote-card-x-icon">&#10005;</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
            {/* Regular vote cards */}
            <div className="vote-cards-grid">
              {regularOptions.map((option) => (
                <div
                  key={option.id}
                  className={`vote-card ${selectedOption === option.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedOption(option.id);
                    setError(null);
                  }}
                >
                  <div className="vote-card-header">
                    <OptionImage option={option} />
                    <div className="vote-card-name">{option.label}</div>
                    {getOptionDescription(option) && (
                      <div className="vote-card-desc">{getOptionDescription(option)}</div>
                    )}
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
                    onClick={() => {
                      setSelectedOption(option.id);
                      setError(null);
                    }}
                  >
                    <div className="vote-card-header">
                      <div className="vote-card-name">
                        {option.option_type === 'BLANK' ? 'Voto en blanco' : 'Voto nulo'}
                      </div>
                      <div className="vote-card-desc">
                        {option.option_type === 'BLANK'
                          ? 'No seleccionar ninguna opción'
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
              </>
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
