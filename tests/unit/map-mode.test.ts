import { describe, expect, it } from 'vitest';
import {
  decideMode,
  MAP_MODE_KEY,
  saveChoice,
  storedChoice,
  urlChoice,
} from '@/scripts/utils/map-mode';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe('modo del mapa', () => {
  it('lee ?lite=1 y ?lite=0 de la URL', () => {
    expect(urlChoice('?lite=1')).toBe('lite');
    expect(urlChoice('?a=b&lite=0')).toBe('live');
    expect(urlChoice('')).toBeNull();
    expect(urlChoice('?lite=si')).toBeNull();
  });

  it('guarda y recupera la elección; ignora valores desconocidos y storage bloqueado', () => {
    const s = memory();
    saveChoice('lite', s);
    expect(storedChoice(s)).toBe('lite');
    expect(storedChoice(memory({ [MAP_MODE_KEY]: 'otro' }))).toBeNull();
    expect(storedChoice(null)).toBeNull();
    const blocked = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(storedChoice(blocked)).toBeNull();
    expect(() => saveChoice('live', blocked)).not.toThrow();
  });

  it('sin WebGL2 siempre es lite', () => {
    expect(
      decideMode({ canRenderMap: false, url: 'live', stored: 'live', constrained: false }),
    ).toBe('lite');
  });

  it('prioridad: URL, luego elección guardada, luego el dispositivo', () => {
    const base = { canRenderMap: true, url: null, stored: null, constrained: false } as const;
    expect(decideMode(base)).toBe('live');
    expect(decideMode({ ...base, constrained: true })).toBe('lite');
    // El usuario con ahorro de datos puede volver al mapa 3D.
    expect(decideMode({ ...base, constrained: true, stored: 'live' })).toBe('live');
    expect(decideMode({ ...base, stored: 'live', url: 'lite' })).toBe('lite');
  });
});
