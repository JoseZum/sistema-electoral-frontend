import type { ElectionResults } from '@/types/elections';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-CR') : '—';

const fmtNum = (n: number) => n.toLocaleString('es-CR');

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const safeFilename = (title: string) =>
  title.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ ]/g, '').replace(/\s+/g, '_').toLowerCase();

/* ─── Shared HTML report body ─────────────────────────────────────────────── */
function buildReportHTML(results: ElectionResults, forWord = false): string {
  const mainOptions = results.options.filter(
    (o) => o.option_type !== 'BLANK' && o.option_type !== 'NULL_VOTE',
  );
  const specialOptions = results.options.filter(
    (o) => o.option_type === 'BLANK' || o.option_type === 'NULL_VOTE',
  );

  const optionRows = [...mainOptions, ...specialOptions]
    .map(
      (o) => `
      <tr>
        <td>${o.label}</td>
        <td class="num">${fmtNum(o.vote_count)}</td>
        <td class="num">${o.percentage.toFixed(2)}%</td>
      </tr>`,
    )
    .join('');

  const voterSection = results.election.is_anonymous
    ? `<p class="muted italic">Votación anónima — la lista de votantes no está disponible.</p>`
    : results.voters && results.voters.length > 0
    ? `<h2>Personas votantes (${results.voters.length})</h2>
       <table>
         <thead><tr><th>Nombre completo</th><th>Carnet</th></tr></thead>
         <tbody>
           ${results.voters
             .map((v) => `<tr><td>${v.full_name}</td><td>${v.carnet}</td></tr>`)
             .join('')}
         </tbody>
       </table>`
    : `<p class="muted">Ninguna persona votó.</p>`;

  // Word needs explicit paragraph breaks and doesn't support CSS grid
  const statsBlock = forWord
    ? `<table class="stats-table">
        <tr>
          <td class="stat-cell"><span class="label">Total votos</span><br/><span class="bignum">${fmtNum(results.total_votes)}</span></td>
          <td class="stat-cell"><span class="label">Elegibles</span><br/><span class="bignum">${fmtNum(results.total_eligible)}</span></td>
          <td class="stat-cell"><span class="label">Abstenciones</span><br/><span class="bignum">${fmtNum(results.total_eligible - results.total_votes)}</span></td>
          <td class="stat-cell"><span class="label">Participación</span><br/><span class="bignum">${results.participation_rate.toFixed(2)}%</span></td>
        </tr>
       </table>`
    : `<div class="stats">
        ${[
          ['Total votos', fmtNum(results.total_votes)],
          ['Elegibles', fmtNum(results.total_eligible)],
          ['Abstenciones', fmtNum(results.total_eligible - results.total_votes)],
          ['Participación', `${results.participation_rate.toFixed(2)}%`],
        ]
          .map(
            ([label, value]) =>
              `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`,
          )
          .join('')}
       </div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Resultados — ${results.election.title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b;padding:24px 32px}
    header{background:#1e293b;color:#fff;padding:14px 20px;border-radius:6px;margin-bottom:20px}
    header h1{font-size:14pt;font-weight:700}
    header p{font-size:9pt;opacity:.75;margin-top:4px}
    h2{font-size:12pt;font-weight:700;margin:18px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px;color:#1e293b}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10pt}
    th{background:#1e293b;color:#fff;padding:6px 10px;text-align:left;font-weight:600}
    td{padding:5px 10px;border-bottom:1px solid #e2e8f0}
    tr:last-child td{border-bottom:none}
    .num{text-align:right}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
    .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px}
    .stat .label,.label{font-size:8.5pt;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    .stat .value{font-size:16pt;font-weight:700;margin-top:2px}
    .stats-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .stat-cell{border:1px solid #e2e8f0;padding:8px 12px;background:#f8fafc;text-align:center}
    .bignum{font-size:16pt;font-weight:700}
    .muted{color:#64748b}
    .italic{font-style:italic}
    footer{margin-top:24px;text-align:center;font-size:8.5pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
    @media print{body{padding:0}@page{margin:18mm 16mm}}
  </style>
</head>
<body>
  <header>
    <h1>Reporte de Resultados — Sistema Electoral</h1>
    <p>Generado el ${new Date().toLocaleString('es-CR')}</p>
  </header>

  <h2 style="margin-top:0">${results.election.title}</h2>
  ${results.election.description ? `<p style="color:#475569;margin-bottom:12px;font-size:10pt">${results.election.description}</p>` : ''}

  <h2>Información de la votación</h2>
  <table>
    <tbody>
      <tr><td><strong>Estado</strong></td><td>${results.election.status}</td></tr>
      <tr><td><strong>Inicio</strong></td><td>${fmtDate(results.election.start_time)}</td></tr>
      <tr><td><strong>Cierre</strong></td><td>${fmtDate(results.election.end_time)}</td></tr>
      <tr><td><strong>Tipo</strong></td><td>${results.election.is_anonymous ? 'Anónima' : 'No anónima'}</td></tr>
    </tbody>
  </table>

  <h2>Estadísticas generales</h2>
  ${statsBlock}

  <h2>Desglose de resultados</h2>
  <table>
    <thead><tr><th>Opción / Candidato</th><th style="text-align:right">Votos</th><th style="text-align:right">Porcentaje</th></tr></thead>
    <tbody>${optionRows}</tbody>
  </table>

  ${voterSection}

  <footer>Sistema Electoral — Reporte generado automáticamente</footer>
</body>
</html>`;
}

/* ─── PDF (browser print dialog → Save as PDF) ────────────────────────────── */
export function exportResultsToPDF(results: ElectionResults) {
  const html = buildReportHTML(results, false);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
}

/* ─── DOCX (Word-compatible HTML blob, no external libraries) ─────────────── */
export function exportResultsToDOCX(results: ElectionResults) {
  const html = buildReportHTML(results, true);
  const blob = new Blob(['\ufeff' + html], {
    type: 'application/vnd.ms-word;charset=utf-8',
  });
  downloadBlob(blob, `resultados_${safeFilename(results.election.title)}.doc`);
}
