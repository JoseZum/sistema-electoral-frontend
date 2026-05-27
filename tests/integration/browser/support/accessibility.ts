import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

function formatViolations(violations: { id: string; impact?: string | null; help: string }[]) {
  return violations
    .map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.help}`)
    .join('\n');
}

export async function expectNoCriticalA11yViolations(page: Page) {
  // axe.analyze() puede correr mientras la página aún está navegando (p. ej. tras un redirect)
  // y entonces falla con "Execution context was destroyed". Esperamos a que el documento
  // termine de cargar antes de evaluar.
  await page.waitForLoadState('load');

  let results;
  try {
    results = await new AxeBuilder({ page }).analyze();
  } catch (err) {
    // Si justo durante el análisis se dispara una nueva navegación, reintentamos una vez
    // tras esperar al nuevo load.
    if (err instanceof Error && /Execution context was destroyed/.test(err.message)) {
      await page.waitForLoadState('load');
      results = await new AxeBuilder({ page }).analyze();
    } else {
      throw err;
    }
  }

  const blockingViolations = results.violations.filter((violation) => violation.impact === 'critical');

  expect(blockingViolations, formatViolations(blockingViolations)).toEqual([]);
}
