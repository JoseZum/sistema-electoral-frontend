import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import lighthouse, { desktopConfig, generateReport } from 'lighthouse';
import { launch } from 'chrome-launcher';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const NEXT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const REPORT_DIR = path.join(__dirname, '.reports');
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_ADMIN_TIMEOUT_MS || 600_000);

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_ADMIN_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_ADMIN_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_ADMIN_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_ADMIN_SEO_MIN', 0.8),
};

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
    const mockApiConfig = resolveMockApiConfig();
    apiServer = await startMockAdminApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv(apiUrl);

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/admin-manager`, 90_000);

    chrome = await launchChrome();
    await seedAdminSession(chrome.port, frontendUrl);

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

  await saveReports(result.lhr, reportName);
  assertFinalPage(result.lhr, expectedUrl);
  assertCategoryBudgets(result.lhr, THRESHOLDS);
}

function readThreshold(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }

  return value;
}

function createNextEnv(apiUrl) {
  return {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-lighthouse-admin',
    LIGHTHOUSE_SKIP_BUILD_CHECKS: '1',
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

function resolveMockApiConfig() {
  const rawUrl =
    process.env.LIGHTHOUSE_ADMIN_MOCK_API_URL ||
    process.env.LIGHTHOUSE_MOCK_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error('LIGHTHOUSE_ADMIN_MOCK_API_URL must be an http localhost URL');
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
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

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

async function getFreePort() {
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const { port } = server.address();
  await closeServer(server);
  return port;
}

async function runNextCommand(args, env, label) {
  const child = spawn(process.execPath, [NEXT_BIN, ...args], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

function startNextServer(port, env) {
  return spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(750);
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ''}`);
}

async function launchChrome() {
  return launch({
    chromePath: process.env.LIGHTHOUSE_CHROME_PATH || process.env.CHROME_PATH,
    chromeFlags: ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  });
}

async function seedAdminSession(chromePort, frontendUrl) {
  const client = await createCdpClient(chromePort, frontendUrl);

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitForRuntimeExpression(
      client,
      `
        localStorage.setItem('tee_token', 'lighthouse-admin-token');
        localStorage.setItem('tee_user', ${JSON.stringify(JSON.stringify(ADMIN_USER))});
        localStorage.getItem('tee_token');
      `,
      15_000
    );
  } finally {
    client.close();
  }
}

async function createCdpClient(chromePort, startingUrl) {
  const response = await fetch(
    `http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(startingUrl)}`,
    { method: 'PUT' }
  );

  if (!response.ok) {
    throw new Error(`Could not create Chrome debugging target: HTTP ${response.status}`);
  }

  const target = await response.json();
  return new CdpClient(target.webSocketDebuggerUrl);
}

class CdpClient {
  constructor(webSocketDebuggerUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketDebuggerUrl);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;

      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForRuntimeExpression(client, expression, timeoutMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });

      if (result?.result?.value === 'lighthouse-admin-token') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(`Timed out seeding admin session${lastError ? `: ${lastError.message}` : ''}`);
}

async function runLighthouse(url, chromePort) {
  return lighthouse(
    url,
    {
      port: chromePort,
      output: 'json',
      logLevel: process.env.LIGHTHOUSE_LOG_LEVEL || 'error',
      disableStorageReset: true,
    },
    {
      ...desktopConfig,
      settings: {
        ...desktopConfig.settings,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1366,
          height: 768,
          deviceScaleFactor: 1,
          disabled: false,
        },
      },
    }
  );
}

async function saveReports(lhr, reportName) {
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(path.join(REPORT_DIR, `${reportName}.lhr.json`), JSON.stringify(lhr, null, 2));
  await writeFile(path.join(REPORT_DIR, `${reportName}.report.html`), generateReport(lhr, 'html'));
}

function assertFinalPage(lhr, expectedUrl) {
  assert.equal(
    normalizeUrl(lhr.finalDisplayedUrl || lhr.finalUrl),
    normalizeUrl(expectedUrl),
    `Lighthouse did not audit the expected page: ${expectedUrl}`
  );
}

function assertCategoryBudgets(lhr, thresholds) {
  for (const [categoryId, minimumScore] of Object.entries(thresholds)) {
    const category = lhr.categories[categoryId];
    assert.ok(category, `Missing Lighthouse category: ${categoryId}`);
    assert.equal(typeof category.score, 'number', `${category.title} score is not numeric`);
    assert.ok(
      category.score >= minimumScore,
      `${category.title} score ${formatScore(category.score)} is below ${formatScore(minimumScore)}`
    );
  }
}

function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

function formatScore(score) {
  return `${Math.round(score * 100)}`;
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGTERM');

  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5_000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }),
  ]);
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
