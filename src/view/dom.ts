/* DOM を扱う小さな道具 */

/** id で要素を取る。見つからなければすぐ気づけるよう例外にする */
export function byId<T extends HTMLElement | SVGElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as unknown as T;
}

/** index.html のアイコン（<symbol id="i-…">）を使う SVG */
export const iconSvg = (name: string, className = 'i') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** HTML の文字列に埋め込む値をエスケープする */
export const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** 中身が前と同じなら書き換えない（無駄な再描画とアニメーションのやり直しを防ぐ） */
export function setHtmlIfChanged(el: HTMLElement, html: string) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}
