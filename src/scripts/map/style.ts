import { LIGHT, layers as protomapsLayers } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import {
  ATTRIBUTION,
  BASEMAPS,
  GLYPHS_URL,
  REGIONAL_MINZOOM,
  SATELLITE_MAXZOOM,
  SATELLITE_TILES,
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

/**
 * Capas del mapa base para los dos recortes: cada capa de Protomaps se duplica, la versión
 * continental hasta REGIONAL_MINZOOM y la regional desde ahí. Se intercalan para conservar
 * el orden de dibujo (agua, vías, etiquetas…).
 */
function basemapLayers(): LayerSpecification[] {
  if (!BASEMAPS) {
    return [
      { id: 'background', type: 'background', paint: { 'background-color': flavor.background } },
    ];
  }
  const cont = protomapsLayers('continente', flavor, { lang: 'es' }) as LayerSpecification[];
  const reg = protomapsLayers('amazonas', flavor, { lang: 'es' }) as LayerSpecification[];
  const out: LayerSpecification[] = [];
  cont.forEach((c, i) => {
    const r = reg[i];
    if (c.type === 'background' || !r) {
      out.push(c);
      return;
    }
    out.push({ ...c, id: `cont-${c.id}`, maxzoom: Math.min(c.maxzoom ?? 24, REGIONAL_MINZOOM) });
    out.push({ ...r, id: `reg-${r.id}`, minzoom: Math.max(r.minzoom ?? 0, REGIONAL_MINZOOM) });
  });
  return out;
}

export function buildStyle(opts: { exaggeration: number }): StyleSpecification {
  const base = basemapLayers();

  // El hillshade va justo encima del suelo y del agua, debajo de vías y etiquetas.
  const firstRoad = base.findIndex((l) => /^(cont|reg)-roads/.test(l.id) || l.type === 'symbol');
  const insertAt = firstRoad === -1 ? base.length : firstRoad;
  // Satélite en paisajes; se desvanece hacia el mapa vectorial en la ciudad (zoom ≥ 16.5).
  const satellite: LayerSpecification = {
    id: 'satelite',
    type: 'raster',
    source: 'satelite',
    paint: {
      'raster-opacity': ['interpolate', ['linear'], ['zoom'], 15.5, 1, 16.5, 0],
      'raster-saturation': -0.15,
      'raster-contrast': 0.05,
      'raster-fade-duration': 200,
    },
  };
  const hillshade: LayerSpecification = {
    id: 'hillshade',
    type: 'hillshade',
    source: 'hillshade',
    paint: {
      // Más suave sobre el satélite (ya trae sombras propias), más marcado en la ciudad.
      'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 15.5, 0.2, 16.5, 0.5],
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
      ...(BASEMAPS
        ? {
            continente: {
              type: 'vector' as const,
              url: `pmtiles://${BASEMAPS.continente}`,
              attribution: ATTRIBUTION.basemap,
            },
            amazonas: {
              type: 'vector' as const,
              url: `pmtiles://${BASEMAPS.amazonas}`,
              attribution: ATTRIBUTION.basemap,
            },
          }
        : {}),
      satelite: {
        type: 'raster' as const,
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: SATELLITE_MAXZOOM,
        attribution: ATTRIBUTION.satellite,
      },
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
    layers: [
      ...base.slice(0, insertAt),
      satellite,
      hillshade,
      ...base.slice(insertAt),
      ...narrativeLayers,
    ],
  };
}
