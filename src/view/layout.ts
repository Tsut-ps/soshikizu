/*
 * 配置の計算。カードの実際の高さを測り、行（作品）と列（部署）が交わる路線図の形に並べる。
 * 結果は「キー → 箱（位置と大きさ）」で返し、ばねのアニメーション（spring.ts）がそこへ動かす。
 */
import { WORK_COLOR, type WorkId } from '../data/constants';
import { KEY } from '../keys';
import type { Block, Plan } from '../plan';

/** 部品の位置と大きさ。数値はばねで動かし、文字列はそのまま置き換える */
export interface Box {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** 行の見出し：管理の線が入る高さ */
  spineY?: number;
  /** 部署のかたまり：上段（作品の行が通る帯）の高さ */
  headsHeight?: number;
  /** 部署のかたまり：上段の下端から、下段の最初のカードの上端までの距離 */
  poolOffset?: number;
  /** 作品の行：発注の線（上）と指示の線（下）を通す高さ */
  orderY?: number;
  instructY?: number;
  /** 複数の作品にかかるカードの、作品ごとの色の帯 */
  bands?: string;
}
export type Boxes = Record<string, Box>;

/** 線を引くときの目安の位置 */
export interface Guides {
  wallLeft: number;
  wallRight: number;
  rowHeaderX: number;
  /** 部署のかたまりの上端と、見出しの高さ */
  blockTop: number;
  blockHeadHeight: number;
  /** 代表から部署へ下りる所属の線の、横に走る高さ */
  affiliationY: number;
  /** 経営から作品ラインへの管理の線の、横に走る高さ */
  managementY: number;
}

export interface Layout {
  boxes: Boxes;
  guides: Guides;
  world: { w: number; h: number };
}

/* 寸法（px） */
const BLOCK_WIDTH = 210;
const EMPTY_BLOCK_WIDTH = 160;
const COLUMN_GAP = 50;
export const ROW_HEADER_WIDTH = 262;
export const MANAGEMENT_CARD_WIDTH = 200;
const MANAGEMENT_GAP = 18;
const PAGE_PADDING = 40;
/** 作品の行の上と下に空ける、線を通す帯の高さ */
const LANE_ABOVE = 24;
const LANE_BELOW = 24;
const MIN_CARD_HEIGHT = 64;

export const blockWidth = (block: Block | null) => (block?.empty ? EMPTY_BLOCK_WIDTH : BLOCK_WIDTH);

/** 測った高さ。部署のかたまりは見出しと下段、ほかのカードは全体 */
interface Measured {
  blocks: Record<string, { head: number; body: number }>;
  cards: Record<string, number>;
}

/** いま画面にある部品の高さを測る（上段の担当者の高さも、伸ばす前の自然な高さで測る） */
function measure(items: Map<string, HTMLElement>): Measured {
  const measured: Measured = { blocks: {}, cards: {} };
  items.forEach((el, key) => {
    if (el.classList.contains('block')) {
      const head = el.querySelector<HTMLElement>('.block-head')!;
      head.style.minHeight = '';
      measured.blocks[key] = {
        head: head.offsetHeight,
        body: el.querySelector<HTMLElement>('.block-body')!.offsetHeight,
      };
      el.querySelectorAll<HTMLElement>('.block-heads > .card').forEach(card => {
        card.style.minHeight = '';
        measured.cards[KEY.head(card.dataset.key!)] = Math.max(MIN_CARD_HEIGHT, card.offsetHeight);
      });
    } else measured.cards[key] = el.offsetHeight;
  });
  return measured;
}

export function computeLayout(plan: Plan, items: Map<string, HTMLElement>): Layout {
  const measured = measure(items);
  const cardHeight = (key: string) => measured.cards[key] ?? 0;
  const boxes: Boxes = {};
  const works = plan.rows.map(r => r.work);

  // 横の並び：（発注元）｜社内の枠［行の見出し｜部署の列…］｜社外
  const outside = plan.clientsOutside;
  const rowHeaderInside = !outside || plan.form === 'gross';
  const wallLeft = outside ? PAGE_PADDING + ROW_HEADER_WIDTH + 70 : PAGE_PADDING;
  const wallTop = PAGE_PADDING + 34;
  const rowHeaderX = rowHeaderInside ? wallLeft + 44 : PAGE_PADDING;
  let columnX = rowHeaderInside ? rowHeaderX + ROW_HEADER_WIDTH + 70 : wallLeft + 50;
  const blockX: Record<string, number> = {};
  for (const block of plan.blocks) {
    blockX[block.key] = columnX;
    columnX += blockWidth(block) + COLUMN_GAP;
  }
  const wallRight = columnX - COLUMN_GAP + 44;

  // 上段：経営・管理のカードを横に並べる
  const managementHeight = plan.management.length
    ? Math.max(...plan.management.map(u => cardHeight(KEY.management(u.key))))
    : 0;
  plan.management.forEach((unit, i) => {
    const key = KEY.management(unit.key);
    boxes[key] = {
      x: wallLeft + 44 + i * (MANAGEMENT_CARD_WIDTH + MANAGEMENT_GAP),
      y: wallTop + 44,
      w: MANAGEMENT_CARD_WIDTH,
      h: cardHeight(key),
    };
  });
  const blockTop = wallTop + 44 + (managementHeight ? managementHeight + 84 : 0);

  // 部署の見出しの高さをそろえる
  const blockKeys = plan.blocks.map(b => b.key).concat(plan.partners.length ? [KEY.partners] : []);
  const blockHeadHeight = Math.max(...blockKeys.map(k => measured.blocks[k].head));
  for (const key of blockKeys)
    items.get(key)!.querySelector<HTMLElement>('.block-head')!.style.minHeight = blockHeadHeight + 'px';
  // 下段の最初のカードの位置（部署の中の線の行き先）。毎フレーム測らずに済むよう、ここで1回だけ測る
  const poolOffset: Record<string, number> = {};
  for (const block of plan.blocks) {
    const el = items.get(block.key)!;
    const first = el.querySelector<HTMLElement>('.block-pool > .card');
    if (!first) continue;
    poolOffset[block.key] =
      first.offsetTop -
      el.querySelector<HTMLElement>('.block-head')!.offsetHeight -
      el.querySelector<HTMLElement>('.block-heads')!.offsetHeight;
  }
  const zoneTop = blockTop + blockHeadHeight;

  // 縦の並び：作品の行ごとに、線の帯（上）・カード・線の帯（下）
  const rowHeight: Partial<Record<WorkId, number>> = {};
  for (const work of works) {
    rowHeight[work] = Math.max(cardHeight(KEY.row(work)), cardHeight(KEY.client(work)), MIN_CARD_HEIGHT);
  }
  const heads = plan.blocks.flatMap(b =>
    b.heads.map(u => ({
      key: u.key,
      works: u.rowWorks ?? [],
      height: measured.cards[KEY.head(u.key)] || MIN_CARD_HEIGHT,
    })),
  );
  // 1つの作品だけの担当者は、その行の高さを押し広げる
  for (const head of heads) {
    if (head.works.length === 1) rowHeight[head.works[0]] = Math.max(rowHeight[head.works[0]]!, head.height);
  }
  const rowTop: Partial<Record<WorkId, number>> = {};
  const placeRows = () => {
    let y = zoneTop + 4;
    for (const work of works) {
      rowTop[work] = y;
      y += LANE_ABOVE + rowHeight[work]! + LANE_BELOW + 6;
    }
  };
  const cardTop = (work: WorkId) => rowTop[work]! + LANE_ABOVE;
  const cardBottom = (work: WorkId) => rowTop[work]! + LANE_ABOVE + rowHeight[work]!;
  placeRows();
  // 複数の作品を掛け持つ担当者が入りきらなければ、最後の行を広げる
  for (const head of heads) {
    if (head.works.length < 2) continue;
    const first = head.works[0];
    const last = head.works[head.works.length - 1];
    const lack = head.height - (cardBottom(last) - cardTop(first));
    if (lack > 0) {
      rowHeight[last]! += lack;
      placeRows();
    }
  }

  for (const work of works) {
    boxes[KEY.row(work)] = {
      x: rowHeaderX,
      y: cardTop(work),
      w: ROW_HEADER_WIDTH,
      h: cardHeight(KEY.row(work)),
      spineY: cardTop(work) + 20,
    };
    if (measured.cards[KEY.client(work)] !== undefined) {
      boxes[KEY.client(work)] = {
        x: PAGE_PADDING,
        y: cardTop(work),
        w: ROW_HEADER_WIDTH,
        h: cardHeight(KEY.client(work)),
      };
    }
    boxes[KEY.lane(work)] = {
      orderY: rowTop[work]! + LANE_ABOVE / 2,
      instructY: cardBottom(work) + LANE_BELOW / 2,
    };
  }

  // 上段の担当者：かかる作品の行の上端から下端まで。複数の作品なら作品ごとの色の帯をつける
  for (const head of heads) {
    const first = head.works[0];
    const last = head.works[head.works.length - 1];
    const height = cardBottom(last) - cardTop(first);
    const box: Box = { y: cardTop(first) - zoneTop, h: height };
    if (head.works.length > 1)
      box.bands = colorBands(head.works, cardTop, cardBottom, cardTop(first), height);
    boxes[KEY.head(head.key)] = box;
  }

  // 部署のかたまり：上段は全部の行が通る高さ、その下に共通の人員
  const lastWork = works[works.length - 1];
  const zoneHeight = cardBottom(lastWork) + LANE_BELOW + 4 - zoneTop;
  let bottom = 0;
  for (const block of plan.blocks) {
    const box: Box = {
      x: blockX[block.key],
      y: blockTop,
      w: blockWidth(block),
      headsHeight: zoneHeight,
      h: blockHeadHeight + zoneHeight + measured.blocks[block.key].body,
    };
    if (poolOffset[block.key] !== undefined) box.poolOffset = poolOffset[block.key];
    boxes[block.key] = box;
    bottom = Math.max(bottom, box.y! + box.h!);
  }
  const wall: Box = { x: wallLeft, y: wallTop, w: wallRight - wallLeft, h: bottom + 40 - wallTop };
  boxes[KEY.wall] = wall;

  // 社外の箱：一覧の高さか、社外へ向かう線が届く高さの、高い方まで
  let right = wallRight;
  if (plan.partners.length) {
    const body = measured.blocks[KEY.partners].body;
    let reach = 0;
    for (const work of works) {
      for (const leg of plan.legs[work] ?? []) {
        if (!leg.toPartners) continue;
        const lane = boxes[KEY.lane(work)];
        reach = Math.max(reach, (leg.kind === 'instruct' ? lane.instructY! : lane.orderY!) + 18 - zoneTop);
      }
    }
    const box: Box = {
      x: wallRight + 64,
      y: blockTop,
      w: BLOCK_WIDTH,
      headsHeight: Math.max(0, reach - body),
      h: blockHeadHeight + Math.max(reach, body),
    };
    boxes[KEY.partners] = box;
    right = box.x! + BLOCK_WIDTH;
    bottom = Math.max(bottom, box.y! + box.h!);
  }
  if (outside) boxes[KEY.clientsLabel] = { x: PAGE_PADDING + 4, y: zoneTop - 26 };

  return {
    boxes,
    guides: {
      wallLeft,
      wallRight,
      rowHeaderX,
      blockTop,
      blockHeadHeight,
      affiliationY: blockTop - 30,
      managementY: blockTop - 56,
    },
    world: { w: right + PAGE_PADDING, h: Math.max(bottom, wall.y! + wall.h!) + PAGE_PADDING },
  };
}

/** 複数の作品にかかるカードの背景：行の境目で色が切り替わる縦のグラデーション */
function colorBands(
  works: WorkId[],
  cardTop: (w: WorkId) => number,
  cardBottom: (w: WorkId) => number,
  top: number,
  height: number,
): string {
  const cuts = works
    .slice(0, -1)
    .map((w, i) => (((cardBottom(w) + cardTop(works[i + 1])) / 2 - top) / height) * 100);
  const edges = [0, ...cuts, 100];
  const stops = works.map(
    (w, i) =>
      `color-mix(in oklab,${WORK_COLOR[w]} 17%,#1e222b) ${edges[i].toFixed(2)}% ${edges[i + 1].toFixed(2)}%`,
  );
  return 'linear-gradient(to bottom,' + stops.join(',') + ')';
}
