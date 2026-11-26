import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Galerías horizontales fijadas al scroll en escritorio (§9.5–9.6). En móvil y con
 * movimiento reducido no se llama: queda el desplazamiento nativo con scroll-snap.
 */
export function initGalleries(): () => void {
  const cleanups: (() => void)[] = [];
  for (const section of document.querySelectorAll<HTMLElement>('.story [data-gallery]')) {
    const track = section.querySelector<HTMLElement>('[data-gallery-track]');
    if (!track) continue;
    section.classList.add('is-pinned');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
    cleanups.push(() => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'transform' });
      section.classList.remove('is-pinned');
    });
  }
  return () => {
    for (const c of cleanups) c();
  };
}
