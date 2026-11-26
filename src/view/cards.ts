/* カード（役職・発注元・制作ライン）と、部署のかたまりの DOM を作って中身を入れる */
import { IN_DEPT_INSTRUCTOR, WORK_COLOR, type WorkId } from '../data/constants';
import type { LineRow, Partner } from '../data/units';
import type { Block } from '../plan';
import { afterPlay, play } from './animation';
import { iconSvg, setHtmlIfChanged } from './dom';
import { stagger } from 'motion';

/** カードに出せるものの共通の形（役職・発注元・自主制作の作品・グロスの自社ライン） */
export interface CardSpec {
  kind: 'unit' | 'client' | 'own-work';
  key: string;
  title: string;
  icon: string;
  roles?: string[];
  count?: number | null;
  sub?: string;
  work?: WorkId;
  multiRole?: boolean;
  rows?: LineRow[];
}

/** 子要素を data-key で引けるようにする（消えていく途中のものは除く） */
function childrenByKey(box: Element, selector: string): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  box
    .querySelectorAll<HTMLElement>(`:scope > ${selector}:not(.leaving)`)
    .forEach(e => map.set(e.dataset.key!, e));
  return map;
}

/** 人のピクトグラムを n 個にそろえる。増えた分は順に現れ、減った分は縮んで消える */
function updatePeople(box: Element, n: number, fresh: boolean) {
  const live = [...box.children].filter(c => !c.classList.contains('leaving'));
  if (n > live.length) {
    const adding = n - live.length;
    box.insertAdjacentHTML(
      'beforeend',
      '<svg aria-hidden="true"><use href="#i-person"/></svg>'.repeat(adding),
    );
    const added = [...box.children].slice(-adding);
    play(
      added,
      { scale: [0, 1], opacity: [0, 1] },
      {
        duration: 0.28,
        delay: stagger(Math.min(0.025, 0.45 / added.length), { startDelay: fresh ? 0.15 : 0 }),
      },
    );
  } else if (n < live.length) {
    for (const person of live.slice(n)) {
      person.classList.add('leaving');
      afterPlay(play(person, { scale: 0, opacity: 0 }, { duration: 0.14 }), () => person.remove());
    }
  }
}

export function createCard(spec: CardSpec): HTMLElement {
  const el = document.createElement('div');
  el.dataset.key = spec.key;
  // キーボードでも選べるようにする（Tab で移り、Enter かスペースで選ぶ）
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.innerHTML =
    '<div class="card-head"><svg class="i card-icon" aria-hidden="true"></svg><b class="card-title"></b><span class="card-count"></span></div>' +
    '<span class="badge" hidden></span><div class="sub"></div><div class="roles"></div><div class="rows"></div>' +
    '<div class="people" aria-hidden="true"></div>';
  return el;
}

/**
 * カードの中身を入れる。
 * fresh はカードが新しく出たときに true（人のピクトグラムを少し遅らせて出す）。
 */
export function fillCard(el: HTMLElement, spec: CardSpec, fresh: boolean, extraClasses: string[] = []) {
  el.className = [...extraClasses, 'card', spec.kind, spec.multiRole ? 'multi-role' : '']
    .filter(Boolean)
    .join(' ');
  if (spec.work) {
    el.dataset.work = spec.work;
    el.style.setProperty('--work-color', WORK_COLOR[spec.work]);
  } else {
    delete el.dataset.work;
    el.style.removeProperty('--work-color');
  }
  el.querySelector('.card-icon')!.innerHTML = `<use href="#i-${spec.icon}"/>`;
  el.querySelector('.card-title')!.textContent = spec.title;
  el.querySelector('.card-count')!.textContent = spec.count ? spec.count + '人' : '';

  const badge = el.querySelector<HTMLElement>('.badge')!;
  badge.hidden = !spec.multiRole;
  badge.textContent = spec.multiRole ? `兼任 ${spec.roles?.length ?? 0}役` : '';
  el.querySelector('.sub')!.textContent = spec.sub || '';

  // 制作ラインは役割の代わりに内訳（P・デスク・進行…）を出す
  const roles = spec.rows ? [] : (spec.roles ?? []);
  setHtmlIfChanged(el.querySelector('.roles')!, roles.map(r => `<span>${r}</span>`).join(''));
  fillLineRows(el.querySelector('.rows')!, spec.rows, fresh);

  const showsPeople = spec.kind === 'unit' && !spec.rows;
  updatePeople(el.querySelector(':scope > .people')!, showsPeople ? (spec.count ?? 0) : 0, fresh);
}

/** 制作ラインの内訳の行（P・デスク・進行・設定）。行ごとに人のピクトグラムを並べる */
function fillLineRows(box: HTMLElement, rows: LineRow[] | undefined, fresh: boolean) {
  if (!rows) {
    box.textContent = '';
    return;
  }
  const existing = childrenByKey(box, '.row');
  for (const { key, icon, label, count } of rows) {
    let row = existing.get(key);
    if (!row) {
      row = document.createElement('div');
      row.className = 'row';
      row.dataset.key = key;
      row.innerHTML = `${iconSvg(icon)}<span></span><span class="people" aria-hidden="true"></span>`;
    }
    box.appendChild(row);
    row.children[1].textContent = label;
    row.title = `${label} ${count}人`;
    updatePeople(row.querySelector('.people')!, count, fresh);
  }
  existing.forEach((row, key) => {
    if (!rows.some(r => r.key === key)) row.remove();
  });
}

export function createBlockElement(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML =
    '<div class="block-head"><svg class="i block-icon" aria-hidden="true"></svg><span class="block-title"><b></b><small></small></span><span class="block-count"></span></div>' +
    '<div class="block-heads"></div><div class="block-body"><div class="block-pool"></div></div>';
  return el;
}

function fillBlockHead(el: HTMLElement, icon: string, name: string, note: string, count: string) {
  el.querySelector('.block-icon')!.innerHTML = `<use href="#i-${icon}"/>`;
  el.querySelector('.block-title b')!.textContent = name;
  el.querySelector('.block-title small')!.textContent = note;
  el.querySelector('.block-head .block-count')!.textContent = count;
}

/** 部署のかたまり：見出し、上段の担当者、下段の共通の人員 */
export function fillBlockElement(el: HTMLElement, block: Block, fresh: boolean) {
  el.className = 'item block' + (block.empty ? ' empty' : '');
  const note = block.empty
    ? '社内に持たない'
    : (block.note ?? (block.first !== block.last ? '兼任でひとまとまり' : `${block.units.length}つの役職`));
  fillBlockHead(el, block.icon, block.name, note, block.empty ? '' : block.total + '人');

  // 上段：作品の行の上に置く担当者
  const headsBox = el.querySelector('.block-heads')!;
  const heads = childrenByKey(headsBox, '.card');
  heads.forEach((card, key) => {
    if (!block.heads.some(u => u.key === key)) card.remove();
  });
  for (const unit of block.heads) {
    let card = heads.get(unit.key);
    const isNew = !card;
    if (!card) headsBox.appendChild((card = createCard(unit)));
    fillCard(card, unit, fresh || isNew);
  }

  // 下段：共通の人員。前のカードから指示を受ける役職なら、間を線でつなぐ（chained）
  const poolBox = el.querySelector('.block-pool')!;
  const pool = childrenByKey(poolBox, '.card');
  pool.forEach((card, key) => {
    if (!block.pool.some(u => u.key === key)) card.remove();
  });
  block.pool.forEach((unit, i) => {
    let card = pool.get(unit.key);
    const isNew = !card;
    if (!card) card = createCard(unit);
    poolBox.appendChild(card);
    const previous = block.pool[i - 1];
    const instructors = IN_DEPT_INSTRUCTOR[unit.key.split('@')[0]] ?? [];
    const chained = !!previous && instructors.some(role => previous.key.startsWith(role));
    fillCard(card, unit, fresh || isNew, chained ? ['chained'] : []);
  });
}

/** 社外の協力先の箱 */
export function fillPartnersElement(el: HTMLElement, partners: Partner[]) {
  el.className = 'item block partners';
  fillBlockHead(el, 'hand', '社外', '各作品の外注先・協力先', `${partners.length}先`);
  const chips = partners
    .map(
      p => `<div class="chip">${iconSvg(p.icon)}<span>${p.title}<small>${p.sub || ''}</small></span></div>`,
    )
    .join('');
  const pool = el.querySelector<HTMLElement>('.block-pool')!;
  if (pool.dataset.html !== chips) {
    pool.dataset.html = chips;
    pool.innerHTML = `<div class="chips">${chips}</div>`;
  }
}
