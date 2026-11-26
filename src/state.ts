/* 画面の表示の状態（どの線を出すか・どの作品を見ているか・どのカードを選んでいるか） */
import type { WorkId } from './data/constants';

export const view = {
  /** 管理・発注の線を出す */
  showOrder: true,
  /** 内容の指示の線を出す */
  showInstruct: true,
  /** 作品の線や見出しにカーソルが乗っているとき、その作品 */
  hoveredWork: null as WorkId | null,
  /** 選んでいるカードのキー（keys.ts） */
  selected: null as string | null,
};
