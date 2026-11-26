import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Portada (§3, Intro): título que aparece letra por letra (por palabras en móvil, §9.6),
 * capas de neblina que se disipan con el scroll e indicador "Desliza".
 */
export function initIntro(opts: { mobile: boolean }): void {
  const hero = document.querySelector<HTMLElement>('.story-hero');
  const title = hero?.querySelector<HTMLElement>('[data-split]');
  if (!hero || !title) return;

  const split = SplitText.create(title, {
    type: opts.mobile ? 'words' : 'chars,words',
    aria: 'auto',
  });
  const targets = opts.mobile ? split.words : split.chars;
  gsap.from(targets, {
    opacity: 0,
    yPercent: 60,
    filter: 'blur(6px)',
    duration: 0.9,
    ease: 'power3.out',
    stagger: opts.mobile ? 0.08 : 0.035,
    delay: 0.15,
  });
  gsap.from(hero.querySelectorAll('[data-intro-fade]'), {
    opacity: 0,
    y: 12,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.6,
  });

  // Neblina: cada capa se desplaza y se desvanece a distinto ritmo (1 capa en móvil).
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
