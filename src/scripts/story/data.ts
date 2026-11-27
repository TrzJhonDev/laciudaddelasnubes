import type { CameraSpec } from '../map/camera';

/**
 * Datos de la historia que el servidor serializa en la página (`#story-data`) y lee el cliente.
 * Cada paso lleva ya su cámara efectiva: si el frontmatter no define una, hereda la anterior.
 */
export interface StoryStep {
  id: string;
  chapter: string;
  camera: CameraSpec;
  layers: string[];
  orbit?: { from: number; to: number } | undefined;
  route?: string | undefined;
  /** Vista estática del modo lite: los pasos con la misma cámara y capas comparten captura. */
  liteKey: string;
}

export interface StoryData {
  initial: CameraSpec;
  steps: StoryStep[];
  /** Claves lite con captura generada (scripts/gen-lite.mjs). Las rellena la página. */
  liteReady: string[];
}

interface ChapterInput {
  slug: string;
  camera: CameraSpec;
  steps: {
    id: string;
    camera?: CameraSpec | undefined;
    layers: string[];
    orbit?: { from: number; to: number } | undefined;
    route?: string | undefined;
  }[];
}

/**
 * Súbelo cuando cambie el aspecto de las capturas lite (estilo, tamaño, capas): todas las
 * claves cambian y `pnpm lite` las vuelve a generar.
 */
export const LITE_VERSION = 1;

/** FNV-1a de 32 bits en hexadecimal: da lo mismo en Node y en el navegador. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Clave de la captura lite de un paso: `<capitulo>-<hash>`. Solo depende de lo que se ve
 * (cámara efectiva, incluido su ajuste de móvil, y capas visibles). Si cambia la cámara,
 * cambia la clave y la captura antigua deja de usarse.
 */
export function liteKey(chapter: string, camera: CameraSpec, layers: readonly string[]): string {
  const m = camera.mobile;
  const sig = JSON.stringify([
    LITE_VERSION,
    camera.center,
    camera.zoom,
    camera.pitch,
    camera.bearing,
    m ? [m.zoom ?? null, m.pitch ?? null, m.offset ?? null] : null,
    [...layers].sort(),
  ]);
  return `${chapter}-${fnv1a(sig)}`;
}

/**
 * Captura que el modo lite muestra en un paso. Si la del paso aún no se ha generado, usa la
 * del paso anterior más cercano que la tenga (y, al principio, la siguiente).
 */
export function resolveLiteKey(
  steps: readonly Pick<StoryStep, 'id' | 'liteKey'>[],
  stepId: string,
  ready: ReadonlySet<string>,
): string | null {
  const i = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  for (let j = i; j >= 0; j--) {
    const k = steps[j]?.liteKey;
    if (k && ready.has(k)) return k;
  }
  for (let j = i + 1; j < steps.length; j++) {
    const k = steps[j]?.liteKey;
    if (k && ready.has(k)) return k;
  }
  return null;
}

export function buildStoryData(chapters: readonly ChapterInput[]): StoryData {
  const first = chapters[0];
  if (!first) throw new Error('buildStoryData: no hay capítulos');
  const steps: StoryStep[] = [];
  for (const ch of chapters) {
    let last: CameraSpec = ch.camera;
    for (const s of ch.steps) {
      let camera = s.camera ?? last;
      // Una órbita empieza en su ángulo inicial; así el siguiente paso hereda el final.
      if (s.orbit) camera = { ...camera, bearing: s.orbit.from };
      steps.push({
        id: s.id,
        chapter: ch.slug,
        camera,
        layers: s.layers,
        orbit: s.orbit,
        route: s.route,
        liteKey: liteKey(ch.slug, camera, s.layers),
      });
      last = s.orbit ? { ...camera, bearing: s.orbit.to } : camera;
    }
  }
  return { initial: first.camera, steps, liteReady: [] };
}
