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

export function getElectionStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'SCHEDULED':
      return 'Programada';
    case 'OPEN':
      return 'Abierta';
    case 'CLOSED':
      return 'Cerrada';
    case 'SCRUTINIZED':
      return 'Escrutada';
    case 'ARCHIVED':
      return 'Archivada';
    default:
      return status;
  }
}
