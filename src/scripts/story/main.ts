/**
 * Punto de entrada de la experiencia (§6.2):
 * scroll → ScrollTrigger → narrativeStore → MapController.
 * El mapa (MapLibre) se carga de forma diferida para no bloquear la primera vista (§10.2).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { type CameraState, resolveCamera } from '../map/camera';
import type { MapController } from '../map/MapController';
import { initSmoothScroll } from '../scroll/lenis';
import { $mode, $narrative, setStep } from '../store/narrative';
import { currentViewport, type DeviceProfile, deviceProfile, shouldUseLite } from '../utils/device';
import { prefersReducedMotion } from '../utils/motion';
import type { StoryData, StoryStep } from './data';

gsap.registerPlugin(ScrollTrigger);

let playCountersOnActive: ((scope: HTMLElement) => void) | null = null;

const dataEl = document.getElementById('story-data');
const mapEl = document.getElementById('story-map');
if (dataEl && mapEl) void start(JSON.parse(dataEl.textContent ?? '{}') as StoryData, mapEl);

async function start(data: StoryData, mapEl: HTMLElement) {
  const reduced = prefersReducedMotion();
  let profile: DeviceProfile = deviceProfile(currentViewport());
  const isMobile = () => profile.kind === 'mobile' || profile.kind === 'landscape-phone';
  const cameraOf = (step: StoryStep): CameraState =>
    resolveCamera(step.camera, { mobile: isMobile(), maxPitch: profile.maxPitch });

  const stepById = new Map(data.steps.map((s) => [s.id, s]));
  let controller: MapController | null = null;

  const lite = shouldUseLite();
  if (lite) {
    $mode.set('lite');
    document.documentElement.dataset.mapMode = 'lite';
  }

  initSmoothScroll(reduced);

  // Con movimiento reducido no se ocultan elementos para animarlos: todo se ve en su estado final.
  if (!reduced) {
    document.documentElement.dataset.anim = '';
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
    const step = stepById.get(el.dataset.step ?? '');
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

  if (lite) return;

  // Carga diferida del mapa: cuando el navegador esté libre o al primer scroll.
  await new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 600);
    window.addEventListener('scroll', go, { once: true, passive: true });
  });

  const { MapController } = await import('../map/MapController');
  const initialStep = stepById.get($narrative.get().step);
  controller = new MapController({ profile, reducedMotion: reduced });
  if (import.meta.env.DEV) (window as unknown as { __story: unknown }).__story = { controller };
  try {
    await controller.init(
      mapEl,
      initialStep
        ? cameraOf(initialStep)
        : resolveCamera(data.initial, { mobile: isMobile(), maxPitch: profile.maxPitch }),
    );
  } catch (err) {
    console.error('[mapa] no se pudo iniciar; se usa el modo lite', err);
    $mode.set('lite');
    document.documentElement.dataset.mapMode = 'lite';
    return;
  }
  document.documentElement.dataset.mapMode = 'live';
  if (initialStep) controller.setVisibleLayers(initialStep.layers);

  // Cambios de paso → cámara y capas.
  $narrative.listen((state, _old, changedKey) => {
    if (changedKey !== 'step' || !controller) return;
    const step = stepById.get(state.step);
    if (!step) return;
    controller.setVisibleLayers(step.layers);
    if (!step.orbit && !step.route) controller.goTo(cameraOf(step));
  });

  // Padding de cámara para que la tarjeta de texto no tape el punto de interés (§9.4).
  const mm = gsap.matchMedia();
  mm.add(
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
      controller?.setProfile(profile);
      controller?.setCameraPadding(
        c['isLandscapePhone']
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
              : { top: 0, bottom: h * 0.45, left: 0, right: 0 },
      );
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
}
