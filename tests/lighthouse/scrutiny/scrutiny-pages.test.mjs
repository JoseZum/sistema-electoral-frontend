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
const TEST_TIMEOUT_MS = readTimeout('SCRUTINY');

const THRESHOLDS = readThresholds('SCRUTINY');

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
    const mockApiConfig = resolveMockApiConfig('SCRUTINY');
    apiServer = await startMockScrutinyApi(mockApiConfig.port);
    const frontendPort = await getFreePort();
    const apiUrl = mockApiConfig.origin || `http://127.0.0.1:${apiServer.port}`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv({ apiUrl, distDir: '.next-lighthouse-scrutiny' });

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(`${frontendUrl}/escrutinio`, 90_000);

    chrome = await launchChrome();
    await seedSession(chrome.port, frontendUrl, {
      token: 'lighthouse-admin-token',
      user: ADMIN_USER,
      label: 'seeding admin session',
    });

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

  await saveReports(REPORT_DIR, result.lhr, reportName);
  assertFinalPage(result.lhr, expectedUrl);
  assertCategoryBudgets(result.lhr, THRESHOLDS);
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
