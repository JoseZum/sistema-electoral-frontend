import { expect, test } from '@playwright/test';

const adminUser = {
  studentId: 'audit-admin-e2e',
  carnet: '2023000009',
  role: 'admin',
  fullName: 'Auditoria E2E',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

function isoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

test.describe('auditoria', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ user }) => {
      localStorage.setItem('tee_token', 'playwright-audit-token');
      localStorage.setItem('tee_user', JSON.stringify(user));
    }, { user: adminUser });

    await page.route('**/api/audit/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            resource_type: 'election',
            count: 12,
            last_activity: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/api/audit/active-days', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { date: isoDaysAgo(0), count: 4 },
          { date: isoDaysAgo(1), count: 3 },
          { date: isoDaysAgo(6), count: 2 },
          { date: isoDaysAgo(14), count: 1 },
          { date: isoDaysAgo(32), count: 1 },
        ]),
      });
    });

    await page.route('**/api/audit**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname !== '/api/audit') {
        await route.fallback();
        return;
      }

      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ deleted: 3 }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            {
              id: 'audit-log-1',
              actor_id: adminUser.studentId,
              actor_carnet: adminUser.carnet,
              actor_name: adminUser.fullName,
              action: 'election.update',
              resource_type: 'election',
              resource_id: 'election-1',
              details: { title: 'Eleccion FEITEC' },
              ip_address: '127.0.0.1',
              created_at: new Date().toISOString(),
              actionLabel: 'Actualizacion',
              resourceLabel: 'Eleccion',
              activityMessage: 'Actualizo una eleccion.',
            },
          ],
          total: 3,
          page: 1,
          limit: 20,
        }),
      });
    });
  });

  test('resalta en rojo el rango seleccionado al vaciar registros', async ({ page }) => {
    await page.goto('/auditoria');

    await expect(page.getByRole('heading', { name: 'Registro de actividad' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const purgeTrigger = page.getByRole('button', { name: 'Vaciar registros' });

    await expect(purgeTrigger).toBeVisible();
    await purgeTrigger.click({ force: true });

    await expect(page.getByRole('heading', { name: 'Vaciar registros de auditoría' })).toBeVisible();

    const allHistoryButton = page.getByRole('button', { name: 'Todo el historial' });
    const sevenDaysButton = page.getByRole('button', { name: 'Últimos 7 días' });

    await expect(allHistoryButton).toHaveClass(/active/);
    await expect(allHistoryButton).toHaveCSS('background-color', 'rgb(185, 28, 28)');

    await sevenDaysButton.click();

    await expect(sevenDaysButton).toHaveClass(/active/);
    await expect(sevenDaysButton).toHaveCSS('background-color', 'rgb(185, 28, 28)');
    await expect(allHistoryButton).not.toHaveClass(/active/);
  });
});
