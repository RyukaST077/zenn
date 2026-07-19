# 公開前レビュー: Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた / bun-cookiemap-vs-manual-set-cookie

## レビューの前提

- 対象記事: articles/bun-cookiemap-vs-manual-set-cookie.md
- 出典ログ: logs/run-bun-cookiemap-20260720-0406/execution-log.md（＋ raw logs: logs/cookiemap.txt, manual.txt, playwright.log, workspace/）
- レビュー日時: 2026-07-20 04:21
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] `title` が 72 文字で **Zenn のタイトル上限（70文字）を超過**している。このままでは公開時に弾かれる／切り詰められる可能性があるため、公開前に短縮が必要。
  - 公開安全（published:false / slug / 秘密情報）はすべてクリア。事実整合も出典ログ・workspace コードと突き合わせて完全一致を確認済み。blocker はなし。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（2行目）— 72文字と Zenn 上限70を超過。2文字以上削って ≤70 にする。例:「Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べた」（「てみた」→「た」で70文字）、または「組込」を削って70文字。
2. [suggestion] 本文324行あたりの `context.cookies()` の JSON（330–334行）— 実ログは配列＋`value`/`expires`込み。「省略」の注記はあり誠実だが、これは整形イメージである旨（`[ ... ]` 配列の1要素抜粋）を一言添えると、実出力そのままと誤読されにくい。
3. [suggestion] 9行目の前提コメント `<!-- 前提: 出典ログ ... -->` — 公開しても実害はないが消し忘れなら公開前に除去してよい（意図的な出典メモとして残すなら可）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title`（2行目） | タイトルが72文字で Zenn の上限70文字を超過 | 2文字以上短縮して ≤70 に。例:「…Set-Cookieを書き比べた」(70) / 「Bunのcookie(CookieMap)と手動Set-Cookieを書き比べてみた」(「組込」除去=70) | 機械チェック `[WARN] title が長い: 72文字` ＋ `wc -m`=72、Zenn 仕様（タイトル上限70） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 329–334行 JSON | 実ログは配列でありコードは整形イメージ | 「配列の1要素を抜粋・value/expires省略」と明示すると実出力との差で誤読されない |
| 2 | 9行目 前提コメント | `<!-- 前提: ... -->` が本文冒頭に残存 | 消し忘れなら除去でノイズ減。意図的な出典メモなら現状維持で可（実害なし） |
| 3 | 全体トーン | 経験談トーンは良好だが、冒頭「はじめに」で結論（両版一致）を既に述べており重複気味 | 現状でも十分。強いて言えば導入をやや圧縮できる（任意） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 34字・重複なし・汎用語でない / 秘密情報・個人パス・内部ホスト名なし（UUID・localhost・GMT日時のみ） |
| Front Matter | 要修正 | title 72字で上限超過（warning）。type=tech / topics 5個 / emoji🍪 は妥当 |
| 事実性（ログ照合） | OK | curl出力・削除挙動・fetch=undefined・行数44/47・tscエラー文言・Playwright JSON いずれも execution-log と workspace 実ファイルに完全一致。創作なし |
| 画像 | OK | 参照2枚 `01-cookiemap.png`/`02-manual.png` とも images/ 配下に実在。alt あり。孤立画像なし |
| Markdown構造 | OK | コードフェンス30行（偶数・閉）/ `:::`2行（閉）/ 見出しは全てH2で階層破綻なし / プレースホルダなし |
| 文章品質・トーン | OK | 経験談トーン・詰まった点あり・再現性（OS/Bun1.3.14/Playwright1.61.1）明記。誇大表現なし |
| 完成度 | OK | `要素材`マーカー・TODO残存なし。構成・分量とも公開に耐える |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「両版とも同じ Set-Cookie 値／ブラウザ側の見え方も一致」（359行）↔ ログ「達成（Set-Cookie値 byte一致 / スクショ取得）」（19行）→ **一致**
- 主要な一次情報の裏付け（すべて一致を確認）:
  - sign-in Set-Cookie `...; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict` … logs/cookiemap.txt に一致
  - sign-out 削除 `sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax`（Max-Age=0でなく過去Expires・SameSite=Laxへ戻る）… logs/cookiemap.txt に一致
  - fetch ハンドラ `typeof req.cookies=undefined` … logs/cookiemap.txt に一致
  - 手動版 第1版のズレ・diff … execution-log フェーズ3 と一致
  - 行数 server.ts=44 / server-manual.ts=47・parseCookies約12行 … workspace の `wc -l` で実測一致
  - tsc エラー `Type 'string | null' is not assignable to type 'number'` … execution-log 161行に一致
  - Playwright `httpOnly:true / secure:false / sameSite:"Strict" / path:"/"` … logs/playwright.log に一致（記事は value/expires を省略、注記あり）
  - コード（server.ts / server-manual.ts / check.ts）… workspace の実ファイルとバイト単位で一致（記事の import・@ts-expect-error まで実物由来）
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
[WARN] title が長い: 72文字 (60字目安)
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

- [ ] warning #1（タイトル短縮 ≤70文字）を直す。必要なら suggestion も反映
- [ ] 直したら `/review-article` で再レビューする（または `/revise-article` で修正）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
