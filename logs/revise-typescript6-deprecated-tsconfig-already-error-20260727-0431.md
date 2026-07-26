# 修正適用: TypeScript 6で「警告」だと思っていたtsconfigは、6の時点でもうビルドを止めていた / typescript6-deprecated-tsconfig-already-error

## 採用した前提

- 対象記事: `articles/typescript6-deprecated-tsconfig-already-error.md`（引数で明示 / `published: false`）
- レビューレポート: `logs/review-typescript6-deprecated-tsconfig-already-error-20260727-0427.md`（引数で明示 / 判定: 要修正・blocker 0 / warning 3 / suggestion 5）
- 出典ログ: `logs/run-typescript7-tsconfig-defaults-20260727-0411/execution-log.md`（引数で明示。記事冒頭の前提コメントと一致）
- 適用範囲: blocker ＋ warning（既定）。suggestion は安全で機械的なものだけ
- slug リネーム: 指摘なし → 実施せず（`published: false` を維持）
- 過去の修正レポート: 本 slug の `logs/revise-typescript6-*.md` は存在しない（初回の修正。ループ判定に該当せず）

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 適用内容 |
|---|---|---|---|---|
| 1 | warning | L63「検証設計」 | C 削減修正 | `<!-- 要素材: 前回記事…の公開URLをリンクとして挿入 -->` を削除し、本文を「検証が止まったことがありました（別の記事に書きました）。」に。Zenn ユーザー名がリポジトリ内で確定できなかったため（`README.md` / `publish-pr` / git remote いずれにも Zenn ユーザー名の記載なし。既存記事にも自記事への `zenn.dev` リンク前例なし）、レポートの指示どおり「URL確定不能ならマーカーを削除」を採用 |
| 2 | warning | L239 導入文 | C 削減修正 | 「全行、上に貼ったログの実測です。」→「この記事に貼った出力と、後半で個別に測った分の実測です（`alwaysStrict` は 7.0 のみ単独プローブしたので、5.9 / 6.0 は未計測です）。」 |
| 3 | warning | L249 表 `"alwaysStrict": false` 行 | C 削減修正 | 5.9.3 列を `通る` → `（未計測）`。出典ログの単独プローブは TS7 のみ（`workspace/probe-alwaysStrict-false.log` は `(cd ts70 …)` で exit=1）、ログ L495「計測を省略した項目」にも 6.0 の未計測が明記。5.9 の「通る」も裏付けが無いため未計測に統一 |
| 4 | warning（#2 の波及） | L270 本文 | C 削減修正 | 「6.0 での挙動は測っていません。」→「単独プローブは 7.0 だけなので、5.9 / 6.0 での挙動は測っていません。」（表と記述の不一致を防ぐため） |
| 5 | warning（#2 の波及） | まとめ L491 | C 削減修正 | 「`alwaysStrict: false` の 6.0 での挙動は測っていない」→「5.9 / 6.0 での挙動は測っていない」 |
| 6 | warning | L419 速度節 | B ログ由来の補完 | 「ただ公称の8〜12倍には届きません。」→ `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/` へのリンク付きに変更し、「この倍率は実測ではなく公式の数字です」と明示（ログ L341 の外部一次情報整理に対応） |
| 7 | warning | L478「Compiler API 7.1 予定」 | B ログ由来の補完 | 同アナウンス URL を添えた（ログ L482） |
| 8 | warning | L479「埋め込み言語は未対応」 | B ログ由来の補完 + C | 同アナウンス URL を添え、「ここは自分では確かめていません」と限定を追記（ログ L483） |
| 9 | warning | L480「typescript-eslint がクラッシュ」 | C 削減修正 | 「クラッシュする」→「クラッシュした（自分の別の検証で踏んだ範囲の話です）」に限定。読者が辿れる公開 URL は無いため URL 添付は行わず、レポートが認めた代替（限定の明示）を採用 |
| 10 | suggestion 2 | L51 環境節 | B ログ由来の補完 | `@typescript/typescript6: 6.0.2` に `（tsc6 --version の報告は Version 6.0.3）` を併記（ログ L361-382 / 記事 L452 の実測と整合）。任意適用 |

## スキップした指摘

| # | 重大度 | 箇所 | 理由 |
|---|---|---|---|
| suggestion 1 | suggestion | L9 前提コメント | 意図的に残した。`articles/` の既存公開記事の多くが同じ `<!-- 前提: ... -->` を保持しており（本リポジトリの慣行）、HTML コメントは Zenn の本文としてレンダリングされない。またレビュー/修正パイプラインが出典ログを辿る手掛かりとして機能している。レポート側も「意図的に残すなら判断としてOK」としている |
| suggestion 3 | suggestion | L368「混ぜて説明している記事をいくつか見かけた」 | 既に「自分でも取り違えていました」と自分側に寄せた表現が同文にある。具体URLは出典ログにも無いため追加できない（捏造回避） |
| suggestion 4 | suggestion | title | `check-article.sh` の `[WARN] title が長い: 108文字` はバイト数カウントによる誤検知（実文字数50字）。レポート自身が「対応不要」と明記。文言短縮は記事の主旨・タイトルの変更にあたるため最小修正の原則で見送り |
| suggestion 5 | suggestion | 画像0枚 | 出典ログどおり CLI 完結の検証でスクショ0枚。`screenshots/` に素材が無く、図の追加は捏造になるため見送り（レポートも「必須ではない」） |

## 未解消の指摘

なし（warning 3件すべて適用済み）。

## 修正不能と判定した指摘

なし。

## セルフチェック結果（scripts/check-article.sh 再実行）

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

- 修正前 `SUMMARY fail=0 warn=2` → 修正後 `fail=0 warn=1`。`要素材` マーカーの WARN は解消。
- 残る `warn=1` は title のバイト数誤検知（レポートで suggestion に降格済み・対応不要）。
- `published: false` を維持していることを最終確認済み。

## 秘密情報に関する警告

なし（今回の修正で秘密情報・個人パスのマスクは発生していない。修正前のチェックでも検出0）。

## 次のアクション

- `/review-article articles/typescript6-deprecated-tsconfig-already-error.md` で再レビューする
- 判定が「公開可」になったら `/publish-pr` へ
