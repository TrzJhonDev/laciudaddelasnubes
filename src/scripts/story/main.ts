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
        if (self.isActive) setStep(step.chapter, step.id);
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

  // Progreso global para la barra superior (fallback de la animación CSS).
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => $narrative.setKey('progress', self.progress),
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
      isDesktop: '(min-width: 1024px)',
      isTablet: '(min-width: 768px) and (max-width: 1023px)',
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
            ? { top: 0, bottom: 0, left: Math.min(w * 0.38, 520), right: 80 }
            : c['isTablet']
              ? { top: 0, bottom: h * 0.3, left: 0, right: 0 }
              : { top: 0, bottom: h * 0.45, left: 0, right: 0 },
      );
      controller?.resize();
    },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controller?.pause();
  });
}
