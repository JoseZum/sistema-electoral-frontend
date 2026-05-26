import type { ElectionResultOption, ElectionResults } from '@/types/elections';
import { getSuffrageLabel } from '@/lib/suffrage';

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
];

const BADGE_COLORS = ['#1B365D', '#2D6A4F', '#8B1A2B', '#5C4033', '#1E4D8C', '#8B6914', '#1A4731', '#6B2D3E'];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toRoman(n: number): string {
  return ROMAN[n] ?? String(n + 1);
}

function getInitials(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getBadgeColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 37 + id.charCodeAt(i)) | 0;
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length];
}

function getOptionDescription(option: Pick<ElectionResultOption, 'metadata'>): string | null {
  const metadataDescription = option.metadata?.description;
  return typeof metadataDescription === 'string' ? metadataDescription : null;
}

function isSpecialOption(option: ElectionResultOption): boolean {
  return option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE';
}

function getResultGroups(options: ElectionResultOption[]) {
  const flatChildren = options.filter((option) => option.parent_option_id);
  const topLevelOptions = options.filter((option) => !option.parent_option_id);

  return topLevelOptions
    .filter((option) =>
      option.suboptions?.length || flatChildren.some((child) => child.parent_option_id === option.id),
    )
    .map((option) => ({
      ...option,
      suboptions: option.suboptions?.length
        ? option.suboptions
        : flatChildren.filter((child) => child.parent_option_id === option.id),
    }));
}

function chunkBy<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function columnsForCount(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return count;
  return 4;
}

function renderChoiceCell(option: ElectionResultOption, cellWidthPct: number): string {
  const description = getOptionDescription(option);
  const label = escapeHtml(option.label);
  const desc = description ? `<div class="ballot-replica-choice-desc">${escapeHtml(description)}</div>` : '';
  const photo = option.image_url
    ? `<img class="ballot-replica-choice-img" src="${escapeHtml(option.image_url)}" alt="" />`
    : '';
  return `
    <td class="ballot-replica-choice-cell" width="${cellWidthPct}%" valign="top">
      <table class="ballot-replica-choice-inner" cellspacing="0" cellpadding="0" border="0" role="presentation">
        <tbody>
          ${photo ? `<tr><td align="center" class="ballot-replica-choice-img-wrap">${photo}</td></tr>` : ''}
          <tr><td align="center"><div class="ballot-replica-choice-box"></div></td></tr>
          <tr><td align="center" class="ballot-replica-choice-label">${label}</td></tr>
          ${desc ? `<tr><td align="center">${desc}</td></tr>` : ''}
        </tbody>
      </table>
    </td>
  `;
}

function renderChoicesTable(options: ElectionResultOption[]): string {
  if (options.length === 0) return '';
  const cols = columnsForCount(options.length);
  const widthPct = Math.floor(100 / cols);
  const rows = chunkBy(options, cols);

  const trs = rows
    .map((row) => {
      const cells = row.map((opt) => renderChoiceCell(opt, widthPct)).join('');
      const padCount = cols - row.length;
      const padCells =
        padCount > 0
          ? Array.from({ length: padCount })
              .map(() => `<td class="ballot-replica-choice-cell ballot-replica-choice-cell--empty" width="${widthPct}%">&nbsp;</td>`)
              .join('')
          : '';
      return `<tr>${cells}${padCells}</tr>`;
    })
    .join('');

  return `
    <table class="ballot-replica-choices" cellspacing="0" cellpadding="0" border="0" role="presentation">
      <tbody>${trs}</tbody>
    </table>
  `;
}

function renderSpecialRow(specials: ElectionResultOption[]): string {
  if (specials.length === 0) return '';
  const cells = specials
    .map((opt) => {
      const label = opt.option_type === 'BLANK' ? 'Voto en blanco' : 'Voto nulo';
      return `
        <td class="ballot-replica-special-cell" valign="middle">
          <table cellspacing="0" cellpadding="0" border="0" role="presentation"><tbody><tr>
            <td valign="middle"><div class="ballot-replica-special-box"></div></td>
            <td valign="middle" class="ballot-replica-special-label">&nbsp;${escapeHtml(label)}</td>
          </tr></tbody></table>
        </td>
      `;
    })
    .join('');
  return `
    <table class="ballot-replica-specials" cellspacing="0" cellpadding="0" border="0" role="presentation">
      <tbody><tr>${cells}</tr></tbody>
    </table>
  `;
}

function renderSectionHeader(parent: ElectionResultOption, index: number): string {
  const description = getOptionDescription(parent);
  const photoMarkup = parent.image_url
    ? `<img class="ballot-replica-section-photo" src="${escapeHtml(parent.image_url)}" alt="" />`
    : `<div class="ballot-replica-section-initials" style="background:${getBadgeColor(parent.id)}">${escapeHtml(getInitials(parent.label))}</div>`;

  return `
    <table class="ballot-replica-section-header" cellspacing="0" cellpadding="0" border="0" role="presentation">
      <tbody><tr>
        <td valign="middle" class="ballot-replica-section-roman">${toRoman(index)}</td>
        <td valign="middle" class="ballot-replica-section-photo-cell">${photoMarkup}</td>
        <td valign="middle" class="ballot-replica-section-info">
          <div class="ballot-replica-section-name">${escapeHtml(parent.label)}</div>
          ${description ? `<div class="ballot-replica-section-sub">${escapeHtml(description)}</div>` : ''}
        </td>
      </tr></tbody>
    </table>
  `;
}

function renderBody(results: ElectionResults): string {
  const allOptions = results.options;
  const groups = getResultGroups(allOptions);
  const hasSuboptions = groups.length > 0;

  if (hasSuboptions) {
    return groups
      .map((parent, idx) => {
        const subs = parent.suboptions ?? [];
        const regular = subs.filter((o) => !isSpecialOption(o));
        const specials = subs.filter(isSpecialOption);
        return `
          <div class="ballot-replica-section">
            ${renderSectionHeader(parent, idx)}
            ${renderChoicesTable(regular)}
            ${renderSpecialRow(specials)}
          </div>
        `;
      })
      .join('');
  }

  const topLevel = allOptions.filter((o) => !o.parent_option_id);
  const regular = topLevel.filter((o) => !isSpecialOption(o));
  const specials = topLevel.filter(isSpecialOption);

  return `
    <div class="ballot-replica-section">
      ${renderChoicesTable(regular)}
      ${renderSpecialRow(specials)}
    </div>
  `;
}

export function buildBallotReplicaSection(results: ElectionResults, folio: string): string {
  const groups = getResultGroups(results.options);
  const hasSub = groups.length > 0;
  const subtitle = hasSub
    ? 'Selecciona una opción por cada candidatura para emitir tu voto'
    : 'Selecciona una opción para emitir tu voto';
  const eyebrow = getSuffrageLabel(results.election.is_anonymous).toUpperCase();
  const electionTitle = escapeHtml(results.election.title);

  if (results.options.length === 0) {
    return `
      <section class="panel ballot-replica-panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Boleta</div>
            <h2>Réplica de la papeleta de voto</h2>
          </div>
        </div>
        <p class="empty-state">No hay opciones configuradas para reconstruir la boleta.</p>
      </section>
    `;
  }

  return `
    <section class="panel ballot-replica-panel">
      <div class="section-header">
        <div>
          <div class="section-kicker">Boleta</div>
          <h2>Réplica de la papeleta de voto</h2>
          <p>Reproducción documental de la boleta exactamente como se presentó al votante. Los cuadros se muestran sin marcar; los conteos se detallan en las secciones de resultados.</p>
        </div>
      </div>
      <div class="ballot-replica-wrap">
        <div class="ballot-replica">
          <div class="ballot-replica-header">
            <div class="ballot-replica-eyebrow">${escapeHtml(eyebrow)}</div>
            <div class="ballot-replica-title">${electionTitle}</div>
            <div class="ballot-replica-subtitle">${subtitle}</div>
          </div>
          <div class="ballot-replica-body">${renderBody(results)}</div>
          <div class="ballot-replica-footer">
            <span>Réplica documental de la boleta original</span>
            <span class="ballot-replica-folio">${escapeHtml(folio)}</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

export const BALLOT_REPLICA_STYLES = `
  .ballot-replica-panel { background: #ffffff; }
  .ballot-replica-wrap {
    display: block;
    margin: 0 auto;
    padding: 4px 0 0;
  }
  .ballot-replica {
    width: 100%;
    max-width: 660px;
    margin: 0 auto;
    background: #FDFAF4;
    border: 1px solid #C4BDB0;
    border-radius: 4px;
    overflow: hidden;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    mso-page-break-inside: avoid;
  }
  .ballot-replica-header {
    background: #ffffff;
    border-bottom: 2px solid #0F1E40;
    padding: 18px 22px 16px;
    text-align: center;
  }
  .ballot-replica-eyebrow {
    font-size: 8.5pt;
    letter-spacing: 0.18em;
    color: #8A8070;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 700;
  }
  .ballot-replica-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 16pt;
    color: #0F1E40;
    margin-bottom: 4px;
    font-weight: 700;
  }
  .ballot-replica-subtitle {
    color: #6B6557;
    font-size: 9pt;
  }
  .ballot-replica-body { padding: 0; background: #FDFAF4; }
  .ballot-replica-section { border-bottom: 1px solid #C4BDB0; }
  .ballot-replica-section:last-child { border-bottom: none; }

  .ballot-replica-section-header {
    width: 100%;
    border-collapse: collapse;
    background: #FDFAF4;
    border-bottom: 1px solid #E2DAD0;
  }
  .ballot-replica-section-header td { padding: 10px 14px; }
  .ballot-replica-section-roman {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 12pt;
    color: #8A8070;
    width: 36px;
    text-align: center;
    white-space: nowrap;
  }
  .ballot-replica-section-photo-cell { width: 92px; }
  .ballot-replica-section-photo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    background: #fff;
    border: 1px solid #E2DAD0;
    border-radius: 6px;
    padding: 4px;
    display: block;
  }
  .ballot-replica-section-initials {
    width: 44px;
    height: 44px;
    border-radius: 3px;
    color: #ffffff;
    font-weight: 700;
    font-size: 10pt;
    letter-spacing: 0.03em;
    text-align: center;
    line-height: 44px;
    display: inline-block;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ballot-replica-section-name {
    font-weight: 700;
    font-size: 10pt;
    color: #0F1E40;
    line-height: 1.3;
  }
  .ballot-replica-section-sub {
    font-size: 8.5pt;
    color: #6B6557;
    margin-top: 2px;
  }

  .ballot-replica-choices {
    width: 100%;
    border-collapse: collapse;
    background: #C4BDB0;
    table-layout: fixed;
  }
  .ballot-replica-choice-cell {
    background: #FDFAF4;
    border: 1px solid #C4BDB0;
    padding: 18px 10px 14px;
    text-align: center;
    vertical-align: top;
    page-break-inside: avoid;
    mso-page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ballot-replica-choice-cell--empty { background: #FDFAF4; border: 1px solid #C4BDB0; }
  .ballot-replica-choice-inner { width: 100%; }
  .ballot-replica-choice-inner td { padding: 4px 0; }
  .ballot-replica-choice-img-wrap { padding-bottom: 8px !important; }
  .ballot-replica-choice-img {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #C4BDB0;
    background: #f8fafc;
    display: inline-block;
  }
  .ballot-replica-choice-box {
    width: 32px;
    height: 32px;
    border: 2px solid #0F1E40;
    background: #ffffff;
    display: inline-block;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ballot-replica-choice-label {
    font-size: 9.5pt;
    font-weight: 600;
    color: #0F1E40;
    line-height: 1.3;
    padding-top: 8px !important;
  }
  .ballot-replica-choice-desc {
    font-size: 8pt;
    color: #6B6557;
    line-height: 1.35;
    padding: 2px 4px 0;
  }

  .ballot-replica-specials {
    width: 100%;
    background: #FDFAF4;
    border-collapse: collapse;
    border-top: 1px dashed #B0A898;
  }
  .ballot-replica-special-cell {
    padding: 8px 18px;
    font-size: 9pt;
    font-style: italic;
    color: #6B6557;
  }
  .ballot-replica-special-box {
    width: 14px;
    height: 14px;
    border: 1px solid #0F1E40;
    background: #ffffff;
    display: inline-block;
    vertical-align: middle;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ballot-replica-special-label { font-style: italic; }

  .ballot-replica-footer {
    border-top: 2px solid #0F1E40;
    background: #ffffff;
    padding: 8px 18px;
    font-size: 8pt;
    color: #6B6557;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ballot-replica-folio {
    font-family: "Courier New", Courier, monospace;
    letter-spacing: 0.05em;
    color: #0F1E40;
  }

  @media print {
    .ballot-replica { box-shadow: none; }
    .ballot-replica-section { page-break-inside: avoid; }
    .ballot-replica-choice-cell { page-break-inside: avoid; }
  }
`;
