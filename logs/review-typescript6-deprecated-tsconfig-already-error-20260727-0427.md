# 公開前レビュー: TypeScript 6で「警告」だと思っていたtsconfigは、6の時点でもうビルドを止めていた / typescript6-deprecated-tsconfig-already-error

## レビューの前提

- 対象記事: `articles/typescript6-deprecated-tsconfig-already-error.md`
- 出典ログ: `logs/run-typescript7-tsconfig-defaults-20260727-0411/execution-log.md`（引数で明示。記事冒頭の前提コメントと一致）
- レビュー日時: 2026-07-27 04:27
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 3 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全は全項目クリア（`published: false` / slug 妥当・重複なし / 秘密情報・個人パスなし）。blocker は無い。
  - 未完成マーカー `要素材` が 1 件残っている（前回記事へのリンク未挿入）。
  - 対応表の「全行、上に貼ったログの実測です」が実態とずれている（`alwaysStrict` の 5.9/6.0 は未計測）。
  - 実測ではない外部由来の主張（公称8〜12倍 / Compiler API 7.1予定 / 埋め込み言語未対応 / typescript-eslint クラッシュ）に読者が辿れる出典が無い。

## 最優先で直すべき指摘（上位3件）

1. [warning] 63行目「検証設計：なぜ3つのディレクトリに分けたか」 — 残っている `<!-- 要素材: 前回記事…の公開URLをリンクとして挿入 -->` を、実在する前回記事（`articles/typescript7-tsc-bin-collision-log.md`、`published: true`）へのリンクに置き換える。Zenn のURLは `https://zenn.dev/<Zennユーザー名>/articles/typescript7-tsc-bin-collision-log`。ユーザー名が確定できない場合はマーカーごと削除して本文だけ残す（コメントを公開物に残さない）。
2. [warning] 239行目「設定 → 3世代での扱い」の導入文 — 「全行、上に貼ったログの実測です」を実態に合わせる。表には `alwaysStrict` の 6.0 が「（未計測）」で入っており、5.9 の「通る」も裏付けログが無い。「この記事に貼った出力と、後半で個別に測った分の実測です（`alwaysStrict` は 7.0 のみ単独で測ったため、5.9 / 6.0 は未計測）」のように書き換え、249行目の表の 5.9 列も `（未計測）` にする。
3. [warning] 419行目・477〜481行目 — 実測ではない主張（`公称の8〜12倍`、`Compiler API が 7.0 には無く 7.1 予定`、`Vue / Svelte / … は未対応`、`typescript-eslint が TypeScript 7 でクラッシュする`）に出典が無い。前3件は参考リンク節にある TypeScript 7 アナウンス記事が根拠なので該当箇所に同URLを添える。`typescript-eslint` は「別の検証で踏んだので」だけでは読者が辿れないため、前回記事のURLを添えるか「自分の別の検証で踏んだ範囲の話」と限定を明示する。

## 指摘一覧（重大度順）

### blocker

なし。

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| — | — | — | — | — |

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | L63「検証設計」 | `要素材` マーカーが残存（未完成サイン）。前回記事へのリンクが未挿入で、HTMLコメントが本文に残ったまま | 実在する `articles/typescript7-tsc-bin-collision-log.md`（published: true）へのZennリンク `https://zenn.dev/<Zennユーザー名>/articles/typescript7-tsc-bin-collision-log` に差し替える。URL確定不能ならマーカーを削除 | check-article.sh `[WARN] 要素材マーカーが 1件残っている` / チェックリスト 3・7 |
| 2 | L239 導入文 ＋ L249 表の `"alwaysStrict": false` 行 | 「全行、上に貼ったログの実測です」が過大。同表には `（未計測）` セルがあり、`alwaysStrict` の 5.9「通る」も出典ログに裏付けが無い（ログの単独プローブは 7.0 のみ） | 導入文を「この記事に貼った出力と、後半で個別に測った分の実測です（`alwaysStrict` は 7.0 のみ単独プローブ。5.9 / 6.0 は未計測）」に変更し、L249 の 5.9 列を `通る` → `（未計測）` にする | ログ L318-323（`probe-alwaysStrict-false.log` は TS7 のみ）/ ログ L494-496「計測を省略した項目」 |
| 3 | L419、L477-481 | 実測外の主張に読者が辿れる出典が無い（`公称の8〜12倍` / `Compiler API` 7.1予定 / 埋め込み言語未対応 / `typescript-eslint` クラッシュ） | L419 と L478-479 に参考リンク節の `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/` を該当箇所へ添える。L480 の `typescript-eslint` は前回記事URLを添えるか「自分の別検証で踏んだ範囲」と限定を明示 | ログ L341/L481-485（外部一次情報として整理されているが記事側にリンクが無い）/ チェックリスト 3「ログに無い断定」 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L9 前提コメント | `<!-- 前提: 出典ログ … -->` が残っている（消し忘れの可能性） | 公開物にパイプライン内部の情報を残さない。意図的に残すなら判断としてOK |
| 2 | L51 環境節 `@typescript/typescript6: 6.0.2` | 記載は dist-tag 上のパッケージ版で、実際に動く `tsc6` は `Version 6.0.3`（L452）。読者が数字の食い違いに引っかかる | `@typescript/typescript6: 6.0.2（tsc6 の報告版は 6.0.3）` のように併記すると混乱しない |
| 3 | L368「ここを混ぜて説明している記事をいくつか見かけたので」 | 出典なしで他記事を否定的に参照している | 「自分も取り違えていた」側に寄せる（既にその文はある）か、具体URLを添えると角が立たない |
| 4 | title（50文字・108バイト） | `check-article.sh` が `[WARN] title が長い: 108文字` を出すが、これはバイト数カウント。実文字数は50字で60字目安内 | 誤検知として対応不要。ただし「6の時点でもう」の重複感を削ると一覧での可読性が上がる（例: 「TypeScript 6の時点でtsconfigはもうビルドを止めていた」） |
| 5 | 画像 | スクショ0枚（`/images` 参照なし） | 出典ログどおりCLI完結の検証なので妥当。step 推移表（L276）が図の代わりになっている。必須ではないが、6→1→6の跳ね返りだけ図にすると山場が伝わりやすい |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 45文字・文字種OK・`articles/` 内重複なし / 秘密情報・個人パス・内部ホスト名なし |
| Front Matter | OK | title/emoji/type(tech)/topics(4)/published すべて揃う。title長warnはバイト数の誤検知 |
| 事実性（ログ照合） | 要修正 | 出力全文・終了コード・step推移・計測値はログと完全一致。warning 2・3 の2点のみ要調整 |
| 画像 | OK | 参照0・孤立画像0。CLI完結の検証で妥当（ログ「スクショ 0枚」と一致） |
| Markdown構造 | OK | フェンス48行で閉じ、`:::` 4行で閉じ。H1なし・H2/H3の階層も破綻なし。リンクのプレースホルダなし |
| 文章品質・トーン | OK | 予測外し4件を隠さず記載、`:::message` で新人・題材規模の限定、`:::message alert` に詰まった点5件、環境節にOS/Node/npm/各版あり |
| 完成度 | 要修正 | `要素材` 1件残存。他のプレースホルダ・TODOは無し |

## 事実整合の照合結果（ログとの突合）

- 結論: 記事「6.0 の時点でもうビルドが止まっていた／`strict`・`types: []` は 6.0 由来で 7.0 固有ではない」 ↔ ログ「一番の発見」「完了条件4件すべて達成」 → **一致**
- 出力全文の突合（すべてログに存在・改変なし）:
  - `npm view typescript dist-tags` 出力（記事 L16-24 ↔ ログ L66-74）→ 一致
  - 版ゲート出力・`GATE_FAIL=0`（記事 L86-95 ↔ ログ L103-112）→ 一致
  - 5.9 baseline `exit=0 / error_lines=0`（記事 L183-184 ↔ ログ L144-145）→ 一致
  - 6.0 baseline TS5107/TS5101 ×5・`exit=2`（記事 L194-203 ↔ ログ L152-162）→ 一致
  - 7.0 baseline TS5108/TS5102/TS5090 ×6・`exit=1`（記事 L215-224 ↔ ログ L174-184）→ 一致
  - step6 の型エラー6件全文（記事 L291-299 ↔ ログ L216-225）→ 一致
  - `ignoreDeprecations` 6.0 / 7.0 の出力（記事 L381-401 ↔ ログ L278-295、行番号 (9,9)/(12,5)/(13,24) の差も一致）→ 一致
  - tsconfig の diff（記事 L308-328 ↔ ログ L236-256）→ 一致
  - `.bin` の中身・`tsc`=7.0.2 / `tsc6`=6.0.3・両者 exit=0（記事 L444-459 ↔ ログ L361-382）→ 一致
- 数値の裏付け: 計測表5回×3版・中央値5478/5563/1322・約4.1倍/約4.2倍・`--singleThreaded` 1643ms・6ファイル45行・`added 4 packages`・optionalDependencies 20個 → すべてログに実測値あり（記事 L411-417、L117、L463）
- 適切に限定できている点: 「4倍は45行の参考値」「実測はAI単独なので所要時間は書かない」というログ側の注意（ログ L12、L344、L525）を記事は守っている。総所要時間の記載なし＝OK
- 創作の疑いがある記述: なし。fixture のコード（`loose.ts` / `node-env.ts` / `interop.ts`、修正後の `loose.ts`）はログの fixture 記述・エラー行番号（`loose.ts(2,24)/(7,10)/(10,5)`、`node-env.ts(2,22)/(3,20)`、`interop.ts(2,23)`）と整合
- 裏付けの弱い記述: `alwaysStrict: false` の 5.9 列「通る」（warning 2）、外部由来の4主張（warning 3）
- 残存する `要素材` マーカー: **1 件**（L63「検証設計：なぜ3つのディレクトリに分けたか」）

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/typescript6-deprecated-tsconfig-already-error.md (slug=typescript6-deprecated-tsconfig-already-error) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=45 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 108文字 (60字目安)
[PASS] emoji あり: 🚧
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=48
[PASS] ::: ブロックが閉じている: 4 行
[WARN] 要素材マーカーが 1件残っている (未完成。埋めるか節を削る)
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

false positive の切り分け: `[WARN] title が長い: 108文字` はバイト数カウントによる誤検知（実文字数50字 = 60字目安内）。重大度を suggestion に下げた。

## 適用した修正

なし（レポートのみ。記事本文は変更していない）。

## 次のアクション

- [ ] warning 3件を直す（`要素材` → 前回記事リンク / 対応表の「全行実測」表現と `alwaysStrict` 行 / 外部主張への出典追加）
- [ ] suggestion は任意（L9 の前提コメント削除は公開前に推奨）
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` にこのレポートを渡してもよい）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
