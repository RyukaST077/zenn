# 修正レポート: pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた / pnpm12-rc-five-diffs

## 修正の前提

- 対象記事: `articles/pnpm12-rc-five-diffs.md`（引数で明示指定・リネームなし）
- レビューレポート: `logs/review-pnpm12-rc-five-diffs-20260816-0428.md`（判定: 公開不可）
- 出典ログ: `logs/run-pnpm12-rc-five-diffs-20260816-0411/execution-log.md`（引数で明示指定）
  - 併せて `artifacts/lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` / `lock-v11.yaml` / `lock-v12.yaml` /
    `lock-v11-order2.yaml` / `lock-v12-order2.yaml` を照合に使用
- 適用範囲: blocker + warning（+ 安全な suggestion 3件）
- slug リネーム: 禁止指定なし。指摘も無いためリネームせず
- 修正日時: 2026-08-16 04:33
- 過去の修正レポート: なし（本記事に対する `/revise-article` は初回。ループ検出対象なし）

## 結果サマリー

- 適用: blocker 1 件 / warning 2 件 / suggestion 3 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: `SUMMARY fail=0 warn=1`（`title が長い: 91文字` はレビューで false positive と切り分け済み。バイト長であり実文字数は 39 文字）
- `published: false` を維持

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | [blocker] ②節 L252 — `git+ssh://` fixture の lockfile について「`grep -c ssh` も `grep -c git@` も 0 件」と書いているが事実と異なる | C（ログ由来の事実に差し替え） | before:「両方とも lockfile には HTTPS の codeload URL を書きました。`grep -c ssh` も `grep -c git@` も lockfile 内で 0 件です」→ after:「両方とも lockfile の `version:` / `resolution:` 行は HTTPS の codeload URL でした（`specifier:` には自分が書いたとおりの `git+ssh://git@github.com/kevva/is-positive.git` がそのまま残ります）。`grep -c ssh` / `grep -c git@` が 0 件だったのは、`git+ssh://` を含まない3表記 fixture の lockfile の方です」 | 再測定で確認: `lock-ssh-v11.yaml` / `lock-ssh-v12.yaml` とも `grep -c ssh`=2 / `grep -c git@`=1（L11 `is-positive-ssh:` と L12 `specifier:`）。`lock-v11.yaml` / `lock-v12.yaml` は両方 0。execution-log L363-367 |
| 2 | [warning] 「詰まった点」L430 — 「ウォームストアだから `integrity` を書けない」の一般化が 12 の実測と矛盾 | C（主語の限定） | before:「1回目はネットワークからダウンロードしたので…」→ after:「pnpm 11 では、1回目はネットワークからダウンロードしたので…」と 11 限定に | `lock-v11-order2.yaml`（ウォーム）integrity 12 行 / `lock-v12-order2.yaml`（ウォーム）13 行。execution-log L431-441 |
| 3 | [warning] 同上 L465 の助言 | B（ログ由来の1文追加） | 「真っ先に疑うべきは…ストアの状態かもしれません」の後に「ただし 12 は同じウォームストア条件でも `integrity` を書いていて（3行目の2回目も `041735...` 側）、この非決定性自体が 11 側の挙動である可能性はあります」を追加 | 同上（`lock-v12-order2.yaml` にウォームでも integrity 13 行） |
| 4 | [warning] 「触ってみて分かったこと」L457 — 「③で書いた `integrity` の件」の参照先誤り | A | 「③で書いた」→「④と『詰まった点』で触れた」 | 記事内の節構成（③は `pnpm add -g yarn` の節） |
| 5 | [suggestion 1] ④節 L267「詳しくは次章」が誤誘導 | A | 「（詳しくは次章）」→「（詳しくは後述の「詰まった点」）」 | 記事内の節構成 |
| 6 | [suggestion 2] ①節 L353 — 11 側の `pnpm ls -g` は出典ログに無い | C | before:「これは 11 でも同じで、`pnpm ls -g` にはちゃんと `node@26.7.0` が並びます」→ after:「これは 11 でも同じで、`$PNPM_HOME/bin` に `node` が現れないところまで同じでした。なお 12 の `pnpm ls -g` には `node@26.7.0` がちゃんと並びます」（直後のコードブロックが `# v12` である事実と一致させた） | execution-log L500-549（11 で実測できているのは bin 不在まで） |
| 7 | [suggestion 3] 本編の並び L154 — 構成の意図が未記載 | A | 「以下、1つずつ。」→「以下、1つずつ。再現できたものから順に書きます。」 | 記事の実際の並び（⑤→②→④→③→①） |

## 適用しなかった指摘

| # | 指摘（重大度） | 判断 |
|---|---|---|
| 1 | [suggestion 4] 冒頭 L9 の `<!-- 前提: ... -->` コメント | 残す方針を採用（レビューも「残す方針なら問題なし」と記載）。パイプラインの出典追跡に使うため削除しない |

## 削除した記述（分類C で削ったもの）

- なし（今回はすべて差し替え・限定・追記で解消。節や段落の削除は発生していない）

## 未解消の指摘

なし。

## 警告

- なし（秘密情報の混入・git 履歴への残存は該当なし）

## セルフチェック出力（check-article.sh）

```
== check-article: articles/pnpm12-rc-five-diffs.md (slug=pnpm12-rc-five-diffs) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=20 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 91文字 (60字目安)
[PASS] emoji あり: 📦
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=60
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

残る `[WARN] title が長い: 91文字` は日本語をバイト数で数えている false positive（実文字数 39 字）。レビューレポートでも「指摘に採用しない」と切り分け済みのため、title は変更していない。

## 次のアクション

- [ ] `/review-article articles/pnpm12-rc-five-diffs.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
