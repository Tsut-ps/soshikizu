/* Motion を使うアニメーション。動きを減らす設定のときは、何もせずに最後の状態にする */
import { animate, type AnimationPlaybackControls, type DOMKeyframesDefinition } from 'motion';

export const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Targets = Element | Element[] | NodeListOf<Element> | HTMLCollection;

/** 要素を動かす。動きを減らす設定なら null を返す */
export function play(
  targets: Targets,
  keyframes: DOMKeyframesDefinition,
  options?: Parameters<typeof animate>[2],
): AnimationPlaybackControls | null {
  if (prefersReducedMotion) return null;
  return animate(targets as Element[], keyframes, options as never);
}

/** 動きが終わってから fn を呼ぶ（動きがなければすぐに呼ぶ） */
export function afterPlay(controls: AnimationPlaybackControls | null, fn: () => void) {
  if (!controls) return fn();
  controls.finished.then(fn, fn);
}

/** 数字を前の値から数え上げる */
export function countTo(el: HTMLElement & { _count?: AnimationPlaybackControls }, to: number) {
  const from = Number(el.textContent) || 0;
  el._count?.stop();
  if (prefersReducedMotion || from === to) {
    el.textContent = String(to);
    return;
  }
  el._count = animate(from, to, { duration: 0.45, onUpdate: v => (el.textContent = String(Math.round(v))) });
}
