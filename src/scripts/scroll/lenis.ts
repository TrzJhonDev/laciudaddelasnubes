import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/** Scroll suave sincronizado con ScrollTrigger (§6.6). Con movimiento reducido, scroll nativo. */
export function initSmoothScroll(reducedMotion: boolean): Lenis | null {
  if (reducedMotion) return null;
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Pausar cuando la pestaña no se ve (§10.2).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lenis.stop();
    else lenis.start();
  });
  return lenis;
}
