/*
 * 体制の型（外注型・基本・内製型）。
 * 同じ人数でも、制作をどこまで社内で持つかで、ライン数と部署の形が大きく変わる。
 * （1ラインあたりの人数は、外注の多いMAPPAで約45人、ほぼ全部を内製するufotableで約250人）
 * ここでは、基本の段階（stages.ts）に対して、外注型・内製型で差し替える部分だけを書く。
 */
import { WORK_IDS, type WorkId } from './constants';
import { contractorPartners, noClients, STAGES, type StageShape } from './stages';
import {
  animators,
  director,
  partner,
  productionLine,
  SOUND_STUDIO,
  unit,
  type LineRow,
  type Partner,
  type Unit,
} from './units';

export type Sourcing = 'outsource' | 'basic' | 'inhouse';
export const SOURCING_LABEL: Record<Sourcing, string> = {
  outsource: '外注型',
  basic: '基本',
  inhouse: '内製型',
};

type Variant = Partial<StageShape>;

/* ---------- 外注先 ---------- */

const OUTSIDE_PRODUCTION: Partner[] = [
  partner('x-gross', 'グロス請けスタジオ', 'hand', '話数をまとめて外注'),
  partner('x-anim', '作画スタジオ', 'pencil', '原画・動画'),
  partner('x-paint', '仕上げ会社', 'drop', '彩色・仕上げ検査'),
  partner('x-bg', '美術背景会社', 'mount', '背景・美術'),
  partner('x-comp', '撮影会社', 'camera', '撮影・編集'),
];
const SCRIPT_AND_FREELANCE: Partner[] = [
  partner('x-script', '脚本家', 'script', 'フリーランス'),
  partner('x-free', 'フリーランスの原画・演出', 'pencil', '話数・カット単位で依頼'),
];

/* ---------- プロデュース型の元請（P・監督・進行だけを持ち、残りを外注） ---------- */

/** 自社の制作ライン（行の見出し）。P は代表が兼ねる */
function ownLine(rows: LineRow[], sub: string): Unit {
  const shown = rows.filter(r => r.count > 0);
  return unit(
    'prod',
    'lineA',
    '自社の制作ライン',
    'reel',
    [],
    ['plan'],
    shown.reduce((sum, r) => sum + r.count, 0),
    {
      work: 'A',
      sub,
      workName: '自社の元請作品',
      rows: shown,
    },
  );
}

const producerTypeCommon: Variant = {
  form: 'contractor',
  worksLabel: '1本',
  clients: noClients,
  workNames: undefined,
  chain:
    '発注・管理の線は自社の制作ラインから外注先へ、内容の指示は監督から外注先へ出ます。社内の人は少なくても、元請として作品全体の日程と品質を受け持ちます。',
};

const producerTypeSmall: Variant = {
  ...producerTypeCommon,
  name: 'プロデュース型の元請（少人数）',
  jobs: '自社で元請になり、作画から撮影までを外注先へ出す',
  desc: '代表がプロデューサーとして元請になり、監督と制作進行だけを社内に置いて、作画・仕上げ・背景・撮影は外注先へ出す形です。人数が少なくても元請はできます。',
  points: [
    '元請の約2割は10人以下の会社です（公正取引委員会の調査）。',
    '社内の仕事は、企画・予算・日程・外注先の手配と、監督による内容のチェックです。',
    '外注先の空き状況で、作れる本数と品質が決まります。',
  ],
  next: '人が増えたら、制作進行を増やして話数を回すか、作画を社内に持つかを選ぶことになります。',
  basis:
    '公正取引委員会の調査（元請の18.6%が10人以下）と、労働政策研究・研修機構の事例（2人がPと監督になり、残りを外注する形）をもとにした型です。',
  build: people => [
    ownLine(
      [
        { key: 'p', icon: 'case', label: 'P（代表）', count: 1 },
        { key: 's', icon: 'car', label: '進行', count: Math.max(0, people - 2) },
      ],
      '元請の短尺・配信作品',
    ),
    director('A'),
  ],
  partners: () => [...OUTSIDE_PRODUCTION, SOUND_STUDIO],
};

const producerTypeStudio: Variant = {
  ...producerTypeCommon,
  name: 'プロデュース型の元請',
  jobs: 'TVシリーズ・配信作品を元請し、作画から撮影までを外注先へ出す',
  desc: 'P・デスク・制作進行と監督・演出だけを社内に持ち、作画・仕上げ・背景・撮影はグロス請けや専門会社へ出す元請です。社内に描く人はいなくても、作品をまるごと請けられます。',
  points: [
    '元請の約2割は10人以下の会社です（公正取引委員会の調査）。',
    '制作進行が話数を分けて受け持ち、外注先への発注と素材の回収を回します。',
    '外注費の割合が大きく、外注先との関係が会社の力になります。',
  ],
  next: '作画を社内に持てば、外注に頼らずに品質をそろえやすくなります（グロス請けから元請に上がる道とは逆の順です）。',
  basis: '公正取引委員会の調査（元請の18.6%が10人以下）をもとにした型です。',
  build: people => {
    const ensh = people >= 8 ? 1 : 0;
    const desk = people >= 6 ? 1 : 0;
    const settei = people >= 10 ? 1 : 0;
    const progress = people - 2 - ensh - desk - settei;
    const units = [
      ownLine(
        [
          { key: 'p', icon: 'case', label: 'P（代表）', count: 1 },
          { key: 'd', icon: 'clip', label: 'デスク', count: desk },
          { key: 's', icon: 'car', label: '進行', count: progress },
          { key: 't', icon: 'book', label: '設定', count: settei },
        ],
        'TVシリーズ（元請）',
      ),
      director('A'),
    ];
    if (ensh) units.push(unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], ensh));
    return units;
  },
  partners: () => [...SCRIPT_AND_FREELANCE, ...OUTSIDE_PRODUCTION, SOUND_STUDIO],
};

/* ---------- 元請の制作現場（ライン数と、社内に持つ工程を選んで組む） ---------- */

interface OwnedSteps {
  art: boolean;
  cg: boolean;
  edit: boolean;
}

/** 経営・管理。人数に合わせて制作統括・企画・版権を足す */
function managementUnits(people: number): Unit[] {
  const units = [unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1)];
  if (people >= 51)
    units.push(
      unit(
        'mgmt',
        'tokatsu',
        '制作統括',
        'case',
        ['ライン横断の管理', '役員'],
        ['plan'],
        people >= 150 ? 2 : 1,
      ),
    );
  units.push(
    unit(
      'mgmt',
      'kanri',
      '管理部',
      'bldg',
      ['経理', '総務', '人事'],
      [],
      Math.max(1, Math.round(people * 0.04)),
    ),
  );
  if (people >= 101) {
    units.push(
      unit(
        'plan',
        'kikaku',
        '企画',
        'case',
        ['企画開発', '原作窓口'],
        ['plan'],
        Math.max(1, Math.round(people * 0.01)),
      ),
      unit(
        'plan',
        'hanken',
        '版権・ライセンス',
        'tag',
        ['版権管理', '商品化'],
        [],
        Math.max(1, Math.round(people * 0.01)),
      ),
    );
  }
  return units;
}

/** 制作ライン・監督と、演出〜撮影の各部署。own で美術・3DCG・編集を社内に持つかを決める */
function productionUnits(people: number, lines: number, own: OwnedSteps): Unit[] {
  const works: WorkId[] = WORK_IDS.slice(0, lines);
  const managers = people < 40 ? 3 : people >= 100 ? 5 : 4;
  const units = [
    ...works.map(work => productionLine(work, 1, managers, people >= 40 ? 1 : 0)),
    ...works.map(director),
    unit(
      'dir',
      'ensh',
      '演出',
      'board',
      ['各話演出', '絵コンテ'],
      ['story'],
      Math.max(1, Math.round(people * 0.025)),
    ),
  ];
  if (people >= 51)
    units.push(
      unit(
        'dir',
        'bungei',
        '文芸',
        'script',
        ['脚本管理', '設定'],
        ['script'],
        Math.max(1, Math.round(people * 0.01)),
      ),
    );
  units.push(
    unit(
      'anim',
      'sakkan',
      '作画監督',
      'star',
      ['作画監督', 'キャラ修正'],
      ['key', 'design'],
      Math.max(2, Math.round(people * 0.04)),
    ),
    ...animators(4, 5, '社員＋社内のフリーランス'),
    unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], Math.max(1, Math.round(people * 0.015))),
    unit(
      'paint',
      'shikisai',
      '色彩設計',
      'drop',
      ['色彩設計', '色指定'],
      ['paint'],
      Math.max(1, Math.round(lines / 2)),
    ),
    unit(
      'paint',
      'shiage',
      '仕上げ',
      'drop',
      ['彩色', '仕上げ検査'],
      ['paint'],
      Math.max(2, Math.round(people * 0.05)),
    ),
  );
  if (own.art) {
    units.push(
      unit(
        'art',
        'bikan',
        '美術監督',
        'mount',
        ['美術設定', '美術監督'],
        ['bg'],
        Math.max(1, Math.round(lines / 2)),
      ),
      unit('art', 'haikei', '背景', 'mount', ['背景'], ['bg'], Math.max(2, Math.round(people * 0.05))),
    );
  }
  units.push(
    unit(
      'post',
      'satsukan',
      '撮影監督',
      'camera',
      ['撮影監督'],
      ['comp'],
      Math.max(1, Math.round(lines / 2)),
    ),
    unit(
      'post',
      'satsu',
      '撮影',
      'camera',
      ['撮影', '特殊効果'],
      ['comp'],
      Math.max(2, Math.round(people * 0.05)),
    ),
  );
  if (own.cg)
    units.push(
      unit(
        'post',
        'cg',
        '3DCG',
        'cube',
        ['モデリング', 'アニメーション'],
        ['cg'],
        Math.max(1, Math.round(people * 0.05)),
      ),
    );
  if (own.edit)
    units.push(
      unit('post', 'henshu', '編集', 'cut', ['編集'], ['edit'], Math.max(1, Math.round(people * 0.01))),
    );
  return units;
}

const outsourcedContractor = (lines: number, name: string): Variant => ({
  name,
  worksLabel: `${lines}本`,
  jobs: `TVシリーズ・配信作品を${lines}本並行。美術・3DCGは外注先へ`,
  desc: `同じ人数でも、ラインを${lines}本に増やし、美術背景・3DCGを専門会社へ出して本数を増やす形です。社内の人の多くは、制作の管理と作画の中核に集まります。`,
  points: [
    'ラインが多い分、1つの作品に社内で割ける人は少なくなります。',
    '美術背景・3DCG・編集は専門会社へ出し、品質は監督・美術監督（社外）・撮影監督のチェックでそろえます。',
    '原画・動画の多くも、社外のフリーランスやグロス請けに頼ります。',
  ],
  basis:
    '外注の多い元請の型です。1ラインあたりの人数は、外注の多いMAPPAで約45人とされます（ライン数は推定）。',
  build: people => [
    ...managementUnits(people),
    ...productionUnits(people, lines, { art: false, cg: false, edit: false }),
  ],
  // 社内に持たない美術・3DCG・編集は、専門会社が外注先に加わる
  partners: (_, has) => contractorPartners(has),
});

const inHouseContractor = (lines: number, name: string, basis: string): Variant => ({
  name,
  worksLabel: `${lines}本`,
  jobs: `作品を${lines}本に絞り、美術・3DCG・撮影・編集まで社内で作る`,
  desc: `ラインを${lines}本に絞り、作画から美術背景・3DCG・撮影・編集までを社内で作る形です。外注に頼らない分、作品ごとの品質と画づくりをそろえやすくなります。`,
  points: [
    '同時に作る本数は少なく、1つの作品に社内の多くの人が関わります。',
    '社員として雇い、社内で育てる会社が多くなります。',
    '音響は、内製型でも音響制作会社に任せるのが一般的です。',
  ],
  basis,
  build: people => [
    ...managementUnits(people),
    ...productionUnits(people, lines, { art: true, cg: true, edit: true }),
  ],
  partners: () => [SOUND_STUDIO],
});

/* ---------- 段階ごとの差し替え（段階の番号は STAGES の並び） ---------- */

const VARIANTS: Partial<Record<number, Partial<Record<'outsource' | 'inhouse', Variant>>>> = {
  // 2〜4人
  1: { outsource: producerTypeSmall },
  // 5〜10人
  2: {
    outsource: producerTypeStudio,
    inhouse: {
      name: '作画スタジオ（動仕まで請ける）',
      jobs: '二原・動画・仕上げ（動仕）をまとめて請ける。海外への再委託も',
      desc: '作画の工程に加えて、動画と仕上げをまとめて（動仕）請ける下請です。仕上げを社内に持つ分、元請から見ると1か所に任せられる範囲が広がります。',
      basis: '株式会社暁（約10人、二原・動画・仕上げの下請と海外への動仕発注）のような型です。',
      build: people => {
        const units = STAGES[2].build(people).filter(u => u.key !== 'shiage');
        units.push(
          unit(
            'paint',
            'shiage',
            '仕上げ（動仕）',
            'drop',
            ['彩色', '仕上げ検査'],
            ['paint'],
            Math.max(1, Math.round(people * 0.2)),
          ),
        );
        return units;
      },
      partners: () => [partner('x-overseas', '海外スタジオ', 'globe', '動画・仕上げの再委託')],
    },
  },
  // 11〜25人
  3: {
    outsource: {
      ...producerTypeCommon,
      name: '小規模元請（プロデュース型）',
      jobs: 'TVシリーズ1本を元請。作画の中核だけを社内に持つ',
      desc: 'グロス請けではなく、少人数のまま元請になる形です。P・デスク・進行と監督・演出・作画監督を社内に置き、原画の一部と、仕上げ・背景・撮影は外注先へ出します。',
      points: [
        '20人ほどで元請をする会社もあります。',
        '話数の一部はグロス請けのスタジオへ出します。',
        '社内の作画監督が、外注先から上がる原画をそろえます。',
      ],
      next: '25人を超えると、仕上げや撮影を社内に持ち、外注を減らせます。',
      basis: 'ミルパンセ（約20人でグロス請けから元請に移った）のような型です。',
      build: people => {
        const progress = people >= 16 ? 4 : 3;
        const settei = people >= 18 ? 1 : 0;
        return [
          unit('mgmt', 'rep', '代表（プロデューサー）', 'flag', ['経営', 'プロデューサー'], ['plan'], 1, {
            multiRole: true,
          }),
          ownLine(
            [
              { key: 'd', icon: 'clip', label: 'デスク', count: 1 },
              { key: 's', icon: 'car', label: '進行', count: progress },
              { key: 't', icon: 'book', label: '設定', count: settei },
            ],
            'TVシリーズ（元請）',
          ),
          director('A'),
          unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], people >= 18 ? 2 : 1),
          unit('anim', 'sakkan', '作画監督', 'star', ['作画監督', 'キャラ修正'], ['key', 'design'], 2),
          ...animators(4, 3, '社員＋社内のフリーランス'),
        ];
      },
      partners: () => [...SCRIPT_AND_FREELANCE, ...OUTSIDE_PRODUCTION, SOUND_STUDIO],
    },
    inhouse: {
      name: 'グロス請けスタジオ（仕上げ・撮影まで社内）',
      desc: '元請から1話分をまるごと請け、作画に加えて仕上げ・撮影・編集まで社内で作る形です。外注に出すのは美術背景が中心になります。',
      basis:
        '労働政策研究・研修機構の事例（25名のD社は仕上げ部・撮影部・編集部を社内に持っていた）をもとにした型です。',
      build: people => {
        const units = STAGES[3].build(people).filter(u => !['shiage', 'satsu'].includes(u.key));
        units.push(
          unit(
            'paint',
            'shiage',
            '仕上げ',
            'drop',
            ['色指定', '彩色', '仕上げ検査'],
            ['paint'],
            people >= 18 ? 3 : 2,
          ),
          unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], 2),
        );
        if (people >= 16) units.push(unit('post', 'henshu', '編集', 'cut', ['編集'], ['edit'], 1));
        return units;
      },
      partners: people => [
        partner('x-bg', '美術背景会社', 'mount', '背景を外注'),
        ...(people < 14 ? [partner('x-ensh', 'フリーランスの演出', 'board', '各話演出を依頼')] : []),
      ],
    },
  },
  // 26〜50人
  4: {
    outsource: outsourcedContractor(2, '小規模元請（外注型・2ライン）'),
    inhouse: inHouseContractor(
      1,
      '小規模元請（内製型・1ライン）',
      '京都アニメーションやufotableのように、ほぼ全工程を内製してラインを少なく保つ会社を、この人数に縮めた型です（推定）。',
    ),
  },
  // 51〜100人
  5: {
    outsource: outsourcedContractor(3, '中規模元請（外注型・3ライン）'),
    inhouse: inHouseContractor(
      1,
      '中規模元請（内製型・1ライン）',
      '京都アニメーションやufotableのように、ほぼ全工程を内製してラインを少なく保つ会社を、この人数に縮めた型です（推定）。',
    ),
  },
  // 101〜200人
  6: {
    outsource: outsourcedContractor(4, '大手元請（外注型・4ライン）'),
    inhouse: inHouseContractor(
      2,
      '大手元請（内製型・2ライン）',
      '京都アニメーション（約150〜190名）のように、ほぼ全工程を内製し、ラインを少なく保つ型です。',
    ),
  },
  // 201〜499人：基本（MAPPA型）がすでに外注の多い型なので、内製型だけを足す
  7: {
    inhouse: {
      ...inHouseContractor(
        2,
        '大手（全内製・少ライン）',
        'ufotable（正社員約250名）のように、1〜2ラインに絞り、ほぼ全工程を内製する型です。',
      ),
      name: '大手（全内製・少ライン）',
      columnNotes: undefined,
      build: people => [
        ...managementUnits(people),
        ...productionUnits(people, 2, { art: true, cg: true, edit: true }),
        unit('anim', 'kenshu', '新人研修', 'cap', ['動画研修', '育成'], ['inb'], Math.round(people * 0.02)),
        unit(
          'anim',
          'chiho',
          '地方スタジオ',
          'sheets',
          ['作画', '仕上げ', '撮影'],
          ['key', 'paint', 'comp'],
          Math.round(people * 0.1),
          {
            sub: '東京の外の制作拠点',
          },
        ),
      ],
    },
  },
};

/** 段階と型から、図に使う中身を求める（型がない段階は基本のまま） */
export function shapeOf(stageIndex: number, sourcing: Sourcing): { shape: StageShape; hasVariant: boolean } {
  const stage = STAGES[stageIndex];
  const variant = sourcing === 'basic' ? undefined : VARIANTS[stageIndex]?.[sourcing];
  return { shape: { ...stage, ...variant }, hasVariant: !!variant };
}
