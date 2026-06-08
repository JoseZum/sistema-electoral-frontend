import type { ElectionResultOption, ElectionResultVoter, ElectionResults } from '@/types/elections';
import {
  getElectionStatusLabel,
  getNoVoteLabel,
  getParticipationLabel,
  getSuffrageDescription,
  getSuffrageLabel,
} from '@/lib/suffrage';
import { buildBallotReplicaSection, BALLOT_REPLICA_STYLES } from '@/lib/ballot-replica';

const LOGO_PATH = '/logo-color-texto.png';

let cachedLogoDataUrl: string | null | undefined;

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;

  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    cachedLogoDataUrl = null;
    return null;
  }

  try {
    const response = await fetch(LOGO_PATH);
    if (!response.ok) {
      cachedLogoDataUrl = null;
      return null;
    }
    const blob = await response.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        resolve(typeof result === 'string' ? result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-CR') : 'No definido';
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
  return title.replace(/[^a-zA-Z0-9_\-À-ſ ]/g, '').replace(/\s+/g, '_').toLowerCase();
}

function isSpecialResultOption(option: ElectionResultOption) {
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

function buildFolio(reference: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Informe N° ${reference.getFullYear()}${pad(reference.getMonth() + 1)}${pad(reference.getDate())}-${pad(reference.getHours())}${pad(reference.getMinutes())}`;
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
  // Primero quienes votaron, luego los abstencionistas. Orden estable dentro de cada grupo.
  const sortedVoters = [...voters].sort((a, b) => {
    if (a.has_voted === b.has_voted) return 0;
    return a.has_voted ? -1 : 1;
  });
  const rows = sortedVoters
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
      <table class="data-table">
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

function buildReportHTML(results: ElectionResults, logoDataUrl: string | null): string {
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

  const generatedAt = new Date();
  const folio = buildFolio(generatedAt);
  const generatedAtStr = generatedAt.toLocaleString('es-CR');

  const logoMarkup = logoDataUrl
    ? `<img class="tribunal-logo" src="${logoDataUrl}" alt="Tribunal Electoral Estudiantil" />`
    : `<div class="tribunal-logo-text">Tribunal Electoral Estudiantil</div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe de resultados - ${escapeHtml(results.election.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 18mm 16mm 22mm 16mm;
      @bottom-center { content: "Tribunal Electoral Estudiantil — Informe Oficial"; font-size: 8pt; color: #475569; }
      @bottom-right  { content: "Página " counter(page) " de " counter(pages); font-size: 8pt; color: #475569; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
      color: #172033;
      background: #ffffff;
      padding: 24px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-shell {
      background: #ffffff;
      border: 1px solid #C4BDB0;
      border-radius: 4px;
      overflow: hidden;
    }
    .hero {
      padding: 20px 24px 16px;
      background: #ffffff;
      border-bottom: 4px solid #0F1E40;
    }
    .hero-table { width: 100%; border-collapse: collapse; }
    .hero-table td { vertical-align: middle; }
    .hero-logo-cell { width: 220px; }
    .tribunal-logo {
      display: block;
      max-height: 64px;
      max-width: 220px;
      width: auto;
      height: auto;
    }
    .tribunal-logo-text {
      font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
      font-weight: 700;
      color: #0F1E40;
      font-size: 12pt;
      letter-spacing: 0.02em;
    }
    .hero-meta-cell { text-align: right; }
    .badge-stack { display: inline-block; }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border: 1px solid #C4BDB0;
      border-radius: 999px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #0F1E40;
      background: #FDFAF4;
      margin-left: 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pill--success {
      border-color: #2D8653;
      color: #2D8653;
      background: #ffffff;
    }
    .pill--danger {
      border-color: #B91C1C;
      color: #B91C1C;
      background: #ffffff;
    }
    .hero-title-row {
      padding-top: 14px;
      border-top: 1px solid transparent;
    }
    .hero-title-row h1 {
      font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
      font-size: 20pt;
      color: #0F1E40;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .hero-folio {
      font-size: 9pt;
      color: #6B6557;
      font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
    }
    .hero-folio strong { color: #0F1E40; font-weight: 700; }
    .content { padding: 20px 24px 28px; }
    .panel {
      border: 1px solid #C4BDB0;
      border-radius: 4px;
      background: #ffffff;
      padding: 16px 18px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      mso-page-break-inside: avoid;
    }
    .panel h2 {
      font-family: "Montserrat", "Segoe UI", Arial, sans-serif;
      font-size: 13pt;
      margin-bottom: 4px;
      color: #0F1E40;
      font-weight: 700;
    }
    .section-header {
      width: 100%;
      margin-bottom: 12px;
    }
    .section-header > div { display: block; }
    .section-kicker {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #8A8070;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .section-header p {
      color: #475569;
      font-size: 9.5pt;
      max-width: 70ch;
      margin-top: 4px;
    }
    .alert-chip {
      display: inline-block;
      margin-top: 6px;
      background: #ffffff;
      color: #B91C1C;
      border: 1px solid #B91C1C;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 8.5pt;
      font-weight: 700;
    }
    table.meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2DAD0;
      font-size: 9.8pt;
      vertical-align: top;
    }
    .meta-table tr:last-child td { border-bottom: none; }
    .meta-table td:first-child {
      width: 28%;
      color: #6B6557;
      font-weight: 700;
    }
    table.stats-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .stats-table td.stat-cell {
      width: 25%;
      background: #FDFAF4;
      border: 1px solid #C4BDB0;
      padding: 14px 14px;
      vertical-align: top;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .metric-label {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 8pt;
      color: #6B6557;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: block;
    }
    .metric-value {
      display: block;
      margin-top: 6px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 17pt;
      font-weight: 700;
      color: #0F1E40;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.7pt;
      border: 1px solid #C4BDB0;
    }
    .data-table th {
      background: #F3EFE5;
      color: #0F1E40;
      text-align: left;
      font-weight: 700;
      padding: 9px 12px;
      border-bottom: 1px solid #C4BDB0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #E2DAD0;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table .row--abstention td { background: #FBF3F3; }
    .data-table .group-row td {
      background: #F3EFE5;
      color: #0F1E40;
      font-weight: 700;
      border-top: 1px solid #C4BDB0;
    }
    .data-table .suboption-label {
      display: inline-block;
      padding-left: 18px;
      color: #334155;
    }
    .data-table .suboption-row--special .suboption-label,
    .data-table .suboption-row--special td { color: #6B6557; }
    .data-table .num { text-align: right; }
    .empty-state { color: #6B6557; font-size: 10pt; }
    footer {
      padding: 12px 24px 18px;
      color: #6B6557;
      font-size: 8.8pt;
      text-align: center;
      border-top: 1px solid #E2DAD0;
    }

    ${BALLOT_REPLICA_STYLES}

    @media print {
      body { background: #ffffff; padding: 0; }
      .report-shell { box-shadow: none; border-radius: 0; border: none; }
      .panel { page-break-inside: avoid; break-inside: avoid; }
      table.data-table { break-inside: auto; }
      .data-table thead { display: table-header-group; }
      .data-table tfoot { display: table-footer-group; }
      .data-table tr { page-break-inside: avoid; break-inside: avoid; }
      .ballot-replica, .ballot-replica-section { page-break-inside: avoid; break-inside: avoid; }
      h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-shell">
    <header class="hero">
      <table class="hero-table" role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tbody>
          <tr>
            <td class="hero-logo-cell">${logoMarkup}</td>
            <td class="hero-meta-cell">
              <div class="badge-stack">
                <span class="pill">${escapeHtml(suffrageLabel)}</span>
                <span class="pill">${escapeHtml(statusLabel)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="hero-title-row">
        <h1>Informe oficial de resultados</h1>
        <div class="hero-folio">
          <strong>${escapeHtml(folio)}</strong> · Emitido el ${escapeHtml(generatedAtStr)} · ${escapeHtml(results.election.title)}
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
        <table class="stats-table" cellspacing="0" cellpadding="0">
          <tbody>
            <tr>
              <td class="stat-cell">
                <span class="metric-label">Total de votos</span>
                <span class="metric-value">${fmtNum(results.total_votes)}</span>
              </td>
              <td class="stat-cell">
                <span class="metric-label">Personas elegibles</span>
                <span class="metric-value">${fmtNum(results.total_eligible)}</span>
              </td>
              <td class="stat-cell">
                <span class="metric-label">Abstenciones</span>
                <span class="metric-value">${fmtNum(abstentions)}</span>
              </td>
              <td class="stat-cell">
                <span class="metric-label">Participación</span>
                <span class="metric-value">${results.participation_rate.toFixed(2)}%</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <div class="section-kicker">Resultado consolidado</div>
            <h2>Desglose por opción</h2>
          </div>
        </div>
        <table class="data-table">
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

      ${buildBallotReplicaSection(results, folio)}

      ${buildParticipationSection(results)}
    </main>

    <footer>
      Sistema Electoral TEC · Documento generado automáticamente para consulta administrativa.
    </footer>
  </div>
</body>
</html>`;
}

export async function exportResultsToPDF(results: ElectionResults) {
  const logoDataUrl = await loadLogoDataUrl();
  const html = buildReportHTML(results, logoDataUrl);
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

export async function exportResultsToDOCX(results: ElectionResults) {
  const logoDataUrl = await loadLogoDataUrl();
  const html = buildReportHTML(results, logoDataUrl);
  const blob = new Blob([`﻿${html}`], {
    type: 'application/vnd.ms-word;charset=utf-8',
  });
  downloadBlob(blob, `resultados_${safeFilename(results.election.title)}.doc`);
}
