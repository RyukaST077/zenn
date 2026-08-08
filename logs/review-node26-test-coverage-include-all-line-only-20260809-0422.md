# 公開前レビュー: Node 26.7の--test-coverage-include-allを試したら、正直になったのはlineだけだった / node26-test-coverage-include-all-line-only

## レビューの前提

- 対象記事: `articles/node26-test-coverage-include-all-line-only.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-coverage-include-all-20260809-0410/execution-log.md`（引数で明示指定。記事冒頭の前提コメントとも一致）
- 補助的に参照した一次資料: `logs/run-.../workspace/results/F-noquote.txt`
- レビュー日時: 2026-08-09 04:22
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 4 件
- 根拠（判定を決めた主な確認結果）:
  - `published: false` を維持。秘密情報・APIキー・トークンの検出なし。
  - パターンE の `bad option` 出力で、ログにあった絶対パス `/Users/<氏名>/.nvm/...` が記事では `~/.nvm/...` に置換済み。個人パスの漏れなし（ログ側の「記事に貼るときはパスを `~/` に置換する」という方針どおり）。
  - slug は 42 文字・文字種OK・汎用語なし・`articles/` 内に重複なし。
  - 本文の数値・コマンド・出力・エラーはすべて出典ログで裏付けを確認（下記「事実整合の照合結果」）。創作コード・創作数値は検出されず。
  - コードフェンス（68 行＝偶数）・`:::`（4 行＝偶数）とも閉じている。`要素材` / プレースホルダの残存なし。
  - 機械チェックの `[WARN] title が長い: 100文字` は **byte 数カウントによる false positive**。実文字数は 60 文字（`wc -m` がロケール非UTF-8のため byte を返している）。目安 60 字ちょうどのため warning には上げず suggestion に留めた。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] 「触ってみて分かったこと」節 L459 — 本文で定義していない実験ラベル「D2」を参照している。「D の追加実験で」等の言い換えにする。
2. [suggestion] タイトル（Front Matter L2）— 60 文字ちょうどで一覧では末尾が省略されやすい。例: `Node 26.7の--test-coverage-include-allで正直になったのはlineだけだった`（52 文字）に短縮。
3. [suggestion] はじめに L19 — 過去記事への言及にリンクが無い。`node-test-randomize-seed-extraction` の Zenn URL を張るか、記述を落とす。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L459「触ってみて分かったこと」 | 「D2 の実験で」と書いているが、本文の見出しは `### D: --test-coverage-include なしで include-all だけ` のみで「D2」というラベルは登場しない（D2 は出典ログ側の内部ラベル） | 「D の追加実験で」「ルート直下にダミーを置いた実験で」に直せば、読者が本文を遡って D2 を探さずに済む |
| 2 | Front Matter L2 `title` | 実文字数 60 字。目安の上限ちょうどで、Zenn の一覧・OGP では末尾（「lineだけだった」）が切れる可能性がある | 例: `Node 26.7の--test-coverage-include-allで正直になったのはlineだけだった`（52字）。記事の主張（line だけ）は保ったまま短くできる |
| 3 | L19「はじめに」 | 「以前も `node --test` のシード値まわりを触った記事を書いた」に参照リンクが無い | 既存記事 `articles/node-test-randomize-seed-extraction.md` の公開 URL を張ると回遊が生まれる。URL が未確定ならこの1文は削っても本文の流れは崩れない |
| 4 | L9 前提コメント `<!-- 前提: 出典ログ ... -->` | HTML コメントなので表示はされないが、公開後も出典ログのローカルパスが記事ソースに残る | パイプラインの再レビューで使うため残す運用ならこのままで可。気になるなら公開時に削除（`publish-pr` 側の判断でよい） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / 秘密情報なし / 個人パスは `~/` 置換済み / slug 42字・重複なし |
| Front Matter | OK | title/emoji(📉)/type(tech)/topics(4個: nodejs, testing, coverage, c8)/published すべて妥当。title 長のみ suggestion |
| 事実性（ログ照合） | OK | 検証した主張 20 件超がすべてログで裏付け済み。ログを超えた断定なし |
| 画像 | OK（対象外） | 画像参照 0 件。出典ログの「スクショ 0 枚（CLI 検証のみ）」と整合しており、スクショ欠如は減点しない |
| Markdown構造 | OK | フェンス 68 行・`:::` 4 行とも閉。H2/H3 階層破綻なし。H1 未使用（Zenn は title が H1）で正しい |
| 文章品質・トーン | OK | 経験談トーン維持。詰まった点 3 件を具体的に記述。環境（macOS 26.5 / arm64 / Node v26.7.0・v26.5.0 / c8 12.0.0）明記。推測箇所は「実装を読んだわけではない」と明示 |
| 完成度 | OK | `要素材` / TODO / プレースホルダなし。再現手順・注意喚起（`:::message alert`）まで揃っている |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「include-all で正直になるのは line だけ。branch と funcs は動かない」 ↔ ログ「結果サマリー／一番の収穫: line だけ 0.00%、branch と funcs は 100.00%。all files は line 78.95%→26.79%、branch 83.33% / funcs 66.67% は 1pt も動かない」 → **一致**
- 創作の疑いがある記述: **なし**。以下を個別に突合して確認した。
  - `node --help` の v26.7.0 全文・diff（`8a9,10`）→ ログ フェーズ1 と完全一致
  - リリース日 2026-08-05 / PR #64830 / SEMVER-MINOR → ログ フェーズ1
  - ディレクトリツリー・`wc -l` の 67 行 → ログ フェーズ2
  - `greet.js` / `format.js` / `legacy-report.js` / `dead-branch.js` / `greet.test.js` のコード全文 → ログ フェーズ2 と一字一句一致
  - `node --test` の緑出力（`duration_ms 242.202917` 含む）→ ログ フェーズ2
  - 事前予想（100/100/100、funcs 50%前後、0/0/0）と「予想 90% に対し実測 78.95%」→ ログ フェーズ2・フェーズ3A
  - A / B / C / D / D2 / E の出力全文と diff、`exit=9` → ログ フェーズ3
  - `node_modules` 配下 `.js` 280 個の状態でも除外される（K1）→ ログ フェーズ3D
  - しきい値表（70/26/27/80、`Error: 26.79% line coverage does not meet threshold of 70%.`、表より前に出る位置）→ ログ フェーズ4
  - funcs しきい値表（B/C とも 66.67 で exit 0、c8 は 40 で exit 1）→ ログ フェーズ4
  - c8 12.0.0 のインストール 9 秒 / 55 packages / 9.6M、`--all` 有無の出力全文、比較表 → ログ フェーズ4
  - 実行時間 265〜305ms / 265〜297ms → ログ フェーズ4
  - 「詰まった点」zsh `(eval):4: no matches found: --include=*.js` → ログ 詰まった点 #1
  - zsh/bash 対照実験のブロック（`zsh:1: no matches found` exit=1 / bash 素通し exit=0 + カバレッジ表全文）→ **`workspace/results/F-noquote.txt` と完全一致**（execution-log.md 本文には要約しか無いが、一次ログに全文が存在することを確認済み）
- ログに無いが問題としなかった記述:
  - 参考リンクの `https://nodejs.org/api/test.html#collecting-code-coverage` は execution-log.md に URL としては現れないが、本文中の「ドキュメントの記述」（テストファイル既定除外・include の AND 条件）はログで確認済みの事実であり、公式ドキュメントへのリンクとして妥当。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-test-coverage-include-all-line-only.md (slug=node26-test-coverage-include-all-line-only) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=42 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 100文字 (60字目安)
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

**false positive の切り分け**: `[WARN] title が長い: 100文字` はスクリプトが byte 数を数えているため（`wc -m` がロケール依存で byte を返す）。実際の文字数は 60 字で目安ちょうど。重大度を suggestion に下げた（指摘一覧 #2）。

## 適用した修正

なし（修正適用の指定が無いため、記事本文は一切変更していない）。

## 次のアクション

- [x] blocker / warning なし（suggestion 4 件は任意対応）
- [ ] suggestion #1（「D2 の実験で」の言い換え）だけは読者の混乱を避けられるので、直すなら `/revise-article` で
- [ ] 直した場合は `/review-article` で再レビュー
- [ ] 公開する場合は Front Matter を `published: true` に変えて `git push`（`/publish-pr` 推奨）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
