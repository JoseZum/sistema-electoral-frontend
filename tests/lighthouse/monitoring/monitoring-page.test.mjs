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
const TEST_TIMEOUT_MS = readTimeout('MONITORING');

const THRESHOLDS = readThresholds('MONITORING');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const ELECTIONS = [
  {
    id: 'monitor-open-001',
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
    tag_description: 'Padron FEITEC',
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
    id: 'monitor-closed-001',
    title: 'Asamblea extraordinaria',
    description: 'Proceso finalizado.',
    status: 'SCRUTINIZED',
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
    start_time: '2026-04-22T14:00:00.000Z',
    end_time: '2026-04-22T20:00:00.000Z',
    created_by: 'admin-002',
    created_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-22T20:10:00.000Z',
    total_voters: 1842,
    votes_cast: 1491,
    options_count: 2,
  },
  {
    id: 'monitor-archived-001',
    title: 'Consulta de presupuesto',
    description: 'Proceso archivado.',
    status: 'ARCHIVED',
    is_anonymous: true,
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
    created_by: 'admin-003',
    created_at: '2026-03-25T08:00:00.000Z',
    updated_at: '2026-04-01T20:10:00.000Z',
    total_voters: 500,
    votes_cast: 411,
    options_count: 2,
  },
  {
    id: 'monitor-ignore-001',
    title: 'Eleccion programada',
    description: 'No debe aparecer en monitoreo inicial.',
    status: 'SCHEDULED',
    is_anonymous: true,
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
    start_time: '2026-05-10T14:00:00.000Z',
    end_time: '2026-05-10T20:00:00.000Z',
    created_by: 'admin-004',
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
    total_voters: 1842,
    votes_cast: 0,
    options_count: 2,
  },
];

const MONITORING_BY_ID = {
  'monitor-open-001': {
    votesByHour: [
      { hour: '2026-05-04T14:00:00.000Z', count: 62 },
      { hour: '2026-05-04T15:00:00.000Z', count: 74 },
      { hour: '2026-05-04T16:00:00.000Z', count: 81 },
      { hour: '2026-05-04T17:00:00.000Z', count: 95 },
      { hour: '2026-05-04T18:00:00.000Z', count: 102 },
      { hour: '2026-05-04T19:00:00.000Z', count: 88 },
      { hour: '2026-05-04T20:00:00.000Z', count: 76 },
      { hour: '2026-05-04T21:00:00.000Z', count: 45 },
    ],
  },
  'monitor-closed-001': {
    votesByHour: [
      { hour: '2026-04-22T14:00:00.000Z', count: 130 },
      { hour: '2026-04-22T15:00:00.000Z', count: 248 },
      { hour: '2026-04-22T16:00:00.000Z', count: 305 },
      { hour: '2026-04-22T17:00:00.000Z', count: 341 },
      { hour: '2026-04-22T18:00:00.000Z', count: 292 },
      { hour: '2026-04-22T19:00:00.000Z', count: 175 },
    ],
  },
  'monitor-archived-001': {
    votesByHour: [
      { hour: '2026-04-01T14:00:00.000Z', count: 54 },
      { hour: '2026-04-01T15:00:00.000Z', count: 77 },
      { hour: '2026-04-01T16:00:00.000Z', count: 101 },
      { hour: '2026-04-01T17:00:00.000Z', count: 88 },
      { hour: '2026-04-01T18:00:00.000Z', count: 59 },
      { hour: '2026-04-01T19:00:00.000Z', count: 32 },
    ],
  },
};

test('Monitoring page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('MONITORING');
    apiServer = await startMockMonitoringApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/monitoreo`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    const result = await runLighthouse(`${frontendUrl}/monitoreo`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'monitoring-page');
    assertFinalPage(result.lhr, `${frontendUrl}/monitoreo`);
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

async function startMockMonitoringApi(port = 0) {
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

    if (request.method === 'GET' && /^\/api\/elections\/[^/]+$/.test(url.pathname)) {
      const electionId = url.pathname.split('/')[3];
      const election = ELECTIONS.find((item) => item.id === electionId);
      if (!election) {
        sendJson(response, { error: 'Election not found' }, 404);
        return;
      }

      sendJson(response, election);
      return;
    }

    if (request.method === 'GET' && /^\/api\/elections\/[^/]+\/monitoring$/.test(url.pathname)) {
      const electionId = url.pathname.split('/')[3];
      const monitoring = MONITORING_BY_ID[electionId];
      if (!monitoring) {
        sendJson(response, { error: 'Monitoring not found' }, 404);
        return;
      }

      sendJson(response, monitoring);
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
