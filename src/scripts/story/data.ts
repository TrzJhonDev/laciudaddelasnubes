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
}

export interface StoryData {
  initial: CameraSpec;
  steps: StoryStep[];
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
      });
      last = s.orbit ? { ...camera, bearing: s.orbit.to } : camera;
    }
  }
  return { initial: first.camera, steps };
}
