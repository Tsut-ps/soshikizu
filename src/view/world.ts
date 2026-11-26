/*
 * キャンバスの中身（ワールド）。計画（plan）に合わせて部品をそろえ、配置を計算し、
 * ばねで動かしながら毎フレーム部品を置き直して線を引く。
 */
import { WORK_COLOR, type WorkId } from '../data/constants';
import { isHeadKey, KEY, unitKeyOf } from '../keys';
import type { Plan } from '../plan';
import { afterPlay, play, prefersReducedMotion } from './animation';
import {
  createBlockElement,
  createCard,
  fillBlockElement,
  fillCard,
  fillPartnersElement,
  type CardSpec,
} from './cards';
import { byId } from './dom';
import { paintCards, paintTracks } from './highlight';
import {
  blockWidth,
  computeLayout,
  MANAGEMENT_CARD_WIDTH,
  ROW_HEADER_WIDTH,
  type Box,
  type Guides,
} from './layout';
import { SpringBoxes } from './spring';
import { drawTracks, markerDefs, type DrawnLeg, type TrackLayers } from './tracks';

export const worldEl = byId('world');
const tracksSvg = byId<SVGSVGElement>('tracks');
const backSvg = byId<SVGSVGElement>('tracks-back');
const layers: TrackLayers = {
  front: byId<SVGGElement>('track-layer'),
  back: byId<SVGGElement>('back-layer'),
};
byId<SVGDefsElement>('markers').innerHTML = markerDefs();

/** いま表示している計画と、引いた線の記録 */
export const scene = {
  plan: null as Plan | null,
  guides: null as Guides | null,
  drawnLegs: [] as DrawnLeg[],
  size: { w: 800, h: 600 },
};

/** ワールドに直接置く部品（キー → 要素） */
export const items = new Map<string, HTMLElement>();
/** 新しく出たばかりで、まだフェードインしていない部品 */
const freshItems = new Set<string>();
/** 上段の担当者のカード（キー 'hd:…' → 要素）。毎フレーム探さずに済むように持っておく */
let headCards = new Map<string, HTMLElement>();

let onHoverWork: (work: WorkId | null) => void = () => {};
/** 作品の行の見出しにカーソルが乗ったとき・離れたときに呼ぶ関数を決める */
export function setHoverHandler(fn: (work: WorkId | null) => void) {
  onHoverWork = fn;
}

const spring = new SpringBoxes(redraw);

/** 部品を置き直し、線を引き直す（ばねが動くたびに呼ばれる） */
function redraw() {
  const { plan, guides } = scene;
  if (!plan || !guides) return;
  for (const key in spring.current) {
    try {
      placeItem(key, spring.current[key]);
    } catch (err) {
      console.error(err);
    }
  }
  try {
    scene.drawnLegs = drawTracks(plan, spring.current, guides, layers);
    paintTracks(layers, plan, scene.drawnLegs);
  } catch (err) {
    console.error(err);
  }
}

/** 部署のかたまりの上段の要素（毎フレーム探さずに済むよう覚えておく） */
const headsBoxes = new WeakMap<HTMLElement, HTMLElement>();
function headsBoxOf(block: HTMLElement): HTMLElement {
  let box = headsBoxes.get(block);
  if (!box) headsBoxes.set(block, (box = block.querySelector<HTMLElement>('.block-heads')!));
  return box;
}

function placeItem(key: string, box: Box) {
  if (isHeadKey(key)) {
    const card = headCards.get(key);
    if (!card) return;
    card.style.top = box.y + 'px';
    card.style.minHeight = box.h + 'px';
    card.style.background = box.bands || '';
    return;
  }
  const el = items.get(key);
  if (!el) return;
  el.style.transform = `translate(${box.x}px,${box.y}px)`;
  if (key === KEY.wall) {
    el.style.width = box.w + 'px';
    el.style.height = box.h + 'px';
  }
  if (box.headsHeight != null) headsBoxOf(el).style.height = box.headsHeight + 'px';
}

/** 計画に合わせて部品をそろえる（足りないものは作り、いらないものは消す） */
function syncItems(plan: Plan, people: number) {
  const kept = new Set<string>();
  const ensure = (key: string, create: () => HTMLElement) => {
    let el = items.get(key);
    if (!el) {
      el = create();
      el.dataset.key = key;
      el.classList.add('item');
      worldEl.insertBefore(el, tracksSvg);
      items.set(key, el);
      freshItems.add(key);
    }
    kept.add(key);
    return el;
  };
  const isFresh = (key: string) => freshItems.has(key);
  const withHover = (el: HTMLElement) => {
    el.addEventListener('pointerenter', () => onHoverWork((el.dataset.work as WorkId) || null));
    el.addEventListener('pointerleave', () => onHoverWork(null));
    return el;
  };
  const placeCard = (key: string, spec: CardSpec, width: number, hover = false) => {
    const card = ensure(key, () => (hover ? withHover(createCard(spec)) : createCard(spec)));
    fillCard(card, spec, isFresh(key), ['item']);
    card.style.width = width + 'px';
    return card;
  };

  const wall = ensure(KEY.wall, () => {
    const el = document.createElement('div');
    el.className = 'wall';
    el.innerHTML = '<span class="wall-tag"></span>';
    return el;
  });
  wall.querySelector('.wall-tag')!.textContent = `社内 ${people}人`;

  if (plan.clientsOutside) {
    const label = ensure(KEY.clientsLabel, () => {
      const el = document.createElement('div');
      el.className = 'outside-label';
      return el;
    });
    label.textContent = '発注元（社外）';
  }
  for (const unit of plan.management) placeCard(KEY.management(unit.key), unit, MANAGEMENT_CARD_WIDTH);
  for (const row of plan.rows) {
    const card = placeCard(KEY.row(row.work), row.card, ROW_HEADER_WIDTH, true);
    // 行の見出しは、中身が何であっても行の作品の色にする
    card.dataset.work = row.work;
    card.style.setProperty('--work-color', WORK_COLOR[row.work]);
  }
  for (const client of plan.clientCards) placeCard(KEY.client(client.work), client, ROW_HEADER_WIDTH, true);
  for (const block of plan.blocks) {
    const el = ensure(block.key, createBlockElement);
    fillBlockElement(el, block, isFresh(block.key));
    el.style.width = blockWidth(block) + 'px';
  }
  if (plan.partners.length) {
    const el = ensure(KEY.partners, createBlockElement);
    fillPartnersElement(el, plan.partners);
    el.style.width = blockWidth(null) + 'px';
  }

  items.forEach((el, key) => {
    if (kept.has(key)) return;
    items.delete(key);
    freshItems.delete(key);
    afterPlay(play(el, { opacity: 0 }, { duration: 0.2 }), () => el.remove());
  });

  headCards = new Map();
  worldEl
    .querySelectorAll<HTMLElement>('.block-heads > .card')
    .forEach(card => headCards.set(KEY.head(card.dataset.key!), card));
}

/** 配置を計算し直して、新しい位置へ動かす */
export function relayout() {
  const plan = scene.plan;
  if (!plan) return;
  const layout = computeLayout(plan, items);
  scene.guides = layout.guides;
  scene.size = layout.world;
  worldEl.style.width = layout.world.w + 'px';
  worldEl.style.height = layout.world.h + 'px';
  for (const svg of [tracksSvg, backSvg]) {
    svg.setAttribute('width', String(layout.world.w));
    svg.setAttribute('height', String(layout.world.h));
  }
  for (const key in layout.boxes) {
    if (!freshItems.has(key)) continue;
    freshItems.delete(key);
    if (!prefersReducedMotion) play(items.get(key)!, { opacity: [0, 1] }, { duration: 0.4, delay: 0.1 });
  }
  spring.moveTo(layout.boxes);
}

/** 新しい計画を表示する */
export function showPlan(plan: Plan, people: number) {
  scene.plan = plan;
  syncItems(plan, people);
  relayout();
  paintCards(worldEl);
}

/** 表示の状態が変わったときに、線とカードの強調を塗り直す */
export function repaint() {
  if (scene.plan) paintTracks(layers, scene.plan, scene.drawnLegs);
  paintCards(worldEl);
}

/** 選択や移動で、キーからカード（または社外の箱）の要素を探す */
export function elementOf(key: string): HTMLElement | null {
  if (isHeadKey(key)) return headCards.get(key) ?? null;
  if (key.startsWith('pl:')) {
    return worldEl.querySelector<HTMLElement>(
      `.block-pool > .card[data-key="${CSS.escape(unitKeyOf(key))}"]`,
    );
  }
  return items.get(key) ?? null;
}
