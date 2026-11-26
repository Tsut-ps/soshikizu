/*
 * 部品の位置をばねで目標へ動かす。
 * 位置ごとに速さを持つので、動いている途中で目標が変わっても（スライダーのドラッグ中）、
 * 今の勢いのまま向きだけ変えて追いかける。毎フレームの更新は Motion の frame で回す。
 */
import { cancelFrame, frame } from 'motion';
import { prefersReducedMotion } from './animation';
import type { Box, Boxes } from './layout';

const STIFFNESS = 170;
const DAMPING = 24;
/** 目標にこれより近く、これより遅ければ、止まったとみなす */
const REST_DISTANCE = 0.25;
const REST_SPEED = 2;
/** 1フレームの時間の上限（秒）。タブが裏にあった後などに大きく飛ばないようにする */
const MAX_STEP = 0.032;
/** フレームの更新が止まっていたら、この時間（ms）の後に最終の位置へ置く */
const STALL_FALLBACK_MS = 1100;

export class SpringBoxes {
  /** いまの位置（毎フレーム更新される） */
  readonly current: Boxes = {};
  private target: Boxes = {};
  private velocity: Record<string, Record<string, number>> = {};
  private running = false;
  private lastTick = 0;
  private fallbackTimer = 0;

  /** onFrame は位置が変わるたびに呼ばれる（部品を置き直し、線を引き直す） */
  constructor(private readonly onFrame: () => void) {}

  /** 目標を差し替える。新しく出た部品は目標の位置から始める */
  moveTo(next: Boxes) {
    this.target = next;
    for (const key in this.current) {
      if (!(key in next)) {
        delete this.current[key];
        delete this.velocity[key];
      }
    }
    for (const key in next) if (!this.current[key]) this.current[key] = { ...next[key] };

    if (prefersReducedMotion) {
      this.jumpToTarget();
    } else {
      if (!this.running) {
        this.running = true;
        this.lastTick = performance.now();
        frame.update(this.tick, true);
      }
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = window.setTimeout(() => {
        if (this.running && performance.now() - this.lastTick > 300) this.jumpToTarget();
      }, STALL_FALLBACK_MS);
    }
    this.onFrame();
  }

  /** 動きを省いて、すぐに目標の位置へ置く */
  jumpToTarget() {
    this.stop();
    for (const key in this.target) {
      this.current[key] = { ...this.target[key] };
      delete this.velocity[key];
    }
    this.onFrame();
  }

  private stop() {
    if (!this.running) return;
    this.running = false;
    cancelFrame(this.tick);
  }

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(MAX_STEP, Math.max(0.001, (now - this.lastTick) / 1000));
    this.lastTick = now;
    let moving = false;
    for (const key in this.target) {
      const goal = this.target[key];
      const box = (this.current[key] ??= { ...goal });
      const speed = (this.velocity[key] ??= {});
      for (const prop in goal) {
        const p = prop as keyof Box;
        const to = goal[p];
        if (typeof to !== 'number') {
          (box as Record<string, unknown>)[p] = to;
          continue;
        }
        const from = box[p];
        let x = typeof from === 'number' && Number.isFinite(from) ? from : to;
        let v = speed[p] ?? 0;
        v += (-STIFFNESS * (x - to) - DAMPING * v) * dt;
        x += v * dt;
        if (Math.abs(x - to) < REST_DISTANCE && Math.abs(v) < REST_SPEED) {
          x = to;
          v = 0;
        } else moving = true;
        (box as Record<string, number>)[p] = x;
        speed[p] = v;
      }
    }
    this.onFrame();
    if (!moving) this.stop();
  };
}
