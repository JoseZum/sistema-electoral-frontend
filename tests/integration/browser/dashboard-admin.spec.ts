import { expect, test, type Page } from '@playwright/test';

import { expectNoCriticalA11yViolations } from './support/accessibility';

// 150/500 abiertas + 200/400 cerradas = 350/900 = 38,9 %. Las cifras del hero salen de
// aqui, asi que las fixtures tienen que cuadrar entre si.
const ELECTIONS = [
  {
    id: 'election-1',
    title: 'Elección FEITEC',
    status: 'OPEN',
    start_time: '2026-05-01T08:00:00.000Z',
    end_time: '2099-05-01T18:00:00.000Z',
    total_voters: 500,
    votes_cast: 150,
  },
  {
    id: 'election-2',
    title: 'Representación Estudiantil',
    status: 'CLOSED',
    start_time: '2026-04-01T08:00:00.000Z',
    end_time: '2026-04-01T18:00:00.000Z',
    total_voters: 400,
    votes_cast: 200,
  },
];

const STATS = {
  totalStudents: 1200,
  activeStudents: 1180,
  totalElections: 2,
  openElections: 1,
  totalVotes: 350,
  participation: 38.9,
};

async function mockApi(
  page: Page,
  { elections = ELECTIONS, electionsStatus = 200, logs = [] as unknown[] } = {},
) {
  await page.addInitScript(() => {
    localStorage.setItem('tee_token', 'playwright-admin-token');
    localStorage.setItem(
      'tee_user',
      JSON.stringify({
        studentId: 'admin-e2e',
        carnet: '2023000002',
        role: 'admin',
        fullName: 'Administrador E2E',
        sede: 'Cartago',
        career: 'Ingenieria en Computacion',
      }),
    );
  });

  // Red de seguridad: ninguna llamada sin simular debe salir hacia la API real.
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'endpoint sin simular en la prueba' }),
    }),
  );

  await page.route('**/api/dashboard/stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATS) }),
  );

  await page.route('**/api/elections', (route) =>
    route.fulfill({
      status: electionsStatus,
      contentType: 'application/json',
      body: electionsStatus === 200 ? JSON.stringify(elections) : JSON.stringify({ error: 'boom' }),
    }),
  );

  await page.route('**/api/audit?limit=3', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ logs, total: logs.length }),
    }),
  );
}

test.describe('dashboard admin page', () => {
  test('@smoke muestra participación, elecciones en curso y la navegación original', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /(Buenos días|Buenas tardes|Buenas noches), Administrador/ })).toBeVisible();

    const hero = page.getByRole('region', { name: 'Participación de la jornada' });
    await expect(hero.locator('.ess-number')).toHaveText('38,9%');
    await expect(hero.getByText('350 votos de 900 posibles')).toBeVisible();
    await expect(hero.getByText('1 elección abierta')).toBeVisible();

    // La lista en curso solo trae las abiertas, con su propio porcentaje.
    const enCurso = page.getByRole('region', { name: 'Elecciones en curso' });
    await expect(enCurso.getByText('Elección FEITEC')).toBeVisible();
    await expect(enCurso.getByText('30.0%')).toBeVisible();
    await expect(enCurso.getByText('Representación Estudiantil')).toHaveCount(0);

    // La navegación existente no se tocó.
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Votaciones' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Vista votante/ })).toHaveAttribute(
      'href',
      '/votaciones',
    );
    for (const [name, href] of [
      ['Procesos electorales', '/elecciones'],
      ['Padrón estudiantil', '/padron'],
      ['Postulaciones', '/postulaciones'],
    ] as const) {
      await expect(
        page.getByRole('navigation', { name: 'Accesos principales' }).getByRole('link', {
          name: new RegExp(name),
        }),
      ).toHaveAttribute('href', href);
    }

    await expect(page.getByRole('link', { name: 'Crear elección' })).toHaveAttribute(
      'href',
      '/elecciones/crear',
    );
    await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0);
    await expectNoCriticalA11yViolations(page);
  });

  test('el filtro recalcula la participación sobre las elecciones elegidas', async ({ page }) => {
    await mockApi(page);
    await page.goto('/dashboard');

    const hero = page.getByRole('region', { name: 'Participación de la jornada' });
    await expect(hero.locator('.ess-number')).toHaveText('38,9%');

    await page.getByLabel('Filtrar participación por elección').selectOption('open');
    await expect(hero.locator('.ess-number')).toHaveText('30,0%');
    await expect(hero.getByText('150 votos de 500 posibles')).toBeVisible();

    await page.getByLabel('Filtrar participación por elección').selectOption('election-2');
    await expect(hero.locator('.ess-number')).toHaveText('50,0%');
  });

  test('un fallo de elecciones se avisa y no se muestra como cero', async ({ page }) => {
    await mockApi(page, { electionsStatus: 500 });
    await page.goto('/dashboard');

    await expect(page.locator('.ess-alert')).toContainText('No se pudo cargar las elecciones');
    await expect(page.locator('.ess-number')).toHaveText('Sin datos');
    await expect(page.getByText('Elecciones sin datos')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Elecciones en curso' }).getByText(
        'No se pudieron cargar las elecciones',
      ),
    ).toBeVisible();
    await expect(page.locator('.ess-number')).not.toHaveText('0,0%');
  });

  test('sin elecciones muestra vacíos reales', async ({ page }) => {
    await mockApi(page, { elections: [] });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /(Buenos días|Buenas tardes|Buenas noches), Administrador/ })).toBeVisible();
    await expect(page.locator('.ess-number')).toHaveText('Sin datos');
    await expect(page.getByText('No hay elecciones en curso')).toBeVisible();
    await expect(page.getByText('Sin actividad registrada')).toBeVisible();
    await expect(page.locator('.ess-alert')).toHaveCount(0);
  });

  test('exporta el resumen del alcance filtrado y neutraliza fórmulas', async ({ page }) => {
    await mockApi(page, {
      // Un titulo que Excel interpretaria como formula si saliera tal cual.
      elections: [{ ...ELECTIONS[0], title: '=HYPERLINK("http://x")' }, ELECTIONS[1]],
    });
    await page.goto('/dashboard');

    await page.getByLabel('Filtrar participación por elección').selectOption('open');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar resumen' }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf8');

    expect(download.suggestedFilename()).toMatch(/^participacion-tee-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('Elección,Estado,Inicio,Cierre,Habilitaciones,Votos,Participación (%)');
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).not.toMatch(/(^|,|")=HYPERLINK/m);
    expect(csv).toContain('500,150,30.0');
    // El filtro manda: la eleccion cerrada no viaja en el archivo.
    expect(csv).not.toContain('Representación Estudiantil');
  });

  test('en móvil no hay desborde horizontal y el menú original sigue ahí', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await page.goto('/dashboard');

    await expect(page.locator('.ess-number')).toHaveText('38,9%');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: /menú|menu/i }).first().click();
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
  });
});
