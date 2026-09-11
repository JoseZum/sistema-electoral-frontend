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
  unique,
} from '../shared/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.join(__dirname, '.reports');
const TEST_TIMEOUT_MS = readTimeout('TAGS');

const THRESHOLDS = readThresholds('TAGS');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const STUDENTS = [
  {
    id: 'student-001',
    carnet: '202600001',
    full_name: 'Ana Camacho Rojas',
    sede: 'Cartago',
    career: 'Ingenieria en Computacion',
    degree_level: 'Bachillerato',
    is_active: true,
  },
  {
    id: 'student-002',
    carnet: '202600002',
    full_name: 'Bruno Solis Vega',
    sede: 'San Carlos',
    career: 'Administracion de Empresas',
    degree_level: 'Bachillerato',
    is_active: true,
  },
  {
    id: 'student-003',
    carnet: '202600003',
    full_name: 'Camila Mora Arias',
    sede: 'Cartago',
    career: 'Ingenieria en Computacion',
    degree_level: 'Licenciatura',
    is_active: true,
  },
  {
    id: 'student-004',
    carnet: '202600004',
    full_name: 'Diego Vargas Soto',
    sede: 'San Jose',
    career: 'Ingenieria en Produccion Industrial',
    degree_level: 'Bachillerato',
    is_active: true,
  },
];

const TAG_DETAILS = [
  {
    id: 'tag-computacion-cartago',
    name: 'Computacion Cartago',
    description: 'Estudiantes activos de Computacion en Cartago',
    color: '#2563eb',
    member_count: 2,
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
    members: [STUDENTS[0], STUDENTS[2]],
  },
  {
    id: 'tag-san-carlos',
    name: 'Sede San Carlos',
    description: 'Padron de la sede San Carlos',
    color: '#16a34a',
    member_count: 1,
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
    members: [STUDENTS[1]],
  },
  {
    id: 'tag-produccion',
    name: 'Produccion Industrial',
    description: 'Estudiantes de Produccion Industrial',
    color: '#ea580c',
    member_count: 1,
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z',
    members: [STUDENTS[3]],
  },
];

test('Tags page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('TAGS');
    apiServer = await startMockTagsApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/tags`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    const result = await runLighthouse(`${frontendUrl}/tags`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'tags-page');
    assertFinalPage(result.lhr, `${frontendUrl}/tags`);
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

async function startMockTagsApi(port = 0) {
  const server = createServer((request, response) => {
    const origin = request.headers.origin || '*';
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/tags') {
      sendJson(response, TAG_DETAILS.map(({ members, ...tag }) => tag));
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/tags/')) {
      const tagId = url.pathname.split('/').pop();
      const tag = TAG_DETAILS.find((current) => current.id === tagId);
      if (!tag) {
        sendJson(response, { error: 'Tag not found' }, 404);
        return;
      }

      sendJson(response, tag);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/users/students/catalog') {
      sendJson(response, {
        sedes: unique(STUDENTS.map((student) => student.sede)),
        careers: unique(STUDENTS.map((student) => student.career)),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/users/students') {
      const limit = Number(url.searchParams.get('limit') || '50');
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      const sede = url.searchParams.get('sede') || '';
      const career = url.searchParams.get('career') || '';
      const filtered = STUDENTS.filter((student) => {
        const matchesSearch =
          !search ||
          student.full_name.toLocaleLowerCase().includes(search) ||
          student.carnet.toLocaleLowerCase().includes(search);
        const matchesSede = !sede || student.sede === sede;
        const matchesCareer = !career || student.career === career;

        return matchesSearch && matchesSede && matchesCareer;
      });

      sendJson(response, {
        students: filtered.slice(0, limit),
        total: filtered.length,
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
