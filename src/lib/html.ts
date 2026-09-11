/**
 * Escapa el texto que se interpola en el HTML que arma el cliente: la replica
 * de la papeleta y la exportacion de resultados.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
