# 公開前レビュー: using / Symbol.dispose を try/finally と同じ処理で書き比べてみた（using-symbol-dispose-try-finally-compare）

## レビューの前提

- 対象記事: articles/using-symbol-dispose-try-finally-compare.md
- 出典ログ: logs/run-using-symbol-dispose-20260717-0409/execution-log.md
- レビュー日時: 2026-07-17 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開不可（blocker あり）**

- blocker: 1 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 本文のログ引用に**個人を特定するローカルパス／ホスト名**が含まれている（行56・行67）。
    公開安全の blocker。マスクするまで公開不可。

## 最優先で直すべき指摘（上位3件）

1. [blocker] 「環境構築」節 行56・行67 — 実ユーザー名を含むパス／ホスト名を伏字にする。
   `/Users/katayamaryuunosuke/workspace/024_zenn/[eval1]:1` → `/Users/you/workspace/024_zenn/[eval1]:1`（または `/path/to/024_zenn/...`）、
   `Darwin katayamaryuunosukes-MacBook-Pro.local ...` → `Darwin macbook.local ...`（ホスト名を汎用化）。
2. [suggestion] タイトル（行1）— 78字とやや長い。誇大表現ではないので必須ではないが、60字前後に短縮すると一覧で読みやすい。
3. [suggestion] 冒頭の前提コメント（行9 `<!-- 前提: 出典ログ ... -->`）— 消し忘れでなければ可。公開前に削除すると本文がすっきりする。

## 指摘一覧（重大度順）

### blocker

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「環境構築」`:::details` エラー全文 行67 | ログ引用に個人を特定するローカルパス `/Users/katayamaryuunosuke/...` が含まれる | ユーザー名部分を汎用化: `file:///Users/you/workspace/024_zenn/[eval1]:1`（他の行に同様のパスがないかも確認） | 公開安全（個人特定パス）／機械チェック `[user-path] at line 67` |
| 1b | 「環境構築」`uname -a` 出力 行56 | ホスト名 `katayamaryuunosukes-MacBook-Pro.local` に実名が含まれる | ホスト名を汎用化: `Darwin macbook.local 25.5.0 ...`（意味は変わらない） | 公開安全（内部/個人情報）／目視 |

### warning

なし（機械チェックの「空リンク/example.com」WARN は false positive。下記「機械チェック結果」参照）

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 行1 title | 78字とやや長い（誇大ではない） | 60字前後にすると記事一覧・OGPで見切れにくい |
| 2 | 行9 前提コメント | `<!-- 前提: ... -->` の消し忘れでないか確認 | 公開版で内部メモが残らずすっきりする（HTMLコメントなので実害は無い） |
| 3 | 「参考リンク」節 行451-460 | ラベルとURLが別行のベアURL表記 | `[MDN: Symbol.dispose](URL)` のMarkdownリンクにすると読者がクリックしやすい |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | NG | published=false はOK・slug妥当。だが個人特定パス／ホスト名が blocker |
| Front Matter | OK | title/emoji/type(tech)/topics(4)/published 揃う。title やや長い（suggestion） |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・出力・比較表がすべてログに裏付けあり。創作なし |
| 画像 | OK | CLI検証で画像なし（記事性質上妥当）。孤立画像なし |
| Markdown構造 | OK | コードフェンス38行=閉じ済み・`:::`4行=閉じ済み・見出し階層OK |
| 文章品質・トーン | OK | 経験談トーン。詰まった点2件が具体的。環境・バージョン明記 |
| 完成度 | OK | 要素材/プレースホルダ残りなし。前提コメントのみ確認推奨 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「確かめたかった4つ…いずれも実際の出力で確認できました」（行447）
  ↔ ログ「完了条件の判定: **達成**（4条件すべてCLI出力で客観確認）」（結果サマリー） → **一致**
- コマンド・エラー全文: 記事の SyntaxError 全文（行66-82）はログ行59-73と一致。機能検出スニペット・
  `nvm use 26`・各 `.mjs` の出力（resource/a-finally/a-using/b-lifo/c-throw/d-return/e-async）は
  すべてログのフェーズ別出力と一致。**創作なし**。
- 数値の扱い: 「詰まったのは2箇所」（行447）はログ「詰まった点: 2件」と一致。AI単独の実測時間
  （0.4h 等）は本文に持ち込んでおらず、ログの注意書き（記事にそのまま書かない）を遵守。
- 断定の根拠: 「出力は完全一致」「LIFO」「await される」等はいずれもログの出力で裏付けあり。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/using-symbol-dispose-try-finally-compare.md (slug=using-symbol-dispose-try-finally-compare) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 78文字 (60字目安)
[PASS] emoji あり: 🧹
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=38
[PASS] ::: ブロックが閉じている: 4 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 67
SUMMARY fail=0 warn=3
```

機械 WARN の切り分け:
- `[WARN] title が長い: 78文字` → suggestion に調整（誇大表現ではなく説明的なため）。
- `[WARN] プレースホルダ/空リンクの疑い` → **false positive**。該当は本文コード内の
  `[Symbol.dispose]()` 等の JS 記法が `]()` にマッチしたもの。実際の空リンク・example.com は無い。指摘対象外。
- `[WARN] 秘密情報の疑い [user-path] at line 67` → **真**。行67に加え行56のホスト名も個人特定情報。**blocker** に格上げ。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）

## 次のアクション

- [ ] blocker（行56・行67 の個人特定パス／ホスト名）を伏字にする（`/review-article ... 修正も適用して` または `/revise-article` で対応）
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
