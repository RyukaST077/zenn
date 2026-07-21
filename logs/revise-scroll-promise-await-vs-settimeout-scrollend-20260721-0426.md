# 修正レポート: スクロール完了を await で待つChrome 150の新API / scroll-promise-await-vs-settimeout-scrollend

## 修正の前提

- 対象記事: `articles/scroll-promise-await-vs-settimeout-scrollend.md`（published: false のまま維持）
- レビューレポート: `logs/review-scroll-promise-await-vs-settimeout-scrollend-20260721-0423.md`（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-scroll-promises-20260721-0407/execution-log.md`
- 適用範囲: blocker ＋ warning（suggestion は安全・機械的なもののみ任意適用）
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-21 04:26
- 過去の修正レポート: `logs/revise-scroll-promise-await-vs-settimeout-scrollend-20260721-0421.md` あり（**同一 warning が前回も「未解消（修正不能）」だった** → 本レポートで再来を確認）

## 判定: 中止（ループ検出）

**`RESULT: abort` とする。** 理由: レビューが「要修正」を出した唯一の根拠である
warning（title が長い）は、前回の修正レポート（0421）でも「機械チェックの仕様上解消不能」
として未解消のまま続行された指摘であり、その後の再レビュー（0423）で**同じ warning が再び
flagged されて再来している**。`revise-article` Step 6 の「前回の修正レポートでも修正不能だった
同じ指摘が再来している → ループ防止のため abort」に該当する。

## 未解消 warning の技術的根拠（同一指摘が解消不能である証明）

- レビュー基準は「title 60**字**以内」。現行タイトルは **60 文字ちょうど**（UTF-8 `wc -m` = 60）で、
  レビューが示した目標を文字数では満たしている。
- 一方 `check-article.sh:94` は `wc -m` を**ロケール未設定（LANG/LC_ALL 空 → C ロケール）**で
  実行しており、日本語1文字＝3バイトの**バイト数**を数える。実測:
  - 現タイトル: C ロケール `wc -m` = **94**、UTF-8 `wc -m` = **60**
- したがって日本語を含むタイトルは 60 バイト以下に事実上できず、`[WARN] title が長い: 94文字`
  は解消できない。レビューレポートが提示した代替案
  「スクロール完了を await で待つ新API（Chrome 150）を setTimeout / scrollend と書き比べた」
  （約55字 ≈ 約90バイト）**でも同じ WARN が出る**ため、レビューの示す直し方では機械チェックは通らない。
- これは記事本文の欠陥ではなく `check-article.sh` の実装（Cロケールでの `wc -m`）に起因する
  false-positive。blocker ではない（`SUMMARY fail=0`）。

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | suggestion / 画像01 alt（165行目・キャプション級に長い） | A 機械修正 | alt を要点1文に短縮。「3手法とも静定後は同じ位置（Section 5, scrollY≈3840）に落ち着く。手法ごとの差は見た目ではなく検知時の detectY に出る（手法A/B=3840, 手法C=3379）」→「3手法とも静定後は同じ Section 5（scrollY≈3840）に落ち着く」。詳細説明は本文（161-163行）に既存のため重複を回避 | レビュー suggestion 1 の例文 / 出典ログ「静定後は Section 5＝最終位置」 |

## スキップ・未適用の指摘

| # | 指摘（重大度） | 対応 | 理由 |
|---|---|---|---|
| warning 1 | title が長い（94バイト） | **未解消（修正不能・ループ要因）** | 上記「技術的根拠」参照。文字数基準（60字）は既達。バイト基準WARNは日本語タイトルで解消不能。前回（0421）も同じ指摘が未解消 → 今回は再来のため abort 判定 |
| suggestion 2 | 冒頭 `<!-- 前提: ... -->` コメント | スキップ（意図的に残す） | 本リポジトリの公開済み記事でも保持される規約。Zenn上は非表示で害なく、`review-article` が出典ログを辿る手がかりに使う。消し忘れではない（前回 0421 と同じ判断） |
| suggestion 3 | まとめ節に対象読者の1行を添える | 未適用（任意） | 任意の加筆であり blocker/warning 解消には無関係。まとめ末尾（258行）に既に「SPAの画面遷移後」という用途が書かれており最低限は満たす。ループ中止のため今回は加筆しない |

## 捏造していないことの確認

- 変更は alt の短縮1件のみ。新しい数値・成功・コード・画像は書き足していない。
- alt の短縮後の文言も出典ログの記録（「静定後は Section 5＝最終位置」）の範囲内。
- `published: false` を維持している。

## 警告 / 推奨アクション

このループは記事側では解消できない。次のいずれかで対応することを推奨する（いずれも本Skillの
役割外のため実施しない）:

1. **`check-article.sh` の title 長判定を文字数基準に修正する**（推奨）。
   `tlen=$(printf '%s' "$title" | wc -m ...)` を UTF-8 ロケールで実行する
   （例: `LC_ALL=en_US.UTF-8 wc -m` もしくは `awk '{print length}'`）よう `.claude/skills/review-article/scripts/check-article.sh:94` を直す。
   → knowledge 記録の候補（`save-knowledge`）。
2. または、この warning は blocker ではない（`fail=0`）ため、**再レビューで「公開可」判定を
   出す運用に切り替える**（title は文字数基準では既に目標達成）。判断は `/review-article` の役割。

いずれも `/revise-article` では実施できない（記事修正では解消しない指摘のため）。

## セルフチェック出力（check-article.sh 再実行）

```
== check-article: articles/scroll-promise-await-vs-settimeout-scrollend.md (slug=scroll-promise-await-vs-settimeout-scrollend) ==
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=44 (12-50)
[PASS] type=tech
[WARN] title が長い: 94文字 (60字目安)   ← バイト数判定のため日本語では解消不能（本文参照）
[PASS] emoji あり: 📜
[PASS] topics 5個
[PASS] 画像あり: /images/…/01-method-a-await.png
[PASS] 画像あり: /images/…/04-intoview-workaround.png
[PASS] コードフェンスが閉じている: フェンス行=24
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし / プレースホルダ残りなし / 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- `published: false` を維持していることを最終確認済み。

## 次のアクション

- ⚠ 記事の再修正では解消しない。上記「推奨アクション」（check-article.sh の文字数基準化、
  または blocker ゼロを根拠に再レビューで公開可判定）を人手/オーケストレーターで対応する。
- それが済めば `/review-article` → `/publish-pr` へ。
