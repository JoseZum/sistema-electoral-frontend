/**
 * Arnes compartido de las auditorias de Lighthouse.
 *
 * Antes cada script de pagina traia su propia copia de estas funciones. Las
 * copias fueron divergiendo (unas con reintento al abrir el target de Chrome y
 * otras no, unas limpiando sessionStorage y otras no), asi que un arreglo solo
 * llegaba a los archivos que alguien se acordo de tocar. Aca viven una sola vez.
 *
 * Lo que sigue siendo de cada pagina se pasa por parametro: el prefijo de sus
 * variables de entorno, su carpeta de reportes, su servidor mock y su usuario.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse, { desktopConfig, generateReport } from 'lighthouse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const NEXT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

const CATEGORY_DEFAULTS = {
  performance: 0.7,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.8,
};

// --- Configuracion por pagina ---

export function readThreshold(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }

  return value;
}

/** Umbrales de la pagina: LIGHTHOUSE_<PREFIJO>_<CATEGORIA>_MIN, con el mismo default de siempre. */
export function readThresholds(prefix) {
  return {
    performance: readThreshold(`LIGHTHOUSE_${prefix}_PERFORMANCE_MIN`, CATEGORY_DEFAULTS.performance),
    accessibility: readThreshold(
      `LIGHTHOUSE_${prefix}_ACCESSIBILITY_MIN`,
      CATEGORY_DEFAULTS.accessibility
    ),
    'best-practices': readThreshold(
      `LIGHTHOUSE_${prefix}_BEST_PRACTICES_MIN`,
      CATEGORY_DEFAULTS['best-practices']
    ),
    seo: readThreshold(`LIGHTHOUSE_${prefix}_SEO_MIN`, CATEGORY_DEFAULTS.seo),
  };
}

export function readTimeout(prefix, fallback = 600_000) {
  return Number(process.env[`LIGHTHOUSE_${prefix}_TIMEOUT_MS`] || fallback);
}

/**
 * Entorno del `next build`/`next start` de la auditoria.
 *
 * `distDir` lo usan las paginas pesadas (admin, escrutinio) para compilar en su
 * propio directorio y no pelearse por `.next`; ahi tambien se saltan los chequeos
 * de build y se fuerza un solo worker.
 */
export function createNextEnv({ apiUrl, distDir } = {}) {
  return {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    ...(distDir && process.env.LIGHTHOUSE_SKIP_BUILD !== '1'
      ? {
          NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || distDir,
        }
      : {}),
    ...(distDir
      ? { LIGHTHOUSE_SKIP_BUILD_CHECKS: '1', LIGHTHOUSE_FORCE_SINGLE_WORKER: '1' }
      : {}),
    ...(apiUrl ? { NEXT_PUBLIC_API_URL: apiUrl } : {}),
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_AZURE_TENANT_ID: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
  };
}

/** Origen del mock: primero la variable de la pagina, luego la global, luego la del front. */
export function resolveMockApiConfig(prefix) {
  const pageVar = prefix ? process.env[`LIGHTHOUSE_${prefix}_MOCK_API_URL`] : undefined;
  const rawUrl = pageVar || process.env.LIGHTHOUSE_MOCK_API_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!rawUrl) {
    return { origin: null, port: 0 };
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'http:' || !isLocalHost) {
    throw new Error(
      `LIGHTHOUSE_${prefix}_MOCK_API_URL/LIGHTHOUSE_MOCK_API_URL must be an http localhost URL`
    );
  }

  return {
    origin: url.origin,
    port: Number(url.port || '80'),
  };
}

// --- Servidores ---

export function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

export async function getFreePort() {
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

export async function closeServer(server) {
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

export async function runNextCommand(args, env, label) {
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

export function startNextServer(port, env) {
  return spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

export async function waitForHttp(url, timeoutMs) {
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

export async function stopProcess(child) {
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

// --- Chrome DevTools Protocol ---

export class CdpClient {
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

/** Reintenta: recien arrancado, Chrome puede tardar en aceptar el target. */
export async function createCdpClient(chromePort, startingUrl, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
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

export async function waitForRuntimeExpression(
  client,
  expression,
  timeoutMs,
  expectedValue = 'lighthouse-admin-token',
  label = 'seeding admin session'
) {
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

  throw new Error(`Timed out ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

/** Siembra la sesion en localStorage antes de auditar una pagina autenticada. */
export async function seedSession(chromePort, frontendUrl, { token, user, label }) {
  const client = await createCdpClient(chromePort, frontendUrl);

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitForRuntimeExpression(
      client,
      `
        sessionStorage.clear();
        localStorage.setItem('tee_token', ${JSON.stringify(token)});
        localStorage.setItem('tee_user', ${JSON.stringify(JSON.stringify(user))});
        localStorage.getItem('tee_token');
      `,
      15_000,
      token,
      label
    );
  } finally {
    client.close();
  }
}

// --- Lighthouse ---

export async function runLighthouse(url, chromePort) {
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

export async function saveReports(reportDir, lhr, reportName) {
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, `${reportName}.lhr.json`), JSON.stringify(lhr, null, 2));
  await writeFile(path.join(reportDir, `${reportName}.report.html`), generateReport(lhr, 'html'));
}

export function assertFinalPage(lhr, expectedUrl) {
  assert.equal(
    normalizeUrl(lhr.finalDisplayedUrl || lhr.finalUrl),
    normalizeUrl(expectedUrl),
    `Lighthouse did not audit the expected page: ${expectedUrl}`
  );
}

export function assertCategoryBudgets(lhr, thresholds) {
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

export function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

export function formatScore(score) {
  return `${Math.round(score * 100)}`;
}

// --- Varios ---

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function unique(values) {
  return [...new Set(values)].sort();
}
