import { expect, test } from '@playwright/test';

/**
 * Modo lite (§6.3): capturas estáticas en lugar del mapa vivo, sin descargar MapLibre ni
 * tiles, y botón para cambiar de modo.
 */
const MAP_REQUEST = /maplibre|MapController|\.pmtiles|mapterhorn|maps\.eox\.at/i;

test('en modo lite no se descarga el mapa y la captura sigue al paso', async ({
  page,
}, testInfo) => {
  const mapRequests: string[] = [];
  page.on('request', (r) => {
    if (MAP_REQUEST.test(r.url())) mapRequests.push(r.url());
  });

  await page.goto('/?lite=1');
  await expect(page.locator('html')).toHaveAttribute('data-map-mode', 'lite');
  await expect(page.locator('.story__map-status')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Modo ligero' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const { key, ready } = await page.evaluate(() => {
    const data = JSON.parse(document.getElementById('story-data')?.textContent ?? '{}');
    const step = data.steps.find((s: { id: string }) => s.id === 'kuelap-03');
    return {
      key: step.liteKey as string,
      ready: (data.liteReady as string[]).includes(step.liteKey),
    };
  });
  test.skip(!ready, 'faltan las capturas lite: ejecuta `pnpm lite`');

  await page.evaluate(() =>
    document.getElementById('kuelap-03')?.scrollIntoView({ block: 'center' }),
  );
  const img = page.locator('[data-lite-frame].is-visible img');
  const frame = testInfo.project.name === 'movil' ? 'alto' : 'ancho';
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc), { timeout: 10_000 })
    .toMatch(new RegExp(`/lite/${key}-${frame}\\.(avif|jpg)$`));

  expect(mapRequests).toEqual([]);
});

test('el botón cambia de modo y recuerda la elección', async ({ page }) => {
  await page.goto('/');
  // Sin WebGL2 (Chromium headless sin GPU) el modo lite es obligatorio y no hay botón.
  const webgl2 = await page.evaluate(
    () => document.createElement('canvas').getContext('webgl2') !== null,
  );
  test.skip(!webgl2, 'este navegador no tiene WebGL2');
  const toggle = page.getByRole('button', { name: 'Modo ligero' });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-map-mode', 'lite');
  expect(await page.evaluate(() => localStorage.getItem('mapa'))).toBe('lite');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-map-mode', 'lite');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).not.toHaveAttribute('data-map-mode', 'lite');
  expect(await page.evaluate(() => localStorage.getItem('mapa'))).toBe('live');
});
