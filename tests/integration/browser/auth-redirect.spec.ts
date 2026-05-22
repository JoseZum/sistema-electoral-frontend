import { expect, test } from '@playwright/test';

import { expectNoCriticalA11yViolations } from './support/accessibility';

test.describe('auth redirect flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tee_token', 'playwright-token');
      localStorage.setItem(
        'tee_user',
        JSON.stringify({
          studentId: 'user-e2e',
          carnet: '2023000001',
          role: 'voter',
          fullName: 'Votante E2E',
          sede: 'Cartago',
          career: 'Ingenieria en Computacion',
        })
      );
    });

    await page.route('**/api/voting/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('@smoke redirects a sessioned user to the voting area', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/votaciones$/);
    await expect(page.getByRole('heading', { name: 'Tus votaciones' })).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });
});
