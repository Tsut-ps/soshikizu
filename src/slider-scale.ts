/*
 * 人数スライダーの目盛り。小さな規模の違いを見やすくするため、対数で並べる。
 * 位置は 0〜1（左端が1人、右端が最大の人数）。
 */
import { MAX_PEOPLE } from './data/constants';

const LOG_MAX = Math.log(MAX_PEOPLE);

/** スライダーの目盛りの数。対数なので、細かくしないと大きい人数で数が飛ぶ */
export const SLIDER_STEPS = 4000;

export const positionOf = (people: number) => Math.log(Math.max(1, people)) / LOG_MAX;

export const peopleAt = (position: number) =>
  Math.min(MAX_PEOPLE, Math.max(1, Math.round(Math.exp(position * LOG_MAX))));

export const clampPeople = (people: number) => Math.min(MAX_PEOPLE, Math.max(1, Math.round(people)));
