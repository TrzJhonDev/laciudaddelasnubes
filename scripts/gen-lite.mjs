// Genera las capturas estáticas del modo lite (§6.3, hallazgo H10 del plan).
//
// Abre la historia en el servidor de desarrollo, coloca el mapa en la vista de cada paso
// (sin repetir vistas iguales) y guarda dos encuadres, `ancho` (escritorio) y `alto` (móvil),
// en AVIF y JPEG en public/lite/. Escribe public/lite/capturas.json, que la página lee en el
// build, y borra las capturas que ya no corresponden a ninguna vista.
//
// Uso:
//   pnpm lite                       # todas las vistas (arranca `astro dev` si no está en marcha)
//   pnpm lite --solo kuelap         # solo las claves que empiezan por "kuelap"
//   pnpm lite --url http://localhost:4321
//   pnpm lite --satelite            # incluye la imagen satelital de EOX (revisar su licencia antes)
//
// Por defecto las capturas NO llevan la capa satelital: EOxCloudless (CC BY-NC-SA) se usa
// desde su servicio público y no se autoaloja (ver src/scripts/map/config.ts).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const withSatellite = args.includes('--satelite');
const only = argValue('--solo');
const ownPort = 4331;
/** Astro 7 admite un solo `astro dev` por proyecto: si ya hay uno (4321), se reutiliza. */
const candidates = argValue('--url')
  ? [argValue('--url')]
  : ['http://localhost:4321', `http://localhost:${ownPort}`];
let baseUrl = candidates[0];

const OUT = join(process.cwd(), 'public', 'lite');
const MANIFEST = join(OUT, 'capturas.json');

/** Encuadres: deben coincidir con PORTRAIT_MEDIA de src/scripts/lite/LiteView.ts. */
const FRAMES = [
  { name: 'ancho', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'alto', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 },
];

async function reachable(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

/** Arranca `astro dev` en un puerto propio si no hay un servidor en la URL indicada. */
async function ensureServer() {
  for (const url of candidates) {
    if (await reachable(url)) {
      baseUrl = url;
      console.log(`[lite] usando el servidor de ${baseUrl}`);
      return null;
    }
  }
  if (argValue('--url')) throw new Error(`No responde ${baseUrl}`);
  baseUrl = `http://localhost:${ownPort}`;
  console.log(`[lite] arrancando astro dev en ${baseUrl}…`);
  const child = spawn(`pnpm exec astro dev --port ${ownPort}`, { shell: true, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    if (await reachable(baseUrl)) return child;
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopServer(child);
  throw new Error('astro dev no arrancó en 2 minutos');
}

function stopServer(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

/** Oculta todo lo que no es el mapa y deja el canvas visible sin fundido. */
const CAPTURE_CSS = `
  .story__content, .progress, [data-map-toggle], .story__map-status,
  .maplibregl-control-container, astro-dev-toolbar { visibility: hidden !important; }
  .story__map .maplibregl-canvas-container { opacity: 1 !important; transition: none !important; }
`;

async function openStory(browser, frame) {
  const context = await browser.newContext({
    viewport: frame.viewport,
    deviceScaleFactor: frame.deviceScaleFactor,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?lite=0`, { waitUntil: 'domcontentloaded' });
  // En móvil el mapa espera al primer gesto: se simula.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await page.waitForFunction(() => document.documentElement.dataset.mapMode === 'live', null, {
    timeout: 120_000,
  });
  await page.addStyleTag({ content: CAPTURE_CSS });
  await page.evaluate((satellite) => {
    const map = window.__story.controller.instance;
    if (!satellite) map.setLayoutProperty('satelite', 'visibility', 'none');
  }, withSatellite);
  return { context, page };
}

/** Coloca la vista de un paso y espera a que el mapa termine de cargar y dibujar. */
async function capture(page, stepId) {
  await page.evaluate(
    async ({ id, satellite }) => {
      const { controller, cameraOf, data } = window.__story;
      const step = data.steps.find((s) => s.id === id);
      const map = controller.instance;
      controller.setVisibleLayers(step.layers);
      // Sin la foto, el aspecto `paisaje` (vías tenues, agua oculta) se queda vacío: se usa el
      // mapa vectorial completo, con el relieve sombreado.
      if (!satellite) controller.setBasemapMode('plano');
      controller.goTo(cameraOf(step), { instant: true });
      await new Promise((resolve) => {
        map.once('idle', resolve);
        map.triggerRepaint();
      });
    },
    { id: stepId, satellite: withSatellite },
  );
  // Margen para los fundidos de capas y del mapa base (700 ms) y de las etiquetas.
  await page.waitForTimeout(900);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = window.__story.controller.instance;
        if (map.loaded() && !map.isMoving()) resolve();
        else map.once('idle', resolve);
      }),
  );
  return page.screenshot({ type: 'png' });
}

async function encode(png, base) {
  await sharp(png).avif({ quality: 50, effort: 6 }).toFile(`${base}.avif`);
  await sharp(png).jpeg({ quality: 70, mozjpeg: true }).toFile(`${base}.jpg`);
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    return { claves: [] };
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  // WebGL por software si no hay GPU en modo headless (Chrome ya no lo activa solo).
  const browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    let views = null;
    for (const frame of FRAMES) {
      const { context, page } = await openStory(browser, frame);
      if (!views) {
        const steps = await page.evaluate(() => window.__story.data.steps);
        const seen = new Map();
        for (const s of steps) if (!seen.has(s.liteKey)) seen.set(s.liteKey, s.id);
        views = [...seen].map(([key, stepId]) => ({ key, stepId }));
      }
      const todo = only ? views.filter((v) => v.key.startsWith(only)) : views;
      for (const [i, v] of todo.entries()) {
        const png = await capture(page, v.stepId);
        await encode(png, join(OUT, `${v.key}-${frame.name}`));
        console.log(`[lite] ${frame.name} ${i + 1}/${todo.length} ${v.key} (${v.stepId})`);
      }
      await context.close();
    }

    const current = new Set(views.map((v) => v.key));
    const done = only
      ? new Set([
          ...readManifest().claves.filter((k) => current.has(k)),
          ...views.filter((v) => v.key.startsWith(only)).map((v) => v.key),
        ])
      : current;

    // Capturas huérfanas: vistas que ya no existen.
    let removed = 0;
    for (const f of readdirSync(OUT)) {
      const m = /^(.+)-(ancho|alto)\.(avif|jpg)$/.exec(f);
      if (m && !current.has(m[1])) {
        rmSync(join(OUT, f));
        removed++;
      }
    }

    writeFileSync(
      MANIFEST,
      `${JSON.stringify(
        {
          generado: new Date().toLocaleDateString('sv'), // AAAA-MM-DD en hora local
          satelite: withSatellite,
          claves: [...done].sort(),
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `[lite] ${done.size}/${current.size} vistas listas en public/lite/` +
        (removed ? ` · ${removed} archivos huérfanos borrados` : ''),
    );
  } finally {
    await browser.close();
    stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
