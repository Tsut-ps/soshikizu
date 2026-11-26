/*
 * 画面の部品を指すキー。配置・線・選択で同じキーを使う。
 * 例：'r-A'（作品Aの行の見出し）、'hd:sakkan@B'（作画部の作品B担当のカード）
 */
import type { WorkId } from './data/constants';

export const KEY = {
  /** 社内の枠（点線の大きな囲み） */
  wall: 'wall',
  /** 「発注元（社外）」の見出し */
  clientsLabel: 'lab-up',
  /** 社外の協力先の箱 */
  partners: 'b-ext',
  /** 上段の経営・管理のカード */
  management: (unitKey: string) => 'n-' + unitKey,
  /** 作品の行の見出し（制作ライン・発注元・自主制作の作品） */
  row: (work: WorkId) => 'r-' + work,
  /** グロス請けで、行の左に置く元請のカード */
  client: (work: WorkId) => 'u-' + work,
  /** 部署の上段（作品の行の上）に置く担当者のカード */
  head: (unitKey: string) => 'hd:' + unitKey,
  /** 部署の下段（共通の人員）のカード */
  pool: (unitKey: string) => 'pl:' + unitKey,
  /** 作品の行の、線を通す高さ（上＝発注、下＝指示） */
  lane: (work: WorkId) => 'ln-' + work,
} as const;

export const isHeadKey = (key: string) => key.startsWith('hd:');
export const isPoolKey = (key: string) => key.startsWith('pl:');
export const isRowKey = (key: string) => key.startsWith('r-');
export const isClientKey = (key: string) => key.startsWith('u-');
export const isManagementKey = (key: string) => key.startsWith('n-');
/** 'hd:' や 'pl:' を外した役職のキー */
export const unitKeyOf = (key: string) => key.slice(3);

/** カードの要素から、選択に使うキーを求める（上段の担当者・下段の共通の人員・それ以外） */
export function keyOfCard(card: HTMLElement): string {
  const key = card.dataset.key!;
  if (card.closest('.block-heads')) return KEY.head(key);
  if (card.closest('.block-pool')) return KEY.pool(key);
  return key;
}

/** 作品の行の見出し（または行の左の元請）のキーなら、その作品。ほかは null */
export function workOfKey(key: string | null): WorkId | null {
  if (!key || !(isRowKey(key) || isClientKey(key))) return null;
  return key.slice(2) as WorkId;
}
