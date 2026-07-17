# 公開前レビュー: Zodしか知らない新人がArkTypeの型主導構文で同じschemaを書き比べてみた / arktype-vs-zod-type-syntax-try

## レビューの前提

- 対象記事: articles/arktype-vs-zod-type-syntax-try.md
- 出典ログ: logs/run-arktype-20260718-0407/execution-log.md
  （加えて生ログ logs/run-arktype-20260718-0407/commands.log と workspace/src/*.ts を一次情報として照合）
- レビュー日時: 2026-07-18 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] `type.fn` 節の「コンパイル時に型でも弾かれる」という記述が、生ログ
    `commands.log` の実出力（`TS2578: Unused '@ts-expect-error' directive`）と矛盾する。
    公開安全・秘密情報・slug はすべてクリアなので blocker はゼロ。事実整合の1点のみ要修正。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「触ってみて分かったこと」節 `type.fn`（本文 L326 コメント / L343 本文）
   — 「コンパイル時は `@ts-expect-error` が有効（＝型でもちゃんと弾かれる）」を、
   実ログどおり「型チェックは `lengthOf(123)` を弾かず、`@ts-expect-error` は **未使用**
   と報告された（TS2578）。弾かれたのはランタイムのみ」に修正する。
2. [suggestion] Front Matter `title`（L2）— 94文字と長め（目安60字）。意味は保てるので
   「ArkTypeの型主導構文でZodと同じschemaを書き比べてみた」等に短縮を検討。
3. [suggestion] 環境構築節（L119）— `MODULE_TYPELESS_PACKAGE_JSON` 警告のくだりの因果が
   分かりにくい。「実際の手順では type 未設定のまま hello を動かしたので警告が出た。
   `npm pkg set type=module` を打つと消える」と時系列を素直に書くと読みやすい。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「触ってみて分かったこと」節 / L326 コメント・L343 本文 | `type.fn` に不正引数を渡したとき「コンパイル時は型でも**ちゃんと弾かれる**」と断定しているが、生ログでは型チェックが `lengthOf(123)` を弾かず `@ts-expect-error` が**未使用**として `TS2578` になっている。コンパイル時に弾かれたという主張は一次ログと矛盾。 | 「コンパイル時は `@ts-expect-error` が有効（＝型でも弾かれる）」→「型チェックでは `lengthOf(123)` はエラーにならず、逆に `@ts-expect-error` が『未使用』と報告された（`error TS2578: Unused '@ts-expect-error' directive`）。弾かれたのはランタイム側だけ」に書き換える。コード内コメント（L326）も同旨に直す。あわせて、この差自体（型定義では引数不一致が弾けなかった）を気づきとして書くと素材が活きる。 | commands.log L99-101 `=== tsc (type-fn) ===` / `src/type-fn.ts(12,3): error TS2578: Unused '@ts-expect-error' directive.`（execution-log L239 の narrative は生ログと食い違っており、生ログが正） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | Front Matter `title`（L2） | 94文字と長い（機械チェック WARN、目安60字）。誇大語は無いので体裁上の問題のみ。 | 一覧・SNSでの見切れを避けられる。内容は「型主導構文でZodと書き比べ」で十分伝わる。 |
| 2 | 環境構築節（L119） | 「先に `npm pkg set type=module` を打っていたので…入れれば消えます」が、警告が出た事実と噛み合わず因果が読みにくい。生ログ上は type 未設定のまま hello 実行→警告→`npm pkg set type=module` で解消、の順。 | 時系列どおりに書くと「なぜ警告が出て、どう消したか」が一読で分かる。 |
| 3 | 冒頭コメント（L9） | 前提コメント `<!-- 前提: 出典ログ ... -->` が残っている。ドラフト管理用として意図的なら可。 | 公開時に残っていても表示はされないが、消し忘れでなければそのままで問題ない（意図確認のみ）。 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / 秘密情報なし / 個人パスは本文で `.../` に伏字済み（L113）/ slug 30字・具体的・ローカル重複なし |
| Front Matter | OK（suggestion 1件） | title が長め以外は必須項目・type・topics(4)・emoji すべて妥当 |
| 事実性（ログ照合） | 要修正 | 大半はコマンド・出力・エラー全文・コードが workspace/commands.log と一致。唯一 `type.fn` のコンパイル時挙動が生ログと矛盾（warning #1） |
| 画像 | OK | CLI完結の記事で画像参照なし。スクショ0枚は素材（execution-log）と整合 |
| Markdown構造 | OK | コードフェンス32行（偶数）/ `:::` 4行（message・details 各1閉じ）/ H1乱用なし / 参考リンク4件は実在の公式ドキュメント |
| 文章品質・トーン | OK | 新人の経験談トーン。詰まった点4件が具体的。再現性（OS/Node/TS/各バージョン）明記。冒頭に結論と対象読者あり |
| 完成度 | OK | プレースホルダ・要素材マーカー残存なし |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件3つすべて確認（3つ目はズレを記録）」 ↔ ログ「達成（3条件すべて客観確認、#3はズレ記録）」 → **一致**
- コマンド／出力の突合:
  - npm ls / tsconfig / hello.ts 出力 / zod-schema.ts / arktype-schema.ts / run.ts 出力 /
    エラー文言比較表 / TS2322(type-error-demo) / TS2375(type-test) / TS5112 / type.fn 実行出力
    → いずれも execution-log ＋ commands.log ＋ workspace/src と**一致**。
  - run.ts の本文コードは workspace/src/run.ts の忠実な抜粋（`cases` 定義・ヘッダ console.log を省いた引用。創作なし）。
  - type-test.ts の相互代入 TS2375 は、最終版では該当行がコメントアウトされており（cross1）、
    「full build は通る／別途 cross 代入で TS2375」という本文の説明は正しい。TS2375 全文も commands.log L89-92 と一致。
- 創作の疑いがある記述:
  - `type.fn` の「コンパイル時に型でも弾かれる」（L343・L326）→ **一次ログと矛盾**（warning #1）。
    創作ではなく execution-log の narrative をそのまま引き継いだものだが、生ログ（commands.log）が示す
    実挙動（TS2578＝未使用）と食い違うため要修正。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/arktype-vs-zod-type-syntax-try.md (slug=arktype-vs-zod-type-syntax-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=30 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 94文字 (60字目安)
[PASS] emoji あり: 🦖
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=32
[PASS] ::: ブロックが閉じている: 4 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

機械チェックの WARN の切り分け:
- `title が長い(94文字)` → suggestion #1 として採用（誇大語は無し・体裁のみ）。
- `example.com / 空リンク` → **false positive**。検出箇所（L211-217, L273-280）はすべて
  検証データ内の `alice@example.com` 等のメールアドレスで、RFC 2606 の予約ドメイン。
  壊れたリンクやプレースホルダではないため指摘から除外。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning #1（`type.fn` のコンパイル時挙動）を生ログどおりに修正する（最優先）
- [ ] suggestion #1〜#3 は任意で対応
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
