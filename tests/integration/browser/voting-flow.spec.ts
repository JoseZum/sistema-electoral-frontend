import { expect, test } from '@playwright/test';

import { expectNoCriticalA11yViolations } from './support/accessibility';

const voterToken = 'playwright-voter-token';
const voterUser = {
  studentId: 'voter-e2e',
  carnet: '2023000003',
  role: 'voter',
  fullName: 'Votante E2E',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

const electionId = 'election-vote-1';

test.describe('voting flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: voterToken, user: voterUser }
    );

    await page.route(`**/api/voting/elections/${electionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: electionId,
          title: 'Elección FEITEC',
          is_anonymous: false,
          has_voted: false,
          options: [
            { id: 'opt-1', label: 'Plan A', option_type: 'REGULAR' },
            { id: 'opt-2', label: 'Plan B', option_type: 'REGULAR' },
            { id: 'opt-3', label: 'Voto en blanco', option_type: 'BLANK' },
          ],
        }),
      });
    });

    await page.route('**/api/voting/cast', async (route) => {
      const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
        electionId?: string;
        optionId?: string;
      };

      expect(requestBody.electionId).toBe(electionId);
      expect(requestBody.optionId).toBe('opt-1');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Voto registrado correctamente' }),
      });
    });
  });

  test('@smoke lets the voter pick an option, confirm and finish the vote', async ({ page }) => {
    await page.goto(`/votaciones/${electionId}`);

    await expect(page.getByRole('heading', { name: 'Elección FEITEC' })).toBeVisible();
    await expect(page.getByText(/Selecciona una opci[oó]n para emitir tu voto/i)).toBeVisible();
    await expectNoCriticalA11yViolations(page);

    await page.getByText('Plan A').click();
    await expect(page.getByText('Plan A').locator('..')).toBeVisible();

    await page.getByRole('button', { name: 'Emitir voto' }).click();
    await expect(page.getByRole('heading', { name: 'Confirmar voto' })).toBeVisible();
    await expect(page.locator('.modal').getByText('Plan A')).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar voto' }).click();

    await expect(page.getByText('Voto registrado')).toBeVisible();
    await expect(page.getByText('Elección FEITEC')).toBeVisible();
    await expect(page.getByText('Plan A')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Volver a mis votaciones' })).toBeVisible();
  });
});
