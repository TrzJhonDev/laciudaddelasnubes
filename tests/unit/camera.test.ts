import { describe, expect, it } from 'vitest';
import {
  bearingBetween,
  distance,
  flightDuration,
  flightKind,
  normalizeBearing,
  orbitBearing,
  pointAlong,
  resolveCamera,
} from '@/scripts/map/camera';
import { classifyViewport, deviceProfile, shouldUseLite } from '@/scripts/utils/device';

const kuelap: [number, number] = [-77.9233, -6.4179];
const plaza: [number, number] = [-77.87239, -6.22936];

describe('resolveCamera', () => {
  const spec = {
    center: kuelap,
    zoom: 15,
    pitch: 70,
    bearing: 40,
    mobile: { zoom: 14.2, pitch: 60 },
  };

  it('usa los valores de escritorio y limita el pitch', () => {
    expect(resolveCamera(spec, { mobile: false, maxPitch: 75 })).toEqual({
      center: kuelap,
      zoom: 15,
      pitch: 70,
      bearing: 40,
    });
    expect(resolveCamera(spec, { mobile: false, maxPitch: 60 }).pitch).toBe(60);
  });

  it('aplica los ajustes de móvil', () => {
    const c = resolveCamera(spec, { mobile: true, maxPitch: 60 });
    expect(c.zoom).toBe(14.2);
    expect(c.pitch).toBe(60);
  });
});

describe('órbita y rumbos', () => {
  it('normaliza ángulos a (-180, 180]', () => {
    expect(normalizeBearing(270)).toBe(-90);
    expect(normalizeBearing(-180)).toBe(180);
    expect(normalizeBearing(540)).toBe(180);
    expect(normalizeBearing(0)).toBe(0);
  });

  it('interpola la órbita y la reduce a la mitad en móvil', () => {
    expect(orbitBearing(0, 120, 0.5)).toBe(60);
    expect(orbitBearing(0, 120, 1, 0.5)).toBe(60);
    expect(orbitBearing(200, 270, 1)).toBe(-90);
    expect(orbitBearing(0, 90, 2)).toBe(90); // progreso fuera de rango se recorta
  });
});

describe('geodesia', () => {
  it('distancia Plaza de Armas → Kuélap ≈ 21.8 km', () => {
    expect(distance(plaza, kuelap) / 1000).toBeCloseTo(21.8, 0);
  });

  it('rumbo hacia el sur ≈ 180°', () => {
    expect(Math.abs(bearingBetween([-77.9, -6.2], [-77.9, -6.5]))).toBeCloseTo(180, 5);
  });

  it('pointAlong recorre la línea de inicio a fin', () => {
    const line: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    expect(pointAlong(line, 0).point).toEqual([0, 0]);
    expect(pointAlong(line, 1).point).toEqual([1, 1]);
    const mid = pointAlong(line, 0.5);
    expect(mid.point[0]).toBeCloseTo(0, 2);
    expect(mid.point[1]).toBeCloseTo(1, 2);
    expect(pointAlong(line, 0.25).bearing).toBeCloseTo(0, 5);
  });
});

describe('vuelos', () => {
  const a = { center: plaza, zoom: 12, pitch: 0, bearing: 0 };
  const b = { center: kuelap, zoom: 15, pitch: 70, bearing: 0 };

  it('usa flyTo para saltos largos y easeTo para cortos', () => {
    expect(flightKind(a, b)).toBe('fly');
    expect(flightKind(b, { ...b, bearing: 90 })).toBe('ease');
  });

  it('dura entre 2 y 4 s, más corto en móvil', () => {
    const d = flightDuration(a, b);
    expect(d).toBeGreaterThanOrEqual(2000);
    expect(d).toBeLessThanOrEqual(4000);
    expect(flightDuration(a, b, 0.75)).toBe(Math.round(d * 0.75));
  });
});

describe('dispositivo', () => {
  it('clasifica los viewports del §9.1', () => {
    expect(classifyViewport({ width: 1440, height: 900, dpr: 1 })).toBe('desktop');
    expect(classifyViewport({ width: 768, height: 1024, dpr: 2 })).toBe('tablet');
    expect(classifyViewport({ width: 390, height: 844, dpr: 3 })).toBe('mobile');
    expect(classifyViewport({ width: 844, height: 390, dpr: 3 })).toBe('landscape-phone');
  });

  it('limita el pixelRatio en móvil', () => {
    expect(deviceProfile({ width: 390, height: 844, dpr: 3 }).pixelRatio).toBe(1.5);
    expect(deviceProfile({ width: 1920, height: 1080, dpr: 3 }).pixelRatio).toBe(2);
  });

  it('activa el modo lite sin WebGL2, con poca memoria o ahorro de datos', () => {
    const nav = {} as Navigator;
    expect(shouldUseLite(nav, () => true)).toBe(false);
    expect(shouldUseLite(nav, () => false)).toBe(true);
    expect(shouldUseLite({ deviceMemory: 2 } as never, () => true)).toBe(true);
    expect(shouldUseLite({ connection: { saveData: true } } as never, () => true)).toBe(true);
  });
});
