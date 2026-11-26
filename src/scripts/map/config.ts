/**
 * Orígenes de datos del mapa.
 *
 * - Mapa base (Protomaps, PMTiles): en desarrollo se lee el build diario a través del proxy
 *   de Vite; en producción, de PUBLIC_BASEMAP_URL (recorte alojado en R2, F2.1). Si no hay
 *   URL, el mapa se dibuja solo con relieve.
 * - Relieve (Mapterhorn): terrarium, 512 px, CORS abierto, sin API key.
 */

/** Build de Protomaps usado en desarrollo (los builds diarios se conservan pocos días). */
const DEV_PROTOMAPS_BUILD = '20261126';

export const BASEMAP_URL: string | null =
  import.meta.env.PUBLIC_BASEMAP_URL ??
  (import.meta.env.DEV ? `/remote/protomaps/${DEV_PROTOMAPS_BUILD}.pmtiles` : null);

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
};
