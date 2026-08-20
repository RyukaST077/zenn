# 修正適用レポート: typescript7-alias-tsc6

## 採用した前提

- 対象記事: `articles/typescript7-alias-tsc6.md`（引数で明示）
- レビューレポート: `logs/review-typescript7-alias-tsc6-20260818-1235.md`（引数で明示）
- 出典ログ: `logs/run-typescript7-alias-tsc6-20260818-1209/execution-log.md`（引数で明示）
- 適用範囲: 既定（blocker + warning）。加えて suggestion のうち安全に機械的に適用できるものを反映
- slug リネーム: なし（指摘が無いため）

## 判定確認

レビューレポートの判定は「要修正」（blocker 0 / warning 1 / suggestion 4）のため、修正を実施した。

## 適用した修正

### warning（1件、すべて適用）

| # | 箇所 | 適用内容 | 分類 |
|---|---|---|---|
| 1 | 「まとめ」節（L642付近） | 「6つ書いて3つ外しました」→「6つ書いて4つ外しました」に修正し、列挙末尾に「Yarn の issue #4368 を Open だと思い込んでいたら、確認時点では Closed だったこと」を追加。出典: 出典ログ「予測と実測の答え合わせ」表（L633-642）／記事 L595 の記述と整合させた | A 機械修正（集計値の訂正） |

### suggestion（4件中3件を適用、1件は見送り）

| # | 箇所 | 適用内容 / 見送り理由 | 分類 |
|---|---|---|---|
| 1 | 見出し「## 事前に調べたこと（実行前に予測を2つ書いた）」 | 「（実行前に書いた予測のうち主な2つ）」に変更し、まとめの「6つ書いて」との数の齟齬を解消 | A 機械修正 |
| 2 | 「## 数字の比較」節「中央値で 3.478s → 0.372s」 | 「中央値の 3.478s から、構成B/Cを通した代表値である約0.37sへ」に言い換え。0.372s がどの3回組の中央値でもない点を出典ログの表と突き合わせて修正 | C 削減修正（不正確な数値表現の言い換え） |
| 3 | L13 前回記事へのリンク | **見送り**。レビューでは「Zennの記事URL（または `https://zenn.dev/<user>/...`）へのリンクにする」提案だったが、過去の修正レポート（`logs/revise-typescript6-deprecated-tsconfig-already-error-20260727-0431.md`）で「Zennユーザー名はリポジトリ内で確定不能」と判断された前例を確認した。ユーザー名を推測でURLに書くと事実の捏造になるため、今回もリンク化は行わず、タイトル文字列のみの現状表記を維持した | 修正不能（分類Eには該当せず、捏造回避のため据え置き） |
| 4 | 「APIが無い」の正確なところ」節のキー一覧 | 「keys は一部を抜粋しています（順不同）」を追記し、`Object.keys` の生出力に見える体裁による誤読を防止 | A 機械修正（注記追加） |

## 未解消の指摘

- suggestion #3（前回記事へのリンク化）は上記理由により見送り。blocker/warning ではないため、公開判定への影響はない想定。次回レビューでも同様の指摘が出た場合は、Zennユーザー名が確定できない限り同じ扱いとする。

## セルフチェック結果

```
$ bash scripts/check-article.sh articles/typescript7-alias-tsc6.md --expect-published false
OK: articles/typescript7-alias-tsc6.md (slug=typescript7-alias-tsc6, published=false)
EXIT=0
```

`published: false` を維持していることを確認済み。

## 次のアクション

- [ ] `/review-article articles/typescript7-alias-tsc6.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` へ

RESULT: ok articles/typescript7-alias-tsc6.md
