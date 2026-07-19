# 修正適用レポート: Bunのcookie(CookieMap)と手動Set-Cookieを書き比べてみた / bun-cookiemap-vs-manual-set-cookie

## 採用した前提

- 対象記事: `articles/bun-cookiemap-vs-manual-set-cookie.md`（published: false / slug リネームなし）
- レビューレポート: `logs/review-bun-cookiemap-vs-manual-set-cookie-20260720-0421.md`（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-bun-cookiemap-20260720-0406/execution-log.md`
- 適用範囲: blocker ＋ warning（＋ 安全・機械的な suggestion）
- slug リネーム: 指摘なし → 実施せず
- 修正日時: 2026-07-20 04:23
- 前回の修正レポート: なし（本記事に対する初回の revise）

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 内容 |
|---|---|---|---|---|
| 1 | warning | Front Matter `title`（2行目） | A 機械修正 | タイトルから「組込」を除去し 72字 → **66字** に短縮。Zenn 上限70字を下回るよう是正。「てみた」トーンは維持。旧: `Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた` / 新: `Bunのcookie(CookieMap)と手動Set-Cookieを書き比べてみた` |
| 2 | suggestion #1 | 327行 `context.cookies()` の注記＋329–334行 JSON | C 削減（誤読防止の明示） | 「実際の戻り値は配列（`[ ... ]`）で、以下はその1要素を抜粋し `value` と `expires` を省略した整形イメージ」と明示。実出力そのままと誤読されないようにした。数値・コードの追加はなし（出典 `logs/playwright.log`／`execution-log.md` 152–157行と整合） |

## スキップ / 未解消の指摘

| # | 重大度 | 箇所 | 判断 | 理由 |
|---|---|---|---|---|
| suggestion #2 | suggestion | 9行目 前提コメント `<!-- 前提: ... -->` | 現状維持（スキップ） | レビュー上も「意図的な出典メモとして残すなら可・実害なし」と明記。当該コメントはパイプラインが出典ログを辿るための出典メモであり、除去すると後工程のトレーサビリティを損なうため残置 |
| suggestion #3 | suggestion | 全体トーン（導入の重複気味） | スキップ | レビュー上「現状でも十分・任意」。最小修正の原則に反する全面リライトになるため見送り |

いずれも suggestion（任意）であり、未解消の warning / blocker はない。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=34 (12-50)
[WARN] title が長い: 66文字 (60字目安)
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- 残る `[WARN] title が長い: 66文字` は **スクリプトの 60字目安（ソフト指針）** に対するもので、レビューが blocker/warning として挙げた **Zenn の 70字上限は 66字でクリア済み**。この warning は Zenn 公開を妨げない。
- `published: false` を維持していることを最終確認済み。
- 事実性・画像・秘密情報など他の機械チェック項目はすべて PASS（変更前と同じ）。

## 修正後の状態

- 記事パス: `articles/bun-cookiemap-vs-manual-set-cookie.md`（リネームなし・`published: false`）
- レビューの warning 1件を解消。suggestion のうち安全なもの1件を反映、残り2件は理由付きでスキップ。

## 次のアクション

- `/review-article articles/bun-cookiemap-vs-manual-set-cookie.md` で再レビューし、判定が「公開可」になったら `/publish-pr` へ。
