import { expect, test } from '@playwright/test';

test.describe('auth redirect flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tee_token', 'playwright-token');
      localStorage.setItem(
        'tee_user',
        JSON.stringify({
          id: 'user-e2e',
          role: 'voter',
          full_name: 'Votante E2E',
          email: 'votante.e2e@tec.ac.cr',
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

  test('redirects a sessioned user to the voting area', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/votaciones$/);
    await expect(page.getByRole('heading', { name: 'Tus votaciones' })).toBeVisible();
  });
});