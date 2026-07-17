# 修正適用レポート: ArkTypeの型主導構文でZodと同じschemaを書き比べてみた / arktype-vs-zod-type-syntax-try

## 採用した前提

- 対象記事: `articles/arktype-vs-zod-type-syntax-try.md`（published: false のまま維持）
- レビューレポート: `logs/review-arktype-vs-zod-type-syntax-try-20260718-0424.md`
  （判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-arktype-20260718-0407/execution-log.md`
  （加えて workspace 実ソース `logs/run-arktype-20260718-0407/workspace/src/*.ts` を一次情報として照合）
- 適用範囲: blocker ＋ warning ＋（安全・機械的な）suggestion
- slug リネーム: なし（指摘なし・現 slug は 30字で妥当）
- 前回の修正レポート: `logs/revise-arktype-vs-zod-type-syntax-try-20260718-0422.md`（ループ検出のため確認済み。下記参照）

### ループ検出の確認

前回（0422）は warning#1 に対し `type-fn.ts` のコメントを「実挙動どおりの説明文」に**書き換える**修正を適用した。
今回（0424）の warning#1 は**同じ箇所**だが指摘の趣旨が異なり、「ファイル名付きコードブロックは実 workspace ソースと
一致させるべき」というもの。前回は「修正不能」ではなく修正を**適用**しており、今回はその適用結果に対する
別観点の指摘。したがって「同一指摘が解消できずループ」には該当しない（中止不要）。今回は実ソースへ整合させる方向で解消した。

## 適用した修正

### warning #1 — `ts:src/type-fn.ts` のコメントが実ソースと不一致【適用】

- 分類: A（実ファイルとの整合／機械修正）
- 箇所: 「触ってみて分かったこと・Zod と比べて」節の `ts:src/type-fn.ts` コードブロック（記事 326行目付近）
- 内容: コード内コメントを実 workspace ソース（`workspace/src/type-fn.ts:12`）の文言に戻した。
  - 旧（前回書き換え後）: `// @ts-expect-error のつもりで置いたが、型チェックは lengthOf(123) を弾かず「未使用」扱いになった（TS2578）。ランタイムでは throw する`
  - 新（実ソースどおり）: `// @ts-expect-error 型でも弾かれる（コンパイルエラー）が、ランタイム検証も走ることを確認`
- 採用したのはレビュー推奨の①（実ファイルのコメントに戻し、TS2578 の解釈は本文プロセで述べる）。
  記事本文はすでに「まず `tsc` にかけると TS2578 が出た → 型では弾けず、弾いてくれたのはランタイム側だけ →
  **弾いてくれる前提で書いていたので想定外だった**」（記事 334〜340行）と正しく説明しており、
  コメントは「実行前の（誤った）想定」を示す位置づけになる。コード本体（`type.fn(...)` / `lengthOf(123)` / try-catch）は
  もともと実ソースと一致しているため変更なし。
- 事実性: 挙動の記述（TS2578＝型では弾けず未使用扱い / ランタイムのみ throw）は commands.log:100 と一致しており、
  本文側は正しいまま。コメントを実ソースに戻しても、本文プロセが解釈を訂正しているため記事全体の事実性は保たれる。
- 捏造なし: 復元したコメントは実ソースファイルに実在する文言そのもの。

### suggestion #2 — `type-error-demo.ts` 抜粋に import を補う【適用（安全・機械的）】

- 箇所: 「詰まった点」節の `ts:src/type-error-demo.ts` コードブロック（記事 270行目付近）
- 内容: 実ソース（`workspace/src/type-error-demo.ts:1`）に存在する
  `import type { User as ArkUser } from "./arktype-schema.ts";` を抜粋の冒頭に1行追加。
  読者が `ArkUser` 型の出所を把握でき、単体で再現しやすくなる。
- 根拠: 実 workspace ソースに実在する行の追加のみ（捏造なし）。末尾の `console.log(...)` はデモ本質でないため引き続き省略。

## スキップ / 未解消の指摘

### suggestion #1 — Front Matter title が長い（機械チェック 70文字）【スキップ・修正不要】

- 理由: マルチバイトのバイト数カウントによる誤検知。実可視文字数は約33字で 60字目安を下回る。
  レビューでも「修正不要と判断できる」とされている。機械チェックは WARN のまま（体裁のみ・非ブロッキング）。

### suggestion #3 — 経験談トーン・スクショ無し【対応不要】

- 理由: 現状維持で良いとの指摘。CLI 完結ゆえスクショ無しは出典ログでも 0 枚と明記されており妥当。

### （参考）冒頭の前提コメント `<!-- 前提: ... -->`

- パイプライン運用の前提追跡用として意図的に保持（公開時は非表示）。前回レポートの判断を踏襲。

## セルフチェック結果（check-article.sh 再実行）

```
SUMMARY fail=0 warn=2
```

- `[WARN] title が長い: 70文字` → suggestion #1 のとおりバイト数カウント誤検知（実可視 約33字）。体裁のみ・非ブロッキング。
- `[WARN] example.com / 空リンク` → false positive。検出箇所は検証データ内の `alice@example.com` 等（RFC 2606 予約ドメイン）。
- `published=false` を維持。コードフェンス 34行（偶数）/ `:::` 4行 閉じ / 要素材・秘密情報なし もすべて PASS。

## 秘密情報・匿名化

- 追加の秘密情報検出なし（機械チェック PASS）。マスク対応は不要。

## 次のアクション

- `/review-article articles/arktype-vs-zod-type-syntax-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
