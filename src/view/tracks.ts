/*
 * 線を引く。作品の行ごとに、行の上（発注）と下（指示）に幹を通し、受ける人へ短い矢印を下ろす。
 * カードの後ろを通る部分は奥の層に描き、関わらない部署の上は薄く通す。
 */
import { NEUTRAL_COLOR, WORK_COLOR, type WorkId } from '../data/constants';
import { isHeadKey, KEY, unitKeyOf } from '../keys';
import type { Leg, LegKind, Plan } from '../plan';
import type { Box, Boxes, Guides } from './layout';

/** 引いた線の記録。選択の解説（だれから指示を受けるか）と、強調表示に使う */
export interface DrawnLeg {
  from: string;
  to: string[];
  work: WorkId;
  kind: LegKind;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 線の種類 → CSS のクラス（線の見た目）と、流れの切り替えで使う名前 */
const LINE_CLASS: Record<LegKind, string> = { order: 'order', instruct: 'instruct', outsideOrder: 'outside' };
/** 流れの切り替え（指示／発注）でどちらに入るか。社外からの発注は「発注」に入る */
export const flowOf = (kind: LegKind) => (kind === 'instruct' ? 'instruct' : 'order');

/** 矢印の印（<marker>）。大きい矢印は経営からの管理の線、小さい矢印は受ける人への枝に使う */
export function markerDefs(): string {
  const colors: Record<string, string> = { ...WORK_COLOR, N: NEUTRAL_COLOR };
  return Object.entries(colors)
    .map(
      ([k, c]) =>
        `<marker id="arrow-large-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>` +
        `<marker id="arrow-small-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`,
    )
    .join('');
}

const fixed1 = (v: number) => v.toFixed(1);
const pointsToD = (points: number[][]) => 'M' + points.map(p => p.map(fixed1).join(',')).join(' L');

/** 折れ線の <path>。座標が欠けていれば何も描かない */
function polyline(
  points: number[][],
  cls: string,
  work: WorkId | '',
  flow: string,
  withArrow = false,
): string {
  if (points.some(p => p.some(v => v == null || Number.isNaN(v)))) return '';
  return (
    `<path class="track ${cls}" data-work="${work}" data-flow="${flow}"` +
    (work ? ` stroke="${WORK_COLOR[work]}"` : '') +
    (withArrow ? ` marker-end="url(#arrow-large-${work || 'N'})"` : '') +
    ` d="${pointsToD(points)}"/>`
  );
}

export interface TrackLayers {
  front: SVGGElement;
  back: SVGGElement;
}

/** 線をすべて引き直す。引いた線の記録を返す */
export function drawTracks(plan: Plan, boxes: Boxes, guides: Guides, layers: TrackLayers): DrawnLeg[] {
  const rectOf = (key: string): Rect | null => {
    if (isHeadKey(key)) {
      // 上段の担当者は、部署のかたまりの中の位置から求める
      const block = boxes[plan.blockOfHead[unitKeyOf(key)]];
      const head = boxes[key];
      if (!block || !head) return null;
      const top = block.y! + guides.blockHeadHeight + head.y!;
      return { left: block.x! + 10, right: block.x! + block.w! - 10, top, bottom: top + head.h! };
    }
    const box = boxes[key];
    if (!box || box.h == null) return null;
    return { left: box.x!, right: box.x! + box.w!, top: box.y!, bottom: box.y! + box.h };
  };

  const front = [
    affiliationLines(plan, boxes, guides),
    ...managementLines(plan, boxes, guides),
    ...inDepartmentLines(plan, boxes, guides, rectOf),
  ];
  const { groups, backs, drawn } = workLines(plan, boxes, guides, rectOf);
  layers.back.innerHTML = backs.join('');
  layers.front.innerHTML = front.join('') + groups.join('');
  return drawn;
}

/** 所属：代表から各部署の見出しへ下りる細い線 */
function affiliationLines(plan: Plan, boxes: Boxes, guides: Guides): string {
  const rep = boxes[KEY.management('rep')];
  if (!rep) return '';
  const repX = rep.x! + rep.w! / 2;
  const xs = plan.blocks
    .filter(b => !b.empty)
    .map(b => (boxes[b.key] ? boxes[b.key].x! + boxes[b.key].w! / 2 : null));
  const left = Math.min(repX, ...(xs as number[]));
  const right = Math.max(repX, ...(xs as number[]));
  const y = guides.affiliationY;
  const drops = xs.map(x => `M${x},${y} V${guides.blockTop}`).join(' ');
  return `<path class="track affiliation" data-flow="affiliation" d="M${repX},${rep.y! + rep.h!} V${y} M${left},${y} H${right} ${drops}"/>`;
}

/** 管理：制作統括（いなければ代表）から、社内の枠の左を通って各作品ラインへ */
function managementLines(plan: Plan, boxes: Boxes, guides: Guides): string[] {
  if (plan.form !== 'contractor') return [];
  const placed = (box?: Box) => !!box && Number.isFinite(box.x) && Number.isFinite(box.y);
  const tokatsu = boxes[KEY.management('tokatsu')];
  const rep = boxes[KEY.management('rep')];
  const top = placed(tokatsu) ? tokatsu : placed(rep) ? rep : null;
  if (!top) return [];

  const x = guides.wallLeft + 20;
  const rowYs = plan.rows.map(r => boxes[KEY.row(r.work)]?.spineY).filter((v): v is number => v != null);
  const lines: string[] = [];
  if (rowYs.length) {
    lines.push(
      `<path class="track line-mgmt" data-flow="order" d="M${top.x! + top.w! / 2},${top.y! + top.h!} V${guides.managementY} H${x} V${Math.max(...rowYs)}"/>`,
    );
  }
  for (const row of plan.rows) {
    const y = boxes[KEY.row(row.work)]?.spineY;
    if (y != null) {
      lines.push(
        `<path class="track line-mgmt" data-flow="order" marker-end="url(#arrow-large-N)" d="M${x},${y} H${guides.rowHeaderX - 2}"/>`,
      );
    }
  }
  return lines;
}

/**
 * 部署の中：上段の担当者ひとりずつ（作品の色）から、下段の最初のカードへ。
 * 部署の枠の外、右のすき間を通す。
 */
function inDepartmentLines(
  plan: Plan,
  boxes: Boxes,
  guides: Guides,
  rectOf: (key: string) => Rect | null,
): string[] {
  const onlyWork = plan.rows.length === 1 ? plan.rows[0].work : null;
  const lines: string[] = [];
  for (const block of plan.blocks) {
    const box = boxes[block.key];
    if (block.empty || !block.pool.length || !box || box.poolOffset == null) continue;
    const right = box.x! + box.w!;
    const cardRight = right - 10;
    const poolTop = box.y! + guides.blockHeadHeight + box.headsHeight! + box.poolOffset;
    const heads = block.heads.map(h => ({ head: h, rect: rectOf(KEY.head(h.key)) })).filter(x => x.rect);
    heads.forEach(({ head, rect }, i) => {
      const work = head.work || onlyWork;
      const color = work ? WORK_COLOR[work] : NEUTRAL_COLOR;
      // 担当者ごとに少しずつずらして、線が重ならないようにする
      const x = right + 6 + i * Math.min(6, 18 / Math.max(1, heads.length - 1));
      const yIn = poolTop + 14 + i * 9;
      const yOut = rect!.bottom - 14;
      lines.push(
        `<path class="track in-dept" data-flow="instruct" data-block="${block.key}"${work ? ` data-work="${work}"` : ''} stroke="${color}" marker-end="url(#arrow-small-${work || 'N'})" d="M${fixed1(rect!.right)},${fixed1(yOut)} H${fixed1(x)} V${fixed1(yIn)} H${fixed1(cardRight + 1)}"/>`,
      );
    });
  }
  return lines;
}

/** 作品ごとの幹と枝。区間（Leg）ごとに1つの <g> にまとめる */
function workLines(plan: Plan, boxes: Boxes, guides: Guides, rectOf: (key: string) => Rect | null) {
  // 線が後ろを通り抜けるカード
  const cards: Rect[] = [];
  for (const block of plan.blocks) {
    for (const head of block.heads) {
      const r = rectOf(KEY.head(head.key));
      if (r) cards.push(r);
    }
  }
  for (const row of plan.rows) {
    const r = rectOf(KEY.row(row.work));
    if (r) cards.push(r);
    const c = rectOf(KEY.client(row.work));
    if (c) cards.push(c);
  }
  const blockRects = plan.blocks
    .map(block => ({ block, rect: rectOf(block.key) }))
    .filter((x): x is { block: (typeof plan.blocks)[number]; rect: Rect } => !!x.rect);

  const groups: string[] = [];
  const backs: string[] = [];
  const drawn: DrawnLeg[] = [];
  for (const row of plan.rows) {
    const lane = boxes[KEY.lane(row.work)];
    if (!lane) continue;
    for (const leg of plan.legs[row.work] ?? []) {
      const id = drawn.length;
      drawn.push({
        from: leg.from,
        to: leg.to.concat(leg.toPartners ? [KEY.partners] : []),
        work: row.work,
        kind: leg.kind,
      });
      const y = leg.kind === 'instruct' ? lane.instructY! : lane.orderY!;
      const parts = legParts(leg, row.work, y, plan, guides, cards, blockRects, rectOf);
      if (!parts) continue;
      const attrs = `class="leg" data-leg="${id}" data-work="${row.work}" data-flow="${flowOf(leg.kind)}"`;
      groups.push(`<g ${attrs}>${parts.front.join('')}${parts.marks.join('')}</g>`);
      if (parts.back.length) backs.push(`<g ${attrs}>${parts.back.join('')}</g>`);
    }
  }
  return { groups, backs, drawn };
}

/** 1本の区間の線を組み立てる：出発点の●、横に走る幹、受ける人への矢印 */
function legParts(
  leg: Leg,
  work: WorkId,
  y: number,
  plan: Plan,
  guides: Guides,
  cards: Rect[],
  blockRects: { block: Plan['blocks'][number]; rect: Rect }[],
  rectOf: (key: string) => Rect | null,
) {
  const source = rectOf(leg.from);
  if (!source) return null;
  const crosses = (r: Rect) => r.top <= y && y <= r.bottom;
  const cls = LINE_CLASS[leg.kind];
  const front: string[] = [];
  const marks: string[] = [];
  const back: string[] = [];

  // 出発点：線を出す人のカードの縁に小さな●。幹の高さがカードの外なら、カードから縦に下ろす
  let startX: number;
  if (crosses(source)) startX = source.right;
  else {
    startX = source.right - 22;
    front.push(
      polyline(
        [
          [startX, y < source.top ? source.top : source.bottom],
          [startX, y],
        ],
        cls,
        work,
        leg.kind,
      ),
    );
  }
  const dotY = crosses(source) ? y : y < source.top ? source.top : source.bottom;
  marks.push(
    `<circle class="source" cx="${fixed1(startX)}" cy="${fixed1(dotY)}" r="4.5" fill="${WORK_COLOR[work]}"/>`,
  );

  // 受ける人への矢印。幹の高さにあるカードへは横から、そうでなければ縦に下ろす
  const arrow = (points: number[][]) =>
    `<path class="track ${cls} drop" stroke="${WORK_COLOR[work]}" marker-end="url(#arrow-small-${work})" d="${pointsToD(points)}"/>`;
  let endX = startX;
  const servedBlocks = new Set<string>();
  if (isHeadKey(leg.from)) servedBlocks.add(plan.blockOfHead[unitKeyOf(leg.from)]);
  for (const key of leg.to) {
    const target = rectOf(key);
    if (!target) continue;
    if (isHeadKey(key)) servedBlocks.add(plan.blockOfHead[unitKeyOf(key)]);
    if (crosses(target)) {
      endX = Math.max(endX, target.left);
      marks.push(
        arrow([
          [target.left - 16, y],
          [target.left, y],
        ]),
      );
    } else {
      const x = target.left + 22;
      marks.push(
        arrow([
          [x, y],
          [x, y < target.top ? target.top : target.bottom],
        ]),
      );
      endX = Math.max(endX, x);
    }
  }
  const partners = leg.toPartners ? rectOf(KEY.partners) : null;
  if (partners) endX = partners.left - 2;
  if (endX - startX < 1) return null;

  // カードの後ろを通る部分は、奥の層にだけ描く
  const hidden = cards
    .filter(r => crosses(r) && r.right > startX && r.left < endX)
    .map(r => [r.left, r.right])
    .sort((a, b) => a[0] - b[0]);
  for (const [a, b] of hidden) {
    const p = Math.max(a, startX);
    const q = Math.min(b, endX);
    if (q - p > 1)
      back.push(
        polyline(
          [
            [p, y],
            [q, y],
          ],
          cls,
          work,
          leg.kind,
        ),
      );
  }

  // 関わらない部署（空き枠は除く）の上は薄く通す
  const faintSpans = blockRects
    .filter(
      x => !x.block.empty && !servedBlocks.has(x.block.key) && x.rect.right > startX && x.rect.left < endX,
    )
    .map(x => [x.rect.left, x.rect.right]);
  const visible: number[][] = [];
  let x0 = startX;
  for (const [a, b] of hidden) {
    if (a > x0) visible.push([x0, Math.min(a, endX)]);
    x0 = Math.max(x0, b);
  }
  if (x0 < endX) visible.push([x0, endX]);
  const splitAtFaint = (a: number, b: number) => {
    const points = [a, b];
    for (const [p, q] of faintSpans) {
      if (p > a && p < b) points.push(p);
      if (q > a && q < b) points.push(q);
    }
    points.sort((m, n) => m - n);
    return points.slice(1).map((q, i) => [points[i], q]);
  };
  for (const [a, b] of visible) {
    for (const [p0, q0] of splitAtFaint(a, b)) {
      const faint = faintSpans.some(([p, q]) => p0 >= p - 0.5 && q0 <= q + 0.5) ? ' faint' : '';
      // 管理・発注の線は、社内の枠の外に出る部分を点線にする
      const segments: [number, number, string][] =
        leg.kind === 'order'
          ? [
              [p0, Math.min(q0, guides.wallLeft), 'outside'],
              [Math.max(p0, guides.wallLeft), Math.min(q0, guides.wallRight), 'order'],
              [Math.max(p0, guides.wallRight), q0, 'outside'],
            ]
          : [[p0, q0, cls]];
      for (const [p, q, c] of segments) {
        if (q - p > 1)
          front.push(
            polyline(
              [
                [p, y],
                [q, y],
              ],
              c + faint,
              work,
              leg.kind,
              !!partners && q === endX,
            ),
          );
      }
    }
  }
  return { front, marks, back };
}
