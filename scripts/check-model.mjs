/*
 * モデルの整合チェック：1〜1000人 × 3つの型 のすべてで、
 * 役職の人数の合計が選んだ人数と一致し、負の人数がないかを調べる。
 * 型ごとの段階の名前・行（ライン）の数・社内に持たない部署も一覧にする。
 */
import { createServer } from 'vite';
const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const { organize } = await server.ssrLoadModule('/src/model.ts');
const { buildPlan } = await server.ssrLoadModule('/src/plan.ts');
const problems = [];
const summary = {};
for (const sourcing of ['outsource', 'standard', 'inhouse']) {
  for (let n = 1; n <= 1000; n++) {
    const org = organize(n, sourcing);
    const total = org.units.reduce((s, u) => s + u.count, 0);
    const negative = org.units.filter(u => u.count < 0 || !Number.isInteger(u.count));
    const anim = org.units
      .filter(u => u.key === 'genga' || u.key === 'douga')
      .reduce((s, u) => s + u.count, 0);
    if (total !== n || negative.length)
      problems.push({ sourcing, n, total, negative: negative.map(u => u.key) });
    const plan = buildPlan(org);
    const key = `${sourcing}:${org.stageIndex}`;
    summary[key] ??= {
      name: org.shape.name,
      form: org.shape.form,
      variant: org.hasVariant,
      rows: new Set(),
      minAnim: Infinity,
      emptyCols: new Set(),
    };
    summary[key].rows.add(plan.rows.length);
    summary[key].minAnim = Math.min(summary[key].minAnim, anim);
    plan.blocks.filter(b => b.empty).forEach(b => summary[key].emptyCols.add(b.key));
    for (const [w, legs] of Object.entries(plan.legs))
      for (const l of legs) if (!l.from) problems.push({ sourcing, n, leg: 'no from', w });
  }
}
console.log('problems:', problems.length, JSON.stringify(problems.slice(0, 8)));
for (const [k, v] of Object.entries(summary))
  console.log(
    k.padEnd(13),
    v.variant ? '★' : ' ',
    v.form.padEnd(11),
    'rows',
    [...v.rows].join('/'),
    'minAnim',
    v.minAnim,
    'empty',
    [...v.emptyCols].join(','),
    v.name,
  );
await server.close();
