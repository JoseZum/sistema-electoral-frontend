import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import lighthouse, { desktopConfig, generateReport } from 'lighthouse';
import { launchChrome } from '../shared/chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const NEXT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const REPORT_DIR = path.join(__dirname, '.reports');
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_VOTING_TIMEOUT_MS || 600_000);
const OPEN_ELECTION_ID = 'lighthouse-election-open';

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_VOTING_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_VOTING_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_VOTING_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_VOTING_SEO_MIN', 0.8),
};

const VOTER_USER = {
  studentId: 'student-lighthouse',
  carnet: '202600001',
  fullName: 'Ana Camacho Rojas',
  role: 'student',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

const now = Date.now();
const OPEN_START = new Date(now - 30 * 60_000).toISOString();
const OPEN_END = new Date(now + 4 * 60 * 60_000).toISOString();
const SCHEDULED_START = new Date(now + 3 * 24 * 60 * 60_000).toISOString();
const SCHEDULED_END = new Date(now + 4 * 24 * 60 * 60_000).toISOString();
const CLOSED_START = new Date(now - 7 * 24 * 60 * 60_000).toISOString();
const CLOSED_END = new Date(now - 6 * 24 * 60 * 60_000).toISOString();

const ELECTIONS = [
  {
    id: OPEN_ELECTION_ID,
    title: 'Eleccion del Consejo Ejecutivo FEITEC',
    description: 'Votacion activa para seleccionar la representacion estudiantil.',
    status: 'OPEN',
    is_anonymous: true,
    tag_name: 'Computacion Cartago',
    tag_color: '#2563eb',
    start_time: OPEN_START,
    end_time: OPEN_END,
    has_voted: false,
    total_options: 4,
  },
  {
    id: 'lighthouse-election-scheduled',
    title: 'Consulta de Asamblea Estudiantil',
    description: 'Consulta programada para validar acuerdos de asamblea.',
    status: 'SCHEDULED',
    is_anonymous: false,
    tag_name: 'Padron general',
    tag_color: '#16a34a',
    start_time: SCHEDULED_START,
    end_time: SCHEDULED_END,
    has_voted: false,
    total_options: 3,
  },
  {
    id: 'lighthouse-election-voted',
    title: 'Referendum de servicios estudiantiles',
    description: 'Proceso cerrado con voto ya emitido por la persona usuaria.',
    status: 'CLOSED',
    is_anonymous: true,
    tag_name: null,
    tag_color: null,
    start_time: CLOSED_START,
    end_time: CLOSED_END,
    has_voted: true,
    total_options: 2,
  },
];

const ELECTION_DETAILS = {
  [OPEN_ELECTION_ID]: {
    ...ELECTIONS[0],
    options: [
      {
        id: 'option-alianza',
        label: 'Movimiento Alianza Estudiantil',
        option_type: 'REGULAR',
        display_order: 1,
      },
      {
        id: 'option-accion',
        label: 'Frente Accion TEC',
        option_type: 'REGULAR',
        display_order: 2,
      },
      {
        id: 'option-blank',
        label: 'Voto en blanco',
        option_type: 'BLANK',
        display_order: 3,
      },
      {
        id: 'option-null',
        label: 'Voto nulo',
        option_type: 'NULL_VOTE',
        display_order: 4,
      },
    ],
  },
};

test('Voting pages meet Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig();
    apiServer = await startMockVotingApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv(apiUrl);

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/votaciones`, 90_000);

    chrome = await launchChrome();
    await seedVoterSession(chrome.port, frontendUrl);

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/votaciones`,
      expectedUrl: `${frontendUrl}/votaciones`,
      reportName: 'voter-elections-page',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/votaciones/${OPEN_ELECTION_ID}`,
      expectedUrl: `${frontendUrl}/votaciones/${OPEN_ELECTION_ID}`,
      reportName: 'election-voting-page',
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
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

function resolveMockApiConfig() {
  const rawUrl =
    process.env.LIGHTHOUSE_VOTING_MOCK_API_URL ||
    process.env.LIGHTHOUSE_MOCK_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error('LIGHTHOUSE_VOTING_MOCK_API_URL must be an http localhost URL');
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
}

async function startMockVotingApi(port = 0) {
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin || '*';
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/voting/elections') {
      sendJson(response, ELECTIONS);
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/voting/elections/')) {
      const electionId = url.pathname.split('/').pop();
      const election = ELECTION_DETAILS[electionId || ''];
      if (!election) {
        sendJson(response, { error: 'Election not found' }, 404);
        return;
      }

      sendJson(response, election);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/voting/cast') {
      await readRequestBody(request);
      sendJson(response, { message: 'Vote recorded' });
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

async function seedVoterSession(chromePort, frontendUrl) {
  const client = await createCdpClient(chromePort, frontendUrl);

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitForRuntimeExpression(
      client,
      `
        localStorage.setItem('tee_token', 'lighthouse-voter-token');
        localStorage.setItem('tee_user', ${JSON.stringify(JSON.stringify(VOTER_USER))});
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

      if (result?.result?.value === 'lighthouse-voter-token') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(`Timed out seeding voter session${lastError ? `: ${lastError.message}` : ''}`);
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
