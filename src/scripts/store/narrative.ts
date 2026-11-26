import { atom, map } from 'nanostores';

export type AppMode = 'story' | 'explore' | 'lite';

/** Estado global de la narrativa (§6.1). */
export const $narrative = map({
  chapter: '' as string,
  step: '' as string,
  /** Progreso global del scroll, 0..1. */
  progress: 0,
});

export const $mode = atom<AppMode>('story');

export function setStep(chapter: string, step: string): void {
  const cur = $narrative.get();
  if (cur.chapter === chapter && cur.step === step) return;
  $narrative.setKey('chapter', chapter);
  $narrative.setKey('step', step);
}
