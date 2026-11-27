/**
 * Elección entre el mapa 3D (`live`) y el modo ligero (`lite`, §6.3).
 *
 * Orden de prioridad:
 * 1. Sin WebGL2 no hay mapa posible: siempre `lite`.
 * 2. `?lite=1` / `?lite=0` en la URL (pruebas y enlaces directos; no se guarda).
 * 3. La elección del usuario con el botón "Modo ligero" (localStorage).
 * 4. Ahorro de datos o poca memoria → `lite`; si no, `live`.
 */
export type MapMode = 'live' | 'lite';

export const MAP_MODE_KEY = 'mapa';

export function urlChoice(search: string): MapMode | null {
  const v = new URLSearchParams(search).get('lite');
  if (v === '1') return 'lite';
  if (v === '0') return 'live';
  return null;
}

export function storedChoice(storage: Pick<Storage, 'getItem'> | null): MapMode | null {
  try {
    const v = storage?.getItem(MAP_MODE_KEY);
    return v === 'lite' || v === 'live' ? v : null;
  } catch {
    return null;
  }
}

export function saveChoice(mode: MapMode, storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(MAP_MODE_KEY, mode);
  } catch {
    // almacenamiento bloqueado: la elección dura solo esta visita
  }
}

export function decideMode(opts: {
  canRenderMap: boolean;
  url: MapMode | null;
  stored: MapMode | null;
  constrained: boolean;
}): MapMode {
  if (!opts.canRenderMap) return 'lite';
  return opts.url ?? opts.stored ?? (opts.constrained ? 'lite' : 'live');
}
