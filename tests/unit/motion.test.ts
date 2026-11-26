import { describe, expect, it } from 'vitest';
import { prefersReducedMotion, setMotionPreference } from '@/scripts/utils/motion';

const mm = (matches: boolean) => ({
  matchMedia: () => ({ matches }) as MediaQueryList,
});

describe('prefersReducedMotion', () => {
  it('respeta la preferencia del sistema', () => {
    expect(prefersReducedMotion(mm(true), { dataset: {} })).toBe(true);
    expect(prefersReducedMotion(mm(false), { dataset: {} })).toBe(false);
  });

  it('la elección manual gana sobre el sistema', () => {
    expect(prefersReducedMotion(mm(false), { dataset: { motion: 'reduce' } })).toBe(true);
  });
});

describe('setMotionPreference', () => {
  it('actualiza el dataset aunque el storage falle', () => {
    const root = { dataset: {} as DOMStringMap };
    const broken = {
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {},
    };
    setMotionPreference(true, root, broken);
    expect(root.dataset['motion']).toBe('reduce');
    setMotionPreference(false, root, broken);
    expect(root.dataset['motion']).toBeUndefined();
  });
});
