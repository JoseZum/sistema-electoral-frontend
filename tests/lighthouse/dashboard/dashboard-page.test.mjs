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
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_DASHBOARD_TIMEOUT_MS || 600_000);

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_DASHBOARD_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_DASHBOARD_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_DASHBOARD_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_DASHBOARD_SEO_MIN', 0.8),
};

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
    const mockApiConfig = resolveMockApiConfig();
    apiServer = await startMockDashboardApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv(apiUrl);

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/dashboard`, 90_000);

    chrome = await launchChrome();
    await seedAdminSession(chrome.port, frontendUrl);

    const result = await runLighthouse(`${frontendUrl}/dashboard`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(result.lhr, 'dashboard-page');
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
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

function resolveMockApiConfig() {
  const rawUrl =
    process.env.LIGHTHOUSE_DASHBOARD_MOCK_API_URL ||
    process.env.LIGHTHOUSE_MOCK_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error('LIGHTHOUSE_DASHBOARD_MOCK_API_URL must be an http localhost URL');
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
}

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
    chromePath: resolveChromePath(),
    chromeFlags: ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  });
}

function resolveChromePath() {
  return (
    process.env.LIGHTHOUSE_CHROME_PATH ||
    process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  );
}

async function seedAdminSession(chromePort, frontendUrl) {
  const client = await createCdpClient(chromePort, frontendUrl);

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitForRuntimeExpression(
      client,
      `
        sessionStorage.clear();
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
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(startingUrl)}`,
        { method: 'PUT' }
      );

      if (!response.ok) {
        throw new Error(`Could not create Chrome debugging target: HTTP ${response.status}`);
      }

      const target = await response.json();
      return new CdpClient(target.webSocketDebuggerUrl);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not create Chrome debugging target');
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
