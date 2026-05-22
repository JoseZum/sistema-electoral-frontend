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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const BADGE_COLORS = ['#1B365D', '#2D6A4F', '#8B1A2B', '#5C4033', '#1E4D8C', '#8B6914', '#1A4731', '#6B2D3E'];

function toRoman(n: number): string {
  return ROMAN[n] ?? String(n + 1);
}

function getInitials(label: string): string {
  return label.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function getBadgeColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i)) | 0;
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length];
}

function getOptionDescription(option: ElectionOption) {
  const metadataDescription = option.metadata?.description;
  if (typeof metadataDescription === 'string') return metadataDescription;
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
      return { ...option, suboptions: nestedSuboptions };
    });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 5 4.5 9 11 1" />
    </svg>
  );
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
      setStage(data.has_voted ? 'success' : 'voting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la votación');
      setStage('error');
    }
  }, [electionId]);

  useEffect(() => { fetchElection(); }, [fetchElection]);

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
        if (selections.some((s) => !s.optionId)) throw new Error('Selecciona una subopcion para cada grupo');
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

  if (stage === 'loading') return <Loader fullscreen />;

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
      const selectedSuboption = parentOption.suboptions?.find((o) => o.id === selectedSuboptions[parentOption.id]);
      return selectedSuboption
        ? { parentLabel: parentOption.label, optionLabel: selectedSuboption.label }
        : null;
    })
    .filter((s): s is { parentLabel: string; optionLabel: string } => s !== null);

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
            {!election?.is_anonymous && hasSuboptionBallot && selectedSuboptionLabels.map((s) => (
              <div key={s.parentLabel} className="receipt-row">
                <span className="receipt-label">{s.parentLabel}</span>
                <span className="receipt-value">{s.optionLabel}</span>
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

  const regularOptions = election.options.filter(
    (o) => !o.parent_option_id && !o.suboptions?.length && o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE'
  );
  const specialOptions = election.options.filter(
    (o) => !o.parent_option_id && (o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE')
  );

  const allSuboptionGroupsSelected = groupedOptions.length > 0 && groupedOptions.every((o) => Boolean(selectedSuboptions[o.id]));
  const canSubmit = (hasSuboptionBallot ? allSuboptionGroupsSelected : selectedOption !== null) && stage === 'voting';

  return (
    <>
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
                  {selectedSuboptionLabels.map((s) => (
                    <div key={s.parentLabel} className="vote-confirm-selection">
                      <span>{s.parentLabel}</span>
                      <strong>{s.optionLabel}</strong>
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
            <p>
              {hasSuboptionBallot
                ? 'Selecciona una opción por cada candidatura para emitir tu voto'
                : 'Selecciona una opción para emitir tu voto'}
            </p>
          </div>

          <div className="ballot-body">
            {hasSuboptionBallot ? (
              <div className="ballot-sections">
                {groupedOptions.map((parentOption, idx) => {
                  const regularSubopts = (parentOption.suboptions ?? []).filter(
                    (o) => o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE'
                  );
                  const specialSubopts = (parentOption.suboptions ?? []).filter(
                    (o) => o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE'
                  );
                  const isSelected = Boolean(selectedSuboptions[parentOption.id]);
                  const description = getOptionDescription(parentOption);

                  return (
                    <div key={parentOption.id} className="ballot-section">
                      <div className="ballot-section-header">
                        <span className="ballot-roman">{toRoman(idx)}</span>
                        {parentOption.image_url ? (
                          <img className="ballot-initials ballot-initials--img" src={parentOption.image_url} alt="" />
                        ) : (
                          <div className="ballot-initials" style={{ backgroundColor: getBadgeColor(parentOption.id) }}>
                            {getInitials(parentOption.label)}
                          </div>
                        )}
                        <div className="ballot-candidate-info">
                          <div className="ballot-candidate-name">{parentOption.label}</div>
                          {description && <div className="ballot-candidate-sub">{description}</div>}
                        </div>
                        <div className={`ballot-status${isSelected ? ' ballot-status--done' : ''}`}>
                          <span className="ballot-status-dot" />
                          {isSelected ? 'Seleccionado' : 'Pendiente'}
                        </div>
                      </div>

                      <div className="ballot-choices">
                        {regularSubopts.map((option) => {
                          const checked = selectedSuboptions[parentOption.id] === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`ballot-choice${checked ? ' ballot-choice--selected' : ''}`}
                              onClick={() => {
                                setSelectedSuboptions((cur) => ({ ...cur, [parentOption.id]: option.id }));
                                setError(null);
                              }}
                            >
                              <div className="ballot-choice-box">
                                {checked && <CheckIcon />}
                              </div>
                              <span className="ballot-choice-label">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {specialSubopts.length > 0 && (
                        <div className="ballot-specials">
                          {specialSubopts.map((option) => {
                            const checked = selectedSuboptions[parentOption.id] === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`ballot-special${checked ? ' ballot-special--selected' : ''}`}
                                onClick={() => {
                                  setSelectedSuboptions((cur) => ({ ...cur, [parentOption.id]: option.id }));
                                  setError(null);
                                }}
                              >
                                <div className="ballot-special-box">
                                  {checked && <CheckIcon />}
                                </div>
                                <span>
                                  {option.option_type === 'BLANK' ? 'Voto en blanco' : 'Voto nulo'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ballot-sections">
                <div className="ballot-section">
                  <div className="ballot-choices">
                    {regularOptions.map((option) => {
                      const checked = selectedOption === option.id;
                      const description = getOptionDescription(option);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`ballot-choice${checked ? ' ballot-choice--selected' : ''}`}
                          onClick={() => { setSelectedOption(option.id); setError(null); }}
                        >
                          {option.image_url && (
                            <img className="ballot-choice-img" src={option.image_url} alt="" />
                          )}
                          <div className="ballot-choice-box">
                            {checked && <CheckIcon />}
                          </div>
                          <span className="ballot-choice-label">{option.label}</span>
                          {description && <span className="ballot-choice-desc">{description}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {specialOptions.length > 0 && (
                    <div className="ballot-specials">
                      {specialOptions.map((option) => {
                        const checked = selectedOption === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`ballot-special${checked ? ' ballot-special--selected' : ''}`}
                            onClick={() => { setSelectedOption(option.id); setError(null); }}
                          >
                            <div className="ballot-special-box">
                              {checked && <CheckIcon />}
                            </div>
                            <span>
                              {option.option_type === 'BLANK' ? 'Voto en blanco' : 'Voto nulo'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
