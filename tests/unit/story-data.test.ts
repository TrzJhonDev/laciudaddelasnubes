import { describe, expect, it } from 'vitest';
import { buildStoryData, liteKey, resolveLiteKey } from '@/scripts/story/data';

const cam = (bearing: number) => ({
  center: [0, 0] as [number, number],
  zoom: 10,
  pitch: 0,
  bearing,
});

describe('buildStoryData', () => {
  it('hereda la cámara anterior y encadena órbitas', () => {
    const data = buildStoryData([
      {
        slug: 'kuelap',
        camera: cam(0),
        steps: [
          { id: 'kuelap-01', camera: cam(10), layers: [] },
          { id: 'kuelap-02', layers: ['a'], orbit: { from: 10, to: 90 } },
          { id: 'kuelap-03', layers: [] },
        ],
      },
    ]);
    expect(data.steps.map((s) => s.camera.bearing)).toEqual([10, 10, 90]);
    expect(data.steps[1]?.layers).toEqual(['a']);
    expect(data.initial.bearing).toBe(0);
  });

  it('el primer paso sin cámara usa la del capítulo', () => {
    const data = buildStoryData([
      { slug: 'x', camera: cam(45), steps: [{ id: 'x-01', layers: [] }] },
    ]);
    expect(data.steps[0]?.camera.bearing).toBe(45);
  });
});

describe('claves lite', () => {
  it('los pasos con la misma vista comparten captura', () => {
    const data = buildStoryData([
      {
        slug: 'k',
        camera: cam(0),
        steps: [
          { id: 'k-01', layers: ['a', 'b'] },
          { id: 'k-02', layers: ['b', 'a'] }, // mismo conjunto de capas, otro orden
          { id: 'k-03', layers: ['a'] },
          { id: 'k-04', camera: cam(30), layers: ['a'] },
        ],
      },
    ]);
    const [s1, s2, s3, s4] = data.steps.map((s) => s.liteKey);
    expect(s1).toBe(s2);
    expect(s3).not.toBe(s1);
    expect(s4).not.toBe(s3);
    expect(s1).toMatch(/^k-[0-9a-f]{8}$/);
  });

  it('la clave cambia si cambia la cámara de móvil', () => {
    const base = cam(0);
    expect(liteKey('k', base, [])).not.toBe(liteKey('k', { ...base, mobile: { zoom: 9 } }, []));
    expect(liteKey('k', base, [])).toBe(liteKey('k', { ...cam(0) }, []));
  });

  it('usa la captura anterior más cercana si falta la del paso', () => {
    const steps = [
      { id: 'a-01', liteKey: 'A' },
      { id: 'a-02', liteKey: 'B' },
      { id: 'a-03', liteKey: 'C' },
    ];
    expect(resolveLiteKey(steps, 'a-03', new Set(['A', 'B', 'C']))).toBe('C');
    expect(resolveLiteKey(steps, 'a-03', new Set(['A']))).toBe('A');
    // Al principio, sin anterior, usa la siguiente disponible.
    expect(resolveLiteKey(steps, 'a-01', new Set(['B']))).toBe('B');
    // Paso desconocido (portada): se trata como el primero.
    expect(resolveLiteKey(steps, '', new Set(['A']))).toBe('A');
    expect(resolveLiteKey(steps, 'a-02', new Set())).toBeNull();
  });
});
