/*
 * 強調表示。表示の状態（state.ts）に合わせて、線とカードを隠す・薄くする・選択の枠をつける。
 * - 凡例の「発注」「指示」で消した種類の線は隠す（off）
 * - 作品の行の見出しを選ぶか、作品にカーソルが乗ったら、その作品以外の線とカードを薄くする（dim）
 * - ほかのカードを選んだら、そのカードに関係しない線を薄くする（dim）
 */
import { isHeadKey, isPoolKey, keyOfCard, unitKeyOf, workOfKey } from '../keys';
import type { Plan } from '../plan';
import { view } from '../state';
import type { DrawnLeg, TrackLayers } from './tracks';

const flowVisible = (flow: string | undefined) =>
  flow === 'instruct' ? view.showInstruct : flow === 'order' ? view.showOrder : true;

/** 選んでいるカードがいる部署のかたまり（上段・下段のカードのとき） */
export function selectedBlock(plan: Plan): string | null {
  const key = view.selected;
  if (!key) return null;
  if (isHeadKey(key)) return plan.blockOfHead[unitKeyOf(key)];
  if (isPoolKey(key)) return plan.blocks.find(b => b.pool.some(u => u.key === unitKeyOf(key)))?.key ?? null;
  return null;
}

/** いま強調している作品：カーソルが乗った作品、なければ選んでいる行の見出しの作品 */
const focusedWork = () => view.hoveredWork || workOfKey(view.selected);

export function paintTracks(layers: TrackLayers, plan: Plan, drawnLegs: DrawnLeg[]) {
  const selected = view.selected;
  const block = selected ? selectedBlock(plan) : null;
  const focus = focusedWork();
  const selectingWork = !!workOfKey(selected);
  const touchesSelected = (legIndex: string) => {
    const leg = drawnLegs[Number(legIndex)];
    return !!leg && (leg.from === selected || leg.to.includes(selected!));
  };
  for (const el of [...layers.front.children, ...layers.back.children] as SVGElement[]) {
    const { flow, work, leg, block: inBlock } = el.dataset;
    el.classList.toggle('off', !!flow && !flowVisible(flow));
    let dim = !!focus && !!work && work !== focus;
    if (selected && !selectingWork) {
      dim = leg != null ? !touchesSelected(leg) : inBlock != null ? inBlock !== block : true;
    }
    el.classList.toggle('dim', dim);
  }
}

export function paintCards(world: HTMLElement) {
  const focusWork = focusedWork();
  world.querySelectorAll<HTMLElement>('.card').forEach(card => {
    card.classList.toggle('dim', !!focusWork && !!card.dataset.work && card.dataset.work !== focusWork);
    const selected = !!view.selected && keyOfCard(card) === view.selected;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
}
