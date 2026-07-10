# 公開前レビュー: ESLintしか知らない新人がoxlintに移行してJSプラグイン(alpha)まで試してみた / oxlint-eslint-migration-js-plugins-try

## レビューの前提

- 対象記事: articles/oxlint-eslint-migration-js-plugins-try.md
- 出典ログ: logs/run-oxlint-eslint-migration-20260709-0407/execution-log.md
- レビュー日時: 2026-07-09 04:26
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug 妥当・重複なし / 秘密情報なし）すべてクリア。
  - 事実性は出典ログと全項目（コマンド・エラー全文・数値・比較表・速度実測・画像）で一致。ログを超えた断定なし。
  - 機械チェックの唯一の WARN（title 99「文字」）はバイト数カウントによる誤検知。可視の日本語タイトルは約47文字で60字目安の範囲内のため warning としない。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter 直後 `<!-- 前提: 出典ログ ... -->` — 公開前に消し忘れでないか確認。意図的に残すなら可、不要なら削除。
2. [suggestion] title の絵文字/前提コメント以外は問題なし — 強いて言えば見出し「詰まった点と解決」節に画像（スクショ）が無い（サマリ1枚のみ）。詰まりの現物を1枚足すと再現性が上がる。
3. [suggestion] 参考リンク節はプレーンURLのみ。Markdown リンク記法にすると体裁が整う（任意）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

（機械チェックの WARN は下記「機械チェック結果」参照。バイト数由来の誤検知として warning に昇格しない。）

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 9行目 `<!-- 前提: ... -->` | 前提コメントが本文冒頭に残っている | 公開後もソースに残る。意図的なら可。不要なら削除で見通しが良くなる（publish-pr でも残置される想定なので必須ではない） |
| 2 | 「詰まった点と解決」節 | スクショがサマリ1枚のみ、詰まり現物の画像なし | TS7 クラッシュ画面等を1枚足すと臨場感・再現性が増す（ログにサマリ1枚しか無いので任意） |
| 3 | 「参考リンク」節 | 生URL列挙 | `[タイトル](URL)` 記法にすると Zenn 上の見栄えが良くなる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 38字・文字種OK・重複なし / 秘密情報・個人パス・内部ホスト名なし |
| Front Matter | OK | title/emoji🦀/type:tech/topics5個/published 揃う。topics=[oxlint,eslint,typescript,react,oxc] 妥当 |
| 事実性（ログ照合） | OK | 結論・全コマンド・エラー全文・数値・速度表・87ルール・302ファイルすべてログと一致。創作なし |
| 画像 | OK | `/images/oxlint-eslint-migration-js-plugins-try/01-summary.png` 実在・alt あり・孤立画像なし |
| Markdown構造 | OK | コードフェンス36行（偶数）閉じ済み / `:::`4行閉じ済み / H2階層健全 / プレースホルダ・壊れリンクなし |
| 文章品質・トーン | OK | 新人経験談トーン。詰まった点3件・環境/バージョン明記・冒頭に結論あり |
| 完成度 | OK | 要素材マーカー/TODO残存なし。公開に耐える長さ・構成 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件3ついずれも達成」↔ ログ「結果サマリー: 達成（3条件すべて客観ログで確認）」→ **一致**
- 主要な数値・出力の突合（すべて一致）:
  - ESLint ベースライン 7件（error5/warn2）… ログ eslint-baseline.txt と一致
  - migrate「87 rules / Skipped 4」… ログ commands.log と一致
  - 検出差分表（no-var/no-unused-vars/prefer-const/eqeqeq/no-console/exhaustive-deps=完全一致）… ログ フェーズ3b 表と一致
  - 速度表（ESLint min7.20/median11.99、oxlint min0.16/median0.21、min45倍/median57倍）… ログ timing.txt と一致
  - 規模 302ファイル/2,127行、oxlint インストール4.7s … ログと一致
  - jsPlugins 予約名エラー全文・エイリアス記法・`jsdoc-js(require-param)` 発火 … ログ フェーズ3d と一致
  - TS7 クラッシュ全文（`Cannot read properties of undefined (reading 'Cjs')` / typescript 7.0.2）… ログ 詰まり#1 と一致
  - Node 要件 >=22.18.0/^20.19.0、`--fix` バイト一致 … ログ フェーズ3d/4 と一致
- 創作の疑いがある記述: なし。ログにない成功・断定は見当たらない。「50〜100倍」「速い」等はすべて「触れ込み」「この規模・環境の簡易計測」と適切にヘッジ済み。Windows OOM / カスタムプラグインは「未検証」と明記（ログの方針どおり）。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/oxlint-eslint-migration-js-plugins-try.md (slug=oxlint-eslint-migration-js-plugins-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=38 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 99文字 (60字目安)
[PASS] emoji あり: 🦀
[PASS] topics 5個
[PASS] 画像あり: /images/oxlint-eslint-migration-js-plugins-try/01-summary.png
[PASS] コードフェンスが閉じている: フェンス行=36
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

> **[WARN] title 99文字 の切り分け**: スクリプトは UTF-8 バイト数で計測している。可視タイトル「ESLintしか知らない新人がoxlintに移行してJSプラグイン(alpha)まで試してみた」は約47文字（日本語約26字×3バイト＋ASCII 約21字≒99バイト）。60**字**目安の範囲内であり、誇大表現（完全理解/徹底解説/保存版等）も含まないため、warning に昇格せず **問題なし** と判断した。

## 次のアクション

- [ ] （任意）上記 suggestion を検討する（必須ではない）
- [ ] 判定が「公開可」のため、Front Matter を `published: true` に変えて公開できる状態
- [ ] 公開は `/publish-pr` で feature ブランチ→PR→main マージ（マージ＝公開ゲート）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
