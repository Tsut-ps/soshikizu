/*
 * 路線図マトリクスの組み立て。
 * 行＝作品、列＝部署（工程の順）。部署の上段に作品ごとの担当者、下段に作品をまたぐ共通の人員を置く。
 * 作品ごとに「だれから、だれへ」線（区間）を引くかもここで決める。
 */
import { DEPARTMENTS, DEPT_SHORT_NAME, type DeptId, type WorkId } from './data/constants';
import type { Form } from './data/stages';
import type { Client, LineRow, OwnWork, Partner } from './data/units';
import { KEY } from './keys';
import type { Organization, StaffedUnit } from './model';

/** 部署に置いた役職。担当者として上段に置くものは、かかる作品の行を持つ */
export type PlacedUnit = StaffedUnit & {
  /** 上段のカードがかかる作品の行 */
  rowWorks?: WorkId[];
  /** 担当を作品ごとに分けず、すべての作品を掛け持ちしている */
  sharedByWorks?: boolean;
};

/** グロス請けの「自社の制作ライン」（代表・デスク・進行をまとめた行の見出し） */
export interface GrossLine {
  kind: 'unit';
  key: string;
  title: string;
  icon: string;
  work: WorkId;
  sub: string;
  rows: LineRow[];
  count: number;
}

export type RowCard = StaffedUnit | Client | OwnWork | GrossLine;

export interface Row {
  work: WorkId;
  card: RowCard;
}

/** 列にならぶ部署のかたまり。兼任の人は複数の列にまたがる1つのかたまりになる */
export interface Block {
  key: string;
  /** 左端と右端の列の番号 */
  first: number;
  last: number;
  units: PlacedUnit[];
  /** 社内に持たない部署の空き枠 */
  empty: boolean;
  name: string;
  /** 見出しの下に出す、まとまりの名前（大手の「局」）。なければ役職の数を出す */
  note?: string;
  icon: string;
  total: number;
  /** 上段（作品の行の上）の担当者 */
  heads: PlacedUnit[];
  /** 下段（共通の人員） */
  pool: PlacedUnit[];
}

/**
 * 線の種類。
 * order＝管理・発注（実線）、instruct＝内容の指示（破線）、outsideOrder＝社外からの発注（点線）
 */
export type LegKind = 'order' | 'instruct' | 'outsideOrder';

/** 1本の線（区間）：出す人 from から、受ける人 to へ。toPartners なら社外の箱まで延ばす */
export interface Leg {
  kind: LegKind;
  from: string;
  to: string[];
  toPartners: boolean;
}

export interface Plan {
  /** 図の組み方（stages.ts の Form） */
  form: Form;
  /** 列の部署（左から工程の順） */
  columns: DeptId[];
  /** 上段の経営・管理（元請以上） */
  management: StaffedUnit[];
  rows: Row[];
  blocks: Block[];
  partners: Partner[];
  /** 発注元が社外にいて、社内の枠の左に置く段階か */
  clientsOutside: boolean;
  /** グロス請けで、行の見出しの左に置く元請のカード */
  clientCards: Client[];
  legs: Partial<Record<WorkId, Leg[]>>;
  /** 上段の担当者（役職のキー）が、どの部署のかたまりにいるか */
  blockOfHead: Record<string, string>;
}

/** 部署ごとに、上段に置く担当者の役職（先に見つかったもの） */
const HEAD_ROLE: Partial<Record<DeptId, string[]>> = {
  dir: ['kantoku'],
  anim: ['chara', 'sakkan'],
  paint: ['shikisai'],
  art: ['bikan'],
  post: ['satsukan'],
};
/** 人数が作品の数以上いれば、作品ごとの担当に分ける役職 */
const SPLITTABLE_CHIEFS = ['chara', 'sakkan', 'shikisai', 'bikan', 'satsukan'];

const SMALL_STUDIO_COLUMNS: DeptId[] = ['prod', 'dir', 'anim', 'paint', 'art', 'post'];
/** 元請は制作ラインを行の見出しに出すので、制作部の列を持たない */
const CONTRACTOR_COLUMNS: DeptId[] = ['dir', 'anim', 'paint', 'art', 'post'];

export function buildPlan(org: Organization): Plan {
  const { form } = org.shape;
  const isContractor = form === 'contractor';
  const isGross = form === 'gross';
  const columns =
    form === 'solo' || form === 'smallUnit' || form === 'subcontract'
      ? SMALL_STUDIO_COLUMNS
      : CONTRACTOR_COLUMNS;
  const works = org.works.map(w => w.id);

  // 1. 役職を、経営・管理／制作ライン／グロスの自社ライン／部署のかたまり に振り分ける
  const management: StaffedUnit[] = [];
  const lineOfWork: Partial<Record<WorkId, StaffedUnit>> = {};
  const grossLineUnits: StaffedUnit[] = [];
  const blockMap = new Map<string, Block>();
  for (const unit of org.units) {
    if (isContractor && (unit.dept === 'mgmt' || unit.dept === 'plan')) {
      management.push(unit);
      continue;
    }
    if (unit.rows && unit.work) {
      lineOfWork[unit.work] = unit;
      continue;
    }
    if (isGross && (unit.dept === 'prod' || unit.span?.[0] === 'prod')) {
      grossLineUnits.push(unit);
      continue;
    }
    const [from, to] = unit.span ?? [unit.dept, unit.dept];
    const key = 'b-' + from + (from !== to ? '-' + to : '');
    if (!blockMap.has(key))
      blockMap.set(key, emptyBlock(key, columns.indexOf(from), columns.indexOf(to), false));
    blockMap.get(key)!.units.push(unit);
  }

  // 2. どのかたまりにも入らない列は「社内に持たない」空き枠にする
  const covered = new Set<number>();
  blockMap.forEach(b => {
    for (let i = b.first; i <= b.last; i++) covered.add(i);
  });
  columns.forEach((dept, i) => {
    if (!covered.has(i)) blockMap.set('b-' + dept, emptyBlock('b-' + dept, i, i, true));
  });
  const blocks = [...blockMap.values()].sort((a, b) => a.first - b.first);
  for (const block of blocks) {
    nameBlock(block, columns);
    if (!block.empty) block.note = org.shape.columnNotes?.[columns[block.first]];
  }

  // 制作統括がいれば、経営・管理の先頭に置く（作品ラインへの管理の線が出るため）
  if (management.some(u => u.key === 'tokatsu')) {
    management.sort((a, b) => Number(b.key === 'tokatsu') - Number(a.key === 'tokatsu'));
  }

  // 3. 部署ごとに、上段の担当者と下段の共通の人員に分ける
  const blockOfHead: Record<string, string> = {};
  for (const block of blocks) {
    if (block.empty) continue;
    const headRole = isContractor
      ? (HEAD_ROLE[columns[block.first]] ?? []).find(role => block.units.some(u => u.key.startsWith(role)))
      : undefined;
    if (headRole) block.units = block.units.flatMap(u => (u.key === headRole ? splitByWork(u, org) : [u]));
    block.heads = headRole ? block.units.filter(u => u.key.startsWith(headRole)) : [block.units[0]];
    block.pool = block.units.filter(u => !block.heads.includes(u));
    for (const head of block.heads) {
      head.rowWorks = head.work ? [head.work] : works;
      if (!head.work && works.length > 1) {
        head.sharedByWorks = true;
        head.sub = `${works.join('・')}を掛け持ち`;
      }
      blockOfHead[head.key] = block.key;
    }
  }

  // 4. 行の見出し
  const rows: Row[] = org.works.map((work, i) => ({
    work: work.id,
    card: isContractor
      ? lineOfWork[work.id]!
      : isGross
        ? grossLine(grossLineUnits)
        : form === 'solo'
          ? ownWork(work.name)
          : org.clients[i],
  }));

  return {
    form,
    columns,
    management,
    rows,
    blocks,
    partners: org.partners,
    clientsOutside: form === 'smallUnit' || form === 'subcontract' || form === 'gross',
    clientCards: isGross ? org.clients : [],
    legs: buildLegs(form, works, blocks, columns, org.partners.length > 0),
    blockOfHead,
  };
}

function emptyBlock(key: string, first: number, last: number, empty: boolean): Block {
  return { key, first, last, units: [], empty, name: '', icon: '', total: 0, heads: [], pool: [] };
}

function nameBlock(block: Block, columns: DeptId[]) {
  const cols = columns.slice(block.first, block.last + 1);
  block.name =
    block.first === block.last
      ? DEPARTMENTS[cols[0]].name
      : cols.length >= 5
        ? 'すべての工程'
        : cols.map(c => DEPT_SHORT_NAME[c]).join('・');
  block.icon = DEPARTMENTS[cols[0]].icon;
  block.total = block.units.reduce((sum, u) => sum + u.count, 0);
}

/** 作品ごとの担当に分けられる役職なら、人数を作品の数で割って作品ごとのカードにする */
function splitByWork(unit: PlacedUnit, org: Organization): PlacedUnit[] {
  const works = org.works.map(w => w.id);
  if (unit.work || !SPLITTABLE_CHIEFS.includes(unit.key)) return [unit];
  if (unit.count < works.length) return [{ ...unit }];
  return works.map((work, i) => ({
    ...unit,
    key: unit.key + '@' + work,
    count: Math.floor(unit.count / works.length) + (i < unit.count % works.length ? 1 : 0),
    work,
    title: works.length > 1 ? `${unit.title} ${work}` : unit.title,
    sub: org.works[i].name,
  }));
}

function grossLine(units: StaffedUnit[]): GrossLine {
  const rep = units.find(u => u.key === 'rep');
  const desk = units.find(u => u.key === 'desk');
  const prog = units.find(u => u.key === 'prog');
  const rows: LineRow[] = [{ key: 'p', icon: 'case', label: 'P（代表）', count: 1 }];
  if (desk) rows.push({ key: 'd', icon: 'clip', label: 'デスク', count: desk.count });
  if (prog) rows.push({ key: 's', icon: 'car', label: '進行', count: prog.count });
  return {
    kind: 'unit',
    key: 'gline',
    title: '自社の制作ライン',
    icon: 'reel',
    work: 'A',
    sub: rep && rep.roles.includes('制作デスク') ? '代表がPとデスクを兼任' : '代表がプロデューサーを兼任',
    rows,
    count: units.reduce((sum, u) => sum + u.count, 0),
  };
}

function ownWork(name: string): OwnWork {
  return {
    kind: 'own-work',
    key: 'w-A',
    title: name,
    icon: 'reel',
    roles: ['企画・発表まで自分で'],
    work: 'A',
  };
}

/** 作品ごとの線（区間）。段階によって、だれが発注し、だれが指示するかが変わる */
function buildLegs(
  form: Form,
  works: WorkId[],
  blocks: Block[],
  columns: DeptId[],
  hasPartners: boolean,
): Partial<Record<WorkId, Leg[]>> {
  // 列 column にいる、作品 work の担当者のカードのキー
  const headOf = (column: DeptId, work: WorkId): string | null => {
    const i = columns.indexOf(column);
    const block = i < 0 ? undefined : blocks.find(b => !b.empty && b.first <= i && i <= b.last);
    const head = block?.heads.find(h => h.rowWorks?.includes(work));
    return head ? KEY.head(head.key) : null;
  };
  const headsOf = (cols: DeptId[], work: WorkId, except?: string | null): string[] => [
    ...new Set(cols.map(c => headOf(c, work)).filter((k): k is string => !!k && k !== except)),
  ];
  const leg = (kind: LegKind, from: string | null, to: (string | null)[], toPartners = false): Leg => ({
    kind,
    from: from ?? '',
    to: to.filter((k): k is string => !!k),
    toPartners,
  });

  const legs: Partial<Record<WorkId, Leg[]>> = {};
  for (const work of works) {
    const row = KEY.row(work);
    const list: Leg[] = [];
    switch (form) {
      case 'solo':
        list.push(
          leg('order', row, [KEY.head('solo')]),
          leg('outsideOrder', KEY.head('solo'), [], hasPartners),
        );
        break;
      case 'smallUnit': {
        // 代表が発注元から発注と指示を受け、社内のアニメーター・仕上げへ回す
        const rep = headOf('prod', work);
        const staff = headsOf(['anim', 'paint', 'post'], work, rep);
        list.push(
          leg('outsideOrder', row, [rep]),
          leg('order', rep, staff, hasPartners),
          leg('instruct', row, [rep]),
          leg('instruct', rep, staff),
        );
        break;
      }
      case 'subcontract': {
        // 制作進行が発注を受けて社内へ回し、元請の演出・作監のチェックは作画へ直接入る
        const prog = headOf('prod', work);
        list.push(
          leg('outsideOrder', row, [prog]),
          leg('order', prog, headsOf(['anim', 'paint'], work)),
          leg('instruct', row, headsOf(['anim'], work)),
        );
        break;
      }
      case 'gross': {
        // 元請から自社ラインへ発注。内容のチェックは元請から演出（いなければ作画）へ
        const client = KEY.client(work);
        const ensh = headOf('dir', work);
        list.push(
          leg('outsideOrder', client, [row]),
          leg('order', row, headsOf(['dir', 'anim', 'paint', 'post'], work), hasPartners),
        );
        if (ensh)
          list.push(
            leg('instruct', client, [ensh]),
            leg('instruct', ensh, headsOf(['anim', 'paint', 'post'], work)),
          );
        else list.push(leg('instruct', client, headsOf(['anim'], work)));
        break;
      }
      default: {
        // 元請：制作ラインが各部署の担当へ発注し、監督が各部署の担当へ指示する
        const kantoku = headOf('dir', work);
        list.push(leg('order', row, headsOf(['dir', 'anim', 'paint', 'art', 'post'], work), hasPartners));
        if (kantoku)
          list.push(leg('instruct', kantoku, headsOf(['anim', 'paint', 'art', 'post'], work), hasPartners));
      }
    }
    legs[work] = list.filter(l => l.from && (l.to.length || l.toPartners));
  }
  return legs;
}
