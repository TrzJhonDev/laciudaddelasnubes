import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { applyBasemapModes, landscapePaint } from '@/scripts/map/basemap-modes';

const layer = (id: string, type: LayerSpecification['type'], paint = {}) =>
  ({ id, type, source: 'amazonas', paint }) as unknown as LayerSpecification;

describe('modo paisaje del mapa base', () => {
  it('deja las vías finas y quita bordes y senderos', () => {
    expect(landscapePaint(layer('reg-roads_major_casing_late', 'line'), true)).toEqual({
      'line-opacity': 0,
    });
    expect(landscapePaint(layer('reg-roads_major', 'line'), true)?.['line-opacity']).toBe(0.55);
    expect(landscapePaint(layer('cont-roads_minor', 'line'), true)?.['line-opacity']).toBe(0.3);
    expect(landscapePaint(layer('reg-roads_minor_service', 'line'), true)).toEqual({
      'line-opacity': 0,
    });
    expect(landscapePaint(layer('reg-roads_other', 'line'), true)).toEqual({ 'line-opacity': 0 });
  });

  it('oculta los rellenos que tapan la foto, no los que quedan debajo', () => {
    expect(landscapePaint(layer('reg-water', 'fill'), true)).toEqual({ 'fill-opacity': 0 });
    expect(landscapePaint(layer('reg-earth', 'fill'), false)).toBeNull();
  });

  it('quita iconos y escudos y pone las etiquetas en blanco', () => {
    expect(landscapePaint(layer('reg-pois', 'symbol'), true)).toEqual({
      'text-opacity': 0,
      'icon-opacity': 0,
    });
    expect(landscapePaint(layer('reg-places_locality', 'symbol'), true)?.['text-color']).toBe(
      '#ffffff',
    );
  });

  it('el estilo nace en paisaje y el modo plano restaura la pintura original', () => {
    const layers = [
      layer('reg-earth', 'fill', { 'fill-color': '#eee' }),
      layer('reg-roads_major', 'line', { 'line-color': '#ffffff' }),
    ];
    const modes = applyBasemapModes(layers, 0, { paisaje: [], plano: [] });
    expect((layers[1] as { paint: Record<string, unknown> }).paint['line-opacity']).toBe(0.55);
    expect(modes.plano).toContainEqual({
      layer: 'reg-roads_major',
      prop: 'line-color',
      value: '#ffffff',
    });
    // Sin valor original, el modo plano lo devuelve al de por defecto.
    expect(modes.plano).toContainEqual({
      layer: 'reg-roads_major',
      prop: 'line-opacity',
      value: undefined,
    });
  });
});
