/* 組織図に出てくる「人のまとまり」と「社外の相手」の型と、作るための関数 */
import { WORK_TITLES, type DeptId, type StepId, type WorkId } from './constants';

/** 制作ラインのカードの中の1行（P・デスク・進行・設定） */
export interface LineRow {
  key: string;
  icon: string;
  label: string;
  count: number;
}

/** 社内の役職ひとつ（同じ役職の人をまとめた1枚のカード） */
export interface Unit {
  kind: 'unit';
  dept: DeptId;
  key: string;
  title: string;
  icon: string;
  roles: string[];
  steps: StepId[];
  /** 人数。null なら、固定の人数を引いた残りを weight の比で配る */
  count: number | null;
  weight?: number;
  /** 1人（1組）で複数の役を兼ねている */
  multiRole?: boolean;
  sub?: string;
  /** 特定の作品（大手では制作スタジオ）の担当 */
  work?: WorkId;
  /** 行の見出しになる役職だけが持つ、絞り込みボタンなどに出す名前 */
  workName?: string;
  /** 制作ラインのカードだけが持つ内訳 */
  rows?: LineRow[];
  /** 兼任で複数の部署にまたがるとき、その左端と右端の部署 */
  span?: [DeptId, DeptId];
}

/** 社外の協力先（外注先）。社外の箱に並ぶ */
export interface Partner {
  kind: 'partner';
  key: string;
  title: string;
  icon: string;
  sub: string;
}

/** 仕事を発注してくる社外の相手（元請・クライアント） */
export interface Client {
  kind: 'client';
  key: string;
  title: string;
  icon: string;
  roles: string[];
  work: WorkId;
}

/** 1人のときの、自主制作の作品（行の見出し） */
export interface OwnWork {
  kind: 'own-work';
  key: string;
  title: string;
  icon: string;
  roles: string[];
  work: WorkId;
}

export const unit = (
  dept: DeptId,
  key: string,
  title: string,
  icon: string,
  roles: string[],
  steps: StepId[],
  count: number | null,
  options: Partial<Pick<Unit, 'weight' | 'multiRole' | 'sub' | 'work' | 'workName' | 'rows' | 'span'>> = {},
): Unit => ({ kind: 'unit', dept, key, title, icon, roles, steps, count, ...options });

export const partner = (key: string, title: string, icon: string, sub: string): Partner => ({
  kind: 'partner',
  key,
  title,
  icon,
  sub,
});

export const client = (key: string, title: string, roles: string[], work: WorkId): Client => ({
  kind: 'client',
  key,
  title,
  icon: 'case',
  roles,
  work,
});

/** 作品ごとの制作ライン（P・デスク・進行・設定）。人数は内訳の合計 */
export const productionLine = (work: WorkId, producers: number, managers: number, settei: number): Unit => {
  const rows: LineRow[] = [
    { key: 'p', icon: 'case', label: 'P', count: producers },
    { key: 'd', icon: 'clip', label: 'デスク', count: 1 },
    { key: 's', icon: 'car', label: '進行', count: managers },
  ];
  if (settei) rows.push({ key: 't', icon: 'book', label: '設定', count: settei });
  return unit(
    'prod',
    'line' + work,
    `ライン ${work}`,
    'reel',
    [],
    ['plan'],
    producers + 1 + managers + settei,
    {
      work,
      sub: WORK_TITLES[work],
      rows,
    },
  );
};

/**
 * 大手の制作スタジオ（行の見出し）。いくつもの制作ラインをまとめて持つ。
 * 1ラインにつき P・デスク各1人、進行4人、2ラインにつき設定1人。
 */
export const studio = (work: WorkId, lines: number, place: string): Unit => {
  const rows: LineRow[] = [
    { key: 'p', icon: 'case', label: 'P', count: lines },
    { key: 'd', icon: 'clip', label: 'デスク', count: lines },
    { key: 's', icon: 'car', label: '進行', count: lines * 4 },
    { key: 't', icon: 'book', label: '設定', count: Math.ceil(lines / 2) },
  ];
  return unit(
    'prod',
    'line' + work,
    `スタジオ ${work}`,
    'reel',
    [],
    ['plan'],
    rows.reduce((sum, r) => sum + r.count, 0),
    {
      work,
      sub: `${place}・${lines}ライン`,
      workName: `スタジオ${work}（${lines}ライン）`,
      rows,
    },
  );
};

/** 大手の制作スタジオの監督陣（ラインの数だけ監督がいる） */
export const studioDirectors = (work: WorkId, lines: number): Unit =>
  unit(
    'dir',
    'kantoku' + work,
    `監督陣 ${work}`,
    'clap',
    ['監督', 'シリーズ演出', '絵コンテ'],
    ['story'],
    lines,
    {
      work,
      sub: `${lines}ライン分`,
    },
  );

/** 作品ごとの監督 */
export const director = (work: WorkId): Unit =>
  unit('dir', 'kantoku' + work, `監督 ${work}`, 'clap', ['監督', '絵コンテ'], ['story'], 1, {
    work,
    sub: WORK_TITLES[work],
  });

/** 原画と動画。人数は残りを重みで配る */
export const animators = (keyWeight: number, inbetweenWeight: number, sub?: string): Unit[] => [
  unit('anim', 'genga', '原画', 'pencil', ['レイアウト', '原画', '第二原画'], ['key'], null, {
    weight: keyWeight,
    sub,
  }),
  unit('anim', 'douga', '動画', 'sheets', ['動画', 'クリーンアップ'], ['inb'], null, {
    weight: inbetweenWeight,
    sub,
  }),
];

export const SOUND_STUDIO = partner('x-sound', '音響制作会社', 'mic', '音響監督・声優・ミックス');
