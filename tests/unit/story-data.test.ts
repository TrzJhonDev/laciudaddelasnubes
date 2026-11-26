import { describe, expect, it } from 'vitest';
import { buildStoryData } from '@/scripts/story/data';

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
