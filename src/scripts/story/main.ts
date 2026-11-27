/**
 * Punto de entrada de la experiencia (§6.2):
 * scroll → ScrollTrigger → narrativeStore → MapController (o LiteView en modo lite).
 * El mapa (MapLibre) se carga de forma diferida para no bloquear la primera vista (§10.2).
 * En modo lite (§6.3) MapLibre ni siquiera se descarga.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { PaddingOptions } from 'maplibre-gl';
import { LiteView } from '../lite/LiteView';
import { type CameraState, resolveCamera } from '../map/camera';
import type { MapController } from '../map/MapController';
import { initSmoothScroll } from '../scroll/lenis';
import { $mode, $narrative, setStep } from '../store/narrative';
import {
  currentViewport,
  type DeviceProfile,
  detectWebGL2,
  deviceProfile,
  isConstrained,
} from '../utils/device';
import { decideMode, type MapMode, saveChoice, storedChoice, urlChoice } from '../utils/map-mode';
import { prefersReducedMotion, safeStorage } from '../utils/motion';
import { resolveLiteKey, type StoryData, type StoryStep } from './data';

gsap.registerPlugin(ScrollTrigger);

let playCountersOnActive: ((scope: HTMLElement) => void) | null = null;

const dataEl = document.getElementById('story-data');
const mapEl = document.getElementById('story-map');
if (dataEl && mapEl) void start(JSON.parse(dataEl.textContent ?? '{}') as StoryData, mapEl);

/**
 * Espera a que el usuario empiece a recorrer la historia. En escritorio basta con que el
 * navegador quede libre; en móvil, arrancar MapLibre cuesta varios segundos de CPU y
 * bloquearía la portada, así que se espera al primer gesto.
 */
function firstInteraction(mobile: boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (window.scrollY > 0) go();
    for (const ev of ['scroll', 'touchstart', 'keydown', 'wheel'] as const) {
      window.addEventListener(ev, go, { once: true, passive: true });
    }
    if (!mobile) {
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 600);
    }
  });
}

async function start(data: StoryData, mapEl: HTMLElement) {
  const root = document.documentElement;
  const reduced = prefersReducedMotion();
  let profile: DeviceProfile = deviceProfile(currentViewport());
  const isMobile = () => profile.kind === 'mobile' || profile.kind === 'landscape-phone';
  const cameraOf = (step: StoryStep): CameraState =>
    resolveCamera(step.camera, { mobile: isMobile(), maxPitch: profile.maxPitch });

  const stepById = new Map(data.steps.map((s) => [s.id, s]));
  const stepIndex = new Map(data.steps.map((s, i) => [s.id, i]));
  const liteReady = new Set(data.liteReady);
  let controller: MapController | null = null;
  let padding: PaddingOptions | null = null;

  const canRenderMap = detectWebGL2();
  let mode: MapMode = decideMode({
    canRenderMap,
    url: urlChoice(window.location.search),
    stored: storedChoice(safeStorage()),
    constrained: isConstrained(),
  });
  const liteRoot = document.querySelector<HTMLElement>('[data-lite]');
  const liteView = liteRoot ? new LiteView(liteRoot) : null;
  const toggle = document.querySelector<HTMLButtonElement>('[data-map-toggle]');
  const syncToggle = () => toggle?.setAttribute('aria-pressed', String(mode === 'lite'));

  if (import.meta.env.DEV) {
    // Lo usa scripts/gen-lite.mjs para colocar la cámara de cada paso y capturarla.
    (window as unknown as { __story: unknown }).__story = {
      get controller() {
        return controller;
      },
      cameraOf,
      data,
    };
  }

  initSmoothScroll(reduced);

  // Con movimiento reducido no se ocultan elementos para animarlos: todo se ve en su estado final.
  if (!reduced) {
    root.dataset['anim'] = '';
    const [{ initIntro }, { playCounters }] = await Promise.all([
      import('../anim/intro'),
      import('../anim/counters'),
    ]);
    initIntro({ mobile: isMobile() });
    playCountersOnActive = playCounters;
    // Galerías fijadas solo en escritorio; en móvil, swipe nativo (§9.6).
    if (document.querySelector('[data-gallery]')) {
      const { initGalleries } = await import('../anim/gallery');
      gsap.matchMedia().add('(min-width: 1024px)', () => initGalleries());
    }
  }

  // Pasos → store. Funciona aunque el mapa todavía no exista.
  for (const el of document.querySelectorAll<HTMLElement>('[data-step]')) {
    const step = stepById.get(el.dataset['step'] ?? '');
    if (!step) continue;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 65%',
      end: 'bottom 35%',
      onToggle: (self) => {
        el.classList.toggle('is-active', self.isActive);
        if (!self.isActive) return;
        setStep(step.chapter, step.id);
        playCountersOnActive?.(el);
      },
      onUpdate: (self) => {
        if (!controller || !self.isActive) return;
        if (step.orbit && !reduced) {
          controller.orbit(cameraOf(step), step.orbit.from, step.orbit.to, self.progress);
        } else if (step.route && !reduced) {
          void controller.followRoute(step.route, cameraOf(step), self.progress);
        }
      },
    });
  }

  // Progreso global; también alimenta la barra superior donde no hay CSS scroll-driven.
  const bar = document.querySelector<HTMLElement>('.progress');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      $narrative.setKey('progress', self.progress);
      bar?.style.setProperty('--progress', self.progress.toFixed(4));
    },
  });

  /** Captura del paso actual (o del primero, en la portada) y precarga de la siguiente. */
  const showLite = () => {
    const id = $narrative.get().step || data.steps[0]?.id || '';
    void liteView?.show(resolveLiteKey(data.steps, id, liteReady));
    const next = data.steps[(stepIndex.get(id) ?? 0) + 1];
    if (next) liteView?.prefetch(resolveLiteKey(data.steps, next.id, liteReady));
  };

  // Cambios de paso → cámara y capas (mapa vivo) o captura (lite).
  $narrative.listen((state, _old, changedKey) => {
    if (changedKey !== 'step') return;
    if (mode === 'lite') {
      showLite();
      return;
    }
    const step = stepById.get(state.step);
    if (!controller || !step) return;
    controller.setVisibleLayers(step.layers);
    if (!step.orbit && !step.route) controller.goTo(cameraOf(step));
  });

  // Padding de cámara para que la tarjeta de texto no tape el punto de interés (§9.4).
  gsap.matchMedia().add(
    {
      // Deben coincidir con las media queries de story.css.
      isDesktop:
        '(min-width: 1024px), (min-width: 768px) and (orientation: landscape) and (min-height: 501px)',
      isTablet: '(min-width: 768px) and (max-width: 1023px) and (orientation: portrait)',
      // Sin esta condición, gsap.matchMedia no ejecuta el callback en móvil.
      isMobile: '(max-width: 767px)',
      isLandscapePhone: '(orientation: landscape) and (max-height: 500px)',
    },
    (ctx) => {
      const c = ctx.conditions ?? {};
      const w = window.innerWidth;
      const h = window.innerHeight;
      profile = deviceProfile(currentViewport());
      padding = c['isLandscapePhone']
        ? { top: 0, bottom: 0, left: 0, right: w * 0.45 }
        : c['isDesktop']
          ? // columna de texto (clamp(300px, 38vw, 520px)) + su margen izquierdo (4vw)
            {
              top: 0,
              bottom: 0,
              left: Math.min(Math.max(300, w * 0.38), 520) + w * 0.04,
              right: 40,
            }
          : c['isTablet']
            ? { top: 0, bottom: h * 0.5, left: 0, right: 0 }
            : { top: 0, bottom: h * 0.45, left: 0, right: 0 };
      controller?.setProfile(profile);
      controller?.setCameraPadding(padding);
      controller?.resize();
    },
  );

  // Con la pestaña oculta el navegador ya deja de dibujar; no se detiene el mapa (eso cortaba
  // los vuelos a medias). Al volver, la cámara se coloca en el paso actual sin animación.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !controller) return;
    const step = stepById.get($narrative.get().step);
    if (step && !step.orbit && !step.route) controller.goTo(cameraOf(step), { instant: true });
  });

  /** Cada cambio de modo invalida las cargas del mapa que estén a medias. */
  let loadTicket = 0;

  const enterLite = () => {
    mode = 'lite';
    loadTicket++;
    controller?.destroy();
    controller = null;
    $mode.set('lite');
    root.dataset['mapMode'] = 'lite';
    syncToggle();
    showLite();
  };

  const enterLive = async (deferred: boolean) => {
    mode = 'live';
    const ticket = ++loadTicket;
    liteView?.clear();
    $mode.set('story');
    delete root.dataset['mapMode'];
    syncToggle();
    if (deferred) await firstInteraction(isMobile());
    if (ticket !== loadTicket) return;
    const { MapController } = await import('../map/MapController');
    if (ticket !== loadTicket) return;
    const startStep = stepById.get($narrative.get().step);
    const ctrl = new MapController({ profile, reducedMotion: reduced });
    try {
      await ctrl.init(
        mapEl,
        startStep
          ? cameraOf(startStep)
          : resolveCamera(data.initial, { mobile: isMobile(), maxPitch: profile.maxPitch }),
      );
    } catch (err) {
      ctrl.destroy();
      if (ticket !== loadTicket) return;
      console.error('[mapa] no se pudo iniciar; se usa el modo lite', err);
      enterLite();
      return;
    }
    if (ticket !== loadTicket) {
      ctrl.destroy();
      return;
    }
    controller = ctrl;
    if (padding) ctrl.setCameraPadding(padding);
    ctrl.resize();
    // El paso puede haber cambiado mientras cargaba el mapa.
    const step = stepById.get($narrative.get().step);
    if (step) {
      ctrl.setVisibleLayers(step.layers);
      if (!step.orbit && !step.route) ctrl.goTo(cameraOf(step), { instant: true });
    }
    root.dataset['mapMode'] = 'live';
  };

  // Sin WebGL2 el modo lite es obligatorio: el botón no se muestra.
  if (toggle && canRenderMap) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const next: MapMode = mode === 'lite' ? 'live' : 'lite';
      saveChoice(next, safeStorage());
      if (next === 'lite') enterLite();
      else void enterLive(false);
    });
  }

  if (mode === 'lite') enterLite();
  else await enterLive(true);
}
