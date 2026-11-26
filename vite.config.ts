import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** 1ファイル版で読み込む Motion（package.json の版と合わせる） */
const MOTION_CDN = 'https://cdn.jsdelivr.net/npm/motion@14.10.1/dist/motion.js';

/** <head> に Motion の CDN の <script> を足す（アプリのスクリプトより先に読み込まれる） */
const motionFromCdn = (): Plugin => ({
  name: 'motion-from-cdn',
  transformIndexHtml: html => html.replace('</head>', `<script src="${MOTION_CDN}"></script>\n</head>`),
});

// 通常のビルド（Cloudflare 用）は dist へ。Motion も同梱する。
// `--mode single` は、HTML 1枚にまとめて dist-single へ（claude.ai のアーティファクト用）。
// Motion は同梱せず CDN から読み、中身を読めるよう圧縮もしない。
// base を './' にして、どの階層に置いても読み込めるようにする。
export default defineConfig(({ mode }) =>
  mode === 'single'
    ? {
        base: './',
        plugins: [viteSingleFile(), motionFromCdn()],
        resolve: {
          alias: [
            {
              find: /^motion$/,
              replacement: fileURLToPath(new URL('./src/motion-from-cdn.ts', import.meta.url)),
            },
          ],
        },
        build: { outDir: 'dist-single', minify: false },
      }
    : { base: './', build: { outDir: 'dist' } },
);
