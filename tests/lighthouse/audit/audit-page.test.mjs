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
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_AUDIT_TIMEOUT_MS || 600_000);
const PAGE_SIZE = 30;

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_AUDIT_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_AUDIT_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_AUDIT_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_AUDIT_SEO_MIN', 0.8),
};

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
    const mockApiConfig = resolveMockApiConfig();
    apiServer = await startMockAuditApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv(apiUrl);

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/auditoria`, 90_000);

    chrome = await launchChrome();
    await seedAdminSession(chrome.port, frontendUrl);

    const result = await runLighthouse(`${frontendUrl}/auditoria`, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(result.lhr, 'audit-page');
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
    process.env.LIGHTHOUSE_AUDIT_MOCK_API_URL ||
    process.env.LIGHTHOUSE_MOCK_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error('LIGHTHOUSE_AUDIT_MOCK_API_URL must be an http localhost URL');
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
}

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
