# 公開前レビュー: Vitest 5 RC に上げてみたら、テストより先に npm が落ちた / vitest5-rc-breaking-changes

## レビューの前提

- 対象記事: `articles/vitest5-rc-breaking-changes.md`（引数で明示）
- 出典ログ: `logs/run-vitest5-rc-breaking-changes-20260817-0412/execution-log.md`（引数で明示。`workspace/test-v4-baseline/` `workspace/test-v5-fixed/` の実ソースも照合に使用）
- レビュー日時: 2026-08-17 04:39
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 位置づけ: 再レビュー（`logs/review-...-0434.md` → `logs/revise-...-0438.md` 適用後）

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠:
  - 公開安全は全項目クリア（`published: false` / slug 妥当・重複なし / 端末出力のパスは全て `/Users/.../` にマスク済み・実キーやトークンの混入なし）。
  - 前回レビューの warning 4 件はすべて解消を確認（12個への訂正／C を的中側へ移し「外したのは A・G・H」と明記／「4経路」への統一／`vitest.escape.config.ts` のフェンス名と別名理由の追記）。
  - 事実整合は出典ログおよび `workspace/` の実ソースと突合し、本文のコマンド・エラー全文・数値・コードすべてに裏付けを確認。創作記述は検出されなかった。
  - 機械チェックは `fail=0`、WARN 2 件はいずれも false positive（下記）。

## 最優先で直すべき指摘（上位3件）

blocker / warning はなし。以下は任意（公開を止める必要はない）。

1. [suggestion] 「G: `.vitest/` ディレクトリ」節 — 「4経路」のうち「キャッシュの置き場」は成果物“生成”経路ではないため、「reporter(json) / reporter(junit) / coverage の3経路＋キャッシュ位置の確認」と書き分けるとより正確になる。
2. [suggestion] 「はじめに」節 — 本記事はスクショ0枚（CLI 検証のため妥当）。冒頭に「掲載するのは端末出力のみ」と一言添えると読者の期待が揃う。
3. [suggestion] 冒頭 `<!-- 前提: 出典ログ ... -->` コメント — 既存の公開済み記事と同じ慣行のため現状維持で問題ないが、運用として不要なら削除してよい。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L542 / L558 / L627「G」節 | 「4経路」にキャッシュ位置の確認が含まれている（出典ログ 4-3 の見出しも「3つの経路」） | 「生成経路3つ＋キャッシュ位置の確認」と書き分けると、G が再現しなかった範囲がより厳密に伝わる |
| 2 | L11「はじめに」節 | 画像・スクショが0枚であることに触れていない | 「端末出力のみ」と先に宣言すると、CLI 検証記事として読者の期待が揃う |
| 3 | L9 冒頭コメント | `<!-- 前提: 出典ログ ... -->` が残っている | 既存記事と同じ慣行のため現状維持で可。運用上不要なら削除で本文がすっきりする |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug `vitest5-rc-breaking-changes`（27字・汎用語なし・`articles/` 内重複なし）/ 秘密情報なし・個人パスは全てマスク済み |
| Front Matter | OK | title/emoji(🧪)/type(tech)/topics(5個: vitest, npm, typescript, testing, vite)/published すべて妥当。誇大表現なし |
| 事実性（ログ照合） | OK | 下記「事実整合の照合結果」参照。創作記述の検出なし |
| 画像 | OK | `/images` 参照ゼロ。出典ログの「スクリーンショット一覧: なし（0枚）」と一致（CLI 検証のため妥当）。孤立画像もなし |
| Markdown構造 | OK | コードフェンス74行（偶数）/ `:::` 8行（偶数）/ 見出しは H2・H3 のみで階層破綻なし / 参考リンク2件（migration ガイド・mocking ガイド）はプレースホルダでない実URL |
| 文章品質・トーン | OK | 経験談トーン、予想を外した3項目・再現しなかった項目Gを正直に記載。再現環境（OS/Node/npm/Vite/Vitest/検証日）とRC注記あり |
| 完成度 | OK | `要素材` マーカー・TODO・プレースホルダの残存なし |

## 事実整合の照合結果（ログとの突合）

- 結論: 記事「8項目中5項目が落ちて、全部直せました」「Gは再現せず」 ↔ ログ「完了条件の判定: 達成（4条件すべて充足）」「落ちたのは A・B・D・E・F の5項目」「項目G: 未達（再現せず）」 → **一致**
- 主要な数値・出力の裏付け（すべて確認済み）:
  - `npm view` dist-tags / engines / peerDependencies、公開日（4.1.10: 2026-07-06、5.0.0-rc.1: 2026-08-11）→ ログ フェーズ1-2 と一致
  - 4.1 ベースライン `Test Files 8 passed (8) / Tests 8 passed (8)` / `Duration 1.45s` → `v4-green.log` 該当箇所と一致
  - 5RC 初回 `Test Files 5 failed | 3 passed (8)` / `Tests 3 failed | 3 passed (6)` / `Duration 1.27s`、5つの FAIL 全文 → ログ 3-10 と一致（要約・改変なし）
  - 修正後 `Test Files 8 passed (8) / Tests 9 passed (9)` / `Duration 1.51s`、8→9 の理由（F に正規表現テスト追加）→ ログ 4-4 と一致
  - npm クラッシュ: エラー全文・`verbose stack` 全文・切り分け5行の表・`--legacy-peer-deps` で `added 37 packages ... in 5s` → ログ 3-9 と一致
  - `-t` の 2×2 表（4セル）と「両バージョンとも終了コード0」→ ログ 3-3 / 4-2 と一致
  - H: 4.1 が `WORKER_ID=0` / `POOL_ID=1`、5RC が `WORKER_ID=1` / `POOL_ID=1` → ログ 項目別結果表 H 行と一致
  - `--clearMocks` の `CACError` 全文、`--config vitest.escape.config.ts` の実行結果 → ログ 4-1 と一致
- 掲載コードの出所: A / B / C / D / E / F / gh-env の before・after は `workspace/test-v4-baseline/` および `workspace/test-v5-fixed/` の実ファイルと**逐語一致**（コメント文言まで一致）。創作コードなし。
- 記事とログ散文の食い違い1件（**記事が正しい**）: 記事 L220「peerDependencies は12個」に対し、出典ログの散文は「13個」と書いている。ログ フェーズ1-2 に収録された `npm view vitest@rc peerDependencies` の実出力は 12 件であり、記事の記述が一次情報と整合する。**記事の修正は不要**（ログ側の誤記）。
- 残存する `要素材` マーカー: 0 件
- 内部メタの転記なし: ログの `<!-- 内部メタ: 記事に転記しない -->`（AI単独実行・実測12分）は本文に持ち込まれていないことを確認。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/vitest5-rc-breaking-changes.md (slug=vitest5-rc-breaking-changes) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=27 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 74文字 (60字目安)
[PASS] emoji あり: 🧪
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 162,165,167,188,265,286,596
SUMMARY fail=0 warn=2
```

### WARN の切り分け（いずれも false positive）

- `title が長い: 74文字` — バイト数カウント。実際のタイトル「Vitest 5 RC に上げてみたら、テストより先に npm が落ちた」は36文字で、Zenn の表示上も問題ない。**指摘に採用しない**。
- `秘密情報の疑い [user-path]` — 該当7行（162/165/167/188/265/286/596）をすべて目視確認。いずれも `/Users/.../` にマスク済みで、ユーザ名・実パスは露出していない。L162 にマスク方針の明記もある。**指摘に採用しない**。

## 適用した修正

なし（レポートのみ・記事本文は未変更）。

## 次のアクション

- [x] blocker / warning の解消（0件）
- [ ] suggestion 3件は任意。取り込む場合は `/revise-article` → 再レビュー
- [ ] `/publish-pr articles/vitest5-rc-breaking-changes.md` で公開準備（PR 上で `published: true` にし、main へマージ＝公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。`knowledge/2026-07-01-zenn-slug-already-used.md`）
