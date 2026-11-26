/**
 * Orígenes de datos del mapa.
 *
 * - Mapa base (Protomaps, PMTiles): dos recortes generados con go-pmtiles (F2.1),
 *   `continente.pmtiles` (Sudamérica, z0–6) y `amazonas.pmtiles` (z7–15). En desarrollo se
 *   sirven desde public/tiles/ (ignorados por git); en producción, desde PUBLIC_TILES_BASE
 *   (bucket R2). Si no hay base, el mapa se dibuja solo con relieve.
 * - Relieve (Mapterhorn): terrarium, 512 px, CORS abierto, sin API key.
 */

const TILES_BASE: string | null =
  import.meta.env.PUBLIC_TILES_BASE ?? (import.meta.env.DEV ? '/tiles' : null);

export const BASEMAPS: { continente: string; amazonas: string } | null = TILES_BASE
  ? {
      continente: `${TILES_BASE}/continente.pmtiles`,
      amazonas: `${TILES_BASE}/amazonas.pmtiles`,
    }
  : null;

/** Zoom en el que el recorte de Amazonas reemplaza al continental. */
export const REGIONAL_MINZOOM = 7;

/**
 * Imagen satelital EOxCloudless 2025 (Sentinel-2, ~10 m, nativa hasta z14).
 * Licencia CC BY-NC-SA 4.0: uso no comercial desde el servicio público de EOX, con atribución
 * visible. No se descarga ni se autoaloja (eso exige licencia comercial de EOX).
 */
export const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg';
export const SATELLITE_MAXZOOM = 14;

export const TERRAIN_TILES = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const TERRAIN_MAXZOOM = 12;

// TODO(F2.2): autoalojar glifos y sprites en public/map/.
export const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
export const SPRITE_URL = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';

export const ATTRIBUTION = {
  basemap:
    '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
  terrain: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
  satellite:
    '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)',
};
