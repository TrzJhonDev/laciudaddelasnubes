import { LIGHT, layers as protomapsLayers } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import {
  ATTRIBUTION,
  BASEMAP_URL,
  GLYPHS_URL,
  SPRITE_URL,
  TERRAIN_MAXZOOM,
  TERRAIN_TILES,
} from './config';
import { narrativeLayers, narrativeSources } from './layers';

/** Paleta "Neblina y piedra" aplicada sobre el sabor LIGHT de Protomaps. */
const flavor = {
  ...LIGHT,
  background: '#dde1da',
  earth: '#e9ebe5',
  water: '#a9bcc0',
  wood_a: '#cdd8c8',
  wood_b: '#c3d0bd',
  park_a: '#d3dccd',
  park_b: '#c8d4c1',
  scrub_a: '#d6dccd',
  scrub_b: '#cfd6c6',
  glacier: '#f4f5f2',
  boundaries: '#8c7350',
  city_label: '#1a2a21',
  city_label_halo: '#f4f5f2',
  subplace_label: '#2f4a3a',
  subplace_label_halo: '#f4f5f2',
  state_label: '#735c3e',
  state_label_halo: '#f4f5f2',
  country_label: '#735c3e',
};

export function buildStyle(opts: { exaggeration: number }): StyleSpecification {
  const base: LayerSpecification[] = BASEMAP_URL
    ? (protomapsLayers('base', flavor, { lang: 'es' }) as LayerSpecification[])
    : [{ id: 'background', type: 'background', paint: { 'background-color': flavor.background } }];

  // El hillshade va justo encima del suelo y del agua, debajo de vías y etiquetas.
  const firstRoad = base.findIndex((l) => l.id.startsWith('roads') || l.type === 'symbol');
  const insertAt = firstRoad === -1 ? base.length : firstRoad;
  const hillshade: LayerSpecification = {
    id: 'hillshade',
    type: 'hillshade',
    source: 'hillshade',
    paint: {
      'hillshade-exaggeration': 0.55,
      'hillshade-shadow-color': '#1a2a21',
      'hillshade-highlight-color': '#f4f5f2',
      'hillshade-accent-color': '#2f4a3a',
    },
  };

  const terrainSource = {
    type: 'raster-dem' as const,
    tiles: [TERRAIN_TILES],
    encoding: 'terrarium' as const,
    tileSize: 512,
    maxzoom: TERRAIN_MAXZOOM,
    attribution: ATTRIBUTION.terrain,
  };

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    sources: {
      ...(BASEMAP_URL
        ? {
            base: {
              type: 'vector' as const,
              url: `pmtiles://${BASEMAP_URL}`,
              attribution: ATTRIBUTION.basemap,
            },
          }
        : {}),
      terrain: terrainSource,
      hillshade: { ...terrainSource, attribution: '' },
      ...narrativeSources,
    },
    terrain: { source: 'terrain', exaggeration: opts.exaggeration },
    sky: {
      'sky-color': '#c9d3cf',
      'horizon-color': '#eef0ec',
      'fog-color': '#eef0ec',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.25,
      'atmosphere-blend': 0.4,
    },
    layers: [...base.slice(0, insertAt), hillshade, ...base.slice(insertAt), ...narrativeLayers],
  };
}
