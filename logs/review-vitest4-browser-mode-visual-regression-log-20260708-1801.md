# 公開前レビュー: Vitest 4 の Browser Mode で toMatchScreenshot を初めて書いてみた（vitest4-browser-mode-visual-regression-log）

## レビューの前提

- 対象記事: articles/vitest4-browser-mode-visual-regression-log.md
- 出典ログ: logs/run-vitest-browser-mode-20260708-1748/execution-log.md
- レビュー日時: 2026-07-08 18:01
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug / 秘密情報）はすべてクリア。機械チェック fail=0 warn=0。
  - 事実性: 記事の実行コマンド・エラー全文・数値・コードがすべて出典ログおよび
    workspace 実体（`logs/run-*/workspace/my-app/src/`）と一致。創作なし。
  - 残る指摘は suggestion のみ（公開をブロックしない）。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] 冒頭コメント（L9） — `<!-- 前提: 出典ログ ... -->` は公開時に読者へ露出する内部メモ。公開前に削除しておくとよい（消し忘れ防止）。
2. [suggestion] Card.css（L126-135） — 実ファイルは `.card__title` / `.card__body` の指定も含むが記事は `.card` のみ抜粋。意図的なら1行「（抜粋）」と添えると誤解がない。
3. [suggestion] まとめ（L305）「半日かからずに一通り触れる範囲」 — 出典ログの実測は AI 単独で約9分（見積もり約4.25h）。人の粒度の表現として妥当だが、体感時間の断定ではなく「半日想定の範囲」程度に留めるとより安全。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L9 前提コメント | 内部メモが公開本文に残る | 公開時のノイズ/情報露出を避けられる |
| 2 | L126-135 Card.css | `.card` のみの抜粋（実体は title/body 指定あり） | 「抜粋」と明示すれば省略が意図的と伝わる |
| 3 | L305 まとめの所要時間表現 | 「半日かからず」は体感の断定寄り | 見積もりベースの表現にすると経験談トーンとして無難 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 42字・具体的で重複なし / 秘密情報・個人パスなし |
| Front Matter | OK | title(53字)・emoji(📸)・type:tech・topics 5個・published すべて妥当 |
| 事実性（ログ照合） | OK | コマンド・エラー全文・数値・コードすべてログ/workspace と一致。創作なし |
| 画像 | OK | 参照5枚すべて実在・alt あり・詰まった点/本編にスクショ添付。孤立画像なし |
| Markdown構造 | OK | コードフェンス偶数(32)・`:::` 閉じ・H2 のみで階層破綻なし・壊れリンクなし |
| 文章品質・トーン | OK | 経験談トーン・詰まった点5件が具体的・環境/バージョン明記・冒頭に結論と対象 |
| 完成度 | OK | プレースホルダ/要素材マーカーなし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「やりたかった3つは全部確認できた」(L305) ↔ ログ「結果サマリー: 達成（3点すべて客観確認）」→ **一致**
- 主要な照合（すべて裏付けあり）:
  - バージョン: React 19.2.7 / Vite 8.1.3 / TS 6.0.3（L66 ↔ ログL53）、vitest 4.1.10 / @vitest/browser-playwright 4.1.10 / vitest-browser-react 2.2.0（L75 ↔ ログL60）、playwright 1.61.1（L209 ↔ ログL62/212）
  - provider 文字列エラー全文（L173-176 ↔ ログL87-90）
  - `screen.getByText is not a function` / `src/Card.test.tsx:8:30`（L185-188 ↔ ログL101-104）
  - 初回スクショ失敗メッセージ（L196-201 ↔ ログL110-114）
  - `2088 pixels (ratio 0.12) differ.` と expected/actual/diff 出力（L244-252 ↔ ログL122-130）
  - allowedMismatchedPixelRatio のネスト（`comparatorOptions`）とトップレベル無視（L211-238 ↔ ログL136-150）
  - JSDOM cleanup `Found multiple elements`（L289 ↔ ログL153）、getBoundingClientRect が 0（L30-46 ↔ ログL152-154）
  - `-darwin` ファイル名・置き場（`__screenshots__/` vs `.vitest-attachments/`）（L163/254 ↔ ログL113/127-129/131）
  - コード（Card.tsx / Card.test.tsx / vitest.config.ts）は workspace 実体と完全一致。Card.css は `.card` ルールを正確に抜粋
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/vitest4-browser-mode-visual-regression-log.md (slug=vitest4-browser-mode-visual-regression-log) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=42 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 53文字
[PASS] emoji あり: 📸
[PASS] topics 5個
[PASS] 画像あり: /images/vitest4-browser-mode-visual-regression-log/01-vite-initial.png
[PASS] 画像あり: /images/vitest4-browser-mode-visual-regression-log/02-baseline-card.png
[PASS] 画像あり: /images/vitest4-browser-mode-visual-regression-log/03-diff-expected.png
[PASS] 画像あり: /images/vitest4-browser-mode-visual-regression-log/04-diff-actual.png
[PASS] 画像あり: /images/vitest4-browser-mode-visual-regression-log/05-diff-diff.png
[PASS] コードフェンスが閉じている: フェンス行=32
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [ ] （任意）上記 suggestion 3件を反映する
- [ ] 判定は「公開可」。Front Matter を `published: true` に変えて公開してよい状態
- [ ] 公開は `/publish-pr` で feature ブランチ→PR 経由（main へ直 push しない）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
