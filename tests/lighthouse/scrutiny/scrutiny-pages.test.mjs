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
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_SCRUTINY_TIMEOUT_MS || 600_000);

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_SCRUTINY_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_SCRUTINY_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_SCRUTINY_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_SCRUTINY_SEO_MIN', 0.8),
};

const ADMIN_USER = {
  studentId: 'member-002',
  carnet: '202600002',
  fullName: 'Bruno Solis Vega',
  role: 'admin',
  sede: 'San Carlos',
  career: 'Administracion',
};

const ELECTIONS = [
  {
    id: 'election-scrutiny-001',
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
    id: 'election-open-002',
    title: 'Representacion estudiantil 2026',
    description: 'Eleccion abierta que no entra al listado de escrutinio',
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

const SCRUTINY_MEMBERS = [
  {
    id: 'member-001',
    full_name: 'Ana Camacho Rojas',
    carnet: '202600001',
    date: '2026-05-02T18:10:00.000Z',
    has_submitted: true,
  },
  {
    id: 'member-002',
    full_name: 'Bruno Solis Vega',
    carnet: '202600002',
    date: null,
    has_submitted: false,
  },
  {
    id: 'member-003',
    full_name: 'Camila Mora Arias',
    carnet: '202600003',
    date: null,
    has_submitted: false,
  },
];

test('Scrutiny pages meet Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let apiServer;
  let nextServer;
  let chrome;

  try {
    const mockApiConfig = resolveMockApiConfig();
    apiServer = await startMockScrutinyApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv(apiUrl);

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/escrutinio`, 90_000);

    chrome = await launchChrome();
    await seedAdminSession(chrome.port, frontendUrl);

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/escrutinio`,
      expectedUrl: `${frontendUrl}/escrutinio`,
      reportName: 'scrutiny-page',
    });

    await auditPage({
      chromePort: chrome.port,
      url: `${frontendUrl}/escrutinio/subir?id=election-scrutiny-001`,
      expectedUrl: `${frontendUrl}/escrutinio/subir?id=election-scrutiny-001`,
      reportName: 'upload-scrutiny-page',
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
    ...(process.env.LIGHTHOUSE_SKIP_BUILD !== '1'
      ? { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-lighthouse-scrutiny' }
      : {}),
    LIGHTHOUSE_SKIP_BUILD_CHECKS: '1',
    LIGHTHOUSE_FORCE_SINGLE_WORKER: '1',
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

function resolveMockApiConfig() {
  const rawUrl =
    process.env.LIGHTHOUSE_SCRUTINY_MOCK_API_URL ||
    process.env.LIGHTHOUSE_MOCK_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error('LIGHTHOUSE_SCRUTINY_MOCK_API_URL must be an http localhost URL');
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
}

async function startMockScrutinyApi(port = 0) {
  let scrutinyStatus = {
    electionStatus: 'CLOSED',
    publicationStatus: 'PENDING',
    submittedKeys: 1,
    members: SCRUTINY_MEMBERS.map((member) => ({ ...member })),
  };

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

    if (request.method === 'GET' && url.pathname === '/api/elections') {
      sendJson(
        response,
        ELECTIONS.map((election) =>
          election.id === 'election-scrutiny-001'
            ? { ...election, status: scrutinyStatus.electionStatus }
            : election
        )
      );
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/scrutiny/election-scrutiny-001') {
      const election = ELECTIONS.find((current) => current.id === 'election-scrutiny-001');
      sendJson(response, {
        electionInfo: {
          id: election.id,
          title: election.title,
          status: scrutinyStatus.electionStatus,
          requires_keys: election.requires_keys,
          min_keys: election.min_keys,
        },
        progressScrutiny: {
          total_Members: scrutinyStatus.members.length,
          submittedKeys: scrutinyStatus.submittedKeys,
          membersPending: scrutinyStatus.members,
          can_finalize: scrutinyStatus.submittedKeys >= election.min_keys,
        },
        general_Metric: {
          total_votes: 401,
          total_elegibles: 428,
          participation_rate: 93.7,
        },
        publication_status: scrutinyStatus.publicationStatus,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/scrutiny/election-scrutiny-001/submit-key') {
      const payload = await readJsonBody(request);
      const memberId = payload.memberId;
      const memberIndex = scrutinyStatus.members.findIndex((member) => member.id === memberId);

      if (memberIndex === -1) {
        sendJson(response, { error: 'Member not found' }, 404);
        return;
      }

      if (!payload.key || typeof payload.key !== 'string') {
        sendJson(response, { error: 'Invalid key' }, 400);
        return;
      }

      const alreadySubmitted = scrutinyStatus.members[memberIndex].has_submitted;
      if (!alreadySubmitted) {
        scrutinyStatus.members[memberIndex] = {
          ...scrutinyStatus.members[memberIndex],
          has_submitted: true,
          date: '2026-05-02T18:20:00.000Z',
        };
        scrutinyStatus.submittedKeys += 1;
      }

      sendJson(response, {
        submitted: true,
        finalized: scrutinyStatus.submittedKeys >= 3,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/scrutiny/election-scrutiny-001/finalize') {
      scrutinyStatus = {
        ...scrutinyStatus,
        electionStatus: 'SCRUTINIZED',
        publicationStatus: 'FINALIZED',
        submittedKeys: Math.max(scrutinyStatus.submittedKeys, 3),
      };
      sendJson(response, {
        ...ELECTIONS[0],
        status: 'SCRUTINIZED',
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
