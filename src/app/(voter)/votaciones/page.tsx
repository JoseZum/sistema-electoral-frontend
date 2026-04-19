'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { VoterElection } from '@/types/elections';
import Loader from '@/components/Loader';

function useCountdown(endTime: string | null) {
  const [text, setText] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'urgent'>('normal');

  useEffect(() => {
    if (!endTime) return;

    function update() {
      const diff = new Date(endTime!).getTime() - Date.now();
      if (diff <= 0) {
        setText('Cerrada');
        setUrgency('urgent');
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      const totalSeconds = Math.floor(diff / 1000);

      setText(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

      if (totalSeconds < 30 * 60) setUrgency('urgent');
      else if (totalSeconds < 2 * 3_600) setUrgency('warning');
      else setUrgency('normal');
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return { text, urgency };
}

function ElectionCard({ election }: { election: VoterElection }) {
  const router = useRouter();
  const { text: countdown, urgency } = useCountdown(
    election.status === 'OPEN' ? election.end_time : null
  );
  const [timeLeft, setTimeLeft] = useState(100);

  const isActive = election.status === 'OPEN';
  const isScheduled = election.status === 'SCHEDULED';
  const canVote = isActive && !election.has_voted;

  useEffect(() => {
    if (!isActive || !election.start_time || !election.end_time) return;
    function update() {
      const start = new Date(election.start_time!).getTime();
      const end = new Date(election.end_time!).getTime();
      const remaining = Math.max(0, Math.min(100, ((end - Date.now()) / (end - start)) * 100));
      setTimeLeft(Math.round(remaining));
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, election.start_time, election.end_time]);

  function getScheduledText() {
    if (!election.start_time) return 'Próximamente';
    const diff = new Date(election.start_time).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days <= 0) return 'Pronto';
    return `En ${days} día${days !== 1 ? 's' : ''}`;
  }

  return (
    <div
      className={`elec-card${canVote ? ' elec-card--votable' : ''}${!isActive ? ' elec-card--disabled' : ''}`}
      onClick={() => canVote && router.push(`/votaciones/${election.id}`)}
      role={canVote ? 'button' : undefined}
      tabIndex={canVote ? 0 : undefined}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && canVote) {
          e.preventDefault();
          router.push(`/votaciones/${election.id}`);
        }
      }}
      aria-label={canVote ? `Votar en: ${election.title}` : election.title}
    >
      {/* Incognito icon – top right */}
      <div className="elec-card__anon-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="m4.736 1.968-.892 3.269-.014.058C2.113 5.568 1 6.006 1 6.5 1 7.328 4.134 8 8 8s7-.672 7-1.5c0-.494-1.113-.932-2.83-1.205l-.014-.058-.892-3.27c-.146-.533-.698-.849-1.239-.734C9.411 1.363 8.62 1.5 8 1.5s-1.411-.136-2.025-.267c-.541-.115-1.093.2-1.239.735m.015 3.867a.25.25 0 0 1 .274-.224c.9.092 1.91.143 2.975.143a30 30 0 0 0 2.975-.143.25.25 0 0 1 .05.498c-.918.093-1.944.145-3.025.145s-2.107-.052-3.025-.145a.25.25 0 0 1-.224-.274M3.5 10h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5m-1.5.5q.001-.264.085-.5H2a.5.5 0 0 1 0-1h3.5a1.5 1.5 0 0 1 1.488 1.312 3.5 3.5 0 0 1 2.024 0A1.5 1.5 0 0 1 10.5 9H14a.5.5 0 0 1 0 1h-.085q.084.236.085.5v1a2.5 2.5 0 0 1-5 0v-.14l-.21-.07a2.5 2.5 0 0 0-1.58 0l-.21.07v.14a2.5 2.5 0 0 1-5 0zm8.5-.5h2a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-3 0v-1a.5.5 0 0 1 .5-.5"/>
        </svg>
      </div>

      <div className="elec-card__badge-row">
        {isActive && !election.has_voted && (
          <span className="elec-card__badge elec-card__badge--active">
            <span className="elec-card__pulse" />
            Activa
          </span>
        )}
        {election.has_voted && (
          <span className="elec-card__badge elec-card__badge--voted">✓ Voto emitido</span>
        )}
        {isScheduled && (
          <span className="elec-card__badge elec-card__badge--scheduled">{getScheduledText()}</span>
        )}
      </div>

      <div className="elec-card__body">
        <h3 className="elec-card__title">{election.title}</h3>
        {election.description && (
          <p className="elec-card__desc">{election.description}</p>
        )}
      </div>

      {isActive && (
        <div className="elec-card__timer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className={`elec-card__timer-value${urgency !== 'normal' ? ` ${urgency}` : ''}`}>{countdown}</span>
        </div>
      )}

      {isActive && election.start_time && (
        <div className="elec-card__progress-wrap">
          <div className="elec-card__progress-track">
            <div
              className={`elec-card__progress-fill${urgency !== 'normal' ? ` ${urgency}` : ''}`}
              style={{ width: `${timeLeft}%` }}
            />
          </div>
          <span className="elec-card__progress-label">{timeLeft}% tiempo restante</span>
        </div>
      )}

      {canVote && (
        <div className="elec-card__cta">
          <span>Votar ahora</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function VotacionesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [elections, setElections] = useState<VoterElection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<VoterElection[]>('/api/voting/elections');
      setElections(data);
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  return (
    <div className="voter-content">
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="overline" style={{ marginBottom: '0.75rem' }}>Votaciones disponibles</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Tus elecciones activas</h2>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Selecciona una votacion para emitir tu voto.</p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/padron')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Panel Admin
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : elections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '1rem' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Sin votaciones disponibles</h3>
          <p>No tienes votaciones activas en este momento.</p>
        </div>
      ) : (
        <div className="elec-grid">
          {elections.map((election, i) => (
            <div
              key={election.id}
              style={{ opacity: 0, animation: `fadeInUp 0.5s var(--ease-out) ${0.1 + i * 0.1}s forwards` }}
            >
              <ElectionCard election={election} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
