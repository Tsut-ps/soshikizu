/*
 * 参考になるスタジオ・事例。段階と体制の型ごとに、近い形の実在の会社や調査の事例を挙げる。
 * 人数は会社によって数え方（正社員のみ・契約社員込み・連結）と時点が違うので、時点と出典を一緒に持つ。
 * Wikipedia などの二次情報は secondary を付ける。図のカードには出さず、解説パネルにだけ出す。
 */
import type { Sourcing } from './variants';

export interface Reference {
  name: string;
  /** 人数と時点（例：'32名'、'467名（2025年4月）'） */
  people: string;
  /** 体制の特徴 */
  note: string;
  url: string;
  /** 二次情報（Wikipedia など）による */
  secondary?: boolean;
}

const ref = (name: string, people: string, note: string, url: string, secondary = false): Reference => ({
  name,
  people,
  note,
  url,
  secondary,
});

const JILPT_2005 = 'https://www.jil.go.jp/institute/reports/2005/documents/025_shiryo.pdf';

/** キーは「段階の番号:型」（段階の番号は STAGES の並び） */
const REFERENCES: Record<string, Reference[]> = {
  '1:outsource': [
    ref(
      '労働政策研究・研修機構の事例 F社',
      '少人数（2005年の資料）',
      '社長が「2人が監督とプロデューサーになり、ほかの仕事は下請けに出す形がいちばん利益が出る」と述べた例',
      JILPT_2005,
    ),
  ],
  '2:basic': [
    ref(
      '株式会社暁',
      '10人',
      '二原・動画・仕上げの下請。動画と仕上げ（動仕）を海外へも発注する',
      'http://akatsuki.studio/cp.html',
    ),
  ],
  '2:inhouse': [
    ref(
      '株式会社暁',
      '10人',
      '二原・動画・仕上げの下請。動画と仕上げ（動仕）を海外へも発注する',
      'http://akatsuki.studio/cp.html',
    ),
  ],
  '3:basic': [
    ref(
      'スノードロップ',
      '人数は非公開',
      'グロス請けが中心で、クレジットは「制作協力」',
      'http://www.snowdrop-anime.jp/',
    ),
    ref(
      '労働政策研究・研修機構の事例 E社',
      '15名（2004年）',
      'グロス請け。仕上げと撮影はさらに外注に出す',
      JILPT_2005,
    ),
  ],
  '3:inhouse': [
    ref(
      '労働政策研究・研修機構の事例 D社',
      '25名（2004年）',
      'グロス請けで、仕上げ部・撮影部・編集部を社内に持つ',
      JILPT_2005,
    ),
  ],
  '3:outsource': [
    ref(
      '朱夏',
      '20名（2025年1月）',
      'ラインは1本で、1クールを約1年かけて元請制作する',
      'https://job.mynavi.jp/28/pc/search/corp286321/outline.html',
    ),
    ref(
      'ミルパンセ',
      '約20人',
      'グロス請けから元請に移った',
      'https://www.creators-station.jp/interview/legends/77083',
    ),
  ],
  '4:basic': [
    ref(
      'プロダクション・プラスエイチ',
      '32名',
      '企画から納品まで一貫して制作する体制。配信・劇場作品を手がける',
      'https://job.mynavi.jp/27/check/search/corp290863/outline.html',
    ),
  ],
  '5:basic': [
    ref(
      'サイエンスSARU',
      '75名（2026年4月）',
      '東宝の子会社。企画から制作まで',
      'https://ja.wikipedia.org/wiki/サイエンスSARU',
      true,
    ),
    ref(
      'P.A.WORKS',
      '95名（連結）',
      '富山の本社で作画と撮影を行うとされる一方、仕上げ・背景美術の部門は持たないとする資料もある',
      'https://shukatsu-line.pref.toyama.lg.jp/corporation/3629/info',
    ),
  ],
  '6:basic': [
    ref(
      '動画工房',
      '123名',
      '作画部・制作部・仕上部・撮影部・版権事業部・管理部を社内に持つ',
      'https://job.mynavi.jp/27/pc/search/corp252947/outline.html',
    ),
    ref(
      '旭プロダクション',
      '173名（2025年5月）',
      '制作部・作画スタジオに加え撮影・3DCGを持ち、宮城県に白石スタジオがある',
      'https://job.mynavi.jp/27/pc/search/corp102979/outline.html',
    ),
  ],
  '6:outsource': [
    ref(
      'ボンズ',
      '約91〜110名',
      'スタジオA〜Eの5ラインで作品を並行して制作（2018年のインタビュー）',
      'https://animeanime.jp/article/2018/10/12/40746_3.html',
    ),
  ],
  '6:inhouse': [
    ref(
      '京都アニメーション',
      '約180名（2022年）',
      'ほぼ全工程を社内で制作し、アニメーター・美術の養成塾も持つ',
      'https://en.wikipedia.org/wiki/Kyoto_Animation',
      true,
    ),
  ],
  '7:basic': [
    ref(
      'MAPPA',
      '467名（2025年4月）〜562名（2026年4月）',
      '制作局に約10ライン、CGI局は160名超の最大部門',
      'https://www.mappa.co.jp/company/',
    ),
    ref(
      'Production I.G',
      '334名（2025年6月）',
      'IGポートの子会社。新潟にも拠点',
      'https://www.production-ig.co.jp/company/aboutus.html',
    ),
    ref(
      'トムス・エンタテインメント',
      '322名（単体・2025年12月末）',
      '長期シリーズと、ライセンス・商品の事業を持つ',
      'https://job.mynavi.jp/26/pc/search/corp111009/outline.html',
    ),
    ref(
      'CloverWorks',
      '258名（2026年2月）',
      '演出・作画・仕上げ・撮影・美術の部門を持つ（アニプレックスの子会社）',
      'https://job.mynavi.jp/26/pc/search/corp267657/outline.html',
    ),
  ],
  '7:inhouse': [
    ref(
      'ufotable',
      '正社員256名（2024年3月）',
      '1ライン前後に絞り、ほぼ全工程を内製。徳島にもスタジオ',
      'https://ja.wikipedia.org/wiki/ユーフォーテーブル',
      true,
    ),
  ],
  '8:basic': [
    ref(
      '東映アニメーション',
      '連結1,048名（2026年3月）',
      '映像製作部門が約86%。録音・編集の子会社、フィリピンの製作子会社、海外の販売拠点を持つ',
      'https://disclosure2dl.edinet-fsa.go.jp/searchdocument/pdf/S100YEQC.pdf',
    ),
  ],
};

/** 段階と型に合う参考の一覧（型の形がない段階は、基本の型の一覧） */
export function referencesFor(stageIndex: number, sourcing: Sourcing): Reference[] {
  return REFERENCES[`${stageIndex}:${sourcing}`] ?? [];
}
