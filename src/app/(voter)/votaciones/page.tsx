'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { VoterElection } from '@/types/elections';

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

  const isOpen = election.status === 'OPEN';
  const isScheduled = election.status === 'SCHEDULED';

  function getScheduledText() {
    if (!election.start_time) return 'Proximamente';
    const diff = new Date(election.start_time).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    if (days <= 0) return 'Pronto';
    return `${days} dia${days !== 1 ? 's' : ''}`;
  }

  return (
    <div
      className={`election-card ${isScheduled ? 'scheduled' : ''}`}
      onClick={() => {
        if (isOpen && !election.has_voted) {
          router.push(`/votaciones/${election.id}`);
        }
      }}
    >
      <div className="election-card-body">
        <div className="election-card-header">
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>{election.title}</h3>
            {election.description && (
              <p className="election-card-desc">{election.description}</p>
            )}
          </div>
          <div className={`status-light ${isOpen ? 'active' : isScheduled ? 'scheduled' : 'closed'}`}>
            <div className="status-light-dots">
              <span className="status-light-dot" />
              <span className="status-light-dot" />
              <span className="status-light-dot" />
            </div>
            {isOpen ? 'Activo' : isScheduled ? 'Programado' : 'Cerrado'}
          </div>
        </div>
      </div>
      <div className="election-card-footer">
          <div className="election-countdown">
          <div className={`countdown-icon ${isOpen ? urgency : 'scheduled'}`}>
            {isOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            )}
          </div>
          <div className="countdown-text">
            <span className="countdown-label">{isOpen ? 'Cierra en' : 'Abre en'}</span>
            <span className={`countdown-time ${isOpen ? urgency : 'scheduled'}`}>
              {isOpen ? countdown : getScheduledText()}
            </span>
          </div>
        </div>

        {isOpen && !election.has_voted ? (
          <button className="election-vote-btn">
            Votar
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        ) : isOpen && election.has_voted ? (
          <span className="badge badge-dot badge-open" style={{ fontSize: '0.8125rem' }}>Ya votaste</span>
        ) : (
          <button className="election-vote-btn" disabled>
            Proximamente
          </button>
        )}
      </div>
    </div>
  );
}

export default function VotacionesPage() {
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
        <div className="overline" style={{ marginBottom: '0.75rem' }}>Votaciones disponibles</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}>Tus elecciones activas</h2>
        <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Selecciona una votacion para emitir tu voto.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
          Cargando votaciones...
        </div>
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
        elections.map((election, i) => (
          <div
            key={election.id}
            style={{ opacity: 0, animation: `fadeInUp 0.5s var(--ease-out) ${0.1 + i * 0.1}s forwards` }}
          >
            <ElectionCard election={election} />
          </div>
        ))
      )}
    </div>
  );
}
