import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';

const DEFAULT_CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-sandbox',
];

export async function launchChrome() {
  const chromePath = await resolveChromePath();

  return launch({
    ...(chromePath ? { chromePath } : {}),
    chromeFlags: DEFAULT_CHROME_FLAGS,
  });
}

async function resolveChromePath() {
  const configuredChromePath =
    process.env.LIGHTHOUSE_CHROME_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROME_BIN ||
    process.env.GOOGLE_CHROME_BIN;

  if (configuredChromePath) {
    return configuredChromePath.trim();
  }

  try {
    const playwrightChromePath = chromium.executablePath();
    return playwrightChromePath || undefined;
  } catch {
    return undefined;
  }
}
