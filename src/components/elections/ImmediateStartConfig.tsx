'use client';

interface ImmediateStartConfigProps {
  startTime: string;
  endTime: string;
  startsImmediately: boolean;
  immediateMinutes: string;
  onChange: (next: {
    startTime?: string;
    endTime?: string;
    startsImmediately?: boolean;
    immediateMinutes?: string;
  }) => void;
}

export default function ImmediateStartConfig({
  startTime,
  endTime,
  startsImmediately,
  immediateMinutes,
  onChange,
}: ImmediateStartConfigProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="input-group">
          <label>Fecha y hora de apertura</label>
          <input
            type="datetime-local"
            className="input"
            value={startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
            disabled={startsImmediately}
          />
        </div>
        <div className="input-group">
          <label>Fecha y hora de cierre</label>
          <input
            type="datetime-local"
            className="input"
            value={endTime}
            onChange={(event) => onChange({ endTime: event.target.value })}
            disabled={startsImmediately}
          />
        </div>
      </div>

      <div
        style={{
          padding: '1rem 1.1rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: startsImmediately ? 'var(--accent-light)' : 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={startsImmediately}
            onChange={(event) => onChange({ startsImmediately: event.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          Iniciar cuando se cree
        </label>

        <div className="input-group" style={{ maxWidth: 220 }}>
          <label>Minutos inmediatos</label>
          <input
            type="number"
            min={1}
            step={1}
            className="input"
            value={immediateMinutes}
            onChange={(event) => onChange({ immediateMinutes: event.target.value })}
            disabled={!startsImmediately}
            placeholder="15"
          />
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
          Si activas esta opción, la votación se abrirá al guardarse y correrá durante la cantidad de minutos indicada.
        </p>
      </div>
    </div>
  );
}

