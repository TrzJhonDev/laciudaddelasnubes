/**
 * Modo lite (§6.3): en lugar del mapa vivo, una captura estática por vista, generada con
 * `pnpm lite` (scripts/gen-lite.mjs). Dos marcos se alternan con un fundido; solo se descarga
 * la captura del paso actual y la del siguiente.
 *
 * Cada captura existe en dos encuadres: `ancho` (texto a la izquierda: escritorio y teléfono
 * apaisado) y `alto` (texto abajo: móvil y tablet en vertical); y en AVIF con JPEG de reserva.
 */
export const LITE_BASE = '/lite';

/** Debe coincidir con el layout vertical de story.css (tarjeta abajo). */
const PORTRAIT_MEDIA = '(max-width: 1023px) and (orientation: portrait)';

export function litePicture(key: string, doc: Document = document): HTMLPictureElement {
  const pic = doc.createElement('picture');
  const sources: [string, string, string | null][] = [
    ['alto', 'avif', PORTRAIT_MEDIA],
    ['ancho', 'avif', null],
    ['alto', 'jpg', PORTRAIT_MEDIA],
  ];
  for (const [frame, ext, media] of sources) {
    const s = doc.createElement('source');
    s.srcset = `${LITE_BASE}/${key}-${frame}.${ext}`;
    if (ext === 'avif') s.type = 'image/avif';
    if (media) s.media = media;
    pic.append(s);
  }
  const img = doc.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  img.src = `${LITE_BASE}/${key}-ancho.jpg`;
  pic.append(img);
  return pic;
}

export class LiteView {
  private frames: HTMLElement[];
  private prefetchSlot: HTMLElement | null;
  private active = 0;
  private shown: string | null = null;
  private prefetched: string | null = null;
  /** Solo la última petición de `show` llega a pintarse. */
  private ticket = 0;

  constructor(root: HTMLElement) {
    this.frames = [...root.querySelectorAll<HTMLElement>('[data-lite-frame]')];
    this.prefetchSlot = root.querySelector<HTMLElement>('[data-lite-prefetch]');
  }

  async show(key: string | null): Promise<void> {
    if (!key || key === this.shown) return;
    const ticket = ++this.ticket;
    const next = this.frames[1 - this.active];
    const current = this.frames[this.active];
    if (!next || !current) return;
    const pic = litePicture(key);
    next.replaceChildren(pic);
    const img = pic.querySelector('img');
    try {
      await img?.decode();
    } catch {
      return; // captura ausente o rota: se queda la anterior
    }
    if (ticket !== this.ticket) return;
    next.classList.add('is-visible');
    current.classList.remove('is-visible');
    this.active = 1 - this.active;
    this.shown = key;
  }

  /** Descarga la captura del paso siguiente sin mostrarla. */
  prefetch(key: string | null): void {
    if (!key || key === this.shown || key === this.prefetched || !this.prefetchSlot) return;
    this.prefetched = key;
    this.prefetchSlot.replaceChildren(litePicture(key));
  }

  clear(): void {
    this.ticket++;
    this.shown = null;
    this.prefetched = null;
    for (const f of this.frames) {
      f.classList.remove('is-visible');
      f.replaceChildren();
    }
    this.prefetchSlot?.replaceChildren();
  }
}
