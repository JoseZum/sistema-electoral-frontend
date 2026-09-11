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
const TEST_TIMEOUT_MS = readTimeout('ELECTIONS');

const THRESHOLDS = readThresholds('ELECTIONS');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const ADMINS = [
  { id: 'admin-001' },
  { id: 'admin-002' },
  { id: 'admin-003' },
  { id: 'admin-004' },
];

const ELECTIONS = [
  {
    id: 'election-open-001',
    title: 'Consejo Ejecutivo FEITEC 2026',
    description: 'Eleccion general abierta.',
    status: 'OPEN',
    is_anonymous: false,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 1,
    voter_source: 'TAG',
    voter_filter: null,
    tag_id: 'tag-feitec',
    tag_name: 'Representacion estudiantil',
    tag_color: '#2563eb',
    tag_description: 'Personas votantes para FEITEC',
    tag_member_count: 812,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-05-04T14:00:00.000Z',
    end_time: '2026-05-05T02:00:00.000Z',
    created_by: 'admin-001',
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-04T14:00:00.000Z',
    total_voters: 812,
    votes_cast: 623,
    options_count: 4,
  },
  {
    id: 'election-scheduled-001',
    title: 'Consulta de presupuesto 2026',
    description: 'Proceso programado para la proxima semana.',
    status: 'SCHEDULED',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: true,
    min_keys: 3,
    voter_source: 'FULL_PADRON',
    voter_filter: null,
    tag_id: null,
    tag_name: null,
    tag_color: null,
    tag_description: null,
    tag_member_count: null,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-05-10T14:00:00.000Z',
    end_time: '2026-05-10T20:00:00.000Z',
    created_by: 'admin-002',
    created_at: '2026-05-02T08:00:00.000Z',
    updated_at: '2026-05-02T08:00:00.000Z',
    total_voters: 1842,
    votes_cast: 0,
    options_count: 2,
  },
  {
    id: 'election-scrutinized-001',
    title: 'Asamblea extraordinaria',
    description: 'Proceso finalizado y listo para archivo.',
    status: 'SCRUTINIZED',
    is_anonymous: false,
    auth_method: 'MICROSOFT',
    requires_keys: true,
    min_keys: 3,
    voter_source: 'FULL_PADRON',
    voter_filter: null,
    tag_id: null,
    tag_name: null,
    tag_color: null,
    tag_description: null,
    tag_member_count: null,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-04-22T14:00:00.000Z',
    end_time: '2026-04-22T20:00:00.000Z',
    created_by: 'admin-003',
    created_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-22T20:10:00.000Z',
    total_voters: 1842,
    votes_cast: 1491,
    options_count: 2,
  },
  {
    id: 'election-closed-001',
    title: 'Representacion por escuela',
    description: 'Proceso cerrado sin llaves.',
    status: 'CLOSED',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 1,
    voter_source: 'MANUAL',
    voter_filter: { sede: 'Cartago' },
    tag_id: 'tag-escuela',
    tag_name: 'Escuela de computacion',
    tag_color: '#16a34a',
    tag_description: 'Grupo segmentado',
    tag_member_count: 305,
    starts_immediately: true,
    immediate_minutes: 180,
    start_time: null,
    end_time: null,
    created_by: 'admin-004',
    created_at: '2026-04-28T10:00:00.000Z',
    updated_at: '2026-04-28T14:00:00.000Z',
    total_voters: 305,
    votes_cast: 189,
    options_count: 3,
  },
  {
    id: 'election-archived-001',
    title: 'Proceso archivado',
    description: 'No aparece en la vista general cuando el filtro es Todas.',
    status: 'ARCHIVED',
    is_anonymous: false,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 1,
    voter_source: 'FULL_PADRON',
    voter_filter: null,
    tag_id: null,
    tag_name: null,
    tag_color: null,
    tag_description: null,
    tag_member_count: null,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-04-01T14:00:00.000Z',
    end_time: '2026-04-01T20:00:00.000Z',
    created_by: 'admin-001',
    created_at: '2026-03-25T08:00:00.000Z',
    updated_at: '2026-04-01T20:10:00.000Z',
    total_voters: 500,
    votes_cast: 411,
    options_count: 2,
  },
];

test('Elections pages meet Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('ELECTIONS');
    apiServer = await startMockElectionsApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/elecciones`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/elecciones`,
      expectedUrl: `${frontendUrl}/elecciones`,
      reportName: 'elections-list-page',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/elecciones/crear`,
      expectedUrl: `${frontendUrl}/elecciones/crear`,
      reportName: 'create-election-page',
    });
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

async function auditPage({ chromePort, url, expectedUrl, reportName }) {
  const result = await runLighthouse(url, chromePort);
  assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

  await saveReports(REPORT_DIR, result.lhr, reportName);
  assertFinalPage(result.lhr, expectedUrl);
  assertCategoryBudgets(result.lhr, THRESHOLDS);
}

async function startMockElectionsApi(port = 0) {
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

    if (request.method === 'GET' && url.pathname === '/api/elections') {
      sendJson(response, ELECTIONS);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/users/admins') {
      sendJson(response, ADMINS);
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
