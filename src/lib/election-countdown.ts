export interface ElectionCountdownInput {
  status: string;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ElectionCountdownState {
  label: string;
  value: string;
  isLive: boolean;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCountdownDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  return `${minutes}m ${pad(seconds)}s`;
}

export function getElectionCountdown(
  election: ElectionCountdownInput,
  now = Date.now(),
): ElectionCountdownState {
  const startTime = parseTimestamp(election.startTime);
  const endTime = parseTimestamp(election.endTime);

  if (election.status === 'OPEN') {
    if (endTime === null) {
      return { label: 'Cierre', value: 'Sin definir', isLive: false };
    }

    if (endTime <= now) {
      return { label: 'Cierre', value: 'Pendiente', isLive: false };
    }

    return {
      label: 'Cierra en',
      value: formatCountdownDuration(endTime - now),
      isLive: true,
    };
  }

  if (election.status === 'SCHEDULED') {
    if (startTime === null) {
      return { label: 'Inicio', value: 'Sin definir', isLive: false };
    }

    if (startTime <= now) {
      return { label: 'Inicio', value: 'Pendiente', isLive: false };
    }

    return {
      label: 'Inicia en',
      value: formatCountdownDuration(startTime - now),
      isLive: true,
    };
  }

  if (election.status === 'DRAFT') {
    return { label: 'Estado', value: 'Pendiente', isLive: false };
  }

  return { label: 'Estado', value: 'Finalizada', isLive: false };
}
