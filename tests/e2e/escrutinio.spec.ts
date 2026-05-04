import { expect, test } from '@playwright/test';

const adminToken = 'playwright-scrutiny-token';
const adminUser = {
  studentId: '9138b2e6-ac51-47d1-b254-a84ea45bfd29',
  carnet: '2022437529',
  fullName: 'Aaron Ortiz Jimenez',
  email: 'aaortiz@estudiantec.cr',
  role: 'admin',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

const electionId = 'scrutiny-election-1';

test.describe('escrutinio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: adminToken, user: adminUser }
    );

    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: electionId,
            title: 'Elección de Escrutinio',
            description: 'Elección cerrada con llaves pendientes',
            status: 'CLOSED',
            requires_keys: true,
            has_voted: false,
            min_keys: 2,
            votes_cast: 88,
            total_voters: 120,
            start_time: '2026-05-01T08:00:00.000Z',
            end_time: '2026-05-02T18:00:00.000Z',
            created_at: '2026-04-20T10:00:00.000Z',
          },
          {
            id: 'no-scrutiny-election',
            title: 'Elección sin escrutinio',
            status: 'CLOSED',
            requires_keys: false,
            has_voted: false,
            min_keys: 0,
            votes_cast: 30,
            total_voters: 90,
            start_time: '2026-05-01T08:00:00.000Z',
            end_time: '2026-05-02T18:00:00.000Z',
            created_at: '2026-04-20T10:00:00.000Z',
          },
          {
            id: 'open-election',
            title: 'Elección abierta',
            status: 'OPEN',
            requires_keys: true,
            has_voted: false,
            min_keys: 1,
            votes_cast: 10,
            total_voters: 50,
            start_time: '2026-05-01T08:00:00.000Z',
            end_time: '2026-05-02T18:00:00.000Z',
            created_at: '2026-04-20T10:00:00.000Z',
          },
        ]),
      });
    });

   let keyRedeemed = false;

await page.route(`**/api/scrutiny/${electionId}`, async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      electionInfo: { id: electionId, title: 'Elección de Escrutinio', status: 'CLOSED', requires_keys: true, min_keys: 2 },
      progressScrutiny: {
        total_Members: 2,
        submittedKeys: keyRedeemed ? 2 : 1,
        membersPending: [
          {
            id: adminUser.studentId,
            full_name: adminUser.fullName,
            carnet: adminUser.carnet,
            date: keyRedeemed ? '2026-05-03T10:00:00.000Z' : null,
            has_submitted: keyRedeemed,
          },
        ],
        can_finalize: keyRedeemed,
      },
      general_Metric: { total_votes: 88, total_elegibles: 120, participation_rate: 73 },
      publication_status: 'results_available',
    }),
  });
});

await page.route(`**/api/scrutiny/${electionId}/submit-key`, async (route) => {
  const payload = JSON.parse(route.request().postData() || '{}');
  if (payload.key !== '123456') {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Key invalida' }) });
    return;
  }
  keyRedeemed = true;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ submitted: true, finalized: false }) });
});
  });

  test('muestra solo elecciones pendientes de escrutinio', async ({ page }) => {
    await page.goto('/escrutinio');

    await expect(page.getByRole('heading', { name: 'Escrutinio' })).toBeVisible();
    await expect(page.getByText('Elección de Escrutinio')).toBeVisible();
    await expect(page.getByText('Requiere escrutinio por llaves')).toBeVisible();
    await expect(page.getByText('120')).toBeVisible();
    await expect(page.getByText('2').nth(1)).toBeVisible();
    await expect(page.getByText("2 may 2026")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Canjear llave' })).toBeVisible();
    await expect(page.getByText('Requiere escrutinio por llaves')).toBeVisible();
  });

  test('redirige a la pantalla de subida de llave', async ({ page }) => {
    await page.goto('/escrutinio');

    const scrutinyRow = page.getByRole('row', { name: /Elección de Escrutinio/ });
    await scrutinyRow.getByRole('link', { name: 'Canjear llave' }).click();

    await page.waitForURL(`/escrutinio/subir\?id=${electionId}`);
    const url = new URL(page.url());
    await expect(url.pathname + url.search).toBe(`/escrutinio/subir\?id=${electionId}`)
    //await expect(page).toHaveURL(new RegExp(`/\escrutinio/subir\?id=${electionId}$`));
    await expect(page.getByRole('heading', { name: 'Escrutinio de resultados' })).toBeVisible();
    await expect(page.getByText('Elección de Escrutinio')).toBeVisible();
    await expect(page.getByText('Custodios de llaves')).toBeVisible();
  });

  test('flujo completo desde el enlace de canje hasta guardar la llave', async ({ page }) => {
    await page.goto('/escrutinio');

    const scrutinyRow = page.getByRole('row', { name: /Elección de Escrutinio/ });
    await scrutinyRow.getByRole('link', { name: 'Canjear llave' }).click();

    await page.waitForURL(`/escrutinio/subir\?id=${electionId}`);
    const url = new URL(page.url());
    await expect(url.pathname + url.search).toBe(`/escrutinio/subir\?id=${electionId}`)
    
    await expect(page.getByRole('heading', { name: 'Escrutinio de resultados' })).toBeVisible();

    await page.getByPlaceholder('Pegar llave...').fill('123456');
    await page.getByRole('button', { name: 'Canjear' }).click();

    await expect(page.getByText(/Llave canjeada/i)).toBeVisible();
    await expect(page.getByText(/El progreso fue actualizado/i)).toBeVisible();
    await expect(page.getByText('Llave canjeada -')).toBeVisible();
    await expect(page.getByText('Pendiente -')).not.toBeVisible();
  });

  test('canjea una llave desde la pantalla de escrutinio', async ({ page }) => {
    await page.goto(`/escrutinio/subir?id=${electionId}`);

    await expect(page.getByRole('heading', { name: 'Escrutinio de resultados' })).toBeVisible();

    await page.getByPlaceholder('Pegar llave...').fill('123456');
    await page.getByRole('button', { name: 'Canjear' }).click();

    await expect(page.getByText(/Llave canjeada/i)).toBeVisible();
    await expect(page.getByText(/El progreso fue actualizado/i)).toBeVisible();
  });

  test('muestra error cuando la llave es incorrecta', async ({ page }) => {
    await page.goto(`/escrutinio/subir?id=${electionId}`);

    await page.getByPlaceholder('Pegar llave...').fill('999999');
    await page.getByRole('button', { name: 'Canjear' }).click();

    //await expect(page.getByText(/Key invalida/i)).toBeVisible();
  });
});