import { expect, test } from '@playwright/test';

const adminToken = 'playwright-create-election-token';
const adminUser = {
  studentId: 'admin-create-election-e2e',
  carnet: '2023000099',
  role: 'admin',
  fullName: 'Admin Create Election',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

type ObservedRequest = {
  endpoint: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
};

test.describe('create election suboptions flow', () => {
  test('activates suboptions without console errors and loads presets through the real api client', async ({ page }) => {
    const frontendErrors: string[] = [];
    const observedRequests: ObservedRequest[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        frontendErrors.push(`console.error: ${message.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      frontendErrors.push(`pageerror: ${error.message}`);
    });

    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: adminToken, user: adminUser }
    );

    await page.route('**/api/users/admins', async (route) => {
      const request = route.request();
      observedRequests.push({
        endpoint: '/api/users/admins',
        method: request.method(),
        authorization: await request.headerValue('authorization'),
        contentType: await request.headerValue('content-type'),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'admin-1' }, { id: 'admin-2' }, { id: 'admin-3' }]),
      });
    });

    await page.route('**/api/elections/suboption-presets', async (route) => {
      const request = route.request();
      observedRequests.push({
        endpoint: '/api/elections/suboption-presets',
        method: request.method(),
        authorization: await request.headerValue('authorization'),
        contentType: await request.headerValue('content-type'),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'preset-binary',
            name: 'Preguntas binarias',
            items: ['Si', 'No'],
          },
        ]),
      });
    });

    await page.goto('/elecciones/crear');
    await expect(page.getByRole('heading', { name: 'Crear proceso electoral' })).toBeVisible({ timeout: 20000 });

    expect(frontendErrors, frontendErrors.join('\n')).toEqual([]);

    const adminRequest = observedRequests.find((request) => request.endpoint === '/api/users/admins');
    expect(adminRequest?.method).toBe('GET');
    expect(adminRequest?.authorization).toBe(`Bearer ${adminToken}`);
    expect(adminRequest?.contentType ?? '').toContain('application/json');

    const useSuboptions = page.getByRole('checkbox', { name: 'Usar subopciones' });
    await expect(useSuboptions).not.toBeChecked();

    const presetsResponse = page.waitForResponse((response) => (
      response.url().includes('/api/elections/suboption-presets')
      && response.request().method() === 'GET'
      && response.status() === 200
    ));

    await useSuboptions.check();
    await presetsResponse;

    await expect(page.getByRole('combobox', { name: 'Preset de subopciones del grupo 1' })).toBeVisible();

    const presetRequest = observedRequests.find((request) => request.endpoint === '/api/elections/suboption-presets');
    expect(presetRequest?.method).toBe('GET');
    expect(presetRequest?.authorization).toBe(`Bearer ${adminToken}`);
    expect(presetRequest?.contentType ?? '').toContain('application/json');
    expect(frontendErrors, frontendErrors.join('\n')).toEqual([]);

    const presetSelect = page.getByRole('combobox', { name: 'Preset de subopciones del grupo 1' });
    await presetSelect.selectOption('preset-binary');
    await page.getByRole('button', { name: 'Usar preset en el grupo 1' }).click();

    await expect(page.getByLabel('Nombre de la subopcion 1 del grupo 1')).toHaveValue('Si');
    await expect(page.getByLabel('Nombre de la subopcion 2 del grupo 1')).toHaveValue('No');
    expect(frontendErrors, frontendErrors.join('\n')).toEqual([]);
  });
});
