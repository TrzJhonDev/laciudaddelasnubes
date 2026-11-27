/** Clase de dispositivo según los breakpoints del §9.1. */
export type DeviceClass = 'desktop' | 'tablet' | 'mobile' | 'landscape-phone';

/** Ajustes del mapa por dispositivo (§9.4). */
export interface DeviceProfile {
  kind: DeviceClass;
  pixelRatio: number;
  exaggeration: number;
  maxPitch: number;
  /** Multiplicador de la duración de los vuelos. */
  flightScale: number;
  antialias: boolean;
  /** Grados de órbita relativos al valor de escritorio (§9.6: 120° → 60°). */
  orbitScale: number;
}

interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

export function classifyViewport({ width, height }: Viewport): DeviceClass {
  if (width > height && height < 500) return 'landscape-phone';
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function deviceProfile(viewport: Viewport): DeviceProfile {
  const kind = classifyViewport(viewport);
  const { dpr } = viewport;
  switch (kind) {
    case 'desktop':
      return {
        kind,
        pixelRatio: Math.min(dpr, 2),
        exaggeration: 1.4,
        maxPitch: 75,
        flightScale: 1,
        antialias: true,
        orbitScale: 1,
      };
    case 'tablet':
      return {
        kind,
        pixelRatio: Math.min(dpr, 1.75),
        exaggeration: 1.4,
        maxPitch: 70,
        flightScale: 0.9,
        antialias: true,
        orbitScale: 1,
      };
    default:
      return {
        kind,
        pixelRatio: Math.min(dpr, 1.5),
        exaggeration: 1.2,
        maxPitch: 60,
        flightScale: 0.75,
        antialias: false,
        orbitScale: 0.5,
      };
  }
}

export function currentViewport(): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/** Ahorro de datos o poca memoria: se propone el modo `lite`, pero el usuario puede salir. */
export function isConstrained(nav: NavigatorExtras = navigator): boolean {
  return nav.connection?.saveData === true || (nav.deviceMemory ?? 8) <= 2;
}

/** Modo `lite` (§6.3): sin WebGL2, poca memoria o ahorro de datos. */
export function shouldUseLite(
  nav: NavigatorExtras = navigator,
  hasWebGL2: () => boolean = detectWebGL2,
): boolean {
  return isConstrained(nav) || !hasWebGL2();
}

export function detectWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
