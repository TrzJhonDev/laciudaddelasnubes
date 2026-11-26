import { gsap } from 'gsap';
import { formatNumber } from '../utils/format';

const done = new WeakSet<HTMLElement>();

/**
 * Anima los contadores de un paso la primera vez que se activa (§4.4: 1.2–2 s, power2.out).
 * El valor final ya está en el HTML; si se interrumpe, queda el valor correcto.
 */
export function playCounters(scope: HTMLElement): void {
  for (const el of scope.querySelectorAll<HTMLElement>('[data-counter]')) {
    if (done.has(el)) continue;
    done.add(el);
    const out = el.querySelector<HTMLElement>('[data-counter-value]');
    const to = Number(el.dataset['to']);
    const from = Number(el.dataset['from'] ?? 0);
    if (!out || !Number.isFinite(to)) continue;
    const state = { v: from };
    gsap.to(state, {
      v: to,
      duration: to > 10_000 ? 2 : 1.4,
      ease: 'power2.out',
      onUpdate: () => {
        out.textContent = formatNumber(Math.round(state.v));
      },
      onComplete: () => {
        out.textContent = formatNumber(to);
      },
    });
  }
}
