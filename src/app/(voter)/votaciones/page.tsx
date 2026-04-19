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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { text: countdown, urgency } = useCountdown(
    election.status === 'OPEN' ? election.end_time : null
  );

  const isActive = election.status === 'OPEN';
  const isScheduled = election.status === 'SCHEDULED';
  const canVote = isActive && !election.has_voted;

  function getScheduledText() {
    if (!election.start_time) return 'Próximamente';
    const diff = new Date(election.start_time).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days <= 0) return 'Pronto';
    return `En ${days} día${days !== 1 ? 's' : ''}`;
  }

  const handleBookClick = () => {
    if (!isActive) return;
    const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
    if (isTouchDevice) {
      setMobileOpen(prev => !prev);
    } else if (canVote) {
      router.push(`/votaciones/${election.id}`);
    }
  };

  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canVote) router.push(`/votaciones/${election.id}`);
  };

  const year = election.end_time
    ? new Date(election.end_time).getFullYear()
    : new Date().getFullYear();

  return (
    <div
      className={`book-card${mobileOpen ? ' book-card--open' : ''}${!isActive ? ' book-card--disabled' : ''}`}
      onClick={handleBookClick}
      role={isActive ? 'button' : undefined}
      tabIndex={canVote ? 0 : undefined}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBookClick(); } }}
      aria-label={canVote ? `Votar en: ${election.title}` : election.title}
    >
      {/* Interior – parchment page visible behind the cover */}
      <div className="book-card__interior">
        <div className="book-card__chapter">§ Convocatoria Electoral</div>
        <h4 className="book-card__inner-title">{election.title}</h4>
        {election.description && (
          <p className="book-card__inner-desc">{election.description}</p>
        )}
        <div className="book-card__divider" />
        {isActive && (
          <div className="book-card__countdown">
            <span className="book-card__countdown-label">Cierra en</span>
            <span className={`book-card__countdown-time ${urgency}`}>{countdown}</span>
          </div>
        )}
        {isScheduled && (
          <div className="book-card__countdown">
            <span className="book-card__countdown-label">Abre</span>
            <span className="book-card__countdown-time">{getScheduledText()}</span>
          </div>
        )}
        {canVote ? (
          <button className="book-card__vote-btn" onClick={handleVote}>
            Emitir voto
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        ) : isActive ? (
          <div className="book-card__voted">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Voto registrado
          </div>
        ) : null}
      </div>

      {/* Cover – rotates away on hover (desktop) or tap (mobile) */}
      <div className="book-card__cover">
        <div className="book-card__spine" />
        <div className="book-card__cover-content">
          {/* Institutional seal */}
          <div className="book-card__seal">
            <svg viewBox="0 0 60 60" width="48" height="48" fill="none">
              <circle cx="30" cy="30" r="26" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2.5"/>
              <circle cx="30" cy="30" r="19" stroke="currentColor" strokeWidth="1"/>
              <line x1="30" y1="15" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="15" y1="30" x2="45" y2="30" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="4" fill="currentColor"/>
            </svg>
          </div>
          <div className="book-card__cover-title">{election.title}</div>
          <div className="book-card__cover-rule" />
          {isActive && !election.has_voted && (
            <div className="book-card__active-badge">
              <span className="book-card__pulse-dot" />
              Votación Activa
            </div>
          )}
          {election.has_voted && (
            <div className="book-card__voted-badge">✓ Voto Emitido</div>
          )}
          {isScheduled && (
            <div className="book-card__scheduled-badge">{getScheduledText()}</div>
          )}
        </div>

        {/* Desktop: hint fades in on hover */}
        {canVote && <div className="book-card__hover-hint">Abrir para votar →</div>}
        {/* Mobile: always visible */}
        {canVote && (
          <div className="book-card__tap-hint">
            {mobileOpen ? '↑ Toca Emitir Voto' : 'Toca para abrir'}
          </div>
        )}

        <div className="book-card__cover-footer">Sistema Electoral · {year}</div>
      </div>
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
        <div className="book-shelf">
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
