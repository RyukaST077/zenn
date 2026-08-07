# 公開前レビュー: Node 26.7の--test-coverage-include-allを付けたら、カバレッジが100%から16.95%になった / node26-test-coverage-include-all-drop

## レビューの前提

- 対象記事: `articles/node26-test-coverage-include-all-drop.md`
- 出典ログ: `logs/run-node26-test-coverage-include-all-20260807-1357/execution-log.md`（引数で明示。記事冒頭の前提コメントとも一致）
  - 併せて `raw-logs/*.txt`（18ファイル）と `practice/practice-node26-test-coverage-include-all-20260807-1354.md` を裏取りに使用
- レビュー日時: 2026-08-07 14:12
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 4 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（`published: false` / slug / 秘密情報 / 個人パス）はすべてクリア。blocker なし
  - ただし数値の比較基準に本文内で矛盾がある（28.30% を 16.95% と比べているが、その実行時点の同条件ベースラインは 12.05%）
  - 13.89% を出した実行の必須オプション `--test-coverage-include='src/**'` が本文に書かれておらず再現できない
  - title が 65文字（60字目安超過・機械チェック WARN）

## 最優先で直すべき指摘（上位3件）

1. [warning] 「`--test-coverage-exclude` を1つ足したら、カバレッジが上がった」節（L385〜412） — 「16.95% だったものが 28.30% に上がりました」の比較基準を直す。この実行時点ではルートに `runner*.mjs` が4本残っており、exclude 無しの同状態は **12.05%**（本文 L488 で自ら提示している数字）。「exclude 無しでは 12.05% だった同じ状態に `--test-coverage-exclude='src/retry.js'` を足すと 28.30% に上がった」に書き換える。
2. [warning] 「どんなプロジェクトで効きそうか」節（L472〜474） — 13.89% を出した実行コマンドを明示する。ログ4-3／`raw-logs/with-flag-7files.txt` は `--test-coverage-include='src/**'` 付きの実行（表は `src/` の7ファイルのみ）。この節は直後に「glob 無しだと 12.05%」と書いているため、コマンドを省くと読者は 13.89% を再現できない。
3. [warning] 「詰まった点」節（L362〜366、L394〜397） — 出力に突然現れる `runner-bogus.mjs` / `runner-excludeglobs.mjs` / `runner-noflag.mjs` の由来を書く。「対照実験を3本足しました」の後に「それぞれ `runner-noflag.mjs` / `runner-bogus.mjs` / `runner-excludeglobs.mjs` としてプロジェクトルートに置いた」を1文追記する。

## 指摘一覧（重大度順）

### blocker

なし。

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| — | — | 該当なし | — | — |

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「`--test-coverage-exclude` を1つ足したら、カバレッジが上がった」L412 | 「16.95% だったものが 28.30% に上がりました」の比較基準が不正確。この実行時点ではルートに `runner*.mjs` が4本存在し（出力 L394-397 がその証拠）、exclude 無しの同状態は 12.05%。本文 L488 の記述と矛盾して読める | L412 を「exclude 無しの同じ状態が 12.05% だったところに `src/retry.js` の除外を1つ足したら 28.30% に上がりました」に書き換える。上げているのは `test/*.test.js` が表に入ったことだという説明（L412 後半）はそのまま維持できる | `raw-logs/glob-exclude.txt`（12ファイル/28.30%）と `raw-logs/with-flag-after-runners.txt`（10ファイル/12.05%）。execution-log 数値記録シート |
| 2 | 「どんなプロジェクトで効きそうか」L472-474 | 13.89% を出した実行の `--test-coverage-include='src/**'` が本文に書かれていない。コマンドブロック自体が無い | L473 あたりに実行コマンドを追加する: `node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-include='src/**'`。あわせて「（この時点でルートに `runner*.mjs` があるので、範囲を `src/**` に固定して測った）」を添える | execution-log フェーズ4-3 の実行コマンド／`raw-logs/with-flag-7files.txt`（表は `src/` の7ファイルのみ = glob 適用済み） |
| 3 | 「詰まった点」L362-366 と L394-397 | 対照実験3本のファイル名が本文に無いまま、後続の出力に `runner-bogus.mjs` / `runner-excludeglobs.mjs` / `runner-noflag.mjs` が並ぶ。読者はこの3ファイルがどこから来たか追えない | L362「計画に無かった対照実験を3本足しました。」の直後に「それぞれ `runner-noflag.mjs`（CONTROL A）/ `runner-bogus.mjs`（B）/ `runner-excludeglobs.mjs`（C）としてプロジェクトルートに置きました」を追記する | execution-log 3-5補（CONTROL A/B/C）／`raw-logs/run-api-noflag-2670.txt` ほか |
| 4 | Front Matter `title`（L2） | 65文字で60字目安を超過（機械チェック WARN）。スマホのカード表示で末尾の「16.95%になった」が切れると記事の芯が消える | 例: `--test-coverage-include-allでカバレッジが100%から16.95%になった（Node 26.7）`（61字）または `Node 26.7のカバレッジ新フラグで100%が16.95%になった`（35字）。数値はタイトルに残す | `scripts/check-article.sh` の `[WARN] title が長い: 65文字` |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 「再現手順」末尾の `:::message`（L534-536） | 「ログをそのまま貼っても手元のパスは漏れませんでした」は検証時の内部確認事項（ログ3-6）で、読者向けの情報としては浮いている | 再現手順の箇条書きに「出力は `src` グループ＋相対ファイル名なので絶対パスは含まれない」の1行として溶かすと、記事の視点が読者側に揃う |
| 2 | 「glob と閾値と併用したときの挙動」L435 の引用 | AND条件のドキュメント引用に出典が付いていない。他の2つの引用（L29 / L418）は `— [Node.js ... documentation]` を添えている | `— [Node.js Test runner documentation](https://nodejs.org/api/test.html)` を添えると引用の扱いが記事内で統一される |
| 3 | 全体（画像0枚） | CLI検証なのでスクショ無しは妥当（機械チェックも INFO 扱い）。ただしコードブロックが連続して数値を追いにくい | フラグ有無の総合%だけを Markdown 表（execution-log の「ヘッドラインの数値」表がそのまま使える）で冒頭に置くと、長い出力を読む前に結論が入る |
| 4 | Front Matter `topics`（L5） | `coverage` / `nodetest` は Zenn の既存トピックとしては弱く、流入が期待しにくい | `nodejs` / `testing` は維持し、残り1〜2枠を `ci` / `node` など既存トピックに寄せると露出が増える |
| 5 | 冒頭の前提コメント L9 | `<!-- 前提: 出典ログ logs/... -->` はパイプラインの内部メタ。HTMLコメントなので表示はされないが、公開リポジトリに内部パスとして残る | 公開時に削除しておくと、記事に残るのは読者向けの情報だけになる（消し忘れではないので任意） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 37字・文字種OK・`articles/` 内で重複なし（同名は自分自身1件のみ）/ 秘密情報パターン検出なし / `grep '/Users/'` 一致なし。ログ3-6の「絶対パス混入なし」とも整合 |
| Front Matter | 要修正 | title 65文字（warning 4）。type=tech / emoji 📉 / topics 4個は妥当。topics の選定は suggestion 4 |
| 事実性（ログ照合） | 要修正 | 創作・捏造は検出されず。数値・出力・コードはすべて `raw-logs/` に一次ソースあり。比較基準の不正確さ2件（warning 1・2）のみ |
| 画像 | OK | 画像参照0件・`images/<slug>/` も未作成。ブラウザ表示を伴わない検証なので妥当（孤立画像なし） |
| Markdown構造 | OK | コードフェンス68行（偶数）/ `:::` 4行（偶数）/ H1 なし（`grep '^# '` の3件はコードブロック内の bash コメント = false positive）/ 参考リンク3本すべて公式ドメイン。プレースホルダ残りなし |
| 文章品質・トーン | OK | 経験談トーン。「思います」「自分の環境では」で断定を回避。詰まった点2節＋事前調査の誤読告白あり。再現手順にOS/Node/npm/nvm を明記。誤字・表記ゆれは目視で検出なし |
| 完成度 | OK | `要素材` マーカー0件・TODO/プレースホルダ0件・末尾空白0行。まとめ／再現手順／参考リンクまで揃っている |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「同じテスト・同じソースで 100.00% → 16.95%」 ↔ ログ「完了条件の判定: **達成**（5条件すべてを一次ログで確認）／△83.05ポイント」 → **一致**
- 主要数値の突合（すべて裏付けあり）:

| 記事の記述 | ログ / raw-logs | 判定 |
|---|---|---|
| フラグ無し 100.00%（3ファイル）L235 | `without-flag.txt` | 一致 |
| フラグ有り 16.95%（6ファイル）L265 | `with-flag.txt` | 一致 |
| `run()` 26.7.0 で 15.04%（`runner.mjs` 込み）L330, L383 | `run-api.txt` / 3-5 の原因説明 | 一致（20/133 ≒ 15.04% も検算一致） |
| 26.5.0 CLI `bad option` / exit 9 L342-345 | `2650-with-flag.txt` / 3-4 | 一致（「出力はこの1行だけ」もログ記載どおり） |
| 26.5.0 `run()` は 100% のまま L349-358 | `2650-run-api.txt` | 一致 |
| CONTROL B: 未知オプションで exit 0 L366 | 3-5補 CONTROL B | 一致 |
| CONTROL C: `coverageExcludeGlobs` は効く L368-377 | 3-5補 CONTROL C | 一致 |
| v26.5.0 ドキュメントに `coverageIncludeAll` 無し L379 | 3-5補（オプション6つの列挙まで一致） | 一致 |
| exclude 併用で 28.30% L409 | `glob-exclude.txt` | 数値は一致（比較基準のみ warning 1） |
| include+exclude で 23.26%（5ファイル）L433 | 4-1(c) / `glob-both.txt` | 一致 |
| 閾値 lines=80 で exit 0 / exit 1、`Error: 16.95% line coverage does not meet threshold of 80%.` L441-456 | 4-2 / `threshold.txt`（エラー文言まで一致） | 一致 |
| funcs=80 / branches=80 は exit 0 L462-468 | 4-2 追加実験 / `threshold-funcs-branches.txt` | 一致 |
| ファイル1本追加で 13.89%（7ファイル/144行）L474 | 4-3 / `with-flag-7files.txt`（`chunk.js` 0.00 / 1-26） | 数値は一致（実行条件の欠落のみ warning 2） |
| ルートに `.mjs` がある状態で 12.05% L488 | `with-flag-after-runners.txt` | 一致 |
| `wc -l src/*.js` 118行 / 20:98 の内訳 L121-131 | フェーズ2-1/2-2 | 一致（20/118 ≒ 16.95%、20/144 ≒ 13.89% を検算して一致） |
| リリースノート原文 `[a646319f61] ... #64830` L40 | 1-1 の原文 | 一致（他の2コミットも一致） |
| `coverageIncludeAll` / CLI フラグのドキュメント原文 L27, L48-56 | 1-2 の原文 | 一致 |
| `node --help \| grep -i coverage` の 26.7.0 / 26.5.0 出力 L66-96 | 1-3 の全文 | 一致（26.5.0 で該当2行のみ欠けることも一致） |
| `runner.mjs` / `add.js` / `retry.js` / `add.test.js` のコード L135-193, L296-312 | `code/` 由来（`runner.mjs` 15行・`add.js` 7行・`retry.js` 32行 = uncovered 表記と行数が一致） | 一致（創作コードなし） |
| 環境（macOS 26.5 / Darwin 25.5.0 / arm64 / npm 11.19.0）L515-517 | 再現性メモ | 一致 |

- 創作の疑いがある記述: **なし**。ログを超えた成功の断定も検出されず、未解明点（26.6系未検証・どのバージョンで入ったか不明）は L381 / L507 で正しく留保されている。所要時間（実測5分・AI単独）は記事に転記されておらず、内部メタの扱いも適切
  - 参考: L60「ネット上で `--test-coverage-include-globs` という表記も見かけて」は execution-log には無いが、`practice/practice-*.md` L27「参照した情報源で表記が割れている」が裏付け。捏造ではないと判断し指摘に含めない
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-test-coverage-include-all-drop.md (slug=node26-test-coverage-include-all-drop) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=37 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 65文字 (60字目安)
[PASS] emoji あり: 📉
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=68
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

補足で実施した確認（機械チェック外）:

- `grep -n '/Users/' articles/node26-test-coverage-include-all-drop.md` → 一致なし（個人パス混入なし）
- `grep -nc ' $'` → 0（末尾空白なし）
- `grep -n '^# '` → 3件だが、いずれもコードブロック内の bash コメント（`# フラグ無し` ほか）。H1 乱用ではない false positive
- `ls articles/` → 同一 slug の重複なし。L17 が参照する `node-test-randomize-seed-extraction.md` は実在
- `20/118`・`20/133`・`20/144` を再計算 → 16.949…% / 15.038…% / 13.889…%。本文の 16.95 / 15.04 / 13.89 と一致

## 適用した修正（修正適用時のみ）

なし（レポートのみの非破壊レビュー）。記事本文は1文字も変更していない。`published: false` はそのまま維持。

## 次のアクション

- [ ] warning 4件を直す（優先: 1 → 2 → 3 → 4）。`/revise-article` に本レポートを渡せば指摘どおり修正できる
- [ ] suggestion 1〜5 は任意。特に 2（引用の出典）と 3（冒頭の比較表）は低コストで効く
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` にして PR を作る
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
