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
const TEST_TIMEOUT_MS = readTimeout('PADRON');

const THRESHOLDS = readThresholds('PADRON');

const ADMIN_USER = {
  studentId: 'admin-lighthouse',
  carnet: 'A00000000',
  fullName: 'Admin Lighthouse',
  role: 'admin',
  sede: 'Cartago',
  career: 'Administracion',
};

const SEDES = ['Cartago', 'San Carlos', 'San Jose'];
const CAREERS = [
  'Administracion de Empresas',
  'Ingenieria en Computacion',
  'Ingenieria en Produccion Industrial',
];
const DEGREE_LEVELS = ['Bachillerato', 'Licenciatura'];

const STUDENTS = Array.from({ length: 38 }, (_, index) => {
  const number = index + 1;
  const sede = SEDES[index % SEDES.length];
  const career = CAREERS[index % CAREERS.length];

  return {
    id: `student-${String(number).padStart(3, '0')}`,
    carnet: `2026${String(number).padStart(5, '0')}`,
    full_name: `Estudiante Lighthouse ${String(number).padStart(2, '0')}`,
    sede,
    career,
    degree_level: DEGREE_LEVELS[index % DEGREE_LEVELS.length],
  };
});

test('Padron pages meet Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig('PADRON');
    apiServer = await startMockPadronApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/padron`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/padron`,
      expectedUrl: `${frontendUrl}/padron`,
      reportName: 'padron-page',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/padron/cargar`,
      expectedUrl: `${frontendUrl}/padron/cargar`,
      reportName: 'upload-padron-page',
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

async function startMockPadronApi(port = 0) {
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin || '*';
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/users/students/catalog') {
      sendJson(response, {
        sedes: SEDES,
        careers: CAREERS,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/users/students') {
      const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
      const limit = Math.max(1, Number(url.searchParams.get('limit') || '25'));
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
      const start = (page - 1) * limit;

      sendJson(response, {
        students: filtered.slice(start, start + limit),
        total: filtered.length,
      });
      return;
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/users/students/')) {
      await readRequestBody(request);
      sendJson(response, { success: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/users/students/import') {
      await readRequestBody(request);
      sendJson(response, {
        total: 38,
        new: 2,
        updated: 35,
        reactivated: 1,
        deactivated: 0,
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

async function readRequestBody(request) {
  for await (const _chunk of request) {
    // Drain request body so the mock behaves like a real HTTP server.
  }
}
