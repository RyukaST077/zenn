# 公開前レビュー: Node 26.5 text imports の試してみた記録 / node26-experimental-import-text-try

## レビューの前提

- 対象記事: `articles/node26-experimental-import-text-try.md`
- 出典ログ: `logs/run-node-text-imports-20260713-0408/execution-log.md`（記事冒頭コメントの指定と一致）
- レビュー日時: 2026-07-13 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] title が 105 文字と長い（Zenn の一覧で見切れる）。60 字目安に短縮を推奨。
  - 公開安全（published:false / slug / 秘密情報）はすべて OK。事実整合も出典ログと一致しており、blocker は無い。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（L2, 105文字）— 「詰まった記録」までを残しつつ 60字程度へ短縮。例: `"Node 26.5 の text imports（--experimental-import-text）で .txt を import してみた"`。
2. [suggestion] 冒頭の前提コメント（L9 `<!-- 前提: ... -->`）— 公開前に消し忘れでないか確認。読者に不要なら削除。
3. [suggestion] JSON import の「v23.1.0+ で安定」（L27, L328）— 今回の実測ではなく裏取り情報。表記は出典ログどおりで問題ないが、断定を避けるなら「v23 系で安定」等に緩める余地あり。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title` (L2) | title が 105 文字と長く、一覧・OGP で見切れる | 60 字前後に短縮。例: `"Node 26.5 の text imports（--experimental-import-text）で .txt を import してみた"` | check-article.sh [WARN] title 105文字（60字目安） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 冒頭コメント (L9) | 前提コメント `<!-- 前提: 出典ログ ... -->` が残っている | 公開記事に不要なメタ情報。消し忘れなら削除で本文がすっきりする |
| 2 | 比較節 (L27, L328) | JSON import「v23.1.0+ で安定」は実測でなく裏取り情報 | 出典ログにも記載があり整合は取れているが、断定を緩めると新人の経験談トーンにより沿う |
| 3 | エラーブロック内パス (L129,188,200,225) | `/Users/.../workspace/...` と適切にマスク済み | 対応不要。将来の記事でも `.../` マスクを維持すると安全（今回は問題なし） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 妥当（35字・具体的・ローカル重複なし）/ 秘密情報なし（user-path は `.../` マスク済み・実名リークなし） |
| Front Matter | 要修正 | title 長すぎ（warning）。type=tech / topics 4個 / emoji OK |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・出力・比較表がすべて出典ログと一致。創作なし |
| 画像 | OK | CLI 検証記事のため画像参照なし（ログも スクショ0枚・ブラウザ確認は完了条件外）。整合あり |
| Markdown構造 | OK | コードフェンス 50行（偶数・閉）/ `:::` 4行（message・details 閉）/ H2 中心で階層破綻なし / 公式リンク3件 |
| 文章品質・トーン | OK | 経験談トーン。詰まった点・再現手順・環境（macOS 26.5 / Node v26.5.0 / npm 11.17.0）明記 |
| 完成度 | OK | 要素材マーカー・プレースホルダ残りなし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「`.txt` を import で読むところまでは達成」↔ ログ「達成（4条件すべて一次ログで確認）」→ **一致**
- 主要な突合（すべてログに裏付けあり）:
  - Node バージョン v22.17.0 → v26.5.0 / npm 11.17.0 — 一致（ログ L13, L54, L72）
  - `ERR_UNKNOWN_FILE_EXTENSION` 全文（フラグ無し）— 一致（ログ L99-118）
  - 「フラグ無し・属性省略・型 json 誤記」が同一 `ERR_UNKNOWN_FILE_EXTENSION` に集約 — 一致（ログ L145、想定外の実測として記録）
  - `ERR_MODULE_NOT_FOUND`（存在しないファイル）全文 — 一致（ログ L148-166）
  - named import の `SyntaxError`（does not provide an export named 'foo'）— 一致（ログ L176-187）
  - inspect 出力（typeof string / length 104 / 4行 / 改行・末尾スペース保持）— 一致（ログ L199-206）
  - fs.readFileSync 版（string / length 104 で完全一致）— 一致（ログ L217-225）
  - JSON import 版（object / フラグ不要 / exit 0）— 一致（ログ L234-245）
  - 比較表（構文・フラグ・バージョン・警告・型・タイミング・export・コード量）— ログの比較表（L249-258）と一致
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

補足: 末尾の「最短の再現手順」（L353-361）は `message.txt` を `line1\nline2` としており本編の 4 行ファイルとは別だが、これは出典ログの「再現性メモ」（L304-312）そのままの最小手順であり、意図的な簡略化。整合上の問題なし。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-experimental-import-text-try.md (slug=node26-experimental-import-text-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=35 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 105文字 (60字目安)
[PASS] emoji あり: 📄
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=50
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 129,188,200,225
SUMMARY fail=0 warn=2
```

機械チェックの false positive 切り分け:
- `[WARN] 秘密情報の疑い [user-path]`（L129,188,200,225）: いずれも `/Users/.../workspace/...` と `.../` でマスク済み。実名（`katayamaryuunosuke`）の混入も grep で確認したが検出なし。**秘密情報の漏れなし**として重大度を下げた（対応不要）。

## 次のアクション

- [ ] warning（title 長すぎ）を短縮する
- [ ] suggestion（前提コメント削除など）は任意で対応
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
