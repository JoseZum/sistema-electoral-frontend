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
const TEST_TIMEOUT_MS = readTimeout('ADMIN');

const THRESHOLDS = readThresholds('ADMIN');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const BASE_ADMINS = [
  {
    id: 'admin-001',
    students_id: 'student-001',
    position_title: 'Administrador general',
    role: 'admin',
    created_at: '2026-05-01T08:00:00.000Z',
    carnet: '202600001',
    full_name: 'Ana Camacho Rojas',
    sede: 'Cartago',
    career: 'Ingenieria en Computacion',
  },
  {
    id: 'admin-002',
    students_id: 'student-002',
    position_title: 'Administrador de soporte',
    role: 'admin',
    created_at: '2026-05-02T09:30:00.000Z',
    carnet: '202600002',
    full_name: 'Bruno Solis Vega',
    sede: 'San Carlos',
    career: 'Administracion de Empresas',
  },
  {
    id: 'admin-003',
    students_id: 'student-003',
    position_title: 'Administrador de escrutinio',
    role: 'admin',
    created_at: '2026-05-03T11:45:00.000Z',
    carnet: '202600003',
    full_name: 'Camila Mora Arias',
    sede: 'San Jose',
    career: 'Ingenieria en Produccion Industrial',
  },
];

const STUDENTS = [
  {
    id: 'student-001',
    carnet: '202600001',
    full_name: 'Ana Camacho Rojas',
    sede: 'Cartago',
    career: 'Ingenieria en Computacion',
  },
  {
    id: 'student-002',
    carnet: '202600002',
    full_name: 'Bruno Solis Vega',
    sede: 'San Carlos',
    career: 'Administracion de Empresas',
  },
  {
    id: 'student-003',
    carnet: '202600003',
    full_name: 'Camila Mora Arias',
    sede: 'San Jose',
    career: 'Ingenieria en Produccion Industrial',
  },
  {
    id: 'student-004',
    carnet: '202600004',
    full_name: 'Daniela Rojas Urena',
    sede: 'Cartago',
    career: 'Ingenieria en Computacion',
  },
  {
    id: 'student-005',
    carnet: '202600005',
    full_name: 'Esteban Castillo Mora',
    sede: 'San Carlos',
    career: 'Administracion de Empresas',
  },
  {
    id: 'student-006',
    carnet: '202600006',
    full_name: 'Fabian Solano Vargas',
    sede: 'Alajuela',
    career: 'Ingenieria en Computacion',
  },
];

const ELECTIONS = [
  {
    id: 'election-closed-keys',
    title: 'Asamblea de escuela 2026',
    description: 'Eleccion cerrada pendiente de escrutinio',
    status: 'CLOSED',
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
    start_time: '2026-05-01T14:00:00.000Z',
    end_time: '2026-05-01T18:00:00.000Z',
    created_by: 'admin-001',
    created_at: '2026-04-20T10:00:00.000Z',
    updated_at: '2026-05-01T18:05:00.000Z',
    total_voters: 428,
    votes_cast: 401,
    options_count: 4,
  },
  {
    id: 'election-open',
    title: 'Representacion estudiantil 2026',
    description: 'Eleccion abierta que no deberia aparecer como elegible',
    status: 'OPEN',
    is_anonymous: true,
    auth_method: 'MICROSOFT',
    requires_keys: true,
    min_keys: 2,
    voter_source: 'TAG',
    voter_filter: null,
    tag_id: 'tag-001',
    tag_name: 'Computacion Cartago',
    tag_color: '#2563eb',
    tag_description: 'Padron filtrado por tag',
    tag_member_count: 120,
    starts_immediately: false,
    immediate_minutes: null,
    start_time: '2026-05-02T14:00:00.000Z',
    end_time: '2026-05-02T18:00:00.000Z',
    created_by: 'admin-001',
    created_at: '2026-04-25T10:00:00.000Z',
    updated_at: '2026-05-02T16:00:00.000Z',
    total_voters: 120,
    votes_cast: 63,
    options_count: 3,
  },
];

test('Admin pages meet Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('ADMIN');
    apiServer = await startMockAdminApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl, distDir: '.next-lighthouse-admin' });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/admin-manager`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/admin-manager`,
      expectedUrl: `${frontendUrl}/admin-manager`,
      reportName: 'admin-manager-page',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/generar-llaves`,
      expectedUrl: `${frontendUrl}/generar-llaves`,
      reportName: 'key-generation-page',
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

async function startMockAdminApi(port = 0) {
  let admins = BASE_ADMINS.map((admin) => ({ ...admin }));

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin || '*';
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/users/admins') {
      sendJson(response, admins);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/users/admins') {
      const payload = await readJsonBody(request);
      const student = STUDENTS.find((current) => current.id === payload.students_id);

      if (!student) {
        sendJson(response, { error: 'Student not found' }, 404);
        return;
      }

      const createdAdmin = {
        id: `admin-${String(admins.length + 1).padStart(3, '0')}`,
        students_id: student.id,
        position_title: payload.position_title || 'Administrador',
        role: payload.role || 'admin',
        created_at: new Date().toISOString(),
        carnet: student.carnet,
        full_name: student.full_name,
        sede: student.sede,
        career: student.career,
      };

      admins = [...admins, createdAdmin];
      sendJson(response, createdAdmin, 201);
      return;
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/users/admins/')) {
      const adminId = url.pathname.split('/').pop();
      admins = admins.filter((admin) => admin.id !== adminId);
      sendJson(response, { success: true });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/users/students') {
      const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'));
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      const filtered = STUDENTS.filter((student) => {
        if (!search) return true;

        return (
          student.full_name.toLocaleLowerCase().includes(search) ||
          student.carnet.toLocaleLowerCase().includes(search)
        );
      });

      sendJson(response, {
        students: filtered.slice(0, limit),
        total: filtered.length,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/elections') {
      sendJson(response, ELECTIONS);
      return;
    }

    if (request.method === 'POST' && /^\/api\/scrutiny\/[^/]+\/assign-members$/.test(url.pathname)) {
      const payload = await readJsonBody(request);
      const studentId = Array.isArray(payload.students_id) ? payload.students_id[0] : null;
      const electionId = url.pathname.split('/')[3];

      sendJson(response, {
        result: {
          election_id: electionId,
          student_id: studentId,
          option: payload.option ?? '0',
        },
        keys: [`SCR-${electionId}-${studentId ?? 'unknown'}-KEY`],
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

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}
