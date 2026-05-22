import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

function formatViolations(violations: { id: string; impact?: string | null; help: string }[]) {
  return violations
    .map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.help}`)
    .join('\n');
}

export async function expectNoCriticalA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter((violation) => violation.impact === 'critical');

  expect(blockingViolations, formatViolations(blockingViolations)).toEqual([]);
}
