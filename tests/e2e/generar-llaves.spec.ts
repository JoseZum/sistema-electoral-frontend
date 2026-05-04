import { expect, test } from '@playwright/test';

const adminToken = 'playwright-admin-token';
const adminUser = {
          studentId:"9138b2e6-ac51-47d1-b254-a84ea45bfd29",
          carnet:"2022437529",
          fullName:"Aaron Ortiz Jimenez",
          email:"aaortiz@estudiantec.cr",
          role:"admin",
          sede:"Cartago",
          career:"Ingenieria en Computacion"
};

const electionId = 'election-keys-1';
const electionTitle = 'Elección con Escrutinio';

test.describe('generación de llaves', () => {
  test.beforeEach(async ({ page }) => {
    // Inyectar token y usuario admin en localStorage
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem('tee_token', token);
        localStorage.setItem('tee_user', JSON.stringify(user));
      },
      { token: adminToken, user: adminUser }
    );

    // Mock: GET /api/elections - retorna elecciones incluida una cerrada con escrutinio
    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: electionId,
            title: electionTitle,
            status: 'CLOSED',
            requires_keys: true,
            min_keys: 3,
            total_voters: 150,
            voter_source: 'FULL_PADRON',
            tag_name: null,
          },
          {
            id: 'election-open-1',
            title: 'Elección Abierta',
            status: 'OPEN',
            requires_keys: false,
            min_keys: 0,
            total_voters: 100,
            voter_source: 'TAG',
            tag_name: 'General',
          },
          {
            id: 'election-no-keys-1',
            title: 'Elección sin Escrutinio',
            status: 'CLOSED',
            requires_keys: false,
            min_keys: 0,
            total_voters: 200,
            voter_source: 'FILTERED',
            tag_name: null,
          },
        ]),
      });
    });

    // Mock: POST /api/scrutiny/{electionId}/assign-members - genera una llave
    await page.route(`**/api/scrutiny/${electionId}/assign-members`, async (route) => {
      const body = await route.request().postData();
      const data = JSON.parse(body || '{}');

      if (data.option === undefined || !Array.isArray(data.students_id)) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid request format' }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          result: { success: true },
          keys: data.option === '0' ? '123456' : 'aB9xKm2p',
        }),
      });
    });
  });

  test('muestra solo elecciones cerradas que requieren escrutinio', async ({ page }) => {
    await page.goto('/generar-llaves');

    // Verificar que la página se cargó
    await expect(page.getByRole('heading', { name: 'Generar llave de escrutinio' })).toBeVisible();

    // Abrir el selector de elecciones
    const select = page.locator('select');
    await select.click();

    // Verificar que solo aparecen elecciones cerradas con escrutinio
    const options = await select.locator('option').all();
    const optionTexts = await Promise.all(options.map((opt) => opt.textContent()));

    expect(optionTexts).toContain(electionTitle);
    expect(optionTexts).not.toContain('Elección Abierta');
    expect(optionTexts).not.toContain('Elección sin Escrutinio');
  });

  test('muestra información de la elección seleccionada', async ({ page }) => {
    await page.goto('/generar-llaves');

    // Seleccionar una elección
    const select = page.locator('select');
    await select.selectOption(electionId);

    // Verificar que se muestra la información
    await expect(page.getByText('Electoral masiva')).toBeVisible();
    await expect(page.getByText('Padron completo')).toBeVisible();
    await expect(page.getByText('3').first()).toBeVisible();
    await expect(page.getByText('150')).toBeVisible();
  });

  test('genera una llave exitosamente con opción numérica', async ({ page }) => {
    await page.goto('/generar-llaves');

    // Seleccionar la elección
    const select = page.locator('select');
    await select.selectOption(electionId);

    // Verificar que el admin es mostrado
    await expect(page.getByText('Aaron Ortiz Jimenez').nth(1)).toBeVisible();
    await expect(page.getByText('2022437529')).toBeVisible();

    // Hacer clic en generar llave
    const generateBtn = page.getByRole('button', { name: 'Generar mi llave' });
    await generateBtn.click();

    // Esperar a que se muestre la llave generada
    await expect(page.locator('code')).toBeVisible();

    // Verificar el contenido de la llave
    const keyCode = page.locator('code');
    const keyValue = await keyCode.textContent();
    expect(keyValue).toBe('123456');

    // Verificar mensaje de éxito
    await expect(page.getByText(/copiar/i)).toBeVisible();
  });

  test('permite copiar la llave al portapapeles', async ({ page }) => {
    // Permitir acceso al clipboard en el test
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/generar-llaves');

    // Seleccionar y generar llave
    const select = page.locator('select');
    await select.selectOption(electionId);

    const generateBtn = page.getByRole('button', { name: 'Generar mi llave' });
    await generateBtn.click();

    // Esperar a que aparezca el botón de copiar
    await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible();

    // Hacer clic en copiar
    const copyBtn = page.getByRole('button', { name: 'Copiar' });
    await copyBtn.click();

    // Verificar que aparezca mensaje de éxito
    await expect(page.getByText(/copiada al portapapeles/i)).toBeVisible();
  });

  test('muestra mensaje de error cuando no hay elecciones disponibles', async ({ page }) => {
    // Mockar para devolver lista vacía
    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'election-1',
            title: 'Elección Abierta',
            status: 'OPEN',
            requires_keys: false,
            min_keys: 0,
            total_voters: 100,
            voter_source: 'TAG',
            tag_name: 'General',
          },
        ]),
      });
    });

    await page.goto('/generar-llaves');

    // Verificar mensaje de no disponibles
    await expect(
      page.getByText(/No hay elecciones cerradas que requieran llaves/)
    ).toBeVisible();
  });

  test('muestra error cuando la generación de llave falla', async ({ page }) => {
    // Mockar error en la API
    await page.route(`**/api/scrutiny/${electionId}/assign-members`, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Ya existe una llave asignada para este usuario en esta eleccion',
        }),
      });
    });

    await page.goto('/generar-llaves');

    // Seleccionar y intentar generar llave
    const select = page.locator('select');
    await select.selectOption(electionId);

    const generateBtn = page.getByRole('button', { name: 'Generar mi llave' });
    await generateBtn.click();

    // Verificar mensaje de error
    await expect(
      page.getByText(/Ya existe una llave asignada para este usuario/)
    ).toBeVisible();
  });

  test('muestra información de la elección con diferentes fuentes de votantes', async ({ page }) => {
    // Mockar elecciones con diferentes sources
    await page.route('**/api/elections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'election-tag-1',
            title: 'Elección por Tag',
            status: 'CLOSED',
            requires_keys: true,
            min_keys: 2,
            total_voters: 50,
            voter_source: 'TAG',
            tag_name: 'Directiva',
          },
          {
            id: 'election-filtered-1',
            title: 'Elección Filtrada',
            status: 'CLOSED',
            requires_keys: true,
            min_keys: 1,
            total_voters: 75,
            voter_source: 'FILTERED',
            tag_name: null,
          },
        ]),
      });
    });

    await page.goto('/generar-llaves');

    // Seleccionar elección por tag
    const select = page.locator('select');
    await select.selectOption('election-tag-1');

    await expect(page.getByText('Tag: Directiva')).toBeVisible();
    await expect(page.getByText('50')).toBeVisible();

    // Seleccionar elección filtrada
    await select.selectOption('election-filtered-1');

    await expect(page.getByText('Filtro personalizado')).toBeVisible();
    await expect(page.getByText('75').first()).toBeVisible();
  });

  /* 
  test('flujo completo: seleccionar, generar y copiar llave', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/generar-llaves');

    // Paso 1: Verificar página cargada
    await expect(page.getByRole('heading', { name: 'Generar llave de escrutinio' })).toBeVisible();

    // Paso 2: Seleccionar elección
    const select = page.locator('select');
    await select.selectOption(electionId);
    await expect(page.getByText(electionTitle)).toBeVisible();

    // Paso 3: Generar llave
    const generateBtn = page.getByRole('button', { name: 'Generar mi llave' });
    await generateBtn.click();

    // Paso 4: Verificar que la llave aparece
    await expect(page.getByText(/Llave generada/i)).toBeVisible();
    const keyCode = page.locator('code');
    await expect(keyCode).toBeVisible();
    const keyValue = await keyCode.textContent();
    expect(keyValue).toBeTruthy();

    // Paso 5: Copiar llave
    const copyBtn = page.getByRole('button', { name: 'Copiar' });
    await copyBtn.click();
    await expect(page.getByText(/copiada al portapapeles/i)).toBeVisible();

    // Paso 6: Verificar que la llave se puede canjear
    await expect(
      page.getByText(/Esta llave se canjea en el flujo de escrutinio/)
    ).toBeVisible();
  });
*/
});
