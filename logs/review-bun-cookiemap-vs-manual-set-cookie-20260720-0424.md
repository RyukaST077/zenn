# 公開前レビュー: Bunのcookie(CookieMap)と手動Set-Cookieを書き比べてみた / bun-cookiemap-vs-manual-set-cookie

## レビューの前提

- 対象記事: articles/bun-cookiemap-vs-manual-set-cookie.md
- 出典ログ: logs/run-bun-cookiemap-20260720-0406/execution-log.md
- レビュー日時: 2026-07-20 04:24
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug / 秘密情報）はすべてクリア。
  - 事実性: 記事の結論・コマンド・出力・数値・コードはすべて出典ログに裏付けられており、ログを超えた断定・創作は検出されなかった。
  - 機械チェックの唯一の WARN（title 長）は Zenn の許容範囲内・誇大表現でもないため suggestion に降格。公開を止める warning ではないと判断。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter title — 66〜69字とやや長い。公開に支障はないが、`Bunのcookie(CookieMap)と手動Set-Cookieを書き比べた` 程度に短縮すると一覧での視認性が上がる。
2. [suggestion] 9行目の前提コメント `<!-- 前提: 出典ログ ... -->` — 消し忘れなら公開前に削除。内部の相対パスが記事ソースに残る（レンダリングはされない）。
3. [suggestion] 305〜325行 `check.ts` のスクショ描画部が「（省略）」で省かれている — 表描画の実コードが無く再現が難しい。省略は正直で問題ないが、一言「描画は本筋でないため省略」の注記があると親切。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 2行目 title | 66字（scriptカウント）とやや長め。誇大表現ではない | 60字前後に収めると一覧・SNSでの視認性が上がる |
| 2 | 9行目 `<!-- 前提: ... -->` | draft-article の前提コメントが残存 | 消し忘れなら削除。ソースがすっきりし内部パスも残らない |
| 3 | 305-325行 `check.ts` | cookie 表描画コードが「（省略）」 | 省略理由を一言添えると読者が再現時に迷わない |
| 4 | 107行 / 203行 | 記事は `import { randomUUIDv7 } from "bun"` だがログのメモは `Bun.randomUUIDv7()` 表記 | どちらも同一 API・記事内で自己完結しており問題なし。表記統一は任意 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 34字 `a-z0-9-` / 秘密情報・個人パス（`/Users/…`）なし。articles/ 内に重複 slug なし |
| Front Matter | OK | title/emoji/type(tech)/topics(5・英小文字)/published 揃う。title 長のみ suggestion |
| 事実性（ログ照合） | OK | 結論・Set-Cookie 出力・fetch=undefined・削除挙動・行数・型・context.cookies() すべてログと一致 |
| 画像 | OK | 参照2件とも実在（images/bun-cookiemap-vs-manual-set-cookie/01-cookiemap.png, 02-manual.png）。alt あり。孤立画像なし |
| Markdown構造 | OK | コードフェンス30行（偶数・閉）/ `:::` 2行（閉）/ 見出し H2 中心で階層破綻なし |
| 文章品質・トーン | OK | 経験談トーン維持。詰まった点あり。再現環境（OS/Bun/Playwright）明記。冒頭に結論・対象読者あり |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「両版とも同じ Set-Cookie 値・ブラウザ側の見え方も一致／完了条件を満たせた」 ↔ ログ「達成（3EP同挙動 / Set-Cookie 値 byte 一致 / スクショ取得）」 → **一致**
- 実行コマンド・出力: `bun init -y` 出力（50-63行）、Hello World の 200（72-79行）、`curl -i` の Set-Cookie 全文（157-188行）、diff（250-291行）、context.cookies() JSON（329-334行）はいずれもログの該当箇所（58-71 / 80-87 / 104-147 / 152-157行）と一致。
- 数値: 行数 44/47・parseCookies 約12行・`string | null`＋tsc エラー文言 — すべてログに裏付けあり。
- 創作の疑いがある記述: なし。ログに無い成功・速度・数値の断定は検出されなかった。
- 残存する `要素材` マーカー: 0 件。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/bun-cookiemap-vs-manual-set-cookie.md (slug=bun-cookiemap-vs-manual-set-cookie) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=34 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 66文字 (60字目安)
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

補足: 唯一の WARN（title 長）は Zenn の許容範囲内かつ誇大表現でもないため、公開を止める warning ではなく suggestion として扱った。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] （任意）上記 suggestion を反映する（title 短縮 / 前提コメント削除 / check.ts 省略注記）
- [ ] blocker・warning は無し。判定は「公開可」
- [ ] Front Matter を `published: true` に変えて `git push`（PRマージ＝公開）で公開してよい
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
