# 公開前レビュー: ArkTypeの型主導構文でZodと同じschemaを書き比べてみた / arktype-vs-zod-type-syntax-try

## レビューの前提

- 対象記事: articles/arktype-vs-zod-type-syntax-try.md
- 出典ログ: logs/run-arktype-20260718-0407/execution-log.md（＋ 一次出力 commands.log を併用）
- レビュー日時: 2026-07-18 04:24
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - warning#1: `src/type-fn.ts` のコードブロックが、実際の workspace ソース（`logs/run-arktype-20260718-0407/workspace/src/type-fn.ts`）とコメント文が食い違っている。ファイル名付きコードフェンスは実ファイルと一致させるべき。
- 公開安全（published:false / slug / 秘密情報）はすべて OK。事実性も一次出力（commands.log）で裏付け済み。blocker は無い。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「触ってみて分かったこと」`src/type-fn.ts`（記事 321〜332行） — コードブロック内のコメントを実ファイルの文言に戻す（または本文プロセで「コメントは説明用に書き換えた」と明示する）。挙動の説明（TS2578＝型では弾けない）は正しいので、コメントの表記だけ整合させる。
2. [suggestion] title（記事2行 / front matter） — 機械チェックが「70文字」と警告するが、実際の可視文字数は約33字で問題なし（マルチバイトのバイト数カウントによる誤検知）。修正不要。念のため確認のみ。
3. [suggestion] 出典ログの内部矛盾に注意 — execution-log.md の要約（239行）は「コンパイル時は型でも弾かれる」と誤記しているが、記事は一次出力 commands.log（TS2578）に沿って正しく書いている。記事側は問題なし。ログの要約が誤りなので、再素材化の際は注意。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「触ってみて分かったこと」記事 321〜332行 `ts:src/type-fn.ts` | ファイル名付きコードブロックのコメントが実 workspace ソースと不一致。実ファイルは `// @ts-expect-error 型でも弾かれる（コンパイルエラー）が、ランタイム検証も走ることを確認` だが、記事は `// @ts-expect-error のつもりで置いたが、型チェックは lengthOf(123) を弾かず「未使用」扱いになった（TS2578）。ランタイムでは throw する` に書き換えられている。関数コード本体（`type.fn(...)` / `lengthOf(123)` / try-catch）は一致。 | ①実ファイルのコメントに戻し、TS2578 の解釈は本文プロセで述べる（推奨）、または ②書き換えたことが分かるように「コメントは記事用に補足」と一言添える。挙動の記述自体は commands.log と整合しているので、コメント文言のみ整える。 | workspace/src/type-fn.ts:12 と記事の該当コードブロックの突合 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | front matter title | 機械チェックが title 70文字と警告。実可視文字数は約33字で 60字目安を下回る（バイト数カウントの誤検知）。 | 修正不要と判断できる。念のため確認しておくと安心。 |
| 2 | 「詰まった点」`type-error-demo.ts`（記事 270〜284行） | 実ファイルにある `import type { User as ArkUser } ...` と末尾 `console.log(...)` を省いた抜粋。抜粋自体は妥当だが、`ArkUser` 型の出所が本文だけでは分かりにくい。 | 冒頭に `import type { User as ArkUser } from "./arktype-schema.ts";` を1行足すと、読者が単体で再現しやすい。 |
| 3 | 全体 | 経験談トーン・詰まった点・再現環境の明記は十分。CLI 完結ゆえスクショ無しも妥当（ログでも0枚と明記）。 | 現状維持で良い。 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 30字・汎用でない / 秘密情報なし。emails は `example.com` のテストデータ（誤検知） |
| Front Matter | OK | title/emoji/type(tech)/topics(4)/published 揃う。title長警告はバイト数誤検知 |
| 事実性（ログ照合） | OK | 主要コマンド・出力・エラー全文が commands.log で裏付け済み。結論「達成」も一致 |
| 画像 | OK | CLI記事のためスクショなし（ログで0枚と明記）。/images 参照なし |
| Markdown構造 | OK | コードフェンス34行(偶数)、:::4行(偶数)、H1乱用なし、リンク実在 |
| 文章品質・トーン | OK | 新人経験談トーン、詰まった点4件が具体的、再現環境明記 |
| 完成度 | 要修正 | type-fn.ts コードブロックのコメント整合（warning#1）のみ |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件3つすべて確認（3つ目はズレを記録）」 ↔ ログ「達成（3条件すべて客観的に確認）」 → **一致**
- コマンド・出力の裏付け（commands.log 突合）:
  - `npm ls`（arktype2.2.3 / typescript7.0.2 / zod4.4.3）→ 一致（commands.log:26-30）
  - hello.ts の警告出力 → 一致（commands.log:36-42）
  - strict:false のエラー型メッセージ → 一致（commands.log:48）
  - run.ts の4ケース出力 → 一致（commands.log:59-87）
  - TS2375 全文（推論ズレ）→ 一致（commands.log:89-92）
  - TS5112 / type-error-demo の TS2322×2 → 一致（commands.log:94-96）
  - **type.fn の TS2578**（記事: 型では弾けず未使用扱い）→ **commands.log:100 と一致**。記事は正しい。
- 記事コードの workspace 由来性:
  - zod-schema.ts / arktype-schema.ts / run.ts → workspace ソースと一致（run.ts のループ本体も一致）
  - type-fn.ts → 関数コードは一致だが**コメント文言のみ相違**（warning#1）
  - type-error-demo.ts → import と末尾 console.log を省いた妥当な抜粋
- 出典ログの内部矛盾（記事の問題ではない）: execution-log.md:239 の要約は「コンパイル時は型でも弾かれる」と誤記。しかし一次出力 commands.log:100 は TS2578（＝`@ts-expect-error` 未使用＝型では弾けていない）で、**記事は一次出力に沿って正しく記述**している。記事側は問題なし。ログの要約とソースコメントが誤り。
- 創作の疑いがある記述: なし（TS2578 出力を含め、すべて commands.log で裏付け）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/arktype-vs-zod-type-syntax-try.md (slug=arktype-vs-zod-type-syntax-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=30 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 70文字 (60字目安)
[PASS] emoji あり: 🦖
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=34
[PASS] ::: ブロックが閉じている: 4 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

機械チェックの WARN 2件はいずれも誤検知:
- title 70文字: マルチバイトのバイト数カウントによるもの。実可視文字数は約33字で問題なし。
- example.com: `alice@example.com` 等のテストデータであり、プレースホルダ・空リンクではない。

## 適用した修正

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning#1（type-fn.ts コードブロックのコメント整合）を直す
- [ ] （任意）suggestion を反映する
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
