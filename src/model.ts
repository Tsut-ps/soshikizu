/* 人数から、その規模の体制（役職ごとの人数・工程の内製状況・作品・社外の相手）を求める */
import { STEPS, UNIT_ORDER, WORK_IDS, type StepId, type WorkId } from './data/constants';
import { STAGES, stageOf, type Stage, type StageShape } from './data/stages';
import { shapeOf, type Sourcing } from './data/variants';
import type { Client, Partner, Unit } from './data/units';

/** 工程を社内で持てるか：in＝専任がいる／ken＝兼任でまかなう／out＝社外に出す */
export type StepState = 'in' | 'ken' | 'out';

/** 人数が決まった役職 */
export type StaffedUnit = Unit & { count: number };

export interface Work {
  id: WorkId;
  name: string;
}

export interface Organization {
  people: number;
  /** 人数で決まる段階（段階のボタンはこれで光る） */
  stage: Stage;
  /** STAGES の中の番号 */
  stageIndex: number;
  /** 体制の型と、それを当てた段階の中身（図はこれで組む） */
  sourcing: Sourcing;
  shape: StageShape;
  /** この段階に、選んだ型の形があるか（なければ基本と同じ） */
  hasVariant: boolean;
  /** 1人以上いる役職。並びは UNIT_ORDER の順 */
  units: StaffedUnit[];
  stepStates: Record<StepId, StepState>;
  clients: Client[];
  partners: Partner[];
  works: Work[];
}

/**
 * 人数が決まっていない役職（count が null）に、残りの人数を重みの比で配る。
 * 端数は、小数点以下が大きい役職から1人ずつ足す（最大剰余法）。
 */
function distributeRemaining(units: Unit[], people: number): StaffedUnit[] {
  const fixed = units.reduce((sum, u) => sum + (u.count ?? 0), 0);
  const flexible = units.filter(u => u.count == null);
  const remaining = Math.max(0, people - fixed);
  const totalWeight = flexible.reduce((sum, u) => sum + (u.weight ?? 0), 0);

  const fractions = flexible.map(u => {
    const exact = (remaining * (u.weight ?? 0)) / totalWeight;
    u.count = Math.floor(exact);
    return { unit: u, fraction: exact - u.count };
  });
  let left = remaining - flexible.reduce((sum, u) => sum + (u.count ?? 0), 0);
  fractions
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ unit }) => {
      if (left > 0) {
        unit.count = (unit.count ?? 0) + 1;
        left--;
      }
    });
  return units as StaffedUnit[];
}

function stepStatesOf(units: StaffedUnit[]): Record<StepId, StepState> {
  const states = {} as Record<StepId, StepState>;
  for (const { id } of STEPS) {
    const doers = units.filter(u => u.steps.includes(id));
    states[id] = doers.some(u => !u.multiRole) ? 'in' : doers.length ? 'ken' : 'out';
  }
  return states;
}

export function organize(people: number, sourcing: Sourcing = 'basic'): Organization {
  const stage = stageOf(people);
  const stageIndex = STAGES.indexOf(stage);
  const { shape, hasVariant } = shapeOf(stageIndex, sourcing);
  const units = distributeRemaining(shape.build(people), people)
    .filter(u => u.count > 0)
    .sort((a, b) => UNIT_ORDER.indexOf(a.key) - UNIT_ORDER.indexOf(b.key));

  const unitKeys = new Set(units.map(u => u.key));
  const has = (key: string) => unitKeys.has(key);

  // 制作ラインを持たない段階は決まった名前の作品、持つ段階はラインの数だけ作品がある
  const works: Work[] = shape.workNames
    ? shape.workNames.map((name, i) => ({ id: WORK_IDS[i], name }))
    : units
        .filter(u => u.rows && u.work)
        .map(u => ({ id: u.work as WorkId, name: u.workName ?? u.sub ?? '' }));

  return {
    people,
    stage,
    stageIndex,
    sourcing,
    shape,
    hasVariant,
    units,
    stepStates: stepStatesOf(units),
    clients: shape.clients(people),
    partners: shape.partners(people, has),
    works,
  };
}
