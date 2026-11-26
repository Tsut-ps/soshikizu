/* 画面全体で使う決まりごと（人数の範囲・色・部署・工程） */

/** スライダーで選べる最大の人数 */
export const MAX_PEOPLE = 1000;

/** 同時に回す作品の記号。作品ごとに路線の色が決まる */
export type WorkId = 'A' | 'B' | 'C' | 'D';
export const WORK_IDS: readonly WorkId[] = ['A', 'B', 'C', 'D'];

export const WORK_COLOR: Record<WorkId, string> = {
  A: '#ff7a66',
  B: '#4fc3ff',
  C: '#b6ec5c',
  D: '#c79bff',
};
/** 作品に属さない線（所属・管理）の色 */
export const NEUTRAL_COLOR = '#dfe3ea';

/** 元請以上で同時に回す作品の名前（ラインA〜Dの順） */
export const WORK_TITLES: Record<WorkId, string> = {
  A: 'TVシリーズ',
  B: '配信シリーズ',
  C: '劇場版',
  D: 'TVシリーズ 2期',
};

/** 部署。名前とアイコン */
export type DeptId = 'solo' | 'mgmt' | 'plan' | 'prod' | 'dir' | 'anim' | 'paint' | 'art' | 'post';
export const DEPARTMENTS: Record<DeptId, { name: string; icon: string }> = {
  solo: { name: 'すべての工程', icon: 'person' },
  mgmt: { name: '経営・管理', icon: 'bldg' },
  plan: { name: '企画・版権', icon: 'tag' },
  prod: { name: '制作部', icon: 'reel' },
  dir: { name: '演出・文芸', icon: 'clap' },
  anim: { name: '作画部', icon: 'pencil' },
  paint: { name: '仕上げ部', icon: 'drop' },
  art: { name: '美術部', icon: 'mount' },
  post: { name: '撮影・CG・編集', icon: 'camera' },
};
/** 兼任でまとまった部署の名前を作るときの短い呼び名（例：演出・作画） */
export const DEPT_SHORT_NAME: Partial<Record<DeptId, string>> = {
  prod: '制作',
  dir: '演出',
  anim: '作画',
  paint: '仕上げ',
  art: '美術',
  post: '撮影',
};

/** カードを並べる順。上の役職ほど先、同じ部署では工程の順 */
// prettier-ignore
export const UNIT_ORDER = [
  'rep', 'tokatsu', 'kanri', 'kikaku', 'hanken', 'shohin', 'kaigai', 'solo',
  'desk', 'prog', 'lineA', 'lineB', 'lineC', 'lineD',
  'kantokuA', 'kantokuB', 'kantokuC', 'kantokuD', 'ensh', 'bungei',
  'anim', 'chara', 'sakkan', 'genga', 'dken', 'douga', 'kenshu', 'chiho',
  'shikisai', 'shiage', 'bikan', 'haikei', 'satsukan', 'satsu', 'cg', 'cgsat', 'henshu', 'eng', 'post',
];

/** 制作の工程。解説パネルで「社内で持てるか」を示す 12 工程 */
// prettier-ignore
export type StepId =
  | 'plan' | 'script' | 'story' | 'design' | 'key' | 'inb'
  | 'paint' | 'bg' | 'cg' | 'comp' | 'edit' | 'sound';
export const STEPS: readonly { id: StepId; name: string; icon: string }[] = [
  { id: 'plan', name: '企画・P', icon: 'case' },
  { id: 'script', name: '脚本', icon: 'script' },
  { id: 'story', name: '絵コンテ・演出', icon: 'board' },
  { id: 'design', name: 'キャラ・設定', icon: 'book' },
  { id: 'key', name: '原画', icon: 'pencil' },
  { id: 'inb', name: '動画', icon: 'sheets' },
  { id: 'paint', name: '仕上げ', icon: 'drop' },
  { id: 'bg', name: '美術背景', icon: 'mount' },
  { id: 'cg', name: '3DCG', icon: 'cube' },
  { id: 'comp', name: '撮影', icon: 'camera' },
  { id: 'edit', name: '編集', icon: 'cut' },
  { id: 'sound', name: '音響', icon: 'mic' },
];

/**
 * 部署の中の指示の順。左の役職は、右の役職（のどれか）から指示を受ける。
 * 部署の中でカードがこの順に並んだとき、間を「指示」の線でつなぐ。
 */
export const IN_DEPT_INSTRUCTOR: Record<string, string[]> = {
  genga: ['sakkan', 'rep'],
  douga: ['dken'],
  ensh: ['kantoku'],
  sakkan: ['chara'],
  shiage: ['shikisai'],
  haikei: ['bikan'],
  satsu: ['satsukan'],
  desk: ['rep'],
  prog: ['desk', 'rep'],
};
