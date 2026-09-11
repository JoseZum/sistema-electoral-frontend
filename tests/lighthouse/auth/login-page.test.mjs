import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { launchChrome } from '../shared/chrome.mjs';
import {
  readThresholds,
  readTimeout,
  createNextEnv,
  getFreePort,
  runNextCommand,
  startNextServer,
  waitForHttp,
  stopProcess,
  createCdpClient,
  waitForRuntimeExpression,
  runLighthouse,
  saveReports,
  assertFinalPage,
  assertCategoryBudgets,
} from '../shared/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.join(__dirname, '.reports');
const TEST_TIMEOUT_MS = readTimeout('AUTH');

const THRESHOLDS = readThresholds('AUTH');

test('Login page meets Lighthouse budgets', { timeout: TEST_TIMEOUT_MS }, async () => {
  let nextServer;
  let chrome;

  try {
    const frontendPort = await getFreePort();
    const frontendUrl = `http://127.0.0.1:${frontendPort}`;
    const env = createNextEnv();

    if (process.env.LIGHTHOUSE_SKIP_BUILD !== '1') {
      await runNextCommand(['build', '--webpack'], env, 'next-build');
    }

    nextServer = startNextServer(frontendPort, env);
    await waitForHttp(frontendUrl, 90_000);

    chrome = await launchChrome();
    await preparePublicSession(chrome.port, frontendUrl);

    const result = await runLighthouse(frontendUrl, chrome.port);
    assert.ok(result?.lhr, 'Lighthouse did not return an LHR result');

    await saveReports(REPORT_DIR, result.lhr, 'login-page');
    assertFinalPage(result.lhr, frontendUrl);
    assertCategoryBudgets(result.lhr, THRESHOLDS);
  } finally {
    if (chrome) {
      await chrome.kill();
    }

    if (nextServer) {
      await stopProcess(nextServer);
    }
  }
});

async function preparePublicSession(chromePort, frontendUrl) {
  const client = await createCdpClient(chromePort, frontendUrl);

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitForRuntimeExpression(
      client,
      `
        localStorage.removeItem('tee_token');
        localStorage.removeItem('tee_user');
        sessionStorage.clear();
        document.querySelector('h1')?.textContent?.includes('Portal de votacion') || false;
      `,
      20_000,
      true,
      'preparing public session'
    );
  } finally {
    client.close();
  }
}
