import { addProtocol, Map as MapLibreMap, type PaddingOptions, setWorkerUrl } from 'maplibre-gl';
// Con `?url` el CSS no se cuela en el <head> de la página: Astro enlaza como hoja de estilos
// bloqueante todo el CSS de los módulos importados, aunque sea con import() dinámico, y en
// modo lite (o antes de cargar el mapa) son 70 KB que no hacen falta.
import maplibreCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url';
import { Protocol } from 'pmtiles';
import type { DeviceProfile } from '../utils/device';
import { type BasemapMode, type BasemapModes, PLANO } from './basemap-modes';
import {
  type CameraState,
  flightDuration,
  flightKind,
  type LngLat,
  orbitBearing,
  pointAlong,
} from './camera';
import { narrativeLayerMap, narrativeLayerOpacity, routeSources } from './layers';
import { buildStyle } from './style';

// MapLibre 6 busca su worker junto a su propio módulo, pero Vite lo reubica (y en desarrollo le
// inyecta su cliente HMR, que lo bloquea). scripts/copy-vendor.mjs lo copia intacto a public/.
const workerUrl = '/vendor/maplibre-gl-worker.mjs';

let protocolRegistered = false;

/**
 * Con relieve, MapLibre dibuja las líneas y rellenos en texturas por tile y solo las rehace si
 * cambian los tiles, el zoom o el conjunto de capas visibles, no la opacidad. Con la cámara
 * quieta, un fundido de capa se quedaría congelado en su primer fotograma (pasaba al cargar el
 * mapa a mitad de un paso). Alternar la visibilidad de esta capa vacía fuerza a rehacerlas.
 */
const RTT_REFRESH_LAYER = 'rtt-refresh';
/** Duración de los fundidos de las capas narrativas (layers.ts) más un margen. */
const LAYER_FADE_MS = 800;

let cssReady: Promise<void> | null = null;

/** Enlaza el CSS de MapLibre una sola vez y espera a que cargue (si falla, sigue sin él). */
function loadMaplibreCss(): Promise<void> {
  cssReady ??= new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = maplibreCssUrl;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
  return cssReady;
}

/**
 * API pública del mapa (contrato §6.5, con setCameraPadding y setProfile añadidos, H5).
 * Toda la historia habla con el mapa a través de esta clase.
 */
export class MapController {
  private map: MapLibreMap | null = null;
  private profile: DeviceProfile;
  private reducedMotion: boolean;
  private visible = new Set<string>();
  private routes = new Map<string, LngLat[]>();
  private current: CameraState | null = null;
  private modes: BasemapModes | null = null;
  private basemapMode: BasemapMode = 'paisaje';
  private refreshUntil = 0;
  private refreshing = false;

  constructor(opts: { profile: DeviceProfile; reducedMotion: boolean }) {
    this.profile = opts.profile;
    this.reducedMotion = opts.reducedMotion;
  }

  async init(container: HTMLElement, initial: CameraState): Promise<void> {
    await loadMaplibreCss();
    if (!protocolRegistered) {
      setWorkerUrl(workerUrl);
      const protocol = new Protocol();
      addProtocol('pmtiles', protocol.tile);
      protocolRegistered = true;
    }
    const { style, modes } = buildStyle({ exaggeration: this.profile.exaggeration });
    this.modes = modes;
    const map = new MapLibreMap({
      container,
      style,
      center: initial.center,
      zoom: initial.zoom,
      pitch: initial.pitch,
      bearing: initial.bearing,
      maxPitch: 85,
      pixelRatio: this.profile.pixelRatio,
      canvasContextAttributes: { antialias: this.profile.antialias },
      interactive: false,
      attributionControl: { compact: true },
      fadeDuration: 200,
    });
    this.map = map;
    this.current = initial;
    // El canvas es decorativo: cada paso describe en texto lo que muestra el mapa (§11).
    map.getCanvas().setAttribute('aria-hidden', 'true');
    map.getCanvas().tabIndex = -1;
    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve());
      map.once('error', (e) => {
        if (!map.loaded()) reject(e.error);
      });
    });
    map.addLayer(
      {
        id: RTT_REFRESH_LAYER,
        type: 'background',
        layout: { visibility: 'none' },
        paint: { 'background-opacity': 0 },
      },
      map.getStyle().layers[0]?.id,
    );
    // La atribución empieza plegada en el botón ⓘ (en móvil, desplegada tapaba media pantalla).
    container
      .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
      ?.classList.remove('maplibregl-compact-show');
  }

  get instance(): MapLibreMap | null {
    return this.map;
  }

  setProfile(profile: DeviceProfile): void {
    this.profile = profile;
    this.map?.setPixelRatio(profile.pixelRatio);
    this.map?.setTerrain({ source: 'terrain', exaggeration: profile.exaggeration });
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setCameraPadding(padding: PaddingOptions): void {
    this.map?.setPadding(padding);
  }

  goTo(camera: CameraState, opts: { instant?: boolean } = {}): void {
    const map = this.map;
    if (!map) return;
    const from = this.current ?? camera;
    this.current = camera;
    const target = { ...camera, pitch: Math.min(camera.pitch, this.profile.maxPitch) };
    if (opts.instant || this.reducedMotion) {
      map.jumpTo(target);
      return;
    }
    const duration = flightDuration(from, target, this.profile.flightScale);
    if (flightKind(from, target) === 'fly') {
      map.flyTo({ ...target, duration, curve: 1.3, essential: false });
    } else {
      map.easeTo({ ...target, duration, essential: false });
    }
  }

  /** Órbita atada al scroll: el progreso (0..1) viene de ScrollTrigger. */
  orbit(base: CameraState, from: number, to: number, progress: number): void {
    const map = this.map;
    if (!map) return;
    const bearing = orbitBearing(from, to, progress, this.profile.orbitScale);
    this.current = { ...base, bearing };
    map.jumpTo({
      center: base.center,
      zoom: base.zoom,
      pitch: Math.min(base.pitch, this.profile.maxPitch),
      bearing,
    });
  }

  /** Sigue una ruta GeoJSON con el progreso del scroll. */
  async followRoute(routeId: string, base: CameraState, progress: number): Promise<void> {
    const map = this.map;
    if (!map) return;
    const line = await this.loadRoute(routeId);
    if (!line) return;
    const { point, bearing } = pointAlong(line, progress);
    this.current = { ...base, center: point, bearing };
    map.jumpTo({
      center: point,
      zoom: base.zoom,
      pitch: Math.min(base.pitch, this.profile.maxPitch),
      bearing,
    });
  }

  /** Muestra exactamente estas capas narrativas y oculta el resto (con fundido). */
  setVisibleLayers(ids: readonly string[]): void {
    const next = new Set(ids);
    this.setBasemapMode(next.has(PLANO) ? 'plano' : 'paisaje');
    for (const id of new Set([...this.visible, ...next])) {
      const on = next.has(id);
      if (on === this.visible.has(id)) continue;
      this.setLayerOpacity(id, on ? 1 : 0);
    }
    this.visible = next;
  }

  /** Satélite con vías discretas (paisaje) o mapa vectorial de ciudad (plano). */
  setBasemapMode(mode: BasemapMode): void {
    const map = this.map;
    if (!map || !this.modes || mode === this.basemapMode) return;
    this.basemapMode = mode;
    for (const { layer, prop, value } of this.modes[mode]) {
      if (map.getLayer(layer)) map.setPaintProperty(layer, prop as 'line-opacity', value as number);
    }
    this.refreshDraped(LAYER_FADE_MS);
  }

  setLayerOpacity(id: string, value: number): void {
    const map = this.map;
    const entries = narrativeLayerMap[id];
    if (!map || !entries) return; // capa aún no implementada (se añade en F4)
    for (const { layer, props } of entries) {
      if (!map.getLayer(layer)) continue;
      const v = value * (narrativeLayerOpacity[layer] ?? 1);
      for (const p of props) map.setPaintProperty(layer, p as 'line-opacity', v);
    }
    this.refreshDraped(LAYER_FADE_MS);
  }

  /** Rehace las texturas del relieve en cada fotograma durante `ms` (ver RTT_REFRESH_LAYER). */
  private refreshDraped(ms: number): void {
    this.refreshUntil = Math.max(this.refreshUntil, performance.now() + ms);
    if (this.refreshing) return;
    this.refreshing = true;
    let on = false;
    const tick = () => {
      const map = this.map;
      if (!map?.getLayer(RTT_REFRESH_LAYER)) {
        this.refreshing = false;
        return;
      }
      const more = performance.now() < this.refreshUntil;
      // Cada fotograma cambia el estado (cualquiera vale: la capa no pinta nada). El último
      // llega con el fundido ya terminado y deja dibujada la opacidad final.
      on = !on;
      map.setLayoutProperty(RTT_REFRESH_LAYER, 'visibility', on ? 'visible' : 'none');
      if (more) requestAnimationFrame(tick);
      else this.refreshing = false;
    };
    requestAnimationFrame(tick);
  }

  setInteractive(enabled: boolean): void {
    const map = this.map;
    if (!map) return;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.touchZoomRotate,
      map.dragRotate,
      map.doubleClickZoom,
      map.keyboard,
      map.touchPitch,
    ];
    for (const h of handlers) {
      if (enabled) h.enable();
      else h.disable();
    }
    map.getCanvas().tabIndex = enabled ? 0 : -1;
    map.getCanvas().setAttribute('aria-hidden', enabled ? 'false' : 'true');
  }

  /**
   * Precarga de tiles del paso siguiente. Pendiente de F6.1 (rendimiento): por ahora se
   * confía en la precarga propia de MapLibre durante los vuelos.
   */
  prefetch(_camera: CameraState): void {}

  resize(): void {
    this.map?.resize();
  }

  destroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private async loadRoute(id: string): Promise<LngLat[] | null> {
    const cached = this.routes.get(id);
    if (cached) return cached;
    const url = routeSources[id];
    if (!url) return null;
    const res = await fetch(url);
    const fc = (await res.json()) as {
      features: { geometry: { type: string; coordinates: LngLat[] } }[];
    };
    const line = fc.features.find((f) => f.geometry.type === 'LineString')?.geometry.coordinates;
    if (!line) return null;
    this.routes.set(id, line);
    return line;
  }
}
