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

  return value === 1 ? 'día' : 'días';
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
    <div className="schedule-mode-grid">
      <div className={`schedule-mode-card ${!startsImmediately ? 'selected' : ''}`}>
        <button
          type="button"
          className="schedule-mode-card__select"
          onClick={() => onChange({ startsImmediately: false })}
          aria-pressed={!startsImmediately}
        >
          <div className="schedule-mode-card__header">
            <div>
              <div className="schedule-mode-card__eyebrow">Programada</div>
              <div className="schedule-mode-card__title">Elegir apertura y cierre</div>
            </div>
            <span className="schedule-mode-card__indicator" aria-hidden="true" />
          </div>
          <p className="schedule-mode-card__description">
            Define una ventana exacta para abrir y cerrar la votación.
          </p>
        </button>

        <div className="schedule-mode-card__body">
          <div className="create-election-field-grid">
            <div className="input-group">
              <label>Fecha y hora de apertura</label>
              <input
                type="datetime-local"
                className="input"
                aria-label="Fecha y hora de apertura"
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
                aria-label="Fecha y hora de cierre"
                value={endTime}
                onChange={(event) => onChange({ endTime: event.target.value })}
                disabled={startsImmediately}
              />
            </div>
          </div>
          <p className="schedule-mode-card__summary">
            {!startsImmediately
              ? 'La votación seguirá el calendario que definas en estos campos.'
              : 'Selecciona esta card si necesitas programar la apertura y el cierre.'}
          </p>
        </div>
      </div>

      <div className={`schedule-mode-card ${startsImmediately ? 'selected' : ''}`}>
        <button
          type="button"
          className="schedule-mode-card__select"
          onClick={() => onChange({ startsImmediately: true })}
          aria-pressed={startsImmediately}
        >
          <div className="schedule-mode-card__header">
            <div>
              <div className="schedule-mode-card__eyebrow">Rápida</div>
              <div className="schedule-mode-card__title">Iniciar cuando se cree</div>
            </div>
            <span className="schedule-mode-card__indicator" aria-hidden="true" />
          </div>
          <p className="schedule-mode-card__description">
            Útil para votaciones express que deben abrirse en cuanto se publiquen.
          </p>
        </button>

        <div className="schedule-mode-card__body">
          <div className="create-election-field-grid">
            <div className="input-group">
              <label>Duración</label>
              <select
                className="input"
                aria-label="Duracion de la votacion inmediata"
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
                aria-label="Unidad de duracion de la votacion inmediata"
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
                <option value="days">Días</option>
              </select>
            </div>
          </div>

          <p className="schedule-mode-card__summary">
            {startsImmediately && summary
              ? `La votación se iniciará apenas se cree y durará ${summary}.`
              : 'Selecciona esta opción si la votación debe iniciar de inmediato.'}
          </p>
        </div>
      </div>
    </div>
  );
}
