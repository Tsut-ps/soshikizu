# soshikizu（組織図）

人数に合わせて、組織の形がどう変わるかを描く Web ページです。今はアニメスタジオに対応しています。

アニメスタジオ版：人数（1〜1000人）と体制の型（外注型・基本・内製型）を変えると、その規模のアニメ制作会社の体制を、路線図のような組織図で描き直します。

## 使い方

```sh
npm install
npm run dev           # 開発サーバ
npm run build         # 型チェック → dist/ にビルド
npm run deploy        # ビルドして Cloudflare Workers（Static Assets）へ配信（wrangler login が必要）
npm run build:single  # HTML 1枚にまとめて dist-single/ へ（claude.ai のアーティファクト用）
npm run format        # Prettier で整形
npm run check:model   # 全人数×全型で、役職の人数の合計が人数と合うかを調べる
```

## しくみ

人数・型 → `organize()`（体制）→ `buildPlan()`（路線図の形）→ `showPlan()`（配置・線・アニメーション）

- 行＝作品、列＝部署（工程の順）。部署の上段に作品ごとの担当者、下段に作品をまたぐ共通の人員を置く
- 線は作品の色。実線＝管理・発注、破線＝内容の指示、点線＝社外からの発注
- 体制の型：同じ人数でも、外注型はラインを増やして工程を外へ出し、内製型はラインを絞って工程を社内に持つ（1ラインあたりの人数は MAPPA で約45人、ufotable で約250人）
- 200人を超えると、行は作品ではなく、ラインを束ねる制作スタジオになる（大手の局制・グループの目安）
- 配置はばねで動かし、目標が変わっても勢いを保って追いかける（ドラッグ中も止まらない）

## ファイル

| ファイル | 役割 |
| --- | --- |
| `src/data/constants.ts` | 人数の上限・作品の色・部署・工程・並び順 |
| `src/data/units.ts` | 役職・社外の相手の型と、作る関数 |
| `src/data/stages.ts` | 規模の段階ごとの体制と解説（基本の型） |
| `src/data/variants.ts` | 外注型・内製型で差し替える部分 |
| `src/model.ts` | 人数から体制を求める |
| `src/plan.ts` | 路線図の形（行・列・担当者・線の区間） |
| `src/keys.ts` | 部品を指すキーの決まり |
| `src/state.ts` | 表示の状態（線の切り替え・絞り込み・選択） |
| `src/view/world.ts` | 部品をそろえ、配置して、線を引く |
| `src/view/layout.ts` | 配置の計算 |
| `src/view/spring.ts` | ばねのアニメーション |
| `src/view/tracks.ts` | 線を引く |
| `src/view/cards.ts` | カードと部署の DOM |
| `src/view/highlight.ts` | 強調表示（薄く・隠す・選択枠） |
| `src/view/selection.ts` | 選択と解説パネルの相手一覧 |
| `src/view/camera.ts` | 移動・拡大縮小 |
| `src/view/panel.ts` | 人数バーと解説パネル |
| `src/view/flow.ts` | 凡例の「発注」「指示」で線を出す・消す |
| `scripts/check-model.mjs` | モデルの人数の整合チェック |
| `public/_headers` | Cloudflare が付けるセキュリティのヘッダー |

部署の人数配分と線の引き方は、公開資料と一般的な制作体制をもとにした試算です。
