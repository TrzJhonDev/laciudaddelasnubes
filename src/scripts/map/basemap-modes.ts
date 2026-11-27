import type { LayerSpecification } from 'maplibre-gl';

/**
 * Dos aspectos del mapa base:
 *
 * - `paisaje` (por defecto): la foto satelital manda. Las vías quedan finas y translúcidas,
 *   sin bordes ni senderos; el agua y los edificios vectoriales se ocultan (la foto ya los
 *   muestra); las etiquetas pasan a blanco con halo oscuro y se quitan iconos y escudos.
 * - `plano`: el mapa vectorial de Protomaps tal cual, para la cuadrícula urbana (Cap. 7). Un
 *   paso lo pide con la capa narrativa `plano` en su frontmatter.
 *
 * Antes se pasaba de uno a otro por zoom (15.5–16.5), pero eso convertía en un plano gris las
 *   vistas cercanas de Kuélap, Karajía o Revash.
 */
export type BasemapMode = 'paisaje' | 'plano';

export interface PaintChange {
  layer: string;
  prop: string;
  value: unknown;
}

export type BasemapModes = Record<BasemapMode, PaintChange[]>;

/** Id narrativo que activa el modo plano. */
export const PLANO = 'plano';

const ROAD_ON_SATELLITE = '#f3ead9';
const LABEL_ON_SATELLITE = '#ffffff';
const HALO_ON_SATELLITE = 'rgba(14, 20, 18, 0.8)';

/** Id de Protomaps sin el prefijo del recorte (`cont-` / `reg-`). */
const baseId = (id: string) => id.replace(/^(cont|reg)-/, '');

/** Pintura del modo paisaje para una capa del mapa base, o null si no cambia. */
export function landscapePaint(
  layer: Pick<LayerSpecification, 'id' | 'type'>,
  aboveSatellite: boolean,
): Record<string, unknown> | null {
  const id = baseId(layer.id);
  switch (layer.type) {
    case 'line':
      if (id.startsWith('roads_')) {
        if (id.includes('casing')) return { 'line-opacity': 0 };
        if (/highway|major|link/.test(id)) {
          return { 'line-opacity': 0.55, 'line-color': ROAD_ON_SATELLITE };
        }
        if (id.includes('minor') && !id.includes('service')) {
          return { 'line-opacity': 0.3, 'line-color': ROAD_ON_SATELLITE };
        }
        return { 'line-opacity': 0 }; // senderos, servicio, muelles, vías férreas, pistas
      }
      if (id.startsWith('water_')) return { 'line-opacity': 0.35 };
      if (id.startsWith('boundaries')) return { 'line-opacity': 0.45 };
      return null;
    case 'fill':
      // Lo que queda por encima de la foto (agua, edificios, algunos usos del suelo) la tapaba.
      return aboveSatellite ? { 'fill-opacity': 0 } : null;
    case 'symbol':
      if (
        id === 'pois' ||
        id === 'roads_shields' ||
        id === 'roads_oneway' ||
        id === 'address_label' ||
        id.startsWith('roads_labels')
      ) {
        return { 'text-opacity': 0, 'icon-opacity': 0 };
      }
      return {
        'text-color': LABEL_ON_SATELLITE,
        'text-halo-color': HALO_ON_SATELLITE,
        'text-halo-width': 1.4,
        'text-halo-blur': 0.5,
      };
    default:
      return null;
  }
}

/**
 * Aplica el modo paisaje a las capas del mapa base (el estilo nace así) y devuelve los cambios
 * de pintura para pasar de un modo a otro. `satelliteIndex` es la posición de la capa
 * satelital: las capas que van después se dibujan encima de la foto.
 */
export function applyBasemapModes(
  layers: LayerSpecification[],
  satelliteIndex: number,
  extra: BasemapModes,
): BasemapModes {
  const modes: BasemapModes = { paisaje: [...extra.paisaje], plano: [...extra.plano] };
  layers.forEach((layer, i) => {
    const paint = landscapePaint(layer, i > satelliteIndex);
    if (!paint) return;
    const original = { ...((layer as { paint?: Record<string, unknown> }).paint ?? {}) };
    for (const [prop, value] of Object.entries(paint)) {
      modes.paisaje.push({ layer: layer.id, prop, value });
      // undefined devuelve la propiedad a su valor por defecto.
      modes.plano.push({ layer: layer.id, prop, value: original[prop] });
    }
    (layer as { paint?: Record<string, unknown> }).paint = { ...original, ...paint };
  });
  return modes;
}
