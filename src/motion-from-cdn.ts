/*
 * 1ファイル版（claude.ai のアーティファクト）だけで使う。
 * Motion を同梱せず、CDN から読み込んだもの（window.Motion）を使う。
 * vite.config.ts の single モードで、'motion' の読み込み先をこのファイルに差し替える。
 */
type MotionModule = typeof import('motion');
const Motion = (window as unknown as { Motion: MotionModule }).Motion;

export const { animate, stagger, frame, cancelFrame } = Motion;
export type { AnimationPlaybackControls, DOMKeyframesDefinition } from 'motion';
