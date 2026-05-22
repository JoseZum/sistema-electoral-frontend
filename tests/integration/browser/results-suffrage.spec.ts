import { expect, test } from '@playwright/test';

import { expectNoCriticalA11yViolations } from './support/accessibility';

const adminUser = {
  studentId: 'admin-results-e2e',
  carnet: '2023000005',
  role: 'admin',
  fullName: 'Admin Resultados',
  sede: 'Cartago',
  career: 'Ingenieria en Computacion',
};

test.describe('results and suffrage flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('tee_token', 'playwright-admin-results-token');
      localStorage.setItem('tee_user', JSON.stringify(user));
    }, adminUser);

    await page.route('**/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('@smoke renders public results with the selected option column and abstentions', async ({ page }) => {
    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'public-election',
            title: 'Asamblea General',
            status: 'CLOSED',
            requires_keys: false,
            is_anonymous: false,
            tag_id: null,
            tag_name: null,
            tag_color: null,
          },
        ]),
      });
    });

    await page.route('**/api/elections/public-election/results', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          election: {
            id: 'public-election',
            title: 'Asamblea General',
            description: 'Eleccion nominal de prueba',
            status: 'CLOSED',
            is_anonymous: false,
            start_time: '2026-05-10T14:00:00.000Z',
            end_time: '2026-05-10T18:00:00.000Z',
          },
          options: [
            { id: 'opt-1', label: 'Plan A', option_type: 'CANDIDATE', vote_count: 1, percentage: 100 },
            { id: 'opt-2', label: 'Plan B', option_type: 'CANDIDATE', vote_count: 0, percentage: 0 },
          ],
          total_votes: 1,
          total_eligible: 2,
          participation_rate: 50,
          voters: [
            {
              full_name: 'Ana Garcia',
              carnet: '2021001234',
              has_voted: true,
              selected_option_label: 'Plan A',
            },
            {
              full_name: 'Bruno Mora',
              carnet: '2021005678',
              has_voted: false,
              selected_option_label: null,
            },
          ],
        }),
      });
    });

    await page.goto('/resultados');
    await expect(page.getByRole('heading', { name: 'Resultados', exact: true })).toBeVisible({ timeout: 20000 });
    await expectNoCriticalA11yViolations(page);

    await expect(page.getByText('Sufragio público')).toBeVisible();
    await expect(page.getByText('Participacion por persona (2)')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Opcion elegida' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Plan A' })).toBeVisible();
    await expect(page.getByText('No votó')).toBeVisible();
    await expect(page.getByText('Abstencionismo detectado: 1')).toBeVisible();
  });

  test('shows ballot participation without revealing the selected option and separates the suffrage section in creation', async ({ page }) => {
    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ballot-election',
            title: 'Consejo de Escuela',
            status: 'SCRUTINIZED',
            requires_keys: true,
            is_anonymous: true,
            tag_id: null,
            tag_name: null,
            tag_color: null,
          },
        ]),
      });
    });

    await page.route('**/api/elections/ballot-election/results', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          election: {
            id: 'ballot-election',
            title: 'Consejo de Escuela',
            description: 'Eleccion por papeleta',
            status: 'SCRUTINIZED',
            is_anonymous: true,
            start_time: '2026-05-11T14:00:00.000Z',
            end_time: '2026-05-11T18:00:00.000Z',
          },
          options: [
            { id: 'opt-1', label: 'Lista Norte', option_type: 'CANDIDATE', vote_count: 1, percentage: 100 },
            { id: 'opt-2', label: 'Lista Sur', option_type: 'CANDIDATE', vote_count: 0, percentage: 0 },
          ],
          total_votes: 1,
          total_eligible: 2,
          participation_rate: 50,
          voters: [
            {
              full_name: 'Ana Garcia',
              carnet: '2021001234',
              has_voted: true,
              selected_option_label: null,
            },
            {
              full_name: 'Bruno Mora',
              carnet: '2021005678',
              has_voted: false,
              selected_option_label: null,
            },
          ],
        }),
      });
    });

    await page.goto('/resultados');
    await expect(page.getByRole('heading', { name: 'Resultados', exact: true })).toBeVisible({ timeout: 20000 });

    await expect(page.getByText('Sufragio por papeleta')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Voto emitido' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ana Garcia 2021001234 Sí/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Bruno Mora 2021005678 No/ })).toBeVisible();

    await page.route('**/api/users/admins', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'admin-1' }, { id: 'admin-2' }]),
      });
    });

    await page.goto('/elecciones/crear');
    await expect(page.getByRole('heading', { name: 'Crear proceso electoral' })).toBeVisible({ timeout: 20000 });

    await expect(page.getByText('4. Sufragio')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Define la modalidad del sufragio' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nominal[\s\S]*Sufragio p[uú]blico/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reservado[\s\S]*Sufragio por papeleta/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Configura el escrutinio' })).toBeVisible();
  });
});
