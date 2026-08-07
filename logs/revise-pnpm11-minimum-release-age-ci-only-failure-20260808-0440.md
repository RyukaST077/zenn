# 修正レポート: pnpm 11のminimumReleaseAge既定24hを踏みに行ったら、手元では通ってCIだけ落ちた / pnpm11-minimum-release-age-ci-only-failure

## 修正の前提

- 対象記事: `articles/pnpm11-minimum-release-age-ci-only-failure.md`（引数で明示指定 / リネームなし）
- レビューレポート: `logs/review-pnpm11-minimum-release-age-ci-only-failure-20260808-0437.md`（判定: 公開不可 / blocker 1・warning 1・suggestion 4）
- 出典ログ: `logs/run-pnpm11-minimum-release-age-20260808-0411/execution-log.md`（引数で明示指定）
- 適用範囲: blocker + warning（+ 安全な suggestion 1〜3）
- slug リネーム: 既定（可）だが指摘なしのため実施せず
- 過去の修正レポート: なし（本記事の初回修正）
- 修正日時: 2026-08-08 04:40

## 結果サマリー

- 適用: blocker 1 件 / warning 1 件 / suggestion 3 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: `SUMMARY fail=0 warn=2`（2件ともレビューが false positive と切り分け済み）
- `published: false` を維持

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | blocker-1 / 「検証環境」ほか計7行 | E | 個人パス・OSユーザー名の伏せ字化。`/Users/katayamaryuunosuke/Library/pnpm/store/v11` → `/Users/<user>/Library/pnpm/store/v11`（旧L113,116,198,265,510）、同 `.../store/v10` → `/Users/<user>/Library/pnpm/store/v10`（旧L114）、`drwxr-xr-x@ 258 katayamaryuunosuke  staff` → `drwxr-xr-x@ 258 <user>  staff`（旧L118,119）。修正後に `grep katayamaryuunosuke` が 0 件であることを確認 | 機械修正（既存公開記事の慣行に合わせた） |
| 2 | warning-1 / 「CIで気をつけたいこと」 | C | 「単一パッケージのプロジェクトでも pnpm 11 は `pnpm-workspace.yaml` を作るので」 → 「単一パッケージのプロジェクトでも、pnpm 11 は exact 指定の `pnpm add` のときに `pnpm-workspace.yaml` を作ることがある（今回のケースBのような range 指定では作られませんでした）ので」。無条件の断定を、ログの限定表現と記事内ケースBの観測に合わせて弱めた | 出典ログ L692「作る**ことがある**」／L279「`pnpm-workspace.yaml` は**作られない**」 |
| 3 | suggestion-1 / 「24時間以内に公開された版を探す」 | A | 26.x 一覧の直後に注記を1文追加:「（この一覧は先ほどの探索より少しあとに走らせたので、同じ 26.2.0 の経過時間が 1.37h → 1.39h とずれています。）」。数値自体はどちらもログ実測値のまま変更していない | 出典ログの 1.37h / 1.39h 両実測値 |
| 4 | suggestion-2 / 「SQLiteストアでinstall時間はどうなったか」 | A | ストア対応の出力ブロック直後に1文追加:「`node_modules/.pnpm` のエントリは 70 なのにストアの索引は 68 行／68 個で、2つずれています（直接依存分の差だと思っています）。」断定を避けた表現にした | ログの 70 エントリ / 68 行（同じずれがログにも存在） |
| 5 | suggestion-3 / 「blockExoticSubdeps を踏むまでに3回空振りした」 | B | `ERR_PNPM_EXOTIC_SUBDEP` の引用出力に、落ちていた `This error happened while installing the dependencies of fixture-d-child@1.0.0` の行（空行含む）を復元 | 出典ログ L390（`case-logs/logs-case-d4-github-tarball.log` の全文引用） |

suggestion-4（冒頭の `<!-- 前提: ... -->` コメント）はレビュー側で「意図的な運用・対応不要」と結論づけられているため、変更していない。

## 削除した記述（分類C で削ったもの）

なし。分類Cの適用は warning-1 の「断定を弱める」1件のみで、削除はしていない。

## 未解消の指摘

なし。

## 警告

- ⚠ 記事ファイルは未コミット（`git status` で untracked）だったため、個人パスは git 履歴に入っていない。履歴の書き換えは不要。
- 秘密情報の実キー・トークンの混入は無く、伏せたのはローカルのホームディレクトリ名のみ。失効（ローテーション）が必要なものはない。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/pnpm11-minimum-release-age-ci-only-failure.md (slug=pnpm11-minimum-release-age-ci-only-failure) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=42 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 101文字 (60字目安)
[PASS] emoji あり: ⏳
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=96
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 631,633
SUMMARY fail=0 warn=2
```

残る2つの WARN はいずれもレビューレポートで false positive と切り分け済み:

- `title が長い: 101文字` → 101 はバイト数。実文字数 55 字で既存公開記事の範囲内。
- `秘密情報の疑い at line 631,633` → `file:///Users/.../pnpm/dist/pnpm.mjs`。もともと `...` で伏せ済み。
- blocker-1 の対象だった旧 L113,114,116,198,265,510 と所有者列 L118,119 は検出から消えた。

## 次のアクション

- [ ] `/review-article articles/pnpm11-minimum-release-age-ci-only-failure.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
