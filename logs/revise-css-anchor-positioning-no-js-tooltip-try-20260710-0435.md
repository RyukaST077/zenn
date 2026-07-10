# 修正レポート: css-anchor-positioning-no-js-tooltip-try

## 採用した前提

- 対象記事: `articles/css-anchor-positioning-no-js-tooltip-try.md`（引数指定 / published:false）
- レビューレポート: `logs/review-css-anchor-positioning-no-js-tooltip-try-20260710-0432.md`（引数指定）
- 出典ログ: `logs/run-css-anchor-positioning-20260710-0407/execution-log.md`（引数指定）
- 適用範囲: blocker ＋ warning（安全・機械的な suggestion も適用）
- slug リネーム: なし（指摘なし）
- 過去の修正レポート: なし（本記事への `logs/revise-*` は初回。ループ懸念なし）

レビュー判定は **要修正**（blocker 0 / warning 1 / suggestion 4）。核となる主張はすべて出典ログに裏付けあり。

## 適用した修正

| # | 重大度 | 分類 | 箇所 | 内容 | 根拠 |
|---|---|---|---|---|---|
| 1 | warning | C 削減 | 357行目（末尾コメント） | 残存していた `<!-- 要素材: Floating UI の実コード... -->` を削除。Floating UI 節（300-311行）は「メモ比較」として本文で完結しており、JS版未実装は本文でも明示済みのため削除で問題なし | レビュー warning #1 / 機械チェック 要素材=1件 |
| 2 | suggestion | 機械 | 2行目 title | `JSなしで…CSS Anchor Positioningで作ってみた` → `CSS Anchor Positioning でツールチップとポップオーバーをJSなしで作ってみた` に変更。機能名を先頭に出し、一覧/SNSでの見切れ時に主題が伝わるようにした（レビュー提示の例に準拠） | レビュー suggestion #1 |
| 3 | suggestion | B ログ由来の補完 | 70行目付近 | 孤立していた `00-skeleton.png` を本文に差し込み。出典ログ（フェーズ2 / execution-log.md 65・73行「配置なし雛形のスクショ」）に裏付けのある実在画像で、既に `images/<slug>/` に存在。alt「配置なしの最小HTML雛形（スクショ取得の動作確認）」を付与 | レビュー suggestion #2 |

## スキップ・未解消の指摘

| # | 重大度 | 箇所 | 判断 | 理由 |
|---|---|---|---|---|
| — | suggestion | HTMLファイル名とスクショ番号のオフセット（例 `05-position-area.html`→`06-*.png`） | スキップ | レビューでも「事実整合はOK・任意」。出典ログのスクショ命名（`05` は予備、記事採用は `06`）どおりで、書き換えるとログとの対応が崩れる。最小修正の原則からスキップ |
| — | suggestion | Floating UI 比較（304-311行）に「一般的なAPIメモ」注記を追加 | スキップ | レビューが「本文で『メモです』と書かれており許容範囲」と明記。302行「比べたメモです」で既に線引き済みのため、追記は不要と判断（任意） |

修正不能の指摘なし。未解消の blocker/warning なし。

## セルフチェック結果（check-article.sh 再実行）

```
SUMMARY fail=0 warn=1
```

- `要素材マーカーなし` に変化（warning 解消の主要因）。
- `00-skeleton.png` が `[PASS] 画像あり` に変化（孤立画像の解消）。
- 残る `[WARN] title が長い: 97文字` は、レビューで「誇大語がなく日本語として自然」として **suggestion に緩和済み**の項目。機能名を先頭に出す readability 改善を優先し、この WARN 自体は許容（唯一の要修正要因だった要素材 warning は解消済み）。
- `published=false` を維持していることを最終確認済み。

## 備考

- 秘密情報・個人パスの検出なし（機械チェック PASS）。匿名化・マスク対応は不要だった。
- slug 変更なし。画像参照・前提コメントの整合は維持。
</content>
</invoke>
