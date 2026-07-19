# 公開前レビュー: Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた / bun-cookiemap-vs-manual-set-cookie

## レビューの前提

- 対象記事: articles/bun-cookiemap-vs-manual-set-cookie.md
- 出典ログ: logs/run-bun-cookiemap-20260720-0406/execution-log.md（記事冒頭コメントの指定と一致）
- レビュー日時: 2026-07-20 04:16
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - warning-1: title が 79 文字と長め（機械チェックが WARN 検出。目安 60 字）。公開安全・事実性は問題なし。

> 公開安全（published:false / slug / 秘密情報）と事実整合（ログ照合）は全てクリア。
> 残るのは title 長の体裁指摘 1 件のみで、そこを詰めれば「公開可」に到達できる状態。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（2行目） — 79文字と長い。`(Bun.CookieMap)` が「組込cookie」と重複気味なので、例: `Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた` などに短縮し 60 字前後に収める。
2. [suggestion] 冒頭の前提コメント（9行目 `<!-- 前提: ... -->`） — 公開しても HTML コメントで表示されないが、公開版に残すか判断。運用上残す方針なら現状維持で可。
3. [suggestion] 参考リンク節（367〜369行目） — 見出し「使ったもの・環境」内(34行目)と同じ Bun docs URL が二重掲載。意図的なら可だが、重複を避けたいなら片方に集約。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title`（2行目） | title が 79 文字で目安(60字)超。`(Bun.CookieMap)` が本文「組込cookie」と重複気味 | 例: `Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた` に短縮、または括弧内を削る | check-article.sh の [WARN]（title 79文字） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 9行目 `<!-- 前提: ... -->` | 前提コメントの残存 | 公開版から外すと本文がクリーンになる（HTMLコメントなので表示上は無害。運用方針次第で維持可） |
| 2 | 34行目 と 367〜369行目 | Bun docs URL の二重掲載 | 冒頭と参考リンクの重複を整理すると冗長さが減る（意図的な再掲なら現状で可） |
| 3 | 329〜334行目 `context.cookies()` の JSON | ログの実出力にある `value` / `expires` を省いた要約形。`secure:false` 等は残しており主張は正確 | 省略した旨を一言添えると、ログ実物との対応がより明確になる（必須ではない） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 妥当(34字, 汎用でない, ローカル重複なし) / 秘密情報なし。パスや内部ホスト名の露出なし |
| Front Matter | 要修正 | title 長のみ warning。type=tech / topics 5個 / emoji 🍪 は妥当 |
| 事実性（ログ照合） | OK | curl 出力・tsc エラー・Playwright JSON・コード・行数(44/47)・バージョンが全てログ裏付けあり。創作なし |
| 画像 | OK | 2枚とも images/ 配下に実在。alt あり。「書き比べて分かったこと」節に添付 |
| Markdown構造 | OK | コードフェンス30行(偶数)・:::message 対応・H1乱用なし・見出し順序自然 |
| 文章品質・トーン | OK | 経験談トーン。詰まった点(削除挙動/routes専用)を具体的に記述。再現環境明記 |
| 完成度 | OK | 要素材/プレースホルダ残存なし。公開に耐える長さ・構成 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「両版とも同じ `Set-Cookie` 値／ブラウザの見え方も一致、完了条件を満たせた」(17,359行) ↔ ログ「達成（3EP 同挙動 / Set-Cookie 値 byte 一致 / スクショ取得）」(19行) → **一致**
- 実行コマンド・出力の照合:
  - sign-in / whoami / sign-out / fetch-whoami の curl 全文（158〜188行）→ `logs/cookiemap.txt` と**完全一致**
  - 手動版 第1版の diff・第2版の出力（251〜290行）→ `execution-log.md` フェーズ3 / `logs/manual.txt` と**一致**
  - `delete` の過去 Expires・`SameSite=Lax`・`HttpOnly` 非継承（193〜194, 295行）→ ログ「一次情報の発見」#2,#3 と**一致**
  - `fetch` ハンドラで `typeof req.cookies=undefined`（187,195行）→ ログ #4 と**一致**
  - `tsc` エラー `Type 'string | null' is not assignable to type 'number'`（355行）→ ログ161行と**一致**
  - 行数 44行/47行（344行）→ 実 workspace の `server.ts`(44) / `server-manual.ts`(47) と**一致**
  - バージョン（Bun 1.3.14 / Playwright 1.61.1 / chromium v1228 / Chrome for Testing 149 / Node v22.17.0）→ ログと**一致**
  - 貼付コード（server.ts / server-manual.ts / check.ts）→ workspace のソースと実質一致（記事はヘッダコメントを一部省いた抜粋）
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/bun-cookiemap-vs-manual-set-cookie.md (slug=bun-cookiemap-vs-manual-set-cookie) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=34 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 79文字 (60字目安)
[PASS] emoji あり: 🍪
[PASS] topics 5個
[PASS] 画像あり: /images/bun-cookiemap-vs-manual-set-cookie/01-cookiemap.png
[PASS] 画像あり: /images/bun-cookiemap-vs-manual-set-cookie/02-manual.png
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning-1（title 短縮）を直す。suggestion は任意
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
