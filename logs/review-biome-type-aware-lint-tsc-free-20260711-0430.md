# 公開前レビュー: ESLint/oxlintしか知らない新人がBiomeの型認識lintを試してみた / biome-type-aware-lint-tsc-free

## レビューの前提

- 対象記事: articles/biome-type-aware-lint-tsc-free.md
- 出典ログ: logs/run-biome-type-aware-lint-20260711-0408/execution-log.md（＋ raw ログ logs/*.txt）
- レビュー日時: 2026-07-11 04:30
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published: false / 秘密情報なし / slug 妥当）はすべて OK。
  - 事実整合はきわめて良好。記事の CLI 出力・数値・比較表は出典ログおよび raw ログ（phase3-I / phase4-E など）と**逐語一致**を確認。創作・水増しは検出されず。
  - 機械チェックの唯一の WARN（title 79 文字）は、誇大でなく説明的なため suggestion に格下げ（Zenn にタイトル長のハード制限はなく、公開ブロッカーではない）。
  - 残る指摘は3件とも suggestion（任意改善）のみ。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter `title`（1行目） — 79文字とやや長い。60字目安に寄せると一覧での視認性が上がる（例: 「ESLint/oxlint経験者がBiomeの型認識lint（tsc非依存）を試してみた」など）。誇大表現はなく必須ではない。
2. [suggestion] 冒頭 `<!-- 前提: 出典ログ ... -->`（9行目） — 内部メタ（ログパス）を含む消し忘れ系コメント。HTMLコメントなのでレンダーはされないが、公開前に削除して問題ない。
3. [suggestion] 「環境構築」の hello.ts 出力（83-93行目） — 実ログ（phase2-hello-check.txt）より前後の未変更行と `check ━━` フッタを省いた短縮版。誤りではないが、省略を示す `...` を入れるか実出力どおりにするとより誠実。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | Front Matter `title`（1行目） | 79文字とやや長い（機械チェック WARN。誇大ではないため格下げ） | 60字目安に整えると記事一覧・検索での視認性が上がる |
| 2 | 冒頭コメント（9行目） | `<!-- 前提: 出典ログ ... -->` の消し忘れ。内部ログパスを含む | 公開版から内部メタを除け、成果物がクリーンになる |
| 3 | 環境構築セクション（83-93行目） | hello.ts の出力が実ログより短縮（前後行・checkフッタ省略）。`...` 等の省略記号なし | 省略を明示すれば「出力そのまま」の信頼性が担保される |
| 4 | ESLint 比較（280-288行目） | 出力ブロックから `MODULE_TYPELESS_PACKAGE_JSON` 警告（実ログ先頭）を省略 | ノイズ除去として妥当。明示は任意 |

### 事実整合で確認済み（＝問題なし）の主要ポイント

- 結論「3種類とも Biome で検出」＝ ログ結果サマリー「達成（3条件）」と一致。
- biome lint 3件（noFloatingPromises / noUnsafePlusOperands / useExhaustiveSwitchCases, exit 1）＝ phase3-F / phase3-I と一致。
- `--verbose` 出力「Scanned project folder in 100ms / Checked 1 file in 216ms / Found 3 errors」＝ phase3-I（89-91行）と逐語一致。
- 「素recommended 約250ms vs scan時 最大約950ms」＝ ログ111行の実測と一致。
- ESLint 5件出力ブロック（281-288行）＝ phase4-E-eslint-typeaware.txt（7-13行）と逐語一致（行:列・ルール名・メッセージ・「✖ 5 problems」）。
- oxlint 「Failed to find tsgolint executable」＝ phase4-B と一致。`--type-aware` 素で1件→明示指定で3件＝ phase4-C/D と一致。
- ERESOLVE（typescript@7.0.2 vs peer `>=4.8.4 <6.1.0`）→ TS5.9.3固定で回避＝ ログ130-132行および knowledge 再利用記録と一致。
- domains.types:"none" でもルール明示有効化で3件出続ける＝ ログ108行（phase3-G）と一致。
- バージョン（biome 2.5.3 / TS 7.0.2 / oxlint 1.73.0 / eslint 10.6.0 / typescript-eslint 8.63.0）＝ ログ15,27行と一致。
- 所要時間の扱い: 記事は「数時間くらい」と記載。ログは AI実測0.9h を「記事にそのまま書かない」と明記し人間見積もり約4.25hとある。AI値を出さず見積もりレンジに沿った表現で**適切**。

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / 秘密情報なし / slug(30字, 汎用でない)妥当。本文に /Users パス等の漏れなし |
| Front Matter | OK | 必須5フィールド揃い・type=tech・topics5・emoji有。title 79字は suggestion |
| 事実性（ログ照合） | OK | CLI出力・数値・比較表が raw ログと逐語一致。創作・水増しなし |
| 画像 | OK | 画像なし（CLI検証記事のため妥当。ログもスクショ0枚と明記） |
| Markdown構造 | OK | コードフェンス38行(偶数)・:::2行(偶数)閉じOK・見出しは全てH2で階層破綻なし |
| 文章品質・トーン | OK | 経験談トーン・詰まった点3件・再現環境(OS/Node/各バージョン)明記 |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「3種類とも Biome で検出できました／確かめたかった3点はいずれも確認」 ↔ ログ「達成（3条件すべて客観確認）」 → **一致**
- 創作の疑いがある記述: なし（引用CLI出力は phase3-I / phase4-E 等と逐語一致を確認）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/biome-type-aware-lint-tsc-free.md (slug=biome-type-aware-lint-tsc-free) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=30 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 79文字 (60字目安)
[PASS] emoji あり: 🧹
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=38
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

※ 唯一の WARN（title 79字）は誇大でなく説明的なため、観点チェックで **suggestion** に格下げ。公開ブロッカーではない。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] （任意）上記 suggestion 3件を反映するとより良い（title短縮 / 前提コメント削除 / hello.ts出力の省略明示）
- [ ] blocker / warning は 0 件のため、そのままでも公開可
- [ ] Front Matter を `published: true` に変えて公開（本パイプラインは `/publish-pr` で feature ブランチ→PR→main マージが公開ゲート）
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
