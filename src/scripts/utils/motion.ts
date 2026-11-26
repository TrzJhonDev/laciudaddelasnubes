/**
 * Preferencia de movimiento: combina `prefers-reduced-motion` del sistema
 * con la elección manual guardada por MotionToggle (`data-motion="reduce"`).
 */
export function prefersReducedMotion(
  win: Pick<Window, 'matchMedia'> = window,
  root: Pick<HTMLElement, 'dataset'> = document.documentElement,
): boolean {
  if (root.dataset['motion'] === 'reduce') return true;
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Guarda o borra la preferencia manual. Tolera storage bloqueado. */
export function setMotionPreference(
  reduce: boolean,
  root: Pick<HTMLElement, 'dataset'> = document.documentElement,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage(),
): void {
  if (reduce) root.dataset['motion'] = 'reduce';
  else delete root.dataset['motion'];
  try {
    if (reduce) storage?.setItem('motion', 'reduce');
    else storage?.removeItem('motion');
  } catch {
    // modo privado o almacenamiento bloqueado: la preferencia dura solo esta visita
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
