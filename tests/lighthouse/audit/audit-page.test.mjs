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
const TEST_TIMEOUT_MS = readTimeout('AUDIT');
const PAGE_SIZE = 30;

const THRESHOLDS = readThresholds('AUDIT');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const AUDIT_LOGS = [
  {
    id: 'audit-log-001',
    actor_id: 'admin-001',
    actor_carnet: '202400001',
    actor_name: 'Jose Rojas',
    target_name: 'Padron 2026',
    target_carnet: null,
    action: 'padron.import',
    resource_type: 'padron_upload',
    resource_id: 'import-001',
    details: {
      total: 1342,
      new: 16,
      updated: 1300,
      reactivated: 20,
      deactivated: 6,
    },
    ip_address: '10.0.0.11',
    created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    actionLabel: 'Importacion de padron',
    resourceLabel: 'Padron',
    activityMessage: 'Importacion del padron estudiantil',
    election_title: null,
    holder_name: null,
    holder_carnet: null,
  },
  {
    id: 'audit-log-002',
    actor_id: 'admin-001',
    actor_carnet: '202400001',
    actor_name: 'Jose Rojas',
    target_name: 'Consejo Ejecutivo FEITEC',
    target_carnet: null,
    action: 'election.update',
    resource_type: 'election',
    resource_id: 'election-001',
    details: {
      previous: {
        status: 'SCHEDULED',
        end_time: '2026-05-10T18:00:00.000Z',
      },
      changes: {
        status: 'OPEN',
        end_time: '2026-05-10T20:00:00.000Z',
      },
    },
    ip_address: '10.0.0.11',
    created_at: new Date(Date.now() - 75 * 60_000).toISOString(),
    actionLabel: 'Actualizacion de eleccion',
    resourceLabel: 'Eleccion',
    activityMessage: 'Actualizacion de configuracion electoral',
    election_title: 'Consejo Ejecutivo FEITEC',
    holder_name: null,
    holder_carnet: null,
  },
  {
    id: 'audit-log-003',
    actor_id: 'admin-002',
    actor_carnet: '202400145',
    actor_name: 'Maria Gonzalez',
    target_name: 'Etiqueta Computacion Cartago',
    target_carnet: null,
    action: 'tag.insert',
    resource_type: 'tag',
    resource_id: 'tag-001',
    details: {
      new: {
        name: 'Computacion Cartago',
        description: 'Estudiantes activos de computacion en Cartago',
        color: '#2563eb',
        member_count: 24,
        members: [
          {
            full_name: 'Ana Camacho Rojas',
            carnet: '202600001',
            sede: 'Cartago',
            career: 'Ingenieria en Computacion',
          },
          {
            full_name: 'Luis Vega Solano',
            carnet: '202600019',
            sede: 'Cartago',
            career: 'Ingenieria en Computacion',
          },
        ],
      },
    },
    ip_address: '10.0.0.12',
    created_at: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    actionLabel: 'Creacion de tag',
    resourceLabel: 'Tag',
    activityMessage: 'Creacion de agrupacion de votantes',
    election_title: null,
    holder_name: null,
    holder_carnet: null,
  },
  {
    id: 'audit-log-004',
    actor_id: null,
    actor_carnet: null,
    actor_name: null,
    target_name: null,
    target_carnet: null,
    action: 'scrutiny.finalize',
    resource_type: 'scrutiny_key',
    resource_id: 'scrutiny-001',
    details: {
      election_title: 'Consulta de Asamblea',
      submitted_keys: 3,
    },
    ip_address: null,
    created_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    actionLabel: 'Escrutinio finalizado',
    resourceLabel: 'Seguridad',
    activityMessage: 'Finalizacion de escrutinio',
    election_title: 'Consulta de Asamblea',
    holder_name: null,
    holder_carnet: null,
  },
];

const AUDIT_STATS = [
  { resource_type: 'padron_upload', count: 12, last_activity: AUDIT_LOGS[0].created_at },
  { resource_type: 'election', count: 18, last_activity: AUDIT_LOGS[1].created_at },
  { resource_type: 'tag', count: 9, last_activity: AUDIT_LOGS[2].created_at },
  { resource_type: 'scrutiny_key', count: 4, last_activity: AUDIT_LOGS[3].created_at },
  { resource_type: 'admin', count: 3, last_activity: AUDIT_LOGS[2].created_at },
];

test('Audit page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('AUDIT');
    apiServer = await startMockAuditApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/auditoria`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    const result = await runLighthouse(`${frontendUrl}/auditoria`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'audit-page');
    assertFinalPage(result.lhr, `${frontendUrl}/auditoria`);
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

async function startMockAuditApi(port = 0) {
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

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/audit/stats') {
      sendJson(response, AUDIT_STATS);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/audit') {
      const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
      const limit = Math.max(1, Number(url.searchParams.get('limit') || String(PAGE_SIZE)));
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      const resourceTypes = (url.searchParams.get('resource_types') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const filtered = AUDIT_LOGS.filter((log) => {
        const matchesResource =
          resourceTypes.length === 0 || resourceTypes.includes(log.resource_type);
        const haystack = [
          log.actor_name,
          log.actor_carnet,
          log.target_name,
          log.target_carnet,
          log.resource_id,
          log.action,
          log.actionLabel,
          log.activityMessage,
          log.election_title,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();
        const matchesSearch = !search || haystack.includes(search);

        return matchesResource && matchesSearch;
      });

      const start = (page - 1) * limit;
      sendJson(response, {
        logs: filtered.slice(start, start + limit),
        total: filtered.length,
        page,
        limit,
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
