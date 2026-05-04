import { expect, test } from '@playwright/test';

const voterToken = 'playwright-voter-token';
const voterUser = {
  id: 'voter-e2e',
  role: 'voter',
  full_name: 'Votante E2E',
  email: 'votante.e2e@tec.ac.cr',
};

const electionId = 'election-vote-1';

test.describe('voting redirect flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: voterToken, user: voterUser }
    );

    await page.route('**/api/voting/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: electionId,
            title: 'Elección FEITEC',
            description: 'Elección abierta para ejemplo de Playwright',
            status: 'OPEN',
            has_voted: false,
            is_anonymous: false,
            tag_name: 'General',
            tag_color: '#1f2937',
            start_time: '2026-05-01T08:00:00.000Z',
            end_time: '2026-05-02T18:00:00.000Z',
          },
        ]),
      });
    });

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
          ],
        }),
      });
    });
  });

  test('redirects to the voting booth after selecting an election', async ({ page }) => {
    await page.goto('/votaciones');

    await expect(page.getByRole('heading', { name: 'Tus votaciones' })).toBeVisible();

    await page.getByRole('button', { name: /Votar en: Elección FEITEC/ }).click();

    await expect(page).toHaveURL(new RegExp(`/votaciones/${electionId}$`));
    await expect(page.getByRole('heading', { name: 'Elección FEITEC' })).toBeVisible();
    await expect(page.getByText('Selecciona una opcion para emitir tu voto')).toBeVisible();
    
    await expect(page.getByRole('heading', { name: 'Elección FEITEC' })).toBeVisible();
    await expect(page.getByText('Selecciona una opcion para emitir tu voto')).toBeVisible();

    await page.getByText('Plan A').click();
    await expect(page.getByText('Plan A').locator('..')).toBeVisible();
    
    await page.getByRole('button', { name: 'Emitir voto' }).click();
    await expect(page.getByRole('heading', { name: 'Confirmar voto' })).toBeVisible();
    await expect(page.locator('.modal').getByText('Plan A')).toBeVisible();
  });
});