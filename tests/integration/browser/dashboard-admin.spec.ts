import { expect, test } from '@playwright/test';

import { expectNoCriticalA11yViolations } from './support/accessibility';

test.describe('dashboard admin page', () => {
  test.beforeEach(async ({ page }) => {
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
        })
      );
    });

    await page.route('**/api/dashboard/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalStudents: 1200,
          activeStudents: 1180,
          totalElections: 6,
          openElections: 2,
          totalVotes: 420,
          participation: 35,
          ongoingElections: [
            {
              id: 'election-1',
              title: 'Elección FEITEC',
              startTime: '2026-05-01T08:00:00.000Z',
              endTime: '2026-05-01T18:00:00.000Z',
              votesCount: 150,
              totalVoters: 500,
              progressPercentage: 45,
            },
          ],
        }),
      });
    });

    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'election-1', title: 'Elección FEITEC', status: 'OPEN' },
          { id: 'election-2', title: 'Representación Estudiantil', status: 'CLOSED' },
        ]),
      });
    });

    await page.route('**/api/audit?limit=3', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [],
          total: 0,
        }),
      });
    });
  });

  test('@smoke renders dashboard metrics and cards for an admin user', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Panel de control · TEE Sistema Electoral')).toBeVisible();
    //await expect(page.getByRole('heading', { name: /Administrador E2E|Buenos d/i })).toBeVisible();
    await expect(page.getByText('Hay 2 votaciones abiertas ahora mismo')).toBeVisible();
    await expect(page.getByText('Elecciones activas')).toBeVisible();
    await expect(page.getByText('Total de elecciones')).toBeVisible();
    await expect(page.getByText('Votos emitidos')).toBeVisible();
    await expect(page.getByText('Estudiantes activos')).toBeVisible();
    await expect(page.getByText('Elecciones en curso')).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });
});
