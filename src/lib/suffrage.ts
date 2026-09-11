export function getSuffrageLabel(isAnonymous: boolean): string {
  return isAnonymous ? 'Sufragio por papeleta' : 'Sufragio público';
}

export function getSuffrageDescription(isAnonymous: boolean): string {
  return isAnonymous
    ? 'La opción elegida no se revela por persona; solo se informa si participó o no.'
    : 'La opción elegida queda visible por persona y las abstenciones se marcan en el detalle.';
}

export function getParticipationLabel(hasVoted: boolean): string {
  return hasVoted ? 'Sí' : 'No';
}

export function getNoVoteLabel(): string {
  return 'No votó';
}

/** Unica fuente de los nombres de estado de una eleccion que ve el usuario. */
export const ELECTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  SCRUTINIZED: 'Escrutada',
  ARCHIVED: 'Archivada',
};

export function getElectionStatusLabel(status: string): string {
  return ELECTION_STATUS_LABELS[status] ?? status;
}
