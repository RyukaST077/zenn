# 公開前レビュー（再レビュー）: TypeScript 6で「警告」だと思っていたtsconfigは、6の時点でもうビルドを止めていた / typescript6-deprecated-tsconfig-already-error

## レビューの前提

- 対象記事: `articles/typescript6-deprecated-tsconfig-already-error.md`（引数で明示 / `published: false`）
- 出典ログ: `logs/run-typescript7-tsconfig-defaults-20260727-0411/execution-log.md`（引数で明示。記事冒頭 L9 の前提コメントと一致）
- レビュー日時: 2026-07-27 04:33
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 前回レビュー: `logs/review-typescript6-deprecated-tsconfig-already-error-20260727-0427.md`（要修正 / warning 3）
- 修正レポート: `logs/revise-typescript6-deprecated-tsconfig-already-error-20260727-0431.md`（warning 3 すべて適用）
- 追加照合: 出典ログのみでなく `workspace/` の実ファイル（`fixture/`、`probe-*.log`、`ts70-*.log`、`tsconfig-after.json`）まで突合した

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 4 件
- 根拠（判定を決めた主な確認結果）:
  - 公開安全は全項目クリア。`published: false` / slug 45文字・文字種OK・`articles/` 内重複なし / 秘密情報・個人パス・内部ホスト名の検出なし。
  - 前回の warning 3件すべてが解消済み（`要素材` マーカー消滅 / 「全行実測」表現と `alwaysStrict` 行の整合 / 実測外の主張への出典・限定の付与）。
  - 事実整合を `workspace/` の実ログ・実ファイルまで下ろして再照合し、創作・数値の水増しは検出なし。
  - 残る指摘は suggestion 4件のみ（うち1件は機械チェックの誤検知）で、公開を止める性質のものはない。

## 最優先で直すべき指摘（上位3件）

warning / blocker はゼロ。以下は任意（公開を止めない）。

1. [suggestion] L368「ここを混ぜて説明している記事をいくつか見かけたので」 — 他記事への否定的言及に出典が無い。出典ログにもURLが無く追加できないため、現状の「自分でも取り違えていました」で自分側に寄せた表現のままでも可。角を落としたい場合は「一般に混同されやすい」等に和らげる。
2. [suggestion] L9 前提コメント `<!-- 前提: 出典ログ ... -->` — Zenn ではレンダリングされず、既存公開記事も同じ慣行なので残置で可。パイプライン情報を公開物から外したい方針なら削除。
3. [suggestion] title の `check-article.sh` 警告 — `[WARN] title が長い: 108文字` はバイト数カウントによる誤検知（実文字数は約50字で60字目安内）。対応不要。

## 指摘一覧（重大度順）

### blocker

なし。

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| — | — | — | — | — |

### warning

なし（前回の3件はすべて解消済み。下記「前回指摘の解消確認」参照）。

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| — | — | — | — | — |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L368 | 「ここを混ぜて説明している記事をいくつか見かけた」に出典が無い | 出典ログにURLが無いため追加は不可（捏造回避）。表現を和らげると角が立たない。現状でも同文に「自分でも取り違えていました」があり許容範囲 |
| 2 | L9 | 前提コメントが残存 | HTMLコメントは Zenn 本文に出ないため実害なし。リポジトリ慣行として残置も妥当。削れば公開物からパイプライン情報が消える |
| 3 | title | `[WARN] title が長い: 108文字` | バイト数カウントの誤検知（実文字数約50字）。対応不要。「6で」「6の時点で」の重複感を削ると記事一覧での可読性が上がる（例: 「TypeScript 6の時点でtsconfigはもうビルドを止めていた」） |
| 4 | 画像 | スクショ 0 枚（`/images` 参照なし） | 出典ログどおりCLI完結の検証で妥当（ログ「スクショ 0枚」）。step 推移表（L276）と対応表が図の代わりに機能している。6→1→6 の跳ね返りを図にすると山場がより伝わる（素材が無いため今回は追加不可） |

## 前回指摘の解消確認

| 前回 # | 前回の指摘 | 現状 | 確認方法 |
|---|---|---|---|
| warning 1 | L63 に `要素材` マーカー残存 | **解消**。本文は「検証が止まったことがありました（別の記事に書きました）。」でコメントは消えている | `check-article.sh` `[PASS] 要素材マーカーなし` / 記事 L63 目視 |
| warning 2 | 「全行、上に貼ったログの実測です」が過大 ＋ `alwaysStrict` 5.9 の「通る」に裏付けなし | **解消**。L239 は「この記事に貼った出力と、後半で個別に測った分の実測です（`alwaysStrict` は 7.0 のみ単独プローブしたので、5.9 / 6.0 は未計測です）」に変更。L249 の 5.9 / 6.0 とも `（未計測）`。L270・L491 の本文記述も「5.9 / 6.0 は測っていない」に統一され表と矛盾しない | 記事 L239 / L249 / L270 / L491 ↔ `workspace/probe-alwaysStrict-false.log`（`cmd: (cd ts70 ...)` = TS7 のみ） |
| warning 3 | 実測外の主張に出典なし | **解消**。L419（8〜12倍）に公式アナウンスへのリンク＋「この倍率は実測ではなく公式の数字です」、L478（Compiler API 7.1）にリンク、L479（埋め込み言語）にリンク＋「ここは自分では確かめていません」、L480（typescript-eslint）は「クラッシュした（自分の別の検証で踏んだ範囲の話です）」と限定 | 記事 L419 / L478-480 目視 |
| suggestion 2 | `@typescript/typescript6: 6.0.2` と `tsc6` 報告版 6.0.3 の食い違い | **解消**。L51 で `6.0.2（tsc6 --version の報告は Version 6.0.3）` と併記 | 記事 L51 ↔ ログ L76 / L370 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`（L6）/ slug 45文字・`a-z0-9-` のみ・汎用語でない・`articles/` 内に重複なし / APIキー・トークン・接続文字列・個人パス（`/Users/...`）・内部ホスト名なし |
| Front Matter | OK | title / emoji(🚧) / type(tech) / topics(typescript, tsconfig, nodejs, npm の4個) / published すべて揃う。title長のWARNはバイト数誤検知 |
| 事実性（ログ照合） | OK | 出力全文・終了コード・step推移・計測値・fixtureコードが `workspace/` の実ファイルと一致。未計測項目は「（未計測）」と明示。実測外の主張には出典または限定が付いた |
| 画像 | OK | 参照0・孤立画像0。CLI完結の検証（ログ「スクショ 0枚」）と整合 |
| Markdown構造 | OK | コードフェンス48行（偶数）・`:::` 4行（偶数）で閉じている。H1なし、H2/H3の階層破綻なし、`example.com`/TODO 等のプレースホルダリンクなし。参考リンクは Zenn のカード埋め込み形式（単独行の生URL）で公式2本 |
| 文章品質・トーン | OK | 外した予測4件＋予測していなかった発見2件を隠さず表で提示。`:::message` で「新人・6ファイル45行の極小題材」と限定、`:::message alert` に詰まった点5件、環境節にOS/Node/npm/各版を明記。冒頭で結論（6.0で既に落ちる）を提示 |
| 完成度 | OK | `要素材` / TODO / `<...>` の残存なし。前提コメントのみ意図的に残置（suggestion 2） |

## 事実整合の照合結果（ログ・workspace との突合）

- 結論: 記事「6.0 の時点でもうビルドが止まっていた / `strict`・`types: []` は 6.0 由来で 7.0 固有ではない」 ↔ ログ「一番の発見」「完了条件 4/4 達成」 → **一致**
- 出力全文（すべてログおよび `workspace/*.log` に存在・改変なし）:
  - `npm view typescript dist-tags`（記事 L16-24 ↔ ログ L66-74）→ 一致
  - 版ゲート出力・`GATE_FAIL=0`（記事 L86-95 ↔ ログ L103-112 / `versions.txt`）→ 一致
  - 5.9 baseline `exit=0 / error_lines=0`（記事 L183-184 ↔ `ts59-baseline.log`）→ 一致
  - 6.0 baseline TS5107/TS5101 ×5・`exit=2`・`Visit https://aka.ms/ts6` の付く行の位置まで一致（記事 L194-203 ↔ `ts60-baseline.log`）
  - 7.0 baseline TS5108/TS5102/TS5090 ×6・`exit=1`（記事 L215-224 ↔ `ts70-baseline.log`）→ 一致
  - step6 の型エラー6件全文（記事 L291-299 ↔ `ts70-step6-paths-relative.log`）→ 一致
  - `ignoreDeprecations` の 6.0 / 7.0 出力（記事 L381-401 ↔ `ts60-ignoredep.log` / `ts70-ignoredep.log`。行番号 (9,9)/(12,5)/(13,24) のズレも一致）
  - tsconfig の diff（記事 L308-328 ↔ `tsconfig-before.json` → `tsconfig-after.json`）→ 一致
  - `.bin` の中身・`tsc`=7.0.2 / `tsc6`=6.0.3・両者 `exit=0`（記事 L444-459 ↔ ログ L361-382）→ 一致
- 貼っているコードが実 workspace 由来か:
  - `fixture/tsconfig.json`（記事 L123-139）→ `workspace/fixture/tsconfig.json` と**完全一致**
  - `fixture/src/loose.ts` / `node-env.ts` / `interop.ts`（記事 L143-170）→ 同ファイルとコメント文言まで**完全一致**
  - 修正後 `src/loose.ts`（記事 L332-344）→ `workspace/ts70/src/loose.ts` と**完全一致**
  - 「合計6ファイル45行」→ `find fixture/src -name '*.ts'` = 6 / `wc -l` 合計 = 45 で**一致**
- 数値の裏付け: 5回×3版の生データ、中央値 5478/5563/1322、約4.1倍 / 約4.2倍、`--singleThreaded` 1643ms、`added 4 packages`、optionalDependencies 20個、TS2591 ×3 → すべてログの実測値と一致
- 適切に限定できている記述: 「4倍は6ファイル45行の参考値」（L266・L419・L423・L491）、「公称8〜12倍は実測ではなく公式の数字」（L419）、「埋め込み言語は自分では確かめていない」（L479）、「typescript-eslint は自分の別検証で踏んだ範囲」（L480）、「`alwaysStrict` の 5.9 / 6.0 は未計測」（L239・L249・L270・L491）
- AI単独の実測時間（約8分）を記事に転記していない点も、ログ L12 の注意に従えている
- 創作の疑いがある記述: **なし**
- 裏付けの弱い記述: **なし**（前回の2箇所は限定表現または出典付与で解消）
- 残存する `要素材` マーカー: **0 件**

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
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

false positive の切り分け: `[WARN] title が長い: 108文字` はバイト数カウントによる誤検知（日本語混在タイトルの実文字数は約50字＝60字目安内）。前回同様 suggestion に降格し、判定には影響させていない。

## 適用した修正

なし（レポートのみ。記事本文は一切変更していない）。

## 次のアクション

- [x] blocker / warning は 0 件（前回の warning 3件は `/revise-article` で解消済み）
- [ ] suggestion 4件は任意。手を入れないまま公開してよい
- [ ] Front Matter を `published: true` に変えて公開する（`/publish-pr` 推奨。PR を main にマージ＝公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
