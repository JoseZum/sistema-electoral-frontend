# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser\auth-redirect.spec.ts >> auth redirect flow >> @smoke redirects a sessioned user to the voting area
- Location: tests\integration\browser\auth-redirect.spec.ts:31:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/votaciones$/
Received string:  "http://127.0.0.1:3000/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × unexpected value "http://127.0.0.1:3000/"

```

```yaml
- alert
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | import { expectNoCriticalA11yViolations } from './support/accessibility';
  4  | 
  5  | test.describe('auth redirect flow', () => {
  6  |   test.beforeEach(async ({ page }) => {
  7  |     await page.addInitScript(() => {
  8  |       localStorage.setItem('tee_token', 'playwright-token');
  9  |       localStorage.setItem(
  10 |         'tee_user',
  11 |         JSON.stringify({
  12 |           studentId: 'user-e2e',
  13 |           carnet: '2023000001',
  14 |           role: 'voter',
  15 |           fullName: 'Votante E2E',
  16 |           sede: 'Cartago',
  17 |           career: 'Ingenieria en Computacion',
  18 |         })
  19 |       );
  20 |     });
  21 | 
  22 |     await page.route('**/api/voting/elections', async (route) => {
  23 |       await route.fulfill({
  24 |         status: 200,
  25 |         contentType: 'application/json',
  26 |         body: JSON.stringify([]),
  27 |       });
  28 |     });
  29 |   });
  30 | 
  31 |   test('@smoke redirects a sessioned user to the voting area', async ({ page }) => {
  32 |     await page.goto('/');
  33 | 
> 34 |     await expect(page).toHaveURL(/\/votaciones$/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  35 |     await expect(page.getByRole('heading', { name: 'Tus votaciones' })).toBeVisible();
  36 |     await expectNoCriticalA11yViolations(page);
  37 |   });
  38 | });
  39 | 
```