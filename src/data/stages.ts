/* 規模の段階ごとの体制。人数から、どの役職が何人いるか・社外の相手は誰かを決める */
import { MAX_PEOPLE, WORK_IDS, type DeptId, type WorkId } from './constants';
import {
  animators,
  client,
  director,
  partner,
  productionLine,
  SOUND_STUDIO,
  studio,
  studioDirectors,
  unit,
  type Client,
  type Partner,
  type Unit,
} from './units';

/**
 * 図の組み方。段階の番号ではなく、この形で配置と線の引き方が決まる。
 * solo＝1人、smallUnit＝少人数（発注元は社外）、subcontract＝工程の下請、gross＝話数の下請、contractor＝元請
 */
export type Form = 'solo' | 'smallUnit' | 'subcontract' | 'gross' | 'contractor';

/** 段階の中身。体制の型（外注型・内製型）で差し替えられる部分 */
export interface StageShape {
  form: Form;
  name: string;
  /** 段階のボタンに出す短い名前 */
  short: string;
  /** 同時に回せる作品の説明。空なら行の数から「n本」と出す */
  worksLabel: string | ((people: number) => string);
  jobs: string;
  desc: string;
  points: string[];
  chain: string;
  next: string;
  /** 制作ラインを持たない段階で、行に並べる作品（または発注元）の名前 */
  workNames?: string[];
  /** 社内の役職と人数 */
  build: (people: number) => Unit[];
  /** 仕事を発注してくる社外の相手 */
  clients: (people: number) => Client[];
  /** 社外の協力先。has(key) で、その役職が社内にいるかを調べられる */
  partners: (people: number, has: (key: string) => boolean) => Partner[];
  /** 部署の見出しの下に出す、まとまりの名前（大手の「局」など） */
  columnNotes?: Partial<Record<DeptId, string>>;
  /** この形のもとにした実在の会社や資料（解説パネルに出す） */
  basis?: string;
}

/** 規模の段階。人数の範囲と、基本の型の中身 */
export interface Stage extends StageShape {
  /** この段階の人数の範囲 */
  min: number;
  max: number;
  /** 段階のボタンを押したときに選ぶ人数 */
  example: number;
}

/** 元請（26人以上）の外注先。社内に持たない工程の専門会社を足す */
export const contractorPartners = (has: (key: string) => boolean): Partner[] => [
  partner('x-script', '脚本家', 'script', 'フリーランス'),
  partner('x-free', 'フリーランスの原画・演出', 'pencil', '話数・カット単位で依頼'),
  partner('x-gross', 'グロス請けスタジオ', 'hand', '1クールのうち数話'),
  partner('x-overseas', '海外スタジオ', 'globe', '動画・仕上げの委託'),
  ...(has('haikei') ? [] : [partner('x-bg', '美術背景会社', 'mount', '背景・美術')]),
  ...(has('cg') ? [] : [partner('x-cg', '3DCGスタジオ', 'cube', 'CGの委託')]),
  ...(has('henshu') ? [] : [partner('x-edit', '編集スタジオ', 'cut', '編集・ポスプロ')]),
  SOUND_STUDIO,
];

export const noClients = (): Client[] => [];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** ラインを、スタジオにできるだけ均等に分ける（端数は先のスタジオへ） */
const splitLines = (lines: number, studios: number) =>
  Array.from({ length: studios }, (_, i) => Math.floor(lines / studios) + (i < lines % studios ? 1 : 0));

/** 局制の大手（201〜499人）のライン数：約45人で1ライン（MAPPA 467名・約10ラインから） */
const linesOfBureauStudio = (people: number) => clamp(Math.round(people / 45), 5, 10);
/** 大手グループ（500人〜）のライン数（推定） */
const linesOfGroup = (people: number) => clamp(Math.round(people / 70), 8, 14);

/** 大手の制作現場の共通部分：スタジオ・監督陣と、演出〜撮影の各部署 */
function majorStudioUnits(people: number, lines: number, studioCount: number, places: string[]): Unit[] {
  const perStudio = splitLines(lines, studioCount);
  const works: WorkId[] = WORK_IDS.slice(0, studioCount);
  return [
    ...works.map((work, i) => studio(work, perStudio[i], places[i])),
    ...works.map((work, i) => studioDirectors(work, perStudio[i])),
    unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], Math.round(lines * 1.5)),
    unit(
      'dir',
      'bungei',
      '文芸',
      'script',
      ['脚本管理', '設定'],
      ['script'],
      Math.max(3, Math.round(lines / 3)),
    ),
    unit(
      'anim',
      'chara',
      'キャラデザ・総作監',
      'book',
      ['キャラクターデザイン', '総作画監督'],
      ['design'],
      lines,
    ),
    unit('anim', 'sakkan', '作画監督', 'star', ['作画監督'], ['key'], lines * 2),
    ...animators(4, 5, '社員＋社内のフリーランス'),
    unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], lines),
    unit('paint', 'shikisai', '色彩設計', 'drop', ['色彩設計', '色指定'], ['paint'], lines),
    unit('paint', 'shiage', '仕上げ', 'drop', ['彩色', '仕上げ検査'], ['paint'], Math.round(people * 0.03)),
    unit(
      'art',
      'bikan',
      '美術監督',
      'mount',
      ['美術設定', '美術監督'],
      ['bg'],
      Math.max(3, Math.round(lines / 3)),
    ),
    unit('art', 'haikei', '背景', 'mount', ['背景'], ['bg'], Math.round(people * 0.03)),
    unit('post', 'satsukan', '撮影監督', 'camera', ['撮影監督'], ['comp'], lines),
    unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], lines * 2),
    unit(
      'post',
      'cg',
      '3DCG',
      'cube',
      ['モデリング', 'アニメーション', '3Dレイアウト'],
      ['cg'],
      Math.round(people * 0.08),
    ),
    unit('post', 'henshu', '編集', 'cut', ['編集'], ['edit'], Math.max(3, Math.round(lines / 3))),
    unit(
      'post',
      'eng',
      '技術開発',
      'clip',
      ['社内ツール開発', '機材・システム'],
      [],
      Math.round(people * 0.012) + 1,
    ),
  ];
}

export const STAGES: Stage[] = [
  {
    min: 1,
    max: 1,
    form: 'solo',
    example: 1,
    name: '個人作家',
    short: '個人',
    worksLabel: '短編 1本',
    jobs: '自主制作の短編・MV・SNS向けアニメ',
    desc: '企画から作画・彩色・背景・撮影・編集まで、一人ですべてを抱えます。個人制作の作品が劇場公開まで届いた例もありますが、作れるのは短編で、制作期間は年単位になります。',
    points: [
      '商業の現場で「1人」というと、多くはフリーランスとして元請から原画・作画監督・動画を請ける働き方です。フリーランスは原画・作画監督が中心で、ベテランが多くなります。',
      '音楽・声・ミックスは外部の協力者に頼ることがほとんどです。',
      '修正やリテイクも自分で抱えるため、スケジュールの余裕が品質を決めます。',
    ],
    chain:
      '路線はすべて1つの箱（自分）を通ります。商業の仕事を請けるときは、発注元の制作進行から締切と発注を、演出・作画監督から修正の指示を受ける側になります。',
    next: '2人目には、作画か、仕上げ・撮影を任せられる人を入れるのが定番です。',
    workNames: ['自主制作の短編'],
    build: () => [
      unit(
        'solo',
        'solo',
        '監督（全工程を兼任）',
        'clap',
        ['企画', '脚本', '絵コンテ', 'キャラ設定', '原画', '動画', '彩色', '背景', '撮影', '編集'],
        ['plan', 'script', 'story', 'design', 'key', 'inb', 'paint', 'bg', 'comp', 'edit'],
        1,
        { multiRole: true, span: ['prod', 'post'] },
      ),
    ],
    clients: noClients,
    partners: () => [partner('x-sound', '音響・音楽', 'mic', '声・音楽・ミックスの協力者')],
  },
  {
    min: 2,
    max: 4,
    form: 'smallUnit',
    example: 3,
    name: '少人数ユニット',
    short: '少人数',
    worksLabel: '短尺 1〜2本',
    jobs: 'MV・CM・ショートアニメ、原画・動画の請負',
    desc: '代表が営業・プロデューサー・監督を兼ねるのが普通です。デジタル作画と撮影ソフトの普及で、短尺なら少人数でも完成まで作れます。',
    points: [
      '代表は「P＋監督＋演出」など3役以上を抱えます。',
      '仕上げ・背景・撮影・編集は1人がまとめて兼任します。',
      '締切が重なると全員が作画に回ります。',
    ],
    chain: '発注元とのやりとり（発注とチェック）も、社内への内容の指示も、代表に集まります。',
    next: '5人を超えると、描く人とは別に、スケジュール管理と素材の回収をする制作進行が必要になります。',
    workNames: ['MV・CM・短尺'],
    build: people => {
      // 2人のときは、アニメーターが仕上げから編集までも兼ねる
      const animatorAlsoFinishes = people < 3;
      const units = [
        unit(
          'mgmt',
          'rep',
          '代表',
          'flag',
          ['プロデューサー', '監督', '脚本・絵コンテ', '営業'],
          ['plan', 'script', 'story'],
          1,
          {
            multiRole: true,
            span: ['prod', 'dir'],
          },
        ),
        unit(
          'anim',
          'anim',
          'アニメーター',
          'pencil',
          ['キャラ設定', '原画', '動画', ...(animatorAlsoFinishes ? ['彩色', '背景', '撮影', '編集'] : [])],
          [
            'design',
            'key',
            'inb',
            ...(animatorAlsoFinishes ? (['paint', 'bg', 'comp', 'edit'] as const) : []),
          ],
          null,
          { weight: 1, multiRole: people < 4, span: animatorAlsoFinishes ? ['anim', 'post'] : undefined },
        ),
      ];
      if (people >= 3) {
        units.push(
          unit(
            'post',
            'post',
            '仕上げ・背景・撮影',
            'camera',
            ['彩色', '背景', '撮影', '編集'],
            ['paint', 'bg', 'comp', 'edit'],
            1,
            {
              multiRole: true,
              span: ['paint', 'post'],
            },
          ),
        );
      }
      return units;
    },
    clients: () => [client('u-client', 'クライアント・元請', ['発注', '内容のチェック'], 'A')],
    partners: () => [SOUND_STUDIO],
  },
  {
    min: 5,
    max: 10,
    form: 'subcontract',
    example: 8,
    name: '作画スタジオ（下請）',
    short: '作画下請',
    worksLabel: '工程のみ',
    jobs: '原画・第二原画・動画・仕上げ（動仕）の工程請け。海外への再委託も',
    desc: '元請やグロス先から作画の工程を請ける専門スタジオです。動画と仕上げをまとめて（動仕）請けたり、海外のスタジオへ再委託したりもします。背景・撮影は持たず、描くことに特化します。代表が作画監督を兼ねる形は、公開情報からの推定です。',
    points: [
      '制作進行1人が、発注・回収・請求まで兼ねます。',
      '動画検査は動画のベテランが兼任します。',
      '複数の作品のカットを並行して請けます。作品ごとのラインはありません。',
      '売上の上限は、制作に投入できる人数でほぼ決まります。',
    ],
    chain:
      '発注とチェックの線は社外から入ってきます。複数の元請の制作進行から発注を受け、元請の演出・作画監督のチェックを受けます。社内では、代表が品質を、制作進行が日程を受け持ちます。',
    next: '10人を超え、演出と作画監督を社内に置けると、1話まるごと請ける「グロス請け」に進めます。',
    workNames: ['元請 X社の作品', '元請 Y社の作品'],
    build: people => {
      const progressAlsoBills = people < 9;
      const units = [
        unit('mgmt', 'rep', '代表（作画監督）', 'flag', ['経営', '作画監督', '営業'], ['key'], 1, {
          multiRole: true,
          span: ['anim', 'anim'],
        }),
        unit(
          'prod',
          'prog',
          '制作進行',
          'car',
          ['スケジュール', '発注・回収', ...(progressAlsoBills ? ['請求・経理'] : [])],
          [],
          progressAlsoBills ? 1 : 2,
          { multiRole: progressAlsoBills },
        ),
        ...animators(4, 5),
      ];
      if (people >= 7)
        units.push(
          unit('anim', 'dken', '動画検査', 'check', ['動画検査', '動画'], ['inb'], 1, { multiRole: true }),
        );
      if (people >= 10)
        units.push(unit('paint', 'shiage', '仕上げ', 'drop', ['彩色', '仕上げ検査'], ['paint'], 1));
      return units;
    },
    clients: () =>
      (['A', 'B'] as const).map(work =>
        client(
          'u-' + work,
          `元請 ${work === 'A' ? 'X' : 'Y'}社`,
          ['制作進行（発注・回収）', '演出・作監（チェック）'],
          work,
        ),
      ),
    partners: () => [],
  },
  {
    min: 11,
    max: 25,
    form: 'gross',
    example: 18,
    name: 'グロス請けスタジオ',
    short: 'グロス',
    worksLabel: '1話単位',
    jobs: 'TVシリーズの1話まるごとの制作（グロス請け）',
    desc: '元請から1話分をまるごと請け、演出・作画監督・原画・動画・仕上げを社内でまとめます。美術や撮影は、専門会社に出す会社も社内に持つ会社もあります。クレジットは「制作協力」になります。',
    points: [
      '代表がプロデューサーとデスクを兼ねます。',
      '1クールのうち1〜2話を担当し、話数ごとに演出・作画監督を立てます。',
      '演出はフリーランスに頼むことも多くあります。',
    ],
    chain:
      '社内に「代表（P兼任）→ デスク → 制作進行」の管理の線と、「演出 → 作画監督 → 原画」の内容の線の2系統ができます。監督チェックや総作監チェックは元請側に戻るのが一般的です（作品によります）。',
    next: '25人を超え、制作進行を4人以上置けると、シリーズ全体を請ける元請（1ライン）が視野に入ります。',
    workNames: ['元請のTVシリーズ（担当話数）'],
    build: people => {
      const repAlsoDesk = people < 16;
      const units = [
        unit(
          'mgmt',
          'rep',
          '代表（プロデューサー）',
          'flag',
          ['経営', 'プロデューサー', ...(repAlsoDesk ? ['制作デスク'] : [])],
          ['plan'],
          1,
          {
            multiRole: true,
            span: ['prod', 'prod'],
          },
        ),
      ];
      if (!repAlsoDesk)
        units.push(
          unit('prod', 'desk', '制作デスク', 'clip', ['スケジュール全体', '予算', '人の配置'], [], 1),
        );
      units.push(
        unit(
          'prod',
          'prog',
          '制作進行',
          'car',
          ['話数の進行', '素材の回収', '外注管理'],
          [],
          people >= 20 ? 3 : 2,
        ),
      );
      if (people >= 14)
        units.push(
          unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], 1, { multiRole: true }),
        );
      units.push(
        unit('anim', 'sakkan', '作画監督', 'star', ['作画監督', 'キャラ修正'], ['key'], people >= 18 ? 2 : 1),
        ...animators(4, 5, '社員＋社内のフリーランス'),
        unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], 1),
        unit(
          'paint',
          'shiage',
          '仕上げ',
          'drop',
          ['色指定', '彩色', '仕上げ検査'],
          ['paint'],
          people >= 13 ? 2 : 1,
          {
            multiRole: people < 13,
          },
        ),
      );
      if (people >= 22)
        units.push(unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], 2));
      return units;
    },
    clients: () => [
      client(
        'u-moto',
        '元請（発注元）',
        ['P・デスク（グロス発注）', '監督・総作監（チェック）', '音響・編集'],
        'A',
      ),
    ],
    partners: people => [
      partner('x-bg', '美術背景会社', 'mount', '背景を外注'),
      ...(people < 22 ? [partner('x-comp', '撮影会社', 'camera', '撮影を外注')] : []),
      ...(people < 14 ? [partner('x-ensh', 'フリーランスの演出', 'board', '各話演出を依頼')] : []),
    ],
  },
  {
    min: 26,
    max: 50,
    form: 'contractor',
    example: 38,
    name: '小規模元請（1ライン）',
    short: '元請1',
    worksLabel: 'TV 1本',
    jobs: 'TVシリーズ1作品（1クール）を元請として制作。年1〜2本',
    desc: '製作委員会から制作を受託し、プロデューサー・デスク・制作進行で1本の制作ラインを組みます。脚本・原画の多くはフリーランスに依頼し、美術・音響・一部の話数はグロス先や専門会社に出します。',
    points: [
      '制作進行は4〜5人で、話数をローテーションで担当します（1人2〜3話）。',
      '色彩設計が色指定・仕上げ検査も兼ねます。',
      '撮影と美術背景を社内に持つかは会社次第です（社内に持つ会社は、どちらも半数ほど）。',
      '20人ほどで元請をする会社や、P・監督・進行だけを持って残りを外注する元請もあります。',
    ],
    chain:
      '制作デスクが制作進行を束ね、進行は担当話数のすべてのスタッフに日程と発注の線を持ちます（内容の指示は出しません）。内容の指示は監督から演出・作画・色・撮影の各責任者へ下ります。プロデューサーと監督は並列で、プロデューサーは起用・予算・日程を受け持ちます。',
    next: '2本目を同時に回すには、プロデューサー・デスク・進行をもう1組（2本目のライン）そろえる必要があります。',
    build: people => {
      const kanriAlsoHr = people < 35;
      const units = [
        unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1),
        unit(
          'mgmt',
          'kanri',
          '管理',
          'bldg',
          ['経理', '総務', ...(kanriAlsoHr ? ['人事'] : [])],
          [],
          kanriAlsoHr ? 1 : 2,
          {
            multiRole: kanriAlsoHr,
          },
        ),
        productionLine('A', 1, people >= 40 ? 5 : 4, people >= 32 ? 1 : 0),
        director('A'),
        unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], people >= 42 ? 2 : 1),
        unit(
          'anim',
          'sakkan',
          '作画監督',
          'star',
          ['総作監', '作画監督', 'キャラ設定'],
          ['key', 'design'],
          people >= 38 ? 3 : 2,
        ),
        ...animators(4, 5, '社員＋社内のフリーランス'),
        unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], 1),
        unit('paint', 'shikisai', '色彩設計', 'drop', ['色彩設計', '色指定', '仕上げ検査'], ['paint'], 1, {
          multiRole: true,
        }),
        unit('paint', 'shiage', '仕上げ', 'drop', ['彩色'], ['paint'], 2),
        unit('post', 'satsukan', '撮影監督', 'camera', ['撮影監督'], ['comp'], 1),
        unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], people >= 34 ? 3 : 2),
      ];
      if (people >= 45)
        units.push(unit('dir', 'bungei', '文芸', 'script', ['脚本管理', 'シリーズ構成補佐'], ['script'], 1));
      if (people >= 38)
        units.push(
          unit('post', 'cg', '3DCG', 'cube', ['モデリング', '3Dレイアウト'], ['cg'], people >= 46 ? 2 : 1),
        );
      return units;
    },
    clients: noClients,
    partners: (_, has) => contractorPartners(has),
  },
  {
    min: 51,
    max: 100,
    form: 'contractor',
    example: 75,
    name: '中規模元請（2ライン）',
    short: '元請2',
    worksLabel: 'TV 2本',
    jobs: 'TVシリーズ2本を並行。劇場・配信作品も',
    desc: '制作部にラインを2つ置き、作品ごとにプロデューサー・デスク・進行と監督がつきます。作画・仕上げ・撮影・CGはライン横断の共通部門として、両方の作品を支えます。',
    points: [
      '総務・経理・人事が独立した管理部門になります。',
      '新人を動画から育てる研修を持ちやすくなります。',
      'それでも原画・動画の相当部分は、社外のフリーランスや国内外のスタジオに頼ります。',
    ],
    chain:
      '作品ラインごとに管理の線（色）と、監督からの内容の線（色）が引かれ、共通の作画・仕上げ・撮影部門は2つの作品から発注と指示を受けます（マトリクス型）。部門の中の流れ（作画監督 → 原画、動画検査 → 動画）は作品をまたいで共通です。',
    next: '3本目のラインを持つには、作品を企画する人材と、版権・海外取引を扱う部署が必要になります。',
    build: people => {
      const large = people >= 80;
      const managers = large ? 5 : 4;
      const units = [
        unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1),
        unit('mgmt', 'tokatsu', '制作統括', 'case', ['ライン横断の管理', '役員'], ['plan'], 1),
        unit('mgmt', 'kanri', '管理部', 'bldg', ['総務', '経理', '人事'], [], people >= 75 ? 5 : 3),
        productionLine('A', 1, managers, 1),
        productionLine('B', 1, managers, 1),
        director('A'),
        director('B'),
        unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], large ? 4 : 2),
        unit('dir', 'bungei', '文芸', 'script', ['脚本管理', '設定'], ['script'], 1),
        unit(
          'anim',
          'sakkan',
          '作画監督',
          'star',
          ['総作監', '作画監督', 'キャラ設定'],
          ['key', 'design'],
          large ? 5 : 4,
        ),
        ...animators(4, 4, '社員＋社内のフリーランス'),
        unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], 2),
        unit('paint', 'shikisai', '色彩設計', 'drop', ['色彩設計', '色指定'], ['paint'], 2),
        unit('paint', 'shiage', '仕上げ', 'drop', ['彩色', '仕上げ検査'], ['paint'], large ? 5 : 3),
        unit('post', 'satsukan', '撮影監督', 'camera', ['撮影監督'], ['comp'], 2),
        unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], large ? 6 : 3),
        unit('post', 'cg', '3DCG', 'cube', ['モデリング', 'アニメーション'], ['cg'], large ? 5 : 2),
      ];
      if (people >= 65) {
        units.push(
          unit('anim', 'kenshu', '新人動画（研修）', 'cap', ['動画研修'], ['inb'], 3),
          unit('art', 'bikan', '美術監督', 'mount', ['美術設定', '美術監督'], ['bg'], 1),
          unit('art', 'haikei', '背景', 'mount', ['背景'], ['bg'], people >= 85 ? 4 : 2),
        );
      }
      if (people >= 70)
        units.push(
          unit('plan', 'kikaku', '企画・版権', 'tag', ['企画', '版権窓口'], ['plan'], people >= 85 ? 2 : 1),
        );
      if (people >= 85) units.push(unit('post', 'henshu', '編集', 'cut', ['編集'], ['edit'], 1));
      return units;
    },
    clients: noClients,
    partners: (_, has) => contractorPartners(has),
  },
  {
    min: 101,
    max: 200,
    form: 'contractor',
    example: 140,
    name: '大手元請（3ライン以上）',
    short: '大手',
    worksLabel: '',
    jobs: 'TV・劇場・配信を並行。自社IPの企画と版権ビジネス',
    desc: '部門ごとに専門職がそろい、ラインが作品単位で動きます。企画・版権・海外営業を持ち、自ら出資して権利を持つ作品も手がけます。',
    points: [
      '制作局や製作室の下に作品ラインが並び、全体を制作統括が見ます。',
      '美術・CG・撮影・編集まで内製でき、品質をそろえやすくなります。',
      '音響は音響制作会社に任せるのが一般的です。',
      '人が多くても、繁忙期は社外スタジオとの協業が前提です。',
      '一方で、京都アニメーションのように、ほぼ全工程を内製してラインを少なく保つ会社もあります。',
    ],
    chain:
      '作品ラインが3〜4本並び、職能部門と交差します。作品ラインの見出しを押すと、その作品の管理の線と内容の線が、どの部門に入っているかを追えます。',
    next: '200人を超えると制作ラインが10本前後に増え、ラインを束ねる「スタジオ」と、部署をまとめる「局」ができます。',
    build: people => {
      const big = people >= 150;
      const lines = big ? 4 : 3;
      const managers = big ? 5 : 4;
      const works = WORK_IDS.slice(0, lines);
      return [
        unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1),
        unit('mgmt', 'tokatsu', '役員・制作統括', 'case', ['経営', 'ライン横断の管理'], ['plan'], 2),
        unit(
          'mgmt',
          'kanri',
          '管理部',
          'bldg',
          ['総務', '経理', '人事', '法務'],
          [],
          Math.round(people * 0.05),
        ),
        unit('plan', 'kikaku', '企画', 'case', ['企画開発', '原作窓口'], ['plan'], big ? 3 : 2),
        unit('plan', 'hanken', '版権・ライセンス', 'tag', ['版権管理', '商品化'], [], big ? 3 : 2),
        unit('plan', 'kaigai', '海外営業', 'globe', ['海外配信・取引'], [], 1),
        ...works.map(work => productionLine(work, 1, managers, 1)),
        ...works.map(director),
        unit('dir', 'ensh', '演出', 'board', ['各話演出', '絵コンテ'], ['story'], lines + 1),
        unit('dir', 'bungei', '文芸', 'script', ['脚本管理', '設定'], ['script'], 2),
        unit(
          'anim',
          'chara',
          'キャラデザ・総作監',
          'book',
          ['キャラクターデザイン', '総作画監督'],
          ['design'],
          2,
        ),
        unit('anim', 'sakkan', '作画監督', 'star', ['作画監督'], ['key'], lines * 2 - 2),
        ...animators(4, 4, '社員＋社内のフリーランス'),
        unit('anim', 'dken', '動画検査', 'check', ['動画検査'], ['inb'], lines),
        unit('anim', 'kenshu', '新人動画（研修）', 'cap', ['動画研修', '育成'], ['inb'], big ? 6 : 4),
        unit('paint', 'shikisai', '色彩設計', 'drop', ['色彩設計', '色指定'], ['paint'], lines),
        unit('paint', 'shiage', '仕上げ', 'drop', ['彩色', '仕上げ検査'], ['paint'], lines + 1),
        unit('art', 'bikan', '美術監督', 'mount', ['美術設定', '美術監督'], ['bg'], 2),
        unit('art', 'haikei', '背景', 'mount', ['背景'], ['bg'], big ? 8 : 4),
        unit('post', 'satsukan', '撮影監督', 'camera', ['撮影監督'], ['comp'], lines),
        unit('post', 'satsu', '撮影', 'camera', ['撮影', '特殊効果'], ['comp'], lines * 2),
        unit('post', 'cg', '3DCG', 'cube', ['モデリング', 'アニメーション'], ['cg'], big ? 12 : 5),
        unit('post', 'henshu', '編集', 'cut', ['編集'], ['edit'], 2),
      ];
    },
    clients: noClients,
    partners: (_, has) => contractorPartners(has),
  },
  {
    min: 201,
    max: 499,
    form: 'contractor',
    example: 450,
    name: '大手（局制・約10ライン）',
    short: '局制',
    worksLabel: people => `${linesOfBureauStudio(people)}ライン`,
    basis: 'MAPPA（467〜562名、制作局に約10ライン、CGI局160名超）の公開情報をもとにした型です。',
    jobs: 'TV・劇場・配信を年に十数本。自社出資の作品と、局単位の内製',
    desc: '制作ラインが10本前後になり、ラインを束ねる制作スタジオと、部署をまとめる「局」ができます。MAPPA（562名）が公開している体制がこの形で、制作局の約10ラインの横に、作画演出局・CGI局・ライツビジネス局・管理局が並びます。',
    points: [
      '行はスタジオ（ラインの束）です。1つのスタジオが3〜4本のラインを持ち、ラインごとに監督がつきます。',
      'CGI局が最大の部門になります。3DCGに加えて色彩・美術・撮影・編集までを1つの局で内製します。',
      '東京の外に、動画・仕上げを担う地方スタジオや、CGのサテライトスタジオを持ちます。',
      '人が多くても、原画・動画の相当部分は社外のフリーランスや国内外のスタジオに頼ります。',
      'ufotable（正社員約250名で1ライン前後）のような内製型もあり、ライン数は人数より内製の度合いで決まります。',
    ],
    chain:
      'スタジオの制作ラインが各局へ発注し、ラインごとの監督陣が各局の担当者へ指示します。局の中では、作画監督 → 原画、動画検査 → 動画の流れがスタジオをまたいで共通です。',
    next: '500人を超えると、制作の外にも子会社（海外の製作スタジオ、録音・編集、海外販売）を持つグループになります。',
    build: people => {
      const lines = linesOfBureauStudio(people);
      return [
        unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1),
        unit('mgmt', 'tokatsu', '役員・制作統括', 'case', ['経営', 'スタジオ横断の管理'], ['plan'], 3),
        unit(
          'mgmt',
          'kanri',
          '管理局',
          'bldg',
          ['経理', '財務', '人事', '総務・システム', '法務'],
          [],
          Math.round(people * 0.05),
        ),
        unit(
          'plan',
          'kikaku',
          'ライツ局',
          'tag',
          ['企画プロデュース', 'ライセンス事業', '事業推進'],
          ['plan'],
          Math.round(people * 0.04),
        ),
        ...majorStudioUnits(people, lines, lines >= 8 ? 3 : 2, ['東京', '東京', '東京']),
        unit('anim', 'kenshu', '新人研修', 'cap', ['動画研修', '育成'], ['inb'], 6),
        unit(
          'anim',
          'chiho',
          '地方スタジオ',
          'sheets',
          ['動画', '仕上げ'],
          ['inb', 'paint'],
          Math.round(people * 0.06),
          {
            sub: '動画・仕上げを担う東京の外の拠点',
          },
        ),
        unit('post', 'cgsat', 'CGサテライト', 'cube', ['3DCG'], ['cg'], Math.round(people * 0.03), {
          sub: 'CGI局の地方拠点',
        }),
      ];
    },
    clients: noClients,
    partners: (_, has) => contractorPartners(has),
    columnNotes: { dir: '作画演出局', anim: '作画演出局', paint: 'CGI局', art: 'CGI局', post: 'CGI局' },
  },
  {
    min: 500,
    max: MAX_PEOPLE,
    form: 'contractor',
    example: 1000,
    name: '大手グループ（子会社を持つ）',
    short: '連結',
    worksLabel: people => `${linesOfGroup(people)}ライン`,
    basis: '東映アニメーション（連結1,048名、映像製作部門が約86%）の公開情報をもとにした型です。',
    jobs: 'TVシリーズを毎週数本、劇場作品を年に数本。版権・商品・海外を事業として持つ',
    desc: '制作の外に、版権・商品・海外の事業部門と、子会社（海外の製作スタジオ、録音・編集、海外販売）を持つグループになります。東映アニメーション（連結1,048名）がこの形で、それでも8割以上の人は映像の製作部門にいます。',
    points: [
      '東映アニメーションの従業員は、映像製作・販売896名、版権76名、商品販売20名、その他56名です（2026年3月）。',
      '原画から動画・背景・CGまで請け負う海外の製作子会社と、録音・編集を請け負う子会社を持ちます。',
      'アジア・米州・欧州に、放映権や版権を売る販売子会社を置きます。',
      '人材は社内のアカデミーで育てます（2023年開講）。東京の外のスタジオと、ライン数（1000人で約14本）は推定です。',
    ],
    chain:
      '4つ前後の制作スタジオが、それぞれ複数のラインで各部署へ発注します。監督陣からの内容の指示は、スタジオごとに各部署の担当者へ下ります。動画・彩色・背景の一部は、グループの海外製作子会社へ出します。',
    next: 'この先も人数は増やせますが、同時に回せる本数を決めるのは、監督・演出・作画監督など中核スタッフの数です。',
    build: people => {
      const lines = linesOfGroup(people);
      return [
        unit('mgmt', 'rep', '代表', 'flag', ['経営'], [], 1),
        unit(
          'mgmt',
          'tokatsu',
          '役員・制作統括',
          'case',
          ['経営', 'スタジオ横断の管理'],
          ['plan'],
          Math.round(people * 0.006),
        ),
        unit(
          'mgmt',
          'kanri',
          '管理部門',
          'bldg',
          ['経理', '財務', '人事', '総務', '法務'],
          [],
          Math.round(people * 0.03),
        ),
        unit('plan', 'kikaku', '企画', 'case', ['企画開発', '原作窓口'], ['plan'], Math.round(people * 0.01)),
        unit('plan', 'hanken', '版権事業', 'tag', ['版権管理', 'ライセンス'], [], Math.round(people * 0.06)),
        unit(
          'plan',
          'shohin',
          '商品・イベント事業',
          'tag',
          ['商品販売', 'イベント'],
          [],
          Math.round(people * 0.05),
        ),
        unit(
          'plan',
          'kaigai',
          '海外事業',
          'globe',
          ['海外販売', '販売子会社との連携'],
          [],
          Math.round(people * 0.01),
        ),
        ...majorStudioUnits(people, lines, 4, ['東京', '東京', '東京', '大阪']),
        unit(
          'anim',
          'kenshu',
          '作画アカデミー',
          'cap',
          ['育成', '動画研修'],
          ['inb'],
          Math.round(people * 0.02),
        ),
        unit(
          'anim',
          'chiho',
          '地方スタジオ',
          'sheets',
          ['動画', '仕上げ'],
          ['inb', 'paint'],
          Math.round(people * 0.04),
          {
            sub: '動画・仕上げを担う東京の外の拠点',
          },
        ),
      ];
    },
    clients: noClients,
    partners: (_, has) => [
      partner('x-sub-prod', '海外製作子会社', 'globe', '子会社：原画〜動画・背景・CG'),
      partner('x-sub-rec', '録音・編集子会社', 'mic', '子会社：録音・編集'),
      partner('x-sub-sales', '海外販売子会社', 'globe', '子会社：アジア・米州・欧州'),
      ...contractorPartners(has),
    ],
  },
];

export const stageOf = (people: number): Stage =>
  STAGES.find(s => people >= s.min && people <= s.max) ?? STAGES[0];
