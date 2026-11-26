/*
 * アニメスタジオの組織図。人数を変えると、その規模の体制を路線図のように描き直す。
 *
 * 流れ：人数 → organize()（体制）→ buildPlan()（路線図の形）→ showPlan()（配置・線・アニメーション）
 */
import './styles/page.css';
import './styles/chart.css';
import { MAX_PEOPLE, type WorkId } from './data/constants';
import { STAGES } from './data/stages';
import type { Sourcing } from './data/variants';
import { keyOfCard } from './keys';
import { organize } from './model';
import { buildPlan } from './plan';
import { clampPeople, peopleAt, SLIDER_STEPS } from './slider-scale';
import { view } from './state';
import { bindCameraControls, bringIntoView, canvas, fitView, wasDragged, zoomAt } from './view/camera';
import { byId } from './view/dom';
import { bindFlowToggles } from './view/flow';
import { buildStaticPanels, isSidePanelOpen, renderPanels, setSidePanelOpen } from './view/panel';
import { bindSelectionPanel, clearSelection, renderSelection, select } from './view/selection';
import { relayout, repaint, setHoverHandler, showPlan, worldEl } from './view/world';

/** 最後に見ていた人数と体制の型を覚えておく（この端末のブラウザの中だけ） */
const STORAGE_KEY = 'anime-org-n';
const SOURCING_KEY = 'anime-org-sourcing';
const SOURCINGS: Sourcing[] = ['outsource', 'basic', 'inhouse'];

let people = 20;
let sourcing: Sourcing = 'basic';
let renderQueued = 0;
/** いま見せている形（段階と型）。変わったら全体を見せ直す */
let shownShapeKey = '';
let fittedOnce = false;

function loadSaved() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= 1 && saved <= MAX_PEOPLE) people = saved;
    const savedSourcing = localStorage.getItem(SOURCING_KEY) as Sourcing | null;
    if (savedSourcing && SOURCINGS.includes(savedSourcing)) sourcing = savedSourcing;
  } catch {
    /* 保存できない環境では使わない */
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, String(people));
    localStorage.setItem(SOURCING_KEY, sourcing);
  } catch {
    /* 保存できない環境では使わない */
  }
}

function render() {
  const org = organize(people, sourcing);
  renderPanels(org);
  showPlan(buildPlan(org), people);
  // 段階や型が変わって形が変わったら（最初の表示も含む）、幅に合わせて見せ直す
  const shapeKey = `${org.stageIndex}:${org.hasVariant ? sourcing : 'basic'}`;
  if (shapeKey !== shownShapeKey) {
    fitView(fittedOnce, 'width');
    fittedOnce = true;
    shownShapeKey = shapeKey;
  }
  renderSelection();
  save();
}

/** 次のフレームで1回だけ描き直す（スライダーのドラッグ中に溜めない） */
function queueRender() {
  if (renderQueued) return;
  renderQueued = requestAnimationFrame(() => {
    renderQueued = 0;
    render();
  });
}

/** 体制の型を変える */
function setSourcing(next: Sourcing) {
  if (next === sourcing) return;
  sourcing = next;
  byId('sourcing')
    .querySelectorAll<HTMLElement>('button')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sourcing === sourcing)));
  queueRender();
}

/** 人数を変える。描き直しは次のフレームで1回だけ行う（スライダーのドラッグ中に溜めない） */
function setPeople(next: number) {
  next = clampPeople(next);
  if (next === people) return;
  people = next;
  queueRender();
}

function bindPeopleControls() {
  const slider = byId<HTMLInputElement>('people-slider');
  slider.addEventListener('input', () => setPeople(peopleAt(Number(slider.value) / SLIDER_STEPS)));
  // スライダーは対数の目盛りなので、キー操作は1人ずつ（PageUp/PageDown は10人ずつ）にする
  slider.addEventListener('keydown', e => {
    const step = (
      { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 } as Record<
        string,
        number
      >
    )[e.key];
    if (step) setPeople(people + step);
    else if (e.key === 'Home') setPeople(1);
    else if (e.key === 'End') setPeople(MAX_PEOPLE);
    else return;
    e.preventDefault();
  });
  byId('minus').addEventListener('click', () => setPeople(people - 1));
  byId('plus').addEventListener('click', () => setPeople(people + 1));
  byId('sourcing').addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLElement>('button');
    if (button) setSourcing(button.dataset.sourcing as Sourcing);
  });
  byId('ribbon').addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLElement>('button');
    if (button) setPeople(STAGES[Number(button.dataset.stage)].example);
  });
}

function bindCardSelection() {
  const onControls = (target: EventTarget | null) => !!(target as Element).closest('.canvas-buttons,.float');

  // カードを押すと選ぶ（もう一度押すと解除）
  worldEl.addEventListener('click', e => {
    if (wasDragged()) return;
    const card = (e.target as Element).closest<HTMLElement>('.card');
    if (!card) return;
    const key = keyOfCard(card);
    select(view.selected === key ? null : key);
    if (view.selected && !isSidePanelOpen()) setSidePanelOpen(true);
  });
  worldEl.addEventListener('keydown', e => {
    const card = (e.target as Element).closest<HTMLElement>('.card');
    if (!card || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const key = keyOfCard(card);
    select(view.selected === key ? null : key);
  });
  // キーボードでカードへ移ったら、そのカードが見える所までキャンバスを動かす
  worldEl.addEventListener('focusin', e => {
    const card = (e.target as Element).closest<HTMLElement>('.card');
    if (card?.matches(':focus-visible')) bringIntoView(card);
  });
  // 何もない所を押すか、Esc で選択を解除
  canvas.addEventListener('click', e => {
    if (wasDragged() || (e.target as Element).closest('.card') || onControls(e.target)) return;
    clearSelection();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') clearSelection();
  });
  // ダブルクリックで拡大（Shift を押しながらで縮小）。カードの上なら、そのカードを選んだまま拡大
  canvas.addEventListener('dblclick', e => {
    if (onControls(e.target)) return;
    e.preventDefault();
    const card = (e.target as Element).closest<HTMLElement>('.card');
    if (card) select(keyOfCard(card));
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey ? 1 / 1.6 : 1.6, true);
  });
}

function bindHover() {
  const hover = (work: WorkId | null) => {
    view.hoveredWork = work;
    repaint();
  };
  setHoverHandler(hover);
  // 作品の線にカーソルが乗ったら、その作品だけを強調する
  for (const svg of [byId('tracks'), byId('tracks-back')]) {
    svg.addEventListener('pointerover', e => {
      const work = (e.target as SVGElement).dataset?.work as WorkId | undefined;
      if (work) hover(work);
    });
    svg.addEventListener('pointerout', e => {
      if ((e.target as SVGElement).dataset?.work) hover(null);
    });
  }
}

buildStaticPanels();
setSidePanelOpen(innerWidth > 1100);
byId('panel-toggle').addEventListener('click', () => setSidePanelOpen(!isSidePanelOpen()));
bindPeopleControls();
bindCameraControls();
bindFlowToggles();
bindSelectionPanel();
bindCardSelection();
bindHover();
loadSaved();
byId('sourcing')
  .querySelectorAll<HTMLElement>('button')
  .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sourcing === sourcing)));
render();
// フォントが読み込まれるとカードの高さが変わるので、配置を計算し直す
document.fonts?.ready.then(relayout);
