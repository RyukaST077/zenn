# 公開前レビュー: MCPサーバーをTypeScriptで初めて作ってInspectorで叩いてみた（v2ベータ） / mcp-server-typescript-v2-inspector-try

## レビューの前提

- 対象記事: articles/mcp-server-typescript-v2-inspector-try.md
- 出典ログ: logs/run-mcp-server-ts-20260722-0410/execution-log.md（引数で明示）
- レビュー日時: 2026-07-22 04:26
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug 妥当・重複なし / 秘密情報なし）をすべてクリア。
  - 出典ログとの事実整合が高い（コマンド・出力JSON・バージョン・結論すべて一致）。
  - 機械チェックの WARN 2件はいずれも目視で false positive と確認（下記）。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter title — 47字で許容範囲だが、やや長め。表示崩れが気になるなら「（v2ベータ）」を落として短縮する余地あり（必須ではない）。
2. [suggestion] 「詰まった点」節（L235-269）— UIトークン壁の話は文章のみ。手元に `01-inspector-loaded` 等のスクショがあれば1枚添えると臨場感が増す（現状でも成立）。
3. [suggestion] 参考リンク（L320-325）— v2 の `@modelcontextprotocol/server` 該当ドキュメント/リポジトリへの直リンクがあると、読者が版を確認しやすい。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

（機械チェックの WARN 2件は下記のとおり目視で false positive と判定し、warning に昇格しない）

| # | 箇所 | 機械チェック | 目視判定 | 根拠 |
|---|---|---|---|---|
| 1 | title (L2) | `[WARN] title が長い: 93文字` | false positive → suggestion 相当 | 実際は47字（非UTF-8ロケールの `wc` がバイト数を計上。`python3 len()`=47）。60字目安内。 |
| 2 | L264 | `[WARN] 秘密情報の疑い [cred-word]` | false positive（漏れなし） | 該当行は `?MCP_PROXY_AUTH_TOKEN=<token>` のプレースホルダ。ログの実トークン `a3d1efca...` は本文で `<token>` にマスク済み。 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | title (L2) | 47字とやや長め | 短縮すると一覧での視認性が上がる（任意） |
| 2 | L235-269 | 詰まった点にスクショ無し | UI初期/接続画面を1枚足すと再現イメージが伝わる |
| 3 | L320-325 | v2 パッケージへの直リンク無し | 読者が「今の版」を確認する導線になる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 38字・重複なし・汎用語なし / 秘密情報なし（トークンは `<token>` にマスク済み） |
| Front Matter | OK | title/emoji🔌/type:tech/topics(mcp,typescript,zod,nodejs=4)/published 揃う。title47字。 |
| 事実性（ログ照合） | OK | コマンド・出力JSON・バージョン・結論すべてログと一致（下記照合参照） |
| 画像 | OK | 参照2枚（03/04）が実在。alt あり。孤立画像なし。 |
| Markdown構造 | OK | コードフェンス30行=偶数で閉じる。:::6行で閉じる。H1乱用なし（H2構成）。 |
| 文章品質・トーン | OK | 経験談トーン。詰まった点あり（予想外れ・トークン壁）。環境・版明記。 |
| 完成度 | OK | プレースホルダ/要素材マーカー残存なし。前提コメント無し。 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件4つすべて確認できています」(L310) ↔ ログ「完了条件の判定: **達成**（4条件すべて客観確認）」(L19) → **一致**
- コマンド整合:
  - `npm view` 群 (記事L33-38) ↔ ログ フェーズ1 (L44-45) → 一致
  - dist-tags / engines / dependencies / exports 出力 (記事L42-63) ↔ ログ (L49-55) → 一致（require(.cjs)含む dual publish もログ由来。記事は「要確認」と適切にヘッジ）
  - install & `npm ls` ツリー (記事L100-108) ↔ ログ (L87-94) → 一致（core 同版 / zod 4.4.3 dedup / TS 7.0.2 / @types/node 26.1.1）
  - `tools/list` JSON (記事L183-208) ↔ ログ (L150-161) → 一致（draft 2020-12 の JSON Schema 自動変換）
  - `tools/call add a=2 b=3` → `"5"` (記事L219-221) ↔ ログ (L175) → 一致
  - `tools/call add a=foo` → `expected number, received null` / `isError:true` (記事L246-256) ↔ ログ (L189-196) → 一致
- 数値・バージョン: 環境表 (記事L71-78) ↔ ログ再現性メモ (L301) → 一致（macOS 26.5 / Node v22.17.0 / TS 7.0.2 / server 2.0.0-beta.5 / zod 4.4.3 / inspector 1.0.0）
- v1↔v2 比較表 (記事L298-304) ↔ ログ (L242-249) → 一致。v1未実行の明示（記事L275-277 の `:::message alert`）もログ (L250, L297) と整合。
- Playwright channel:'chrome' (記事L269) ↔ ログ (L223, L266) → 一致（既存 knowledge 参照）
- 創作の疑いがある記述: なし（本文の主張はすべてログの一次情報に裏付けあり）
- ログを超えた断定: なし（「疎通OKの瞬間」等の表現もログ準拠。dual publish は「要確認」と明示）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/mcp-server-typescript-v2-inspector-try.md (slug=mcp-server-typescript-v2-inspector-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=38 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 93文字 (60字目安)
[PASS] emoji あり: 🔌
[PASS] topics 4個
[PASS] 画像あり: /images/mcp-server-typescript-v2-inspector-try/03-tools-listed.png
[PASS] 画像あり: /images/mcp-server-typescript-v2-inspector-try/04-tool-call-result.png
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [cred-word] (散文か目視確認) at line 264
SUMMARY fail=0 warn=2
```

補足（WARN 2件の切り分け）:
- `title が長い: 93文字` → 非UTF-8ロケールで `wc` がバイト数を計上。実文字数は47字（`python3 -c "len(...)"`=47）で60字目安内。**false positive**。
- `秘密情報の疑い [cred-word] at line 264` → 該当は起動ログ引用中の `?MCP_PROXY_AUTH_TOKEN=<token>` プレースホルダ。ログの実トークンは本文で `<token>` にマスク済み。**false positive（秘密情報の漏れなし）**。

## 次のアクション

- [x] blocker / warning はなし（対応不要）
- [ ] （任意）上記 suggestion を反映する
- [ ] 問題なければ Front Matter を `published: true` に変えて `git push`（PR経由で公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
