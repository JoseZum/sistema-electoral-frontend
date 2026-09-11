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
const TEST_TIMEOUT_MS = readTimeout('DASHBOARD');

const THRESHOLDS = readThresholds('DASHBOARD');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const DASHBOARD_STATS = {
  totalStudents: 1842,
  activeStudents: 1721,
  totalElections: 8,
  openElections: 2,
  totalVotes: 1398,
  participation: 76.4,
  ongoingElections: [
    {
      id: 'ongoing-election-001',
      title: 'Consejo Ejecutivo FEITEC 2026',
      startTime: '2026-05-04T14:00:00.000Z',
      endTime: '2026-05-05T02:00:00.000Z',
      votesCount: 623,
      totalVoters: 812,
      progressPercentage: 76.7,
    },
    {
      id: 'ongoing-election-002',
      title: 'Representacion de escuela',
      startTime: '2026-05-04T15:00:00.000Z',
      endTime: '2026-05-05T01:30:00.000Z',
      votesCount: 189,
      totalVoters: 305,
      progressPercentage: 62.0,
    },
  ],
};

const ELECTIONS = [
  {
    id: 'ongoing-election-001',
    title: 'Consejo Ejecutivo FEITEC 2026',
    description: 'Eleccion general del consejo ejecutivo.',
    status: 'OPEN',
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
    id: 'ongoing-election-002',
    title: 'Representacion de escuela',
    description: 'Eleccion de representacion por escuela.',
    status: 'OPEN',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: false,
    min_keys: 0,
    voter_source: 'FILTERED',
    voter_filter: { sede: 'Cartago' },
    tag_id: null,
    tag_name: null,
    tag_color: null,
    tag_description: null,
    tag_member_count: null,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-05-04T15:00:00.000Z',
    end_time: '2026-05-05T01:30:00.000Z',
    created_by: 'admin-002',
    created_at: '2026-05-01T10:00:00.000Z',
    updated_at: '2026-05-04T15:00:00.000Z',
    total_voters: 305,
    votes_cast: 189,
    options_count: 3,
  },
  {
    id: 'scheduled-election-001',
    title: 'Consulta de presupuesto',
    description: 'Consulta programada para presupuesto.',
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
    created_by: 'admin-003',
    created_at: '2026-05-02T08:00:00.000Z',
    updated_at: '2026-05-02T08:00:00.000Z',
    total_voters: 1842,
    votes_cast: 0,
    options_count: 2,
  },
  {
    id: 'closed-election-001',
    title: 'Asamblea extraordinaria',
    description: 'Proceso ya finalizado.',
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
];

const AUDIT_LOGS = [
  {
    id: 'audit-log-001',
    actor_carnet: '202400001',
    actor_name: 'Jose Rojas',
    action: 'padron_upload.insert',
    resource_type: 'padron_upload',
    resource_id: 'import-001',
    actionLabel: 'Importacion de padron',
    resourceLabel: 'Padron',
    activityMessage: 'Importacion del padron estudiantil',
    ip_address: '10.0.0.11',
    created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
  {
    id: 'audit-log-002',
    actor_carnet: '202400145',
    actor_name: 'Maria Gonzalez',
    action: 'election.update',
    resource_type: 'election',
    resource_id: 'ongoing-election-001',
    actionLabel: 'Actualizacion de eleccion',
    resourceLabel: 'Eleccion',
    activityMessage: 'Actualizacion de configuracion electoral',
    ip_address: '10.0.0.12',
    created_at: new Date(Date.now() - 80 * 60_000).toISOString(),
  },
  {
    id: 'audit-log-003',
    actor_carnet: null,
    actor_name: null,
    action: 'scrutiny_key.insert',
    resource_type: 'scrutiny_key',
    resource_id: 'key-001',
    actionLabel: 'Carga de llave',
    resourceLabel: 'Llave',
    activityMessage: 'Carga de llave de escrutinio',
    ip_address: null,
    created_at: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
  },
];

test('Dashboard page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('DASHBOARD');
    apiServer = await startMockDashboardApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/dashboard`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    const result = await runLighthouse(`${frontendUrl}/dashboard`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'dashboard-page');
    assertFinalPage(result.lhr, `${frontendUrl}/dashboard`);
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

async function startMockDashboardApi(port = 0) {
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

    if (request.method === 'GET' && url.pathname === '/api/dashboard/stats') {
      sendJson(response, DASHBOARD_STATS);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/elections') {
      sendJson(response, ELECTIONS);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/audit') {
      const limit = Math.max(1, Number(url.searchParams.get('limit') || '3'));
      sendJson(response, {
        logs: AUDIT_LOGS.slice(0, limit),
        total: AUDIT_LOGS.length,
      });
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
