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
const TEST_TIMEOUT_MS = readTimeout('VOTING');
const OPEN_ELECTION_ID = 'lighthouse-election-open';

const THRESHOLDS = readThresholds('VOTING');

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
    const mockApiConfig = resolveMockApiConfig('VOTING');
    apiServer = await startMockVotingApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/votaciones`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-voter-token',
      user: VOTER_USER,
      label: 'seeding voter session',
    });

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

  await saveReports(REPORT_DIR, result.lhr, reportName);
  assertFinalPage(result.lhr, expectedUrl);
  assertCategoryBudgets(result.lhr, THRESHOLDS);
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
