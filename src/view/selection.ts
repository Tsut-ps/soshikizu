/*
 * カードの選択。選んだ人の役割と、指示・発注の相手を解説パネルに出す。
 * 相手の名前を押すと、そのカードへ移動して選び直す。
 */
import { IN_DEPT_INSTRUCTOR, WORK_COLOR, type WorkId } from '../data/constants';
import { isClientKey, isHeadKey, isManagementKey, isPoolKey, isRowKey, KEY, unitKeyOf } from '../keys';
import type { Block, Plan } from '../plan';
import { view } from '../state';
import { play, prefersReducedMotion } from './animation';
import { bringIntoView } from './camera';
import { byId, escapeHtml } from './dom';
import { elementOf, repaint, scene } from './world';

const box = byId('selection');
const EMPTY_MESSAGE =
  'カードを押すと、その人の役割と、指示・発注の相手がここに出ます。相手の名前を押すと、そのカードへ移動します。';

/** 選んだ人の情報（カードの種類によって持っているものが違う） */
interface Subject {
  title: string;
  count?: number | null;
  roles?: string[];
  rows?: { label: string; count: number }[];
  multiRole?: boolean;
  sharedByWorks?: boolean;
  sub?: string;
}

function findUnit(plan: Plan, unitKey: string) {
  for (const block of plan.blocks) {
    const unit = block.heads.concat(block.pool).find(u => u.key === unitKey);
    if (unit) return { unit, block };
  }
  return null;
}

/** キーから、相手として表示する名前を求める */
function labelOf(plan: Plan, key: string): string {
  if (key === KEY.partners) return '社外の発注先（' + plan.partners.map(p => p.title).join('・') + '）';
  if (isHeadKey(key) || isPoolKey(key)) return findUnit(plan, unitKeyOf(key))?.unit.title ?? key;
  if (isRowKey(key)) {
    const row = plan.rows.find(r => KEY.row(r.work) === key);
    if (!row) return key;
    return (
      row.card.title + (plan.form === 'contractor' ? `（${'sub' in row.card ? row.card.sub : ''}）` : '')
    );
  }
  if (isClientKey(key)) return plan.clientCards.find(c => KEY.client(c.work) === key)?.title ?? key;
  if (isManagementKey(key)) return plan.management.find(u => KEY.management(u.key) === key)?.title ?? key;
  return key;
}

/** 選んだキーの人と、いる部署を求める */
function subjectOf(plan: Plan, key: string): { subject: Subject; dept: string; block: Block | null } | null {
  if (isHeadKey(key) || isPoolKey(key)) {
    const found = findUnit(plan, unitKeyOf(key));
    return found ? { subject: found.unit, dept: found.block.name, block: found.block } : null;
  }
  if (isRowKey(key)) {
    const card = plan.rows.find(r => KEY.row(r.work) === key)?.card;
    return card ? { subject: card, dept: '', block: null } : null;
  }
  if (isClientKey(key)) {
    const client = plan.clientCards.find(c => KEY.client(c.work) === key);
    return client ? { subject: client, dept: '', block: null } : null;
  }
  if (isManagementKey(key)) {
    const unit = plan.management.find(u => KEY.management(u.key) === key);
    return unit ? { subject: unit, dept: '経営・管理', block: null } : null;
  }
  return null;
}

export function renderSelection() {
  const plan = scene.plan;
  const key = view.selected;
  if (!key || !plan) {
    box.className = 'selection';
    box.innerHTML = EMPTY_MESSAGE;
    return;
  }
  const found = subjectOf(plan, key);
  if (!found) {
    view.selected = null;
    renderSelection();
    return;
  }
  const { subject, dept, block } = found;
  const dot = (work: WorkId) => `<i style="background:${WORK_COLOR[work]}"></i>`;
  const jump = (target: string, text?: string) =>
    `<button type="button" class="jump" data-jump="${escapeHtml(target)}">${escapeHtml(text || labelOf(plan, target))}</button>`;

  // 線の記録から、受ける線と出す線を集める
  const receivesInstruct: string[] = [];
  const givesInstruct: string[] = [];
  const receivesOrder: string[] = [];
  const givesOrder: string[] = [];
  for (const leg of scene.drawnLegs) {
    const isInstruct = leg.kind === 'instruct';
    if (leg.to.includes(key))
      (isInstruct ? receivesInstruct : receivesOrder).push(dot(leg.work) + jump(leg.from));
    if (leg.from === key) {
      const targets = leg.to.map(t => jump(t, t === KEY.partners ? '社外の発注先' : undefined)).join('、');
      (isInstruct ? givesInstruct : givesOrder).push(dot(leg.work) + targets);
    }
  }

  // 下段の共通の人員：部署の中の前の人（いなければ上段の担当者）から指示を受け、部署全体への発注を受ける
  if (isPoolKey(key) && block) {
    const unit = block.pool.find(u => u.key === unitKeyOf(key))!;
    const instructors = IN_DEPT_INSTRUCTOR[unit.key.split('@')[0]] ?? [];
    const sources = block.pool.filter(u => u !== unit && instructors.some(role => u.key.startsWith(role)));
    receivesInstruct.push(
      sources.length
        ? '部署の中で：' + sources.map(u => jump(KEY.pool(u.key))).join('、')
        : '部署の担当者から：' + block.heads.map(h => jump(KEY.head(h.key))).join('、'),
    );
    const seen = new Set<string>();
    for (const leg of scene.drawnLegs) {
      if (leg.kind === 'instruct' || seen.has(leg.from)) continue;
      if (!leg.to.some(t => block.heads.some(h => KEY.head(h.key) === t))) continue;
      seen.add(leg.from);
      receivesOrder.push(dot(leg.work) + jump(leg.from) + '（部署全体への発注）');
    }
  }
  if (isHeadKey(key) && block && block.pool.length) {
    givesInstruct.push('部署の中で：' + block.pool.map(u => jump(KEY.pool(u.key))).join('、'));
  }

  // 元請以上：代表は各部署の所属先、制作統括（いなければ代表）は作品ラインを管理する
  const isContractor = plan.form === 'contractor';
  const hasTokatsu = plan.management.some(u => u.key === 'tokatsu');
  const lineManager = KEY.management(hasTokatsu ? 'tokatsu' : 'rep');
  if (isContractor && key === KEY.management('rep')) givesOrder.push('各部署（組織上の所属）');
  if (isContractor && key === lineManager) {
    givesOrder.push(
      plan.rows.map(r => dot(r.work) + jump(KEY.row(r.work))).join('、') + '（作品ラインの管理）',
    );
  }
  if (isContractor && isRowKey(key)) receivesOrder.push(jump(lineManager) + 'から（ラインの管理）');

  const section = (title: string, list: string[]) =>
    list.length ? `<dt>${title}</dt><dd>${list.join('<br>')}</dd>` : '';
  const roles = (subject.rows ? subject.rows.map(r => `${r.label} ${r.count}人`) : (subject.roles ?? []))
    .map(r => `<span>${escapeHtml(r)}</span>`)
    .join('');
  const notes = [
    subject.multiRole ? `兼任（${(subject.roles ?? []).length}役）` : '',
    subject.sharedByWorks ? '作品の掛け持ち' : '',
    subject.sub && !subject.sharedByWorks ? escapeHtml(subject.sub) : '',
  ]
    .filter(Boolean)
    .join('・');
  const connected =
    receivesInstruct.length + givesInstruct.length + receivesOrder.length + givesOrder.length > 0;

  box.className = 'selection on';
  box.innerHTML = `<div class="selection-title"><b>${escapeHtml(subject.title)}</b><span>${subject.count ? subject.count + '人' : ''}${dept ? '・' + escapeHtml(dept) : ''}</span></div>
  ${notes ? `<div class="selection-notes">${notes}</div>` : ''}
  <div class="selection-roles">${roles}</div>
  <dl>${section('指示を受ける', receivesInstruct)}${section('指示を出す', givesInstruct)}${section('発注・管理を受ける', receivesOrder)}${section('発注・管理を出す', givesOrder)}</dl>
  ${connected ? '' : '<p class="selection-empty">この規模では、線でつながる相手はいません。</p>'}
  <button type="button" id="selection-clear">選択を解除（Esc）</button>`;
}

export function select(key: string | null) {
  view.selected = key;
  renderSelection();
  repaint();
}

export function clearSelection() {
  if (view.selected) select(null);
}

/** 相手のカードへ移動して選ぶ */
export function goTo(key: string) {
  const el = elementOf(key);
  if (!el) return;
  if (key !== KEY.partners) {
    select(key);
  }
  bringIntoView(el);
  // 着いたことを示す：位置（transform）には触れず、選択の枠を外から縮めて合わせる
  if (!prefersReducedMotion && key !== KEY.partners) {
    setTimeout(() => play(el, { outlineOffset: ['14px', '3px'] }, { duration: 0.45 }), 380);
  }
}

/** パネルの中のボタン（相手の名前・選択の解除）を受け付ける */
export function bindSelectionPanel() {
  box.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const jumpButton = target.closest<HTMLElement>('[data-jump]');
    if (jumpButton) goTo(jumpButton.dataset.jump!);
    else if (target.closest('#selection-clear')) clearSelection();
  });
}
