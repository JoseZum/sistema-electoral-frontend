import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { launchChrome } from '../shared/chrome.mjs';
import {
  readThresholds,
  readTimeout,
  createNextEnv,
  resolveMockApiConfig,
  sendJson,
  getFreePort,
  closeServer,
  runNextCommand,
  startNextServer,
  waitForHttp,
  stopProcess,
  seedSession,
  runLighthouse,
  saveReports,
  assertFinalPage,
  assertCategoryBudgets,
} from '../shared/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.join(__dirname, '.reports');
const TEST_TIMEOUT_MS = readTimeout('RESULTS');

const THRESHOLDS = readThresholds('RESULTS');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const TAGS = [
  {
    id: 'tag-feitec',
    name: 'Representacion estudiantil',
    description: 'Personas votantes para FEITEC',
    color: '#2563eb',
    member_count: 342,
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
  },
  {
    id: 'tag-asamblea',
    name: 'Asamblea general',
    description: 'Padron general de asamblea',
    color: '#059669',
    member_count: 120,
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
  },
];

const ELECTIONS = [
  {
    id: 'election-results-001',
    title: 'Consejo Ejecutivo FEITEC 2026',
    description: 'Eleccion general del consejo ejecutivo.',
    status: 'ARCHIVED',
    is_anonymous: false,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 0,
    voter_source: 'TAG',
    voter_filter: null,
    tag_id: 'tag-feitec',
    tag_name: 'Representacion estudiantil',
    tag_color: '#2563eb',
    tag_description: 'Personas votantes para FEITEC',
    tag_member_count: 342,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-04-10T13:00:00.000Z',
    end_time: '2026-04-11T19:00:00.000Z',
    created_by: 'admin-001',
    created_at: '2026-04-01T08:00:00.000Z',
    updated_at: '2026-04-11T19:30:00.000Z',
    total_voters: 342,
    votes_cast: 278,
    options_count: 4,
  },
  {
    id: 'election-results-002',
    title: 'Consulta de asamblea extraordinaria',
    description: 'Consulta para aprobar el calendario extraordinario.',
    status: 'SCRUTINIZED',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: true,
    min_keys: 3,
    voter_source: 'FULL_PADRON',
    voter_filter: null,
    tag_id: 'tag-asamblea',
    tag_name: 'Asamblea general',
    tag_color: '#059669',
    tag_description: 'Padron general de asamblea',
    tag_member_count: 120,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-04-15T15:00:00.000Z',
    end_time: '2026-04-16T20:00:00.000Z',
    created_by: 'admin-002',
    created_at: '2026-04-05T08:00:00.000Z',
    updated_at: '2026-04-16T20:10:00.000Z',
    total_voters: 120,
    votes_cast: 87,
    options_count: 3,
  },
  {
    id: 'election-results-003',
    title: 'Eleccion en proceso',
    description: 'No deberia mostrarse en resultados.',
    status: 'OPEN',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 0,
    voter_source: 'FULL_PADRON',
    voter_filter: null,
    tag_id: null,
    tag_name: null,
    tag_color: null,
    tag_description: null,
    tag_member_count: null,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-04-20T15:00:00.000Z',
    end_time: '2026-04-20T19:00:00.000Z',
    created_by: 'admin-003',
    created_at: '2026-04-10T08:00:00.000Z',
    updated_at: '2026-04-20T16:00:00.000Z',
    total_voters: 50,
    votes_cast: 12,
    options_count: 2,
  },
];

const RESULTS_BY_ELECTION_ID = {
  'election-results-001': {
    election: ELECTIONS[0],
    options: [
      { id: 'option-001', label: 'Lista Horizonte', option_type: 'CANDIDATE', vote_count: 133, percentage: 47.8 },
      { id: 'option-002', label: 'Lista Raices', option_type: 'CANDIDATE', vote_count: 89, percentage: 32.0 },
      { id: 'option-003', label: 'Lista Impulso', option_type: 'CANDIDATE', vote_count: 41, percentage: 14.7 },
      { id: 'option-004', label: 'Votos en blanco', option_type: 'BLANK', vote_count: 15, percentage: 5.4 },
    ],
    total_votes: 278,
    total_eligible: 342,
    participation_rate: 81.3,
    voters: [
      { full_name: 'Ana Camacho Rojas', carnet: '202600001' },
      { full_name: 'Bruno Solis Vega', carnet: '202600002' },
      { full_name: 'Camila Mora Arias', carnet: '202600003' },
      { full_name: 'Diego Vargas Soto', carnet: '202600004' },
      { full_name: 'Elena Mora Segura', carnet: '202600005' },
    ],
  },
  'election-results-002': {
    election: ELECTIONS[1],
    options: [
      { id: 'option-005', label: 'A favor', option_type: 'CANDIDATE', vote_count: 61, percentage: 70.1 },
      { id: 'option-006', label: 'En contra', option_type: 'CANDIDATE', vote_count: 19, percentage: 21.8 },
      { id: 'option-007', label: 'Votos nulos', option_type: 'NULL_VOTE', vote_count: 7, percentage: 8.0 },
    ],
    total_votes: 87,
    total_eligible: 120,
    participation_rate: 72.5,
  },
};

test('Results page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('RESULTS');
    apiServer = await startMockResultsApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/resultados`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    const result = await runLighthouse(`${frontendUrl}/resultados`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'results-page');
    assertFinalPage(result.lhr, `${frontendUrl}/resultados`);
    assertCategoryBudgets(result.lhr, THRESHOLDS);
  } finally {
    if (chrome) {
      await chrome.kill();
    }

    if (nextServer) {
      await stopProcess(nextServer);
    }

    if (apiServer) {
      await closeServer(apiServer.server);
    }
  }
});

async function startMockResultsApi(port = 0) {
  const server = createServer((request, response) => {
    const origin = request.headers.origin || '*';
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.headers.authorization !== 'Bearer lighthouse-admin-token') {
      sendJson(response, { error: 'Unauthorized' }, 401);
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/tags') {
      sendJson(response, TAGS);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/elections') {
      sendJson(response, ELECTIONS);
      return;
    }

    if (request.method === 'GET' && /^\/api\/elections\/[^/]+\/results$/.test(url.pathname)) {
      const electionId = url.pathname.split('/')[3];
      const results = RESULTS_BY_ELECTION_ID[electionId];

      if (!results) {
        sendJson(response, { error: 'Results not found' }, 404);
        return;
      }

      sendJson(response, results);
      return;
    }

    sendJson(response, { error: `Unhandled route: ${request.method} ${url.pathname}` }, 404);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    server,
    port: server.address().port,
  };
}
