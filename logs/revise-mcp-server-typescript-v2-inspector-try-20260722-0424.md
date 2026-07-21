# 修正適用レポート: mcp-server-typescript-v2-inspector-try

## 採用した前提

- 対象記事: `articles/mcp-server-typescript-v2-inspector-try.md`（published: false のまま）
- レビューレポート: `logs/review-mcp-server-typescript-v2-inspector-try-20260722-0422.md`（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-mcp-server-ts-20260722-0410/execution-log.md`
- 適用範囲: blocker ＋ warning（＋ 安全・機械的な suggestion 3件も適用）
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-22 04:24

## 指摘ごとの適用結果

| # | 重大度 | 箇所 | 分類 | 対応 |
|---|---|---|---|---|
| warning-1 | warning | line 271 `要素材` マーカー | B ログ由来の補完 | **適用**。制作メモの HTML コメントを削除し、Playwright を `channel:'chrome'` で起動した経緯を1文で本文化。出典: execution-log line 223（`channel:'chrome'`・ローカル Chrome 使用の一次記録）＋ knowledge `2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md`。捏造なし |
| suggestion-1 | suggestion | line 2 `title`（104字） | A 機械修正 | **適用（任意）**。「MCPサーバーをTypeScriptで初めて作ってInspectorで叩いてみた（v2ベータ）」に短縮（93字）。事実は不変 |
| suggestion-2 | suggestion | line 266 トークン露出 | E 匿名化・マスク | **適用（任意）**。`MCP_PROXY_AUTH_TOKEN=a3d1efca...` → `MCP_PROXY_AUTH_TOKEN=<token>` へプレースホルダ化。元値は切り詰め済みローカル一時トークン（出典ログ line 213-214 でマスク不要と明記）だが、より無難に |
| suggestion-3 | suggestion | line 9 前提コメント | A 機械修正 | **適用（任意）**。冒頭の `<!-- 前提: ... -->` メタコメントを削除。読者には不要 |

## 補完素材の収集（分類B）

- warning-1 の本文化に使った一次情報: execution-log line 223（「既存 knowledge に従い `channel:'chrome'`（ローカル Chrome 150）で起動」）、詰まった点表 #3（line 266）、knowledge ファイル本体。いずれも実在の記録で、記事本文への1文追記に必要十分。新規の成功・数値・コードは書き足していない。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] 要素材マーカーなし          ← warning-1 解消
[PASS] プレースホルダ残りなし
[WARN] title が長い: 93文字 (60字目安)   ← suggestion（表示上は問題なし）
[WARN] 秘密情報の疑い [cred-word] at line 264  ← <token> プレースホルダ化済みの false positive
SUMMARY fail=0 warn=2
```

- warning-1（要素材マーカー）: **解消**。
- 残 WARN 2件はいずれも非ブロッキング（title 長さの suggestion、`<token>` 化済み行の cred-word 誤検知）。fail=0。
- `published: false` を最終確認。

## 未解消・スキップ

- なし（blocker 0。warning 1 は解消。suggestion 3 もすべて適用）。

## 次のアクション

- `/review-article articles/mcp-server-typescript-v2-inspector-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
