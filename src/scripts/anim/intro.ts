import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Portada (§3, Intro). El título se anima solo con CSS (story.css, `.hero-title`) para que
 * aparezca en el primer pintado sin esperar al JavaScript: es el elemento LCP de la página.
 * Aquí solo van las animaciones ligadas al scroll: la neblina que se disipa (una capa en
 * móvil, §9.6) y el indicador "Desliza".
 */
export function initIntro(opts: { mobile: boolean }): void {
  const hero = document.querySelector<HTMLElement>('.story-hero');
  if (!hero) return;

  const layers = hero.querySelectorAll<HTMLElement>('[data-mist]');
  layers.forEach((layer, i) => {
    if (opts.mobile && i > 0) {
      layer.hidden = true;
      return;
    }
    gsap.to(layer, {
      opacity: 0,
      xPercent: i % 2 ? 12 : -12,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  });

  gsap.to(hero.querySelector('[data-scroll-hint]'), {
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: '25% top', scrub: true },
  });
}
