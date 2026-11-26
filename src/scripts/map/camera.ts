/**
 * Cálculos de cámara puros (sin MapLibre), para poder probarlos con Vitest.
 */

export type LngLat = [number, number];

export interface CameraSpec {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
  duration?: number | undefined;
  mobile?:
    | {
        zoom?: number | undefined;
        pitch?: number | undefined;
        offset?: [number, number] | undefined;
      }
    | undefined;
}

export interface CameraState {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

/** Aplica los ajustes de móvil y el pitch máximo del dispositivo. */
export function resolveCamera(
  spec: CameraSpec,
  opts: { mobile: boolean; maxPitch: number },
): CameraState {
  const m = opts.mobile ? spec.mobile : undefined;
  return {
    center: spec.center,
    zoom: m?.zoom ?? spec.zoom,
    pitch: Math.min(m?.pitch ?? spec.pitch, opts.maxPitch),
    bearing: spec.bearing,
  };
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Interpolación lineal de la órbita, con el arco reducido en móvil (§9.6). */
export function orbitBearing(from: number, to: number, progress: number, scale = 1): number {
  const span = (to - from) * scale;
  return normalizeBearing(from + span * clamp01(progress));
}

/** Lleva un ángulo a (-180, 180]. */
export function normalizeBearing(deg: number): number {
  const b = ((((deg + 180) % 360) + 360) % 360) - 180;
  return b === -180 ? 180 : b;
}

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Distancia ortodrómica en metros. */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo inicial de a hacia b, en grados (-180, 180]. */
export function bearingBetween(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return normalizeBearing(deg(Math.atan2(y, x)));
}

export interface RoutePoint {
  point: LngLat;
  bearing: number;
}

/**
 * Punto a lo largo de una polilínea según el progreso (0..1), con el rumbo del tramo.
 * Los tramos son cortos (< 50 km), así que se interpola linealmente en lng/lat.
 */
export function pointAlong(line: readonly LngLat[], progress: number): RoutePoint {
  const first = line[0];
  if (!first) throw new Error('pointAlong: la línea está vacía');
  if (line.length === 1) return { point: first, bearing: 0 };
  if (progress >= 1) {
    const a = line[line.length - 2] as LngLat;
    const b = line[line.length - 1] as LngLat;
    return { point: b, bearing: bearingBetween(a, b) };
  }

  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = distance(line[i - 1] as LngLat, line[i] as LngLat);
    segs.push(d);
    total += d;
  }
  let target = clamp01(progress) * total;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i] as number;
    const a = line[i] as LngLat;
    const b = line[i + 1] as LngLat;
    if (target <= seg || i === segs.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, target / seg);
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        bearing: bearingBetween(a, b),
      };
    }
    target -= seg;
  }
  // inalcanzable: el bucle siempre devuelve en el último tramo
  return { point: line[line.length - 1] as LngLat, bearing: 0 };
}

/** Decide entre un vuelo (flyTo) y un desplazamiento suave (easeTo) según la distancia. */
export function flightKind(from: CameraState, to: CameraState): 'fly' | 'ease' {
  const km = distance(from.center, to.center) / 1000;
  const dz = Math.abs(from.zoom - to.zoom);
  return km > 5 || dz > 2.5 ? 'fly' : 'ease';
}

/** Duración del vuelo en ms (2–4 s, §4.4), escalada por dispositivo. */
export function flightDuration(from: CameraState, to: CameraState, scale = 1): number {
  const km = distance(from.center, to.center) / 1000;
  const dz = Math.abs(from.zoom - to.zoom);
  const base = Math.min(4000, Math.max(2000, 1600 + km * 6 + dz * 250));
  return Math.round(base * scale);
}
