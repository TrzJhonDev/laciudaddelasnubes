import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** [lng, lat] con rangos válidos. */
export const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** Estado de cámara del mapa (contrato MapController §6.5). */
export const camera = z.object({
  center: lngLat,
  zoom: z.number().min(0).max(22),
  pitch: z.number().min(0).max(85).default(0),
  bearing: z.number().min(-180).max(180).default(0),
  /** ms; si se omite, el vuelo va atado al scroll. */
  duration: z.number().positive().optional(),
  /** Ajustes para móvil (§9.4): menos zoom/pitch y desplazamiento del centro. */
  mobile: z
    .object({
      zoom: z.number().min(0).max(22).optional(),
      pitch: z.number().min(0).max(60).optional(),
      offset: z.tuple([z.number(), z.number()]).optional(),
    })
    .optional(),
});

export const step = z.object({
  /** Formato `<capitulo>-NN`, p. ej. `kuelap-03`. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/, 'id de paso: "<capitulo>-NN"'),
  camera: camera.optional(),
  layers: z.array(z.string()).default([]),
  /** id de una ruta animada en public/data (followRoute). */
  route: z.string().optional(),
  /** Órbita en grados, atada al scroll. */
  orbit: z
    .object({
      from: z.number().min(-360).max(360),
      to: z.number().min(-360).max(360),
    })
    .optional(),
});

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/chapters' }),
  schema: z
    .object({
      order: z.number().int().min(0),
      /** Ancla y id del capítulo (`/#kuelap`). */
      slug: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string().min(3),
      /** Antetítulo, p. ej. "Siglos IX–XV". */
      kicker: z.string(),
      /** Para SEO, OG y la versión de texto. */
      summary: z.string().min(20).max(200),
      /** Aviso previo (Cap. 4: restos humanos). */
      warning: z.string().optional(),
      /** Cámara de entrada del capítulo. */
      camera,
      steps: z.array(step).min(1),
      sources: z.array(reference('sources')).min(1),
      /** Borrador hasta que lo valide el especialista (F1.6). */
      draft: z.boolean().default(true),
    })
    .refine((c) => new Set(c.steps.map((s) => s.id)).size === c.steps.length, {
      message: 'Hay ids de pasos repetidos',
    })
    .refine((c) => c.steps.every((s) => s.id.startsWith(`${c.slug}-`)), {
      message: 'Cada id de paso debe empezar por el slug del capítulo',
    }),
});

export const sourceTypes = [
  'oficial',
  'academica',
  'prensa',
  'enciclopedia',
  'divulgacion',
] as const;

const sources = defineCollection({
  loader: file('./src/content/sources/sources.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    author: z.string().optional(),
    publisher: z.string(),
    url: z.url().optional(),
    /** Fecha de publicación si se conoce (AAAA, AAAA-MM o AAAA-MM-DD). */
    published: z
      .string()
      .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
      .optional(),
    /** Fecha de consulta (AAAA-MM-DD). */
    accessed: z.iso.date(),
    type: z.enum(sourceTypes),
    lang: z.enum(['es', 'en']).default('es'),
  }),
});

const media = defineCollection({
  loader: file('./src/content/media/media.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Ruta relativa a src/assets/images. */
    file: z.string(),
    alt: z.string().min(10),
    caption: z.string(),
    author: z.string(),
    /** CC BY 4.0, CC BY-SA 4.0, dominio público, permiso escrito… */
    license: z.string(),
    licenseUrl: z.url().optional(),
    sourceUrl: z.url().optional(),
    /** Contenido sensible (restos humanos): sin primeros planos (§13.3). */
    sensitive: z.boolean().default(false),
  }),
});

export const collections = { chapters, sources, media };
