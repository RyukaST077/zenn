# 修正レポート: Node 26.7の--test-coverage-include-allで100%が16.95%になった / node26-test-coverage-include-all-drop

## 修正の前提

- 対象記事: `articles/node26-test-coverage-include-all-drop.md`（リネームなし）
- レビューレポート: `logs/review-node26-test-coverage-include-all-drop-20260807-1412.md`（判定: **要修正** / blocker 0・warning 4・suggestion 5）
- 出典ログ: `logs/run-node26-test-coverage-include-all-20260807-1357/execution-log.md`（＋ `raw-logs/`）
  - すべて引数で明示。記事冒頭の前提コメントとも一致
- 適用範囲: blocker + warning（既定）。suggestion は安全で機械的なもののみ
- slug リネーム: 不可（指摘なし）
- 修正日時: 2026-08-07 14:14
- 過去の修正レポート: なし（本記事の初回修正）

## 結果サマリー

- 適用: blocker 0 件 / warning **4 件（全件）** / suggestion 1 件
- 未解消: 0 件
- スキップ: suggestion 4 件（任意・記事の主旨に関わらないため）
- slug リネーム: なし
- `published: false` 維持: **OK**
- セルフチェック: `SUMMARY fail=0 warn=0`（修正前は warn=1）

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| W1 | warning / 「`--test-coverage-exclude` を1つ足したら、カバレッジが上がった」L412 | C（差し替え） | before:「16.95% だったものが 28.30% に上がりました。」→ after:「この時点ではルートに `runner*.mjs` が4本ある状態で、exclude 無しの同じ状態は 12.05%（後述）でした。そこに除外を1つ足しただけで 28.30% に上がっています。」 比較基準を同条件（12.05%）に訂正。後半の「`test/*.test.js` が表に入ったのが原因」という説明はそのまま維持 | `raw-logs/glob-exclude.txt`（`runner*.mjs` 4本を含む12ファイル / 28.30%）と `raw-logs/with-flag-after-runners.txt`（同じ4本を含む10ファイル / 12.05%）。execution-log 「副次的発見」 |
| W2 | warning / 「どんなプロジェクトで効きそうか」L472-474 | B（ログ由来の補完） | 13.89% の直前に実行コマンドブロックを追加: `node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-include='src/**'`。あわせて「この時点ではプロジェクトルートに `runner*.mjs` が増えていたので（後述）、範囲を `src/**` に固定して測りました。」を追記 | execution-log フェーズ4-3 の実行コマンド原文（`--test-coverage-include='src/**'` 付き）／`raw-logs/with-flag-7files.txt`（表は `src/` 7ファイルのみ = glob 適用済み） |
| W3 | warning / 「詰まった点」L362 | B（ログ由来の補完） | 「切り分けのために、計画に無かった対照実験を3本足しました。」の後に1文追記:「それぞれ `runner-noflag.mjs`（1つ目）/ `runner-bogus.mjs`（2つ目）/ `runner-excludeglobs.mjs`（3つ目）として、`runner.mjs` と同じくプロジェクトルートに置きました。この4本が後の出力に顔を出します。」 後続の出力に現れる4本のファイル名の由来が追える | execution-log 3-5補（CONTROL A/B/C とログファイル名 `run-api-noflag-2670.txt` ほか）／`raw-logs/glob-exclude.txt`・`with-flag-after-runners.txt` の表に並ぶ4本 |
| W4 | warning / Front Matter `title`（L2） | A（機械修正） | before:「Node 26.7の--test-coverage-include-allを付けたら、カバレッジが100%から16.95%になった」（65文字）→ after:「Node 26.7の--test-coverage-include-allで100%が16.95%になった」（**53文字**）。フラグ名・バージョン・100%→16.95% の数値はすべて維持 | `check-article.sh` の WARN 解消（再実行で `[PASS] title あり: 53文字`） |
| S2 | suggestion / 「glob と閾値と併用したときの挙動」L435 の引用 | A（機械修正） | AND 条件のドキュメント引用に `— [Node.js Test runner documentation](https://nodejs.org/api/test.html)` を追記。記事内の他2つの引用（L29 / L418）と出典表記が揃った | 引用元は `run()` API のオプション説明（execution-log 1-2 の原文と同ページ） |

## 削除した記述（分類C で削ったもの）

なし。分類C の適用は W1 の**差し替え**（ログの事実による比較基準の訂正）のみで、削除は発生していない。

## スキップした指摘（suggestion / 任意）

| # | 指摘 | スキップ理由 |
|---|---|---|
| S1 | 再現手順末尾の `:::message`（絶対パスが漏れない話）を箇条書きに溶かす | 事実は正しく、公開安全・事実性に影響しない体裁の好み。最小修正の原則により見送り |
| S3 | 冒頭にヘッドライン数値の比較表を置く | 記事構成の変更にあたり、指摘の無い箇所への手入れになるため見送り |
| S4 | topics を `ci` / `node` に寄せる | 流入最適化の提案で、公開可否に影響しない。現行 `nodejs` / `testing` / `coverage` / `nodetest` も内容と整合 |
| S5 | 冒頭の前提コメント `<!-- 前提: ... -->` を削除 | このコメントは `review-article` / `revise-article` が出典ログを辿るために使うパイプライン内部メタ。公開直前（`/publish-pr`）の判断に委ねる |

## 未解消の指摘

なし（blocker 0・warning 4 すべて適用済み）。

## 警告

- なし。秘密情報・個人パスの検出は修正前後ともゼロ（`grep '/Users/'` 一致なし）。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/node26-test-coverage-include-all-drop.md (slug=node26-test-coverage-include-all-drop) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=37 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 53文字
[PASS] emoji あり: 📉
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=70
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

（フェンス行が 68 → 70 に増えたのは W2 で実行コマンドブロックを1つ追加したため。偶数で閉じている）

## 次のアクション

- [ ] `/review-article articles/node26-test-coverage-include-all-drop.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` にして PR を作る
