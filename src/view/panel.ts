/* 上の人数バー（数字・スライダー・段階のボタン）と、右の解説パネル */
import { stagger } from 'motion';
import { MAX_PEOPLE, STEPS } from '../data/constants';
import { STAGES } from '../data/stages';
import type { Organization, StepState } from '../model';
import { positionOf, SLIDER_STEPS } from '../slider-scale';
import { countTo, play } from './animation';
import { byId, escapeHtml, iconSvg } from './dom';
import { referencesFor } from '../data/references';

const slider = byId<HTMLInputElement>('people-slider');
const ribbon = byId('ribbon');
const side = byId('side');
const panelToggle = byId('panel-toggle');

const STEP_STATE: Record<StepState, { className: string; label: string }> = {
  in: { className: 'in-house', label: '内製' },
  ken: { className: 'multi-role', label: '兼任' },
  out: { className: 'outsourced', label: '社外' },
};

/** 段階のボタン（幅はスライダー上の範囲に合わせる）と、工程の一覧を作る */
export function buildStaticPanels() {
  slider.max = String(SLIDER_STEPS);
  ribbon.innerHTML = STAGES.map((stage, i) => {
    const left = stage.min === 1 ? 0 : positionOf(stage.min - 0.5);
    const right = stage.max === MAX_PEOPLE ? 1 : positionOf(stage.max + 0.5);
    const range =
      stage.min === stage.max ? `${stage.min}` : `${stage.min}〜${stage.max === MAX_PEOPLE ? '' : stage.max}`;
    return `<button type="button" data-stage="${i}" style="width:${(right - left) * 100}%" title="${stage.name}（${range}人）" aria-label="${stage.name}"><span class="ribbon-label">${stage.short}</span></button>`;
  }).join('');
  new ResizeObserver(fitRibbonLabels).observe(ribbon);
  byId('pipe').innerHTML = STEPS.map(
    s =>
      `<div class="step" data-key="${s.id}"><div class="step-icon">${iconSvg(s.icon)}</div><span>${s.name}</span><em></em></div>`,
  ).join('');
}

export function setSidePanelOpen(open: boolean) {
  side.hidden = !open;
  panelToggle.setAttribute('aria-expanded', String(open));
}
export const isSidePanelOpen = () => !side.hidden;

/** いま解説に出している段階と型（変わったときだけ解説を書き直す） */
let shownShapeKey = '';

/** 人数が変わったときに、上のバーと解説パネルを更新する */
export function renderPanels(org: Organization) {
  const { people, stageIndex, shape, units, stepStates, works } = org;

  byId('people-count').textContent = String(people);
  const position = positionOf(people);
  slider.value = String(Math.round(position * SLIDER_STEPS));
  slider.style.setProperty('--progress', position * 100 + '%');
  slider.setAttribute('aria-valuetext', `${people}人（${shape.name}）`);
  ribbon.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === stageIndex));

  byId('stage-name').textContent = shape.name;
  const worksLabel = typeof shape.worksLabel === 'function' ? shape.worksLabel(people) : shape.worksLabel;
  byId('stat-works').textContent = worksLabel || `${works.length}本`;
  const inHouse = Object.values(stepStates).filter(s => s !== 'out').length;
  countTo(byId('stat-in'), inHouse);
  countTo(byId('stat-out'), STEPS.length - inHouse);
  countTo(
    byId('stat-multi'),
    units.filter(u => u.multiRole).reduce((sum, u) => sum + u.count, 0),
  );
  const bar = byId('stat-in-bar');
  const width = (inHouse / STEPS.length) * 100 + '%';
  if (!play(bar, { width }, { duration: 0.4 })) bar.style.width = width;
  byId('jobs').innerHTML = `<strong>主な仕事：</strong>${shape.jobs}`;
  const sameAsStandard = org.sourcing !== 'basic' && !org.hasVariant;
  byId('basis').textContent = [
    sameAsStandard ? 'この人数では、選んだ型も基本と同じ形です。' : '',
    shape.basis ?? '',
  ]
    .filter(Boolean)
    .join('');

  byId('pipe')
    .querySelectorAll<HTMLElement>('.step')
    .forEach(step => {
      const state = stepStates[step.dataset.key as keyof typeof stepStates];
      const before = step.dataset.state;
      step.className = 'step ' + STEP_STATE[state].className;
      step.dataset.state = state;
      step.querySelector('em')!.textContent = STEP_STATE[state].label;
      if (before && before !== state)
        play(step.querySelector('.step-icon')!, { scale: [0.6, 1.12, 1] }, { duration: 0.4 });
    });

  const multiRoleList = () => {
    const multi = units.filter(u => u.multiRole);
    if (!multi.length) return '';
    const items = multi.map(u => `<div><b>${u.title}</b>：${u.roles.join('・')}</div>`).join('');
    return `<div class="box multi-role-list"><h3>兼任の例（${people}人のとき）</h3>${items}</div>`;
  };
  const effectiveSourcing = org.hasVariant ? org.sourcing : 'basic';
  const shapeKey = `${stageIndex}:${effectiveSourcing}`;
  if (shapeKey !== shownShapeKey) {
    const real = byId('real');
    real.innerHTML = `<h3>現場の実態</h3><p>${shape.desc}</p><ul>${shape.points.map(p => `<li>${p}</li>`).join('')}</ul>
   <div class="box"><h3>指示系統</h3><p>${shape.chain}</p></div>${referenceBox(stageIndex, effectiveSourcing)}<div id="multi-role-box">${multiRoleList()}</div>
   <div class="box"><h3>次の規模で変わること</h3><p>${shape.next}</p></div>`;
    if (shownShapeKey)
      play(real.children, { opacity: [0, 1], y: [12, 0] }, { duration: 0.35, delay: stagger(0.06) });
    shownShapeKey = shapeKey;
  } else byId('multi-role-box').innerHTML = multiRoleList();
}

/** 参考になるスタジオ・事例の欄。会社名は出典へのリンクにする */
function referenceBox(stageIndex: number, sourcing: Parameters<typeof referencesFor>[1]): string {
  const list = referencesFor(stageIndex, sourcing);
  const items = list.length
    ? list
        .map(
          r =>
            `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)}</a>` +
            `<span class="reference-people">${escapeHtml(r.people)}${r.secondary ? '・二次情報' : ''}</span>` +
            `<small>${escapeHtml(r.note)}</small></li>`,
        )
        .join('')
    : '<li class="reference-none">この形に近い会社の例は、公開資料では見つけられていません。</li>';
  return `<div class="box references"><h3>参考になるスタジオ</h3><ul>${items}</ul></div>`;
}

/**
 * 段階のボタンの名前を、入りきるときだけ出す。
 * 1つでも入りきらなければ、選んでいる段階の名前だけを出す（はみ出した名前が隣の名前とつながって読めないように）。
 */
function fitRibbonLabels() {
  const buttons = [...ribbon.querySelectorAll<HTMLElement>('button')];
  const labels = buttons.map(b => b.querySelector<HTMLElement>('.ribbon-label')!);
  labels.forEach(l => l.classList.remove('hidden'));
  const allFit = buttons.every((b, i) => labels[i].scrollWidth <= b.clientWidth - 4);
  if (!allFit) labels.forEach(l => l.classList.add('hidden'));
}
