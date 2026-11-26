import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accesibilidad con axe (§11, §14): WCAG 2.0/2.1/2.2 A y AA.
 * Se excluye el canvas del mapa, que es decorativo (aria-hidden) y lo dibuja WebGL.
 */
const pages = [
  { path: '/', name: 'historia' },
  { path: '/texto', name: 'versión de texto' },
  { path: '/creditos', name: 'créditos' },
];

for (const p of pages) {
  test(`${p.name} no tiene violaciones de accesibilidad`, async ({ page }) => {
    // Con movimiento reducido todo está en su estado final: axe no mide elementos a mitad de
    // un fundido (lo que daría falsos fallos de contraste).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('.maplibregl-canvas')
      .analyze();
    const resumen = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.length} nodo(s) — ${v.nodes[0]?.target.join(' ')}`,
    );
    expect(resumen, resumen.join('\n')).toEqual([]);
  });
}

test('la historia se puede recorrer con el teclado desde el enlace de salto', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenido')).toBeFocused();
});

test('cada capítulo tiene un título h2 y existe un único h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('section.chapter h2')).toHaveCount(10);
});
