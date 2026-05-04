import { expect, test } from '@playwright/test';

const adminToken = process.env.E2E_ADMIN_TOKEN;
const adminUserJson = process.env.E2E_ADMIN_USER_JSON;

test.describe('dashboard admin page (real backend)', () => {
  test('renders dashboard using real API data', async ({ page }) => {
    console.log('E2E_ADMIN_TOKEN:', adminToken ? 'definido' : 'NO DEFINIDO');
    console.log('E2E_ADMIN_USER_JSON:', adminUserJson ? 'definido' : 'NO DEFINIDO');
    
    test.skip(
      !adminToken || !adminUserJson,
      'Define E2E_ADMIN_TOKEN y E2E_ADMIN_USER_JSON para ejecutar con datos reales.'
    );

    const adminUser = JSON.parse(adminUserJson as string);
    console.log('Usuario inyectado:', adminUser);

    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: adminToken as string, user: adminUser }
    );

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Panel de control · TEE Sistema Electoral')).toBeVisible();

    // Estas etiquetas son estables aunque cambien los valores reales del backend.
    await expect(page.getByText('Elecciones activas')).toBeVisible();
    await expect(page.getByText('Total de elecciones')).toBeVisible();
    await expect(page.getByText('Votos emitidos')).toBeVisible();
    await expect(page.getByText('Estudiantes activos')).toBeVisible();
    await expect(page.getByText('Hay 2 votaciones abiertas ahora mismo')).toBeVisible();
    await expect(page.getByText('Modificado')).toBeVisible();
  });
});