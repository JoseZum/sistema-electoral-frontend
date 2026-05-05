import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
const TEST_TIMEOUT_MS = Number(process.env.LIGHTHOUSE_AUTH_TIMEOUT_MS || 600_000);

const THRESHOLDS = {
  performance: readThreshold('LIGHTHOUSE_AUTH_PERFORMANCE_MIN', 0.7),
  accessibility: readThreshold('LIGHTHOUSE_AUTH_ACCESSIBILITY_MIN', 0.9),
  'best-practices': readThreshold('LIGHTHOUSE_AUTH_BEST_PRACTICES_MIN', 0.9),
  seo: readThreshold('LIGHTHOUSE_AUTH_SEO_MIN', 0.8),
};

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

    await saveReports(result.lhr, 'login-page');
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

function readThreshold(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }

  return value;
}

function createNextEnv() {
  return {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

async function getFreePort() {
  const { createServer } = await import('node:http');
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
      true
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

async function waitForRuntimeExpression(client, expression, timeoutMs, expectedValue = 'lighthouse-ready') {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });

      if (result?.result?.value === expectedValue) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(`Timed out preparing public session${lastError ? `: ${lastError.message}` : ''}`);
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
