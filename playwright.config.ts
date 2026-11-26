import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E y de accesibilidad (§14). Corren contra el build de producción servido con
 * `astro preview`. En local usan el Chrome instalado (sin descargar navegadores); en CI,
 * el Chromium de Playwright.
 */
// Astro 7 admite un solo `astro preview` a la vez; si ya hay uno en este puerto, se reutiliza.
const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...(process.env['CI'] ? {} : { channel: 'chrome' }),
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec astro preview --port ${PORT} --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env['CI'],
  },
});
