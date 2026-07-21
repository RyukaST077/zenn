# 公開前レビュー: MCPサーバーをTypeScriptで初めて作って、MCP Inspectorで叩いてみた（SDK v2ベータ） / mcp-server-typescript-v2-inspector-try

## レビューの前提

- 対象記事: articles/mcp-server-typescript-v2-inspector-try.md
- 出典ログ: logs/run-mcp-server-ts-20260722-0410/execution-log.md
- レビュー日時: 2026-07-22 04:22
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - warning-1: 本文末尾（line 271）に `要素材` マーカーが残存（未完成サイン）。埋めるか節ごと削る必要がある。
  - 公開安全（published:false / slug / 秘密情報）はすべてクリア。事実整合も出典ログと一致。blocker なし。

## 最優先で直すべき指摘（上位3件）

1. [warning] 本編「詰まった点」節末尾（line 271） — `<!-- 要素材: Playwright 同梱 Chromium ... -->` を削除する（もしくは knowledge を1〜2文で本文化する）。公開ドラフトに制作メモが残っている状態。
2. [suggestion] Front Matter `title`（line 2） — 104文字とやや長い。Zenn上の表示は問題ないが、必要なら「（SDK v2ベータ）」など末尾を短縮して60〜80字程度に。
3. [suggestion] コードブロック内トークン（line 266） — `MCP_PROXY_AUTH_TOKEN=a3d1efca...` はローカルの一時トークンを切り詰めた表記で安全。念のため `MCP_PROXY_AUTH_TOKEN=<token>` のようにプレースホルダ化するとより無難。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | line 271（「詰まった点」節末尾） | `要素材` マーカー付き HTML コメントが1件残存。未完成のサイン | コメント行 `<!-- 要素材: Playwright 同梱 Chromium が古い件で ... -->` を削除する。触れたいなら knowledge（`knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md`）の要点を1〜2文で本文化する（ログ line 223 に `channel:'chrome'` 採用の一次情報あり） | 機械チェック WARN / checklist 3・7 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | line 2 `title` | 104文字とやや長い（目安60字） | 一覧やOGでの視認性が上がる。「（SDK v2ベータ）」等の末尾を削るなど |
| 2 | line 266 コードブロック | 切り詰め済みだがトークン文字列 `a3d1efca...` が露出 | `<token>` へプレースホルダ化すると秘密情報スキャンの誤検知も消え、より無難 |
| 3 | line 9 前提コメント | `<!-- 前提: 出典ログ ... -->` が冒頭に残る | 公開前に消してよい（意図的なら残置可）。読者には不要なメタ情報 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 一意（38字・重複なし）/ 秘密情報なし（token は切り詰め済みの一時ローカル値） |
| Front Matter | OK | title/emoji/type(tech)/topics(4)/published 揃う。title がやや長い(suggestion) |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・コード・数値がすべて出典ログと一致（下記照合） |
| 画像 | OK | 参照 2件（03/04）とも実在。alt 記述あり。孤立画像なし |
| Markdown構造 | OK | コードフェンス偶数(30)・`:::`偶数(6)・見出し階層破綻なし・参考リンクあり |
| 文章品質・トーン | OK | 経験談トーン。詰まった点・予想外れ・環境/バージョン明記あり |
| 完成度 | 要修正 | `要素材` マーカー1件残存（warning-1） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件4つすべて確認」↔ ログ「達成（4条件すべて客観確認）」→ **一致**
- 実行コマンド: `npm view` / `npm i` / `npx tsc` / Inspector CLI `tools/list`・`tools/call`（a=2 b=3 / a=foo b=3）→ すべてログのフェーズ1〜3に存在。**創作なし**
- エラー全文: `Input validation error: ... a: Invalid input: expected number, received null` / `isError:true` / exit=0 → ログ line 192-196 と一致
- 主要出力: `tools/list` の JSON（draft 2020-12）、`{"text":"5"}` → ログ line 150-162, 175 と一致
- バージョン: server 2.0.0-beta.5・core 同版・zod 4.4.3・TS 7.0.2・@types/node 26.1.1・Node v22.17.0・inspector 1.0.0 → ログの環境/依存ツリーと一致
- 予想が外れた話（`--tool-arg` が number 変換で通る）: ログ「予測#4・外れ」（line 178-179, 265）と一致
- v1↔v2 比較表: 「v1 未実行・型定義/exports からの推定」と本文で明記（line 277-279）。ログ line 250 の注意書きと整合。**過大主張なし**
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: **1件**（line 271）

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/mcp-server-typescript-v2-inspector-try.md (slug=mcp-server-typescript-v2-inspector-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=38 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 104文字 (60字目安)
[PASS] emoji あり: 🔌
[PASS] topics 4個
[PASS] 画像あり: /images/mcp-server-typescript-v2-inspector-try/03-tools-listed.png
[PASS] 画像あり: /images/mcp-server-typescript-v2-inspector-try/04-tool-call-result.png
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 6 行
[WARN] 要素材マーカーが 1件残っている (未完成。埋めるか節を削る)
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [cred-word] (散文か目視確認) at line 266
SUMMARY fail=0 warn=3
```

機械チェック WARN の切り分け:
- title 104文字 → 表示上は問題なし。**suggestion** に調整。
- 要素材マーカー → 未完成サイン。**warning** として採用（warning-1）。
- 秘密情報 line 266 → `MCP_PROXY_AUTH_TOKEN=a3d1efca...` は切り詰め済みのローカル一時トークン（プロセス終了で無効。出典ログ line 213-214 でマスク不要と明記）。**false positive**。安全のためプレースホルダ化を **suggestion** に留める（blocker ではない）。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning-1（line 271 の `要素材` マーカー）を削除、または knowledge を1〜2文で本文化する
- [ ] （任意）title 短縮 / token のプレースホルダ化 / 前提コメント削除
- [ ] 直したら `/revise-article` → `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
