import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

/**
 * Capas narrativas: cada id que usan los capítulos (`layers: [...]` en el frontmatter)
 * se traduce aquí a una o varias capas de MapLibre. Empiezan ocultas (opacidad 0) y el
 * MapController las muestra con un fundido.
 */

export const narrativeSources: Record<string, SourceSpecification> = {
  sitios: { type: 'geojson', data: '/data/sitios.geojson' },
  telecabinas: { type: 'geojson', data: '/data/telecabinas.geojson' },
  'ruta-fundacion': { type: 'geojson', data: '/data/ruta-fundacion.geojson' },
  kuelap: {
    type: 'geojson',
    data: '/data/kuelap.geojson',
    attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
  },
};

const OCRE = '#c27c3a';
const NOCHE = '#0e1412';
const NEBLINA = '#f4f5f2';
const kind = (k: string) => ['==', ['get', 'kind'], k] as ['==', ['get', string], string];

export const narrativeLayers: LayerSpecification[] = [
  {
    id: 'kuelap-recintos-fill',
    type: 'fill',
    source: 'kuelap',
    filter: kind('recinto'),
    paint: {
      'fill-color': OCRE,
      'fill-opacity': 0,
      'fill-opacity-transition': { duration: 700 },
    },
  },
  {
    id: 'kuelap-muralla-glow',
    type: 'line',
    source: 'kuelap',
    filter: ['in', ['get', 'kind'], ['literal', ['muralla', 'muralla-tramo']]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': NOCHE,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 5, 14, 9, 16, 16],
      'line-blur': 4,
      'line-opacity': 0,
      'line-opacity-transition': { duration: 700 },
    },
  },
  {
    id: 'kuelap-muralla-line',
    type: 'line',
    source: 'kuelap',
    filter: ['in', ['get', 'kind'], ['literal', ['muralla', 'muralla-tramo']]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#e8a25c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 14, 3.5, 16, 6],
      'line-opacity': 0,
      'line-opacity-transition': { duration: 700 },
    },
  },
  {
    id: 'kuelap-hitos-label',
    type: 'symbol',
    source: 'kuelap',
    filter: kind('hito'),
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 13,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.6],
    },
    paint: {
      'text-color': NOCHE,
      'text-halo-color': NEBLINA,
      'text-halo-width': 1.5,
      'text-opacity': 0,
      'text-opacity-transition': { duration: 700 },
    },
  },
  {
    id: 'ruta-fundacion-line',
    type: 'line',
    source: 'ruta-fundacion',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': OCRE,
      'line-width': 3,
      'line-dasharray': [1, 2],
      'line-opacity': 0,
      'line-opacity-transition': { duration: 600 },
    },
  },
  {
    id: 'telecabinas-line',
    type: 'line',
    source: 'telecabinas',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': OCRE,
      'line-width': 3,
      'line-opacity': 0,
      'line-opacity-transition': { duration: 600 },
    },
  },
  {
    id: 'sitios-circle',
    type: 'circle',
    source: 'sitios',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 7],
      'circle-color': OCRE,
      'circle-stroke-color': NEBLINA,
      'circle-stroke-width': 2,
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
      'circle-opacity-transition': { duration: 600 },
      'circle-stroke-opacity-transition': { duration: 600 },
    },
  },
  {
    id: 'sitios-label',
    type: 'symbol',
    source: 'sitios',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 13,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': NOCHE,
      'text-halo-color': NEBLINA,
      'text-halo-width': 1.5,
      'text-opacity': 0,
      'text-opacity-transition': { duration: 600 },
    },
  },
];

/** id narrativo → capas de MapLibre y la propiedad de opacidad de cada una. */
export const narrativeLayerMap: Record<string, { layer: string; props: string[] }[]> = {
  sitios: [
    { layer: 'sitios-circle', props: ['circle-opacity', 'circle-stroke-opacity'] },
    { layer: 'sitios-label', props: ['text-opacity'] },
  ],
  telecabinas: [{ layer: 'telecabinas-line', props: ['line-opacity'] }],
  'ruta-fundacion': [{ layer: 'ruta-fundacion-line', props: ['line-opacity'] }],
  'kuelap-muralla': [
    { layer: 'kuelap-muralla-glow', props: ['line-opacity'] },
    { layer: 'kuelap-muralla-line', props: ['line-opacity'] },
  ],
  'kuelap-recintos': [{ layer: 'kuelap-recintos-fill', props: ['fill-opacity'] }],
  'kuelap-hitos': [{ layer: 'kuelap-hitos-label', props: ['text-opacity'] }],
};

/** Opacidad final de cada capa al mostrarse (por defecto 1). */
export const narrativeLayerOpacity: Record<string, number> = {
  'kuelap-muralla-glow': 0.55,
  'kuelap-recintos-fill': 0.7,
};

/** Rutas que la cámara puede seguir con el scroll (`route:` en un paso). */
export const routeSources: Record<string, string> = {
  telecabinas: '/data/telecabinas.geojson',
  'ruta-fundacion': '/data/ruta-fundacion.geojson',
};
