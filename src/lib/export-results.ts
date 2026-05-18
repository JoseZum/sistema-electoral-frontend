import type { ElectionResultOption, ElectionResultVoter, ElectionResults } from '@/types/elections';
import {
  getElectionStatusLabel,
  getNoVoteLabel,
  getParticipationLabel,
  getSuffrageDescription,
  getSuffrageLabel,
} from '@/lib/suffrage';

const fmtDate = (value: string | null) => (value ? new Date(value).toLocaleString('es-CR') : 'No definido');
const fmtNum = (value: number) => value.toLocaleString('es-CR');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, '').replace(/\s+/g, '_').toLowerCase();
}

function isSpecialResultOption(option: ElectionResultOption) {
  return option.option_type === 'BLANK' || option.option_type === 'NULL_VOTE';
}

function getOptionDescription(option: Pick<ElectionResultOption, 'metadata'>) {
  const metadataDescription = option.metadata?.description;
  return typeof metadataDescription === 'string' ? metadataDescription : null;
}

function getBallotOptionLabel(option: ElectionResultOption) {
  if (option.option_type === 'BLANK') {
    return 'Voto en blanco';
  }

  if (option.option_type === 'NULL_VOTE') {
    return 'Voto nulo';
  }

  return option.label;
}

function getResultGroups(options: ElectionResultOption[]) {
  const flatChildren = options.filter((option) => option.parent_option_id);
  const topLevelOptions = options.filter((option) => !option.parent_option_id);

  return topLevelOptions
    .filter((option) => option.suboptions?.length || flatChildren.some((child) => child.parent_option_id === option.id))
    .map((option) => {
      const nestedSuboptions = option.suboptions?.length
        ? option.suboptions
        : flatChildren.filter((child) => child.parent_option_id === option.id);

      return {
        ...option,
        suboptions: nestedSuboptions,
      };
    });
}

function getResultOptionTotal(option: ElectionResultOption) {
  if (option.suboptions?.length) {
    return option.suboptions.reduce((total, suboption) => total + suboption.vote_count, 0);
  }

  return option.vote_count;
}

function renderParticipationCell(voter: ElectionResultVoter, isAnonymous: boolean): string {
  if (isAnonymous) {
    const statusClass = voter.has_voted ? 'pill pill--success' : 'pill pill--danger';
    return `<span class="${statusClass}">${getParticipationLabel(voter.has_voted)}</span>`;
  }

  if (!voter.has_voted) {
    return `<span class="pill pill--danger">${getNoVoteLabel()}</span>`;
  }

  return escapeHtml(voter.selected_option_label ?? 'Sin detalle disponible');
}

function renderBallotCard(option: ElectionResultOption): string {
  const description = getOptionDescription(option);
  const hasImage = Boolean(option.image_url);

  return `
    <article class="ballot-report-card ${isSpecialResultOption(option) ? 'ballot-report-card--special' : ''}">
      ${hasImage
        ? `<img class="ballot-report-card__image" src="${escapeHtml(option.image_url ?? '')}" alt="" />`
        : '<div class="ballot-report-card__image ballot-report-card__image--placeholder">Sin foto</div>'}
      <div class="ballot-report-card__content">
        <div class="ballot-report-card__title">${escapeHtml(getBallotOptionLabel(option))}</div>
        ${description ? `<div class="ballot-report-card__description">${escapeHtml(description)}</div>` : ''}
        <div class="ballot-report-card__metrics">
          <span>${fmtNum(option.vote_count)} voto${option.vote_count === 1 ? '' : 's'}</span>
          <strong>${option.percentage.toFixed(2)}%</strong>
        </div>
      </div>
    </article>
  `;
}

function buildBallotsSection(results: ElectionResults): string {
  const resultGroups = getResultGroups(results.options);
  const hasSuboptionResults = resultGroups.length > 0;

  if (results.options.length === 0) {
    return `
      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Boletas</div>
            <h2>Replica visual de la boleta</h2>
          </div>
        </div>
        <p class="empty-state">No hay opciones configuradas para reconstruir la boleta.</p>
      </section>
    `;
  }

  if (hasSuboptionResults) {
    const groupsMarkup = resultGroups
      .map((parentOption, index) => {
        const description = getOptionDescription(parentOption);

        return `
          <div class="ballot-report-group">
            <div class="ballot-report-group__header">
              <div>
                <div class="ballot-report-group__eyebrow">Grupo ${index + 1}</div>
                <h3>${escapeHtml(parentOption.label)}</h3>
                ${description ? `<p>${escapeHtml(description)}</p>` : ''}
              </div>
              <div class="ballot-report-group__total">${fmtNum(getResultOptionTotal(parentOption))} boleta${getResultOptionTotal(parentOption) === 1 ? '' : 's'}</div>
            </div>
            <div class="ballot-report-grid ballot-report-grid--suboptions">
              ${(parentOption.suboptions ?? []).map((option) => renderBallotCard(option)).join('')}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Boletas</div>
            <h2>Replica visual de la boleta</h2>
            <p>Esta sección conserva la estructura publicada de la boleta con sus imágenes, descripciones y conteos.</p>
          </div>
        </div>
        ${groupsMarkup}
      </section>
    `;
  }

  const mainOptions = results.options.filter((option) => !isSpecialResultOption(option));
  const specialOptions = results.options.filter(isSpecialResultOption);

  return `
    <section class="panel">
      <div class="section-header">
        <div>
          <div class="section-kicker">Boletas</div>
          <h2>Replica visual de la boleta</h2>
          <p>Esta sección conserva la boleta publicada con sus fotos, textos y el resultado consolidado por opción.</p>
        </div>
      </div>
      <div class="ballot-report-grid">
        ${mainOptions.map((option) => renderBallotCard(option)).join('')}
      </div>
      ${specialOptions.length > 0
        ? `
          <div class="ballot-report-grid ballot-report-grid--special">
            ${specialOptions.map((option) => renderBallotCard(option)).join('')}
          </div>
        `
        : ''}
    </section>
  `;
}

function buildParticipationSection(results: ElectionResults): string {
  const voters = results.voters ?? [];

  if (voters.length === 0) {
    return `
      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Detalle individual</div>
            <h2>Participación por persona</h2>
          </div>
        </div>
        <p class="empty-state">No hay personas elegibles registradas para esta votación.</p>
      </section>
    `;
  }

  const abstentions = voters.filter((voter) => !voter.has_voted).length;
  const headerLabel = results.election.is_anonymous ? 'Voto emitido' : 'Opción elegida';
  const rows = voters
    .map(
      (voter) => `
        <tr class="${voter.has_voted ? '' : 'row--abstention'}">
          <td>${escapeHtml(voter.full_name)}</td>
          <td>${escapeHtml(voter.carnet)}</td>
          <td>${renderParticipationCell(voter, results.election.is_anonymous)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <section class="panel">
      <div class="section-header">
        <div>
          <div class="section-kicker">Detalle individual</div>
          <h2>Participación por persona</h2>
          <p>${escapeHtml(getSuffrageDescription(results.election.is_anonymous))}</p>
        </div>
        ${abstentions > 0 ? `<div class="alert-chip">Abstencionismo detectado: ${fmtNum(abstentions)}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>Nombre completo</th>
            <th>Carnet</th>
            <th>${headerLabel}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function buildReportHTML(results: ElectionResults, forWord = false): string {
  const suffrageLabel = getSuffrageLabel(results.election.is_anonymous);
  const statusLabel = getElectionStatusLabel(results.election.status);
  const abstentions = Math.max(0, results.total_eligible - results.total_votes);
  const resultGroups = getResultGroups(results.options);
  const hasSuboptionResults = resultGroups.length > 0;
  const mainOptions = hasSuboptionResults
    ? []
    : results.options.filter((option) => !isSpecialResultOption(option));
  const specialOptions = hasSuboptionResults
    ? []
    : results.options.filter(isSpecialResultOption);
  const optionRows = hasSuboptionResults
    ? resultGroups
        .map((parentOption) => {
          const suboptionRows = (parentOption.suboptions ?? [])
            .map(
              (option) => `
                <tr class="${isSpecialResultOption(option) ? 'suboption-row suboption-row--special' : 'suboption-row'}">
                  <td><span class="suboption-label">${escapeHtml(option.label)}</span></td>
                  <td class="num">${fmtNum(option.vote_count)}</td>
                  <td class="num">${option.percentage.toFixed(2)}%</td>
                </tr>
              `,
            )
            .join('');

          return `
            <tr class="group-row">
              <td>${escapeHtml(parentOption.label)}</td>
              <td class="num">${fmtNum(getResultOptionTotal(parentOption))}</td>
              <td class="num">-</td>
            </tr>
            ${suboptionRows}
          `;
        })
        .join('')
    : [...mainOptions, ...specialOptions]
        .map(
          (option) => `
            <tr>
              <td>${escapeHtml(option.label)}</td>
              <td class="num">${fmtNum(option.vote_count)}</td>
              <td class="num">${option.percentage.toFixed(2)}%</td>
            </tr>
          `,
        )
        .join('');

  const statsBlock = forWord
    ? `
        <table class="stats-table">
          <tr>
            <td class="stat-cell">
              <span class="metric-label">Total de votos</span><br/>
              <span class="metric-value">${fmtNum(results.total_votes)}</span>
            </td>
            <td class="stat-cell">
              <span class="metric-label">Personas elegibles</span><br/>
              <span class="metric-value">${fmtNum(results.total_eligible)}</span>
            </td>
            <td class="stat-cell">
              <span class="metric-label">Abstenciones</span><br/>
              <span class="metric-value">${fmtNum(abstentions)}</span>
            </td>
            <td class="stat-cell">
              <span class="metric-label">Participación</span><br/>
              <span class="metric-value">${results.participation_rate.toFixed(2)}%</span>
            </td>
          </tr>
        </table>
      `
    : `
        <div class="stats-grid">
          ${[
            ['Total de votos', fmtNum(results.total_votes)],
            ['Personas elegibles', fmtNum(results.total_eligible)],
            ['Abstenciones', fmtNum(abstentions)],
            ['Participación', `${results.participation_rate.toFixed(2)}%`],
          ]
            .map(
              ([label, value]) => `
                <div class="stat-card">
                  <div class="metric-label">${label}</div>
                  <div class="metric-value">${value}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      `;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe de resultados - ${escapeHtml(results.election.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #172033;
      background: #f3f6fb;
      padding: 28px;
      line-height: 1.45;
    }
    .report-shell {
      background: #ffffff;
      border: 1px solid #dbe3f0;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    }
    .hero {
      padding: 28px 32px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #ffffff;
    }
    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .eyebrow {
      font-size: 9pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.78;
      margin-bottom: 6px;
    }
    .hero h1 {
      font-size: 20pt;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .hero p {
      font-size: 10pt;
      opacity: 0.9;
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 9pt;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }
    .pill--success {
      background: rgba(15, 118, 110, 0.14);
      color: #0f766e;
    }
    .pill--danger {
      background: rgba(220, 38, 38, 0.14);
      color: #b91c1c;
    }
    .hero-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .hero-meta-card {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      padding: 12px 14px;
    }
    .hero-meta-card strong {
      display: block;
      font-size: 11pt;
      margin-top: 4px;
    }
    .content {
      padding: 24px 28px 28px;
    }
    .panel {
      border: 1px solid #dbe3f0;
      border-radius: 18px;
      background: #ffffff;
      padding: 18px 20px;
      margin-bottom: 18px;
    }
    .panel h2 {
      font-size: 13pt;
      margin-bottom: 6px;
      color: #172033;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .section-kicker {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #4f46e5;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .section-header p {
      color: #475569;
      font-size: 9.5pt;
      max-width: 70ch;
    }
    .alert-chip {
      background: rgba(220, 38, 38, 0.08);
      color: #b91c1c;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 9pt;
      font-weight: 700;
    }
    .meta-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5ebf5;
      font-size: 9.8pt;
    }
    .meta-table tr:last-child td {
      border-bottom: none;
    }
    .meta-table td:first-child {
      width: 28%;
      color: #64748b;
      font-weight: 700;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .stat-card,
    .stat-cell {
      background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      border: 1px solid #d7e3f4;
      border-radius: 16px;
      padding: 14px 16px;
    }
    .stats-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 10px 0;
    }
    .metric-label {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .metric-value {
      display: block;
      margin-top: 6px;
      font-size: 17pt;
      font-weight: 700;
      color: #172033;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.7pt;
    }
    th {
      background: #eff4fb;
      color: #334155;
      text-align: left;
      font-weight: 700;
      padding: 10px 12px;
      border-bottom: 1px solid #d7e3f4;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5ebf5;
      vertical-align: middle;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .row--abstention td {
      background: rgba(220, 38, 38, 0.035);
    }
    .group-row td {
      background: #f8fbff;
      color: #172033;
      font-weight: 800;
      border-top: 1px solid #d7e3f4;
    }
    .suboption-label {
      display: inline-block;
      padding-left: 18px;
      color: #334155;
    }
    .suboption-row--special .suboption-label,
    .suboption-row--special td {
      color: #64748b;
    }
    .num {
      text-align: right;
    }
    .empty-state {
      color: #64748b;
      font-size: 10pt;
    }
    .ballot-report-group {
      border: 1px dashed #c9d7ec;
      border-radius: 16px;
      background: linear-gradient(180deg, #fbfdff 0%, #f3f7ff 100%);
      padding: 16px;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .ballot-report-group__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .ballot-report-group__header h3 {
      font-size: 11pt;
      color: #172033;
      margin-bottom: 4px;
    }
    .ballot-report-group__header p {
      color: #475569;
      font-size: 9pt;
    }
    .ballot-report-group__eyebrow {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #1d4ed8;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .ballot-report-group__total {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(29, 78, 216, 0.1);
      color: #1d4ed8;
      font-size: 8.8pt;
      font-weight: 700;
    }
    .ballot-report-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .ballot-report-grid--special {
      margin-top: 12px;
    }
    .ballot-report-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid #dbe3f0;
      background: #ffffff;
      page-break-inside: avoid;
      min-height: 118px;
    }
    .ballot-report-card--special {
      background: linear-gradient(180deg, #fbfbfc 0%, #f4f5f7 100%);
    }
    .ballot-report-card__image {
      width: 88px;
      height: 88px;
      border-radius: 16px;
      object-fit: cover;
      border: 1px solid #dbe3f0;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .ballot-report-card__image--placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 8pt;
    }
    .ballot-report-card__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .ballot-report-card__title {
      font-size: 10pt;
      font-weight: 700;
      color: #172033;
    }
    .ballot-report-card__description {
      color: #475569;
      font-size: 9pt;
      line-height: 1.45;
    }
    .ballot-report-card__metrics {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      color: #334155;
      font-size: 8.8pt;
      font-weight: 600;
    }
    .ballot-report-card__metrics strong {
      color: #0f172a;
      font-size: 10pt;
    }
    footer {
      padding: 0 28px 24px;
      color: #64748b;
      font-size: 8.8pt;
      text-align: center;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-shell { box-shadow: none; border-radius: 0; }
      @page { margin: 16mm; }
    }
  </style>
</head>
<body>
  <div class="report-shell">
    <header class="hero">
      <div class="hero-top">
        <div>
          <div class="eyebrow">Tribunal Electoral Estudiantil</div>
          <h1>Informe de resultados</h1>
          <p>Generado el ${new Date().toLocaleString('es-CR')}</p>
        </div>
        <div class="badge-row">
          <span class="pill">${escapeHtml(suffrageLabel)}</span>
          <span class="pill">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      <div class="hero-meta">
        <div class="hero-meta-card">
          <span class="metric-label">Proceso electoral</span>
          <strong>${escapeHtml(results.election.title)}</strong>
        </div>
        <div class="hero-meta-card">
          <span class="metric-label">Participación acumulada</span>
          <strong>${results.participation_rate.toFixed(2)}%</strong>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Datos generales</div>
            <h2>Información de la votación</h2>
            ${results.election.description ? `<p>${escapeHtml(results.election.description)}</p>` : ''}
          </div>
        </div>
        <table class="meta-table">
          <tbody>
            <tr><td>Estado</td><td>${escapeHtml(statusLabel)}</td></tr>
            <tr><td>Inicio</td><td>${escapeHtml(fmtDate(results.election.start_time))}</td></tr>
            <tr><td>Cierre</td><td>${escapeHtml(fmtDate(results.election.end_time))}</td></tr>
            <tr><td>Sufragio</td><td>${escapeHtml(suffrageLabel)}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Resumen cuantitativo</div>
            <h2>Estadísticas generales</h2>
          </div>
        </div>
        ${statsBlock}
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Resultado consolidado</div>
            <h2>Desglose por opción</h2>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Opción</th>
              <th class="num">Votos</th>
              <th class="num">Porcentaje</th>
            </tr>
          </thead>
          <tbody>${optionRows}</tbody>
        </table>
      </section>

      ${buildBallotsSection(results)}

      ${buildParticipationSection(results)}
    </main>

    <footer>
      Sistema Electoral TEC · Documento generado automáticamente para consulta administrativa.
    </footer>
  </div>
</body>
</html>`;
}

export function exportResultsToPDF(results: ElectionResults) {
  const html = buildReportHTML(results, false);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const previewWindow = window.open(url, '_blank');

  if (previewWindow) {
    previewWindow.addEventListener('load', () => {
      previewWindow.print();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
}

export function exportResultsToDOCX(results: ElectionResults) {
  const html = buildReportHTML(results, true);
  const blob = new Blob([`\ufeff${html}`], {
    type: 'application/vnd.ms-word;charset=utf-8',
  });
  downloadBlob(blob, `resultados_${safeFilename(results.election.title)}.doc`);
}
