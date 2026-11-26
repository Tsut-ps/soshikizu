/*
 * キャンバスの移動と拡大縮小（地図と同じ操作）。
 * ドラッグで移動、ホイール・ピンチでカーソルの位置を中心に拡大縮小、ダブルクリックで拡大。
 */
import { animate, type AnimationPlaybackControls } from 'motion';
import { prefersReducedMotion } from './animation';
import { byId } from './dom';
import { scene, worldEl } from './world';

export const canvas = byId('canvas');

/** 平行移動（x, y）と倍率（scale） */
export const camera = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.2;
/** 背景の点の間隔（倍率1のとき）。縮小して詰まりすぎたら間引く */
const DOT_SPACING = 24;
const MIN_DOT_SPACING = 14;

let cameraAnimation: AnimationPlaybackControls | null = null;
/** ドラッグで動かした直後のクリックを、カードの選択として扱わないための印 */
let dragged = false;
export const wasDragged = () => dragged;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function applyCamera() {
  worldEl.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  // 背景の点もキャンバスと一緒に動かす。縮小して詰まりすぎたら間隔を2倍に間引く
  let spacing = DOT_SPACING;
  while (spacing * camera.scale < MIN_DOT_SPACING) spacing *= 2;
  const size = spacing * camera.scale;
  canvas.style.backgroundSize = `${size}px ${size}px`;
  canvas.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
}

export function stopCamera() {
  cameraAnimation?.stop();
}

export function setCamera(to: typeof camera, animated: boolean) {
  stopCamera();
  if (!animated || prefersReducedMotion) {
    Object.assign(camera, to);
    applyCamera();
    return;
  }
  const from = { ...camera };
  cameraAnimation = animate(0, 1, {
    duration: 0.55,
    ease: [0.2, 0.8, 0.2, 1],
    onUpdate: t => {
      camera.x = lerp(from.x, to.x, t);
      camera.y = lerp(from.y, to.y, t);
      camera.scale = lerp(from.scale, to.scale, t);
      applyCamera();
    },
  });
}

/**
 * 全体が見えるように合わせる。mode が 'width' なら幅に合わせる（縦ははみ出してよい）。
 * 上は操作パネルの分だけ空ける。
 */
export function fitView(animated: boolean, mode: 'all' | 'width' = 'all') {
  const vw = canvas.clientWidth;
  const vh = canvas.clientHeight;
  const narrow = vw < 760;
  const top = narrow ? 120 : 96;
  const { w, h } = scene.size;
  const fitWidth = (vw - 32) / w;
  const fitHeight = (vh - top - 16) / h;
  const scale =
    mode === 'width'
      ? Math.max(narrow ? 0.6 : 0.82, Math.min(1, fitWidth))
      : Math.max(0.15, Math.min(1, fitWidth, fitHeight));
  const x = w * scale < vw ? (vw - w * scale) / 2 : 16;
  const y = h * scale < vh - top ? Math.max(top, (vh - h * scale) / 2) : top;
  setCamera({ x, y, scale }, animated);
}

/** 画面上の点（px, py）を中心に、factor 倍する */
export function zoomAt(px: number, py: number, factor: number, animated = false) {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
  const k = scale / camera.scale;
  setCamera({ scale, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k }, animated);
}

export const zoomAtCenter = (factor: number) =>
  zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, factor, true);

/** 画面上の要素が、キャンバスの中央付近に来るように動かす（少し拡大もする） */
export function bringIntoView(el: Element) {
  const r = el.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const scale = Math.max(camera.scale, 0.8);
  const k = scale / camera.scale;
  const cx = (r.left + r.width / 2 - c.left - camera.x) * k + camera.x;
  const cy = (r.top + Math.min(r.height / 2, 120) - c.top - camera.y) * k + camera.y;
  setCamera({ scale, x: camera.x + c.width / 2 - cx, y: camera.y + c.height * 0.45 - cy }, true);
}

/** 操作の受け付け（ドラッグ・ピンチ・ホイール・キー・ボタン） */
export function bindCameraControls() {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; scale: number } | null = null;
  let drag: { x: number; y: number; cameraX: number; cameraY: number; id: number } | null = null;
  const onControls = (e: Event) => !!(e.target as Element).closest('.canvas-buttons,.float');

  canvas.addEventListener('pointerdown', e => {
    if (onControls(e)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    drag = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y, id: e.pointerId };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: camera.scale };
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = canvas.getBoundingClientRect();
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(
        (a.x + b.x) / 2 - rect.left,
        (a.y + b.y) / 2 - rect.top,
        (pinch.scale * distance) / pinch.distance / camera.scale,
      );
      dragged = true;
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    // 5px 未満の動きはクリックとして扱う
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    if (!dragged) {
      dragged = true;
      canvas.classList.add('drag');
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ポインタがすでに離れていれば取れない */
      }
    }
    stopCamera();
    camera.x = drag.cameraX + dx;
    camera.y = drag.cameraY + dy;
    applyCamera();
  });

  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      drag = null;
      canvas.classList.remove('drag');
      // 直後の click イベントが「ドラッグだった」とわかるように、少し遅らせて戻す
      setTimeout(() => (dragged = false), 0);
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // ホイール（トラックパッドの二本指・ピンチを含む）で、カーソルの位置を中心に拡大縮小
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      const delta = Math.max(-120, Math.min(120, e.deltaY * unit));
      stopCamera();
      // ピンチ（ctrlKey つき）は細かく届くので、強めに効かせる
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0025)));
    },
    { passive: false },
  );

  canvas.addEventListener('keydown', e => {
    const step = 60;
    const move = (
      { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<
        string,
        number[]
      >
    )[e.key];
    if (move) {
      e.preventDefault();
      setCamera({ x: camera.x + move[0], y: camera.y + move[1], scale: camera.scale }, true);
    }
    if (e.key === '+' || e.key === '=') zoomAtCenter(1.2);
    if (e.key === '-') zoomAtCenter(1 / 1.2);
    if (e.key === '0') fitView(true);
    if (e.key === 'w' || e.key === 'W') fitView(true, 'width');
  });

  byId('zoom-in').addEventListener('click', () => zoomAtCenter(1.25));
  byId('zoom-out').addEventListener('click', () => zoomAtCenter(1 / 1.25));
  byId('fit-all').addEventListener('click', () => fitView(true));
  byId('fit-width').addEventListener('click', () => fitView(true, 'width'));

  // キャンバスはスクロールさせない（Tab でカードへ移ったときにブラウザが勝手にずらすのを戻す）
  canvas.addEventListener('scroll', () => {
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  });

  // 画面の幅が変わったら、幅に合わせ直す
  let lastWidth = canvas.clientWidth;
  new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth) return;
    lastWidth = canvas.clientWidth;
    fitView(true, 'width');
  }).observe(canvas);
}
