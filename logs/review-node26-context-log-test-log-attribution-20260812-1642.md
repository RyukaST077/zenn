# 公開前レビュー: Node 26.6のt.log()を試したら、ログに帰属が付くのはイベント側だけだった / node26-context-log-test-log-attribution

## レビューの前提

- 対象記事: `articles/node26-context-log-test-log-attribution.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`（引数で明示指定）
  - 併せて `workspace/results/*`（`reporter-spec/tap/dot.txt` / `field-diff.md` / `attribution.md` /
    `concurrency.txt` / `entryfile.txt` / `parentid-check.txt` / `type-module.txt` / `data-payload.txt`）と
    `workspace/` のテストコード・reporter 実ファイルを直接確認
- レビュー日時: 2026-08-12 16:42
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 前提の補足: 本記事は3回目のレビュー。前回（`review-...-20260812-1630.md`）の warning 2件は
  `revise-...-20260812-1638.md` で修正済み。本レビューではその2件の解消確認を含めて全次元を再検査した。

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 5 件
- 根拠（判定を決めた主な確認）:
  - 公開安全: `published: false` を維持。秘密情報・APIキー・トークンの検出なし。
    記事本文に `/Users/katayamaryuunosuke/...` を含む絶対パスは**1件も無い**
    （`results/` の生ファイルには絶対パスが残っているが、記事側は `/path/to/` へマスク済み）。
    slug は39文字・文字種OK・`articles/` 内に重複なし（`node26-*` は8本あるが全て別 slug）。
  - 事実性: 記事の主要な主張・出力全文・コード・数値をすべて出典ログおよび `workspace/` の
    生ファイルまで遡って照合し、**ログを超えた断定・創作は検出されなかった**。
  - 前回 warning の解消:
    - #1 `reporters/group.mjs` のコメント行復活 → 記事595〜608行が実ファイル（14行）と**逐語一致**。
      本文の「14行でここまで来る」「14行の reporter で」も整合。
    - #2 「環境構築とバージョンゲート」の重複文 → 193行が
      「フラグで有効化できる類のものでもなさそうです。いずれにせよ〜」に短縮され、重複解消を確認。
  - 機械チェック: `SUMMARY fail=0 warn=0`。

## 最優先で直すべき指摘（上位3件）

blocker / warning は無い。以下はすべて任意（suggestion）。

1. [suggestion] 「なぜこの技術を試すのか」44〜68行 — spec 出力ブロックがサマリ行（`ℹ tests 3` 以降）を
   落とした抜粋なのに「出力がこれです」と全文のように読める。「（末尾のサマリ行は省略）」を1語添える。
2. [suggestion] `tree.test.mjs` / `suite.test.mjs` / `entry.test.mjs` のコードブロック — 実ファイルは
   複数行だが記事では `(t2) => { t2.log('in child'); }` のように1行に整形されている。意味は同一なので
   問題ないが、他ブロックが逐語なので「掲載の都合で整形」と1行注記するか、実ファイルどおりに戻す。
3. [suggestion] Front Matter `topics` の `test` と `testing` が実質重複。`nodejs` / `testing` /
   `javascript` に絞り、空いた枠を `nodetest` などに回すと露出面が広がる（Zenn の妥当性としては現状でも可）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 44〜68行（並行実行の spec 出力） | `results/concurrency.txt` の末尾サマリ（`ℹ tests 3` 〜 `duration_ms 125.071541`）を落とした抜粋だが、抜粋である旨の表示が無い | 他の「全文」ブロックと区別が付き、引用の正確さが保たれる |
| 2 | 634〜654行 / 691〜708行 / 726〜738行 | `tree` / `suite` / `entry` のテストコードが実ファイルより1行化されている（意味は同一。`data` / `conc` / reporter 3本・`field-diff.mjs` は逐語一致） | 読者が丸ごとコピーしたときに手元のファイルと同一になる／記事全体の「逐語掲載」の一貫性が揃う |
| 3 | Front Matter 5行 | `topics` の `test` / `testing` が実質重複 | 検索・タグ面での露出が広がる |
| 4 | 19〜21行 `:::message` と 24〜27行「使ったもの・環境」 | 環境情報（macOS 26.5 / v26.7.0 / v26.5.0）が二重で書かれている | 導入がすっきりする。※前回・前々回から繰り越しのスキップ判断であり、構成変更を伴うため無理に直さなくてよい |
| 5 | 9行 `<!-- 前提: 出典ログ ... -->` | パイプライン追跡用の前提コメントが残っている | Zenn 上は非表示で害はない。意図的に残す運用なら現状維持で可 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / 秘密情報なし / 個人パスなし（全て `/path/to/` にマスク）/ slug 一意・39文字 |
| Front Matter | OK | title 43字（誇大表現なし）・emoji 🪵・type tech・topics 4個。`test`/`testing` 重複は suggestion 止まり |
| 事実性（ログ照合） | OK | 主要主張・出力・コード・数値をすべて生ファイルまで確認。創作・ログ超えの断定なし |
| 画像 | OK | 画像参照0件。出典ログが「スクショ0枚・画像は不要（CLI 検証）」と明記しており妥当 |
| Markdown構造 | OK | コードフェンス78行・`:::` 8行とも閉じている。H2 起点で階層破綻なし。リンク4本は実在URL、プレースホルダなし |
| 文章品質・トーン | OK | 経験談トーン維持。詰まった点5件を独立節で記述。環境（OS/arch/Node 2バージョン）明記。「分からなかったこと」2件を正直に記載 |
| 完成度 | OK | `要素材` 0件・TODO/プレースホルダ0件。導入→動機→調査→検証→詰まった点→比較→まとめの流れが閉じている |

## 事実整合の照合結果（ログとの突合）

- 結論の一致: 記事「確かめられたのは…／分からないまま残ったことが2つ」 ↔ ログ「完了条件4件すべて達成、
  未解決として残した事実が2件」 → **一致**
- 生ファイルまで確認した主要主張:

  | 記事の記述（行） | 突合先 | 結果 |
  |---|---|---|
  | spec 出力12行（211〜224） | `results/reporter-spec.txt` | 一致 |
  | tap 全文（236〜256）／dot 全文（260〜262） | `results/reporter-tap.txt` / `reporter-dot.txt` | 一致 |
  | 26.5.0 の `TypeError: t.log is not a function`（168〜191） | `results/fail-26.5.txt` | 一致（「抜粋」と明記済み・パスはマスク） |
  | `ERR_MODULE_NOT_FOUND` 全文と「終了コードは 7」（298〜320） | ログ313行 `exit=7` | 一致 |
  | フィールド差分表（574〜586）と「76行（log 26 / diagnostic 50）」 | `results/field-diff.md` | 完全一致 |
  | `field-diff.mjs` 全文（544〜568・25行） | `workspace/field-diff.mjs` | **逐語一致** |
  | `dump.mjs`（283〜289・7行）／`inspect.mjs`（369〜377・9行）／`group.mjs`（595〜608・14行） | `workspace/reporters/*.mjs` | **すべて逐語一致**（前回 warning #1 の解消を確認） |
  | 帰属表（657〜663）／suite 表（712〜716） | `results/attribution.md` | 一致 |
  | group 出力（614〜626） | `results/attribution.md` 冒頭 | 一致 |
  | 並行実行 before（44〜68） | `results/concurrency.txt` | 一致（サマリ行を省いた抜粋 → suggestion #1） |
  | `inspect` 出力（383〜404）と残り3件の抜粋（412〜420） | `results/data-payload.txt` 1〜54行 | 一致（絶対パス行は持ち込まず `/path/to/` 化） |
  | 関数ペイロード `could not be cloned.`／循環参照 `Unable to deserialize cloned data.`（435〜461・478〜498） | `results/data-payload-errors.txt` | 一致 |
  | `--test-isolation=none` で両方通る（500） | ログ467行 | 一致 |
  | `parentId` が常に `0`（676〜681） | `results/parentid-check.txt` | 一致（分離あり／なし両方） |
  | `entryFile` と `file` の食い違い（743〜745）と「末尾2階層に短縮」注記（740） | `results/entryfile.txt` | 一致 |
  | `type: module` 忘れの警告と「exit code は 0」（199〜205） | `results/type-module.txt`（末尾 `exit=0`） | 一致 |
  | CHANGELOG 引用（82〜90）／`doc/api/test.md` 引用（102〜130） | ログ フェーズ1・`results/doc-excerpts.md` | 一致 |
  | PR #64389 本文の引用（40行） | ログ フェーズ1 PR 本文 verbatim | 一致 |
  | `context.log` に Stability 表記が無い＝Stable 継承（132） | ログ97行 | 一致 |

- 誇大・ログ超えの断定: **検出なし**。出典ログの申し送り3点はいずれも守られている。
  - ①「`t.log()` を使えば並行実行のログが読める」とは書かず、628行で明示的に
    「イベントには帰属が載っているので、reporter 側で復元できる」と訂正している
  - ② AI 単独実測の「約5分」は記事に一切登場しない
  - ③ 記事本文の絶対パスはすべてマスク済み（grep で0件）
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-context-log-test-log-attribution.md (slug=node26-context-log-test-log-attribution) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=39 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 43文字
[PASS] emoji あり: 🪵
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=78
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

`[INFO] /images 参照なし` は false positive ではなく妥当（出典ログ「スクショ 0 枚 / 画像は不要」）。

## 適用した修正

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [x] blocker / warning: 0 件（直すべき必須項目は無い）
- [ ] 任意で suggestion #1・#2 を反映（反映する場合は `/revise-article` → 再レビュー）
- [ ] `/publish-pr` で Front Matter を `published: true` にして PR を作成し、main へマージして公開
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
