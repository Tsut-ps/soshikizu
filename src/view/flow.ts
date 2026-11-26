/* 凡例の「発注」「指示」のボタン：押すと、その種類の線を出す・消す */
import { view } from '../state';
import { byId } from './dom';
import { repaint } from './world';

export function bindFlowToggles() {
  byId('flow').addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLElement>('button');
    if (!button) return;
    const shown =
      button.dataset.flow === 'instruct'
        ? (view.showInstruct = !view.showInstruct)
        : (view.showOrder = !view.showOrder);
    button.setAttribute('aria-pressed', String(shown));
    repaint();
  });
}
