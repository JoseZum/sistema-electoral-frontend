'use client';

export type ImmediateDurationUnit = 'minutes' | 'hours' | 'days';

interface ImmediateStartConfigProps {
  startTime: string;
  endTime: string;
  startsImmediately: boolean;
  durationValue: string;
  durationUnit: ImmediateDurationUnit;
  onChange: (next: {
    startTime?: string;
    endTime?: string;
    startsImmediately?: boolean;
    durationValue?: string;
    durationUnit?: ImmediateDurationUnit;
  }) => void;
}

const DURATION_OPTIONS: Record<ImmediateDurationUnit, number[]> = {
  minutes: Array.from({ length: 59 }, (_, index) => index + 1),
  hours: Array.from({ length: 24 }, (_, index) => index + 1),
  days: Array.from({ length: 30 }, (_, index) => index + 1),
};

function getUnitLabel(unit: ImmediateDurationUnit, value: number): string {
  if (unit === 'minutes') {
    return value === 1 ? 'minuto' : 'minutos';
  }

  if (unit === 'hours') {
    return value === 1 ? 'hora' : 'horas';
  }

  return value === 1 ? 'dia' : 'dias';
}

export function formatImmediateDuration(value: string, unit: ImmediateDurationUnit): string {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return '';
  }

  return `${numericValue} ${getUnitLabel(unit, numericValue)}`;
}

export function getImmediateDurationMinutes(value: string, unit: ImmediateDurationUnit): number | null {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }

  if (unit === 'minutes') return numericValue;
  if (unit === 'hours') return numericValue * 60;
  return numericValue * 24 * 60;
}

export default function ImmediateStartConfig({
  startTime,
  endTime,
  startsImmediately,
  durationValue,
  durationUnit,
  onChange,
}: ImmediateStartConfigProps) {
  const options = DURATION_OPTIONS[durationUnit];
  const summary = formatImmediateDuration(durationValue, durationUnit);

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
        <label
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--ink-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <input
            type="checkbox"
            checked={startsImmediately}
            onChange={(event) => onChange({ startsImmediately: event.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          Iniciar cuando se cree
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) minmax(180px, 220px)', gap: '0.75rem', alignItems: 'end' }}>
          <div className="input-group">
            <label>Duracion</label>
            <select
              className="input"
              value={durationValue}
              onChange={(event) => onChange({ durationValue: event.target.value })}
              disabled={!startsImmediately}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Unidad</label>
            <select
              className="input"
              value={durationUnit}
              onChange={(event) => {
                const nextUnit = event.target.value as ImmediateDurationUnit;
                const nextOptions = DURATION_OPTIONS[nextUnit];
                const currentValue = Number(durationValue);
                const nextValue = nextOptions.includes(currentValue) ? durationValue : String(nextOptions[0]);

                onChange({
                  durationUnit: nextUnit,
                  durationValue: nextValue,
                });
              }}
              disabled={!startsImmediately}
            >
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
          {startsImmediately && summary
            ? `La votacion se iniciara apenas se cree y tendra una duracion de ${summary}.`
            : 'Si activas esta opcion, la votacion se abrira al publicarse y correra por la duracion seleccionada.'}
        </p>
      </div>
    </div>
  );
}
