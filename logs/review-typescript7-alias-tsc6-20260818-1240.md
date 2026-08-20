# 公開前レビュー: TypeScript 7に上げたらeslintが1件も走らなくなった話と、公式のalias構成 / typescript7-alias-tsc6

## レビューの前提

- 対象記事: articles/typescript7-alias-tsc6.md（引数で明示指定）
- 出典ログ: logs/run-typescript7-alias-tsc6-20260818-1209/execution-log.md（引数で明示指定）
- レビュー日時: 2026-08-18 12:40
- 修正の適用: なし（レポートのみ）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 1 件
- 根拠（判定を決めた主な指摘）:
  - 機械チェック（`scripts/check-article.sh --expect-published false`）は `OK` で終了（exit 0）。
  - `published: false`、slug（`typescript7-alias-tsc6`、17文字、`a-z0-9-`のみ、ローカル重複なし）、
    秘密情報・個人パス・内部ホスト名のいずれも検出なし。
  - 出典ログ（`execution-log.md`）と本文の数値・コマンド・エラー全文・結論を突合し、不一致・創作は無し。
  - 唯一の指摘は suggestion（画像 alt テキストの情報量）で、公開判断には影響しない。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] 「数字の比較」節の画像 alt テキスト（`![3構成の比較表と、型チェック時間の構成A比グラフ、およびTS7のtypescriptエントリの中身](/images/typescript7-alias-tsc6/benchmark.png)`） — alt自体はあるが「TS7のtypescriptエントリの中身」がスクショの何を指すか読者には分かりにくいため、画像内の実際の見出し名に寄せるとより親切（必須ではない）。
2. なし
3. なし

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 「数字の比較」節の画像alt | altテキストが3要素を羅列していて、画像内の各領域とどう対応するか読者が推測する必要がある | 画像内の実際の見出し（比較表／棒グラフ／APIの中身比較の3ブロック名）に揃えると、画像を見る前でも構成が掴める |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`／slug妥当・重複無し／秘密情報・個人パス・内部ホスト名の混入無し（`/…/` でパスは意図的にマスクされている） |
| Front Matter | OK | title/emoji/type/topics/published 揃い、type=tech、topics 4個で妥当、title 47字で誇大表現無し |
| 事実性（ログ照合） | OK | 完了条件5/5達成の結論、3構成の計測値、`--checkers`振り、pnpm追試、Yarn未検証の扱い、すべてログと一致。創作なし |
| 画像 | OK | `/images/typescript7-alias-tsc6/benchmark.png` は実ファイルとして存在（621KB）。孤立画像なし |
| Markdown構造 | OK | コードフェンス閉じ済み、`:::message` 閉じ済み、見出し階層に破綻なし、参考リンク3件は実URL |
| 文章品質・トーン | OK | 「新人が1日触った範囲」等の経験談トーン一貫。詰まった点（4件）が具体的に書かれている。環境情報（OS/Node/npm/pnpm）明記 |
| 完成度 | OK | プレースホルダ・`要素材`マーカー・TODO残存なし。前提コメントは意図的（出典ログ・記事タイプ・slug継承・published方針を明示） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「単純アップでlintが死ぬ→alias構成で両立」 ↔ ログ「完了条件の判定: 達成（5/5）」→ **一致**
- 主要数値の突合:
  - 構成A `tsc --noEmit`: 記事 3.478s/3.535s/3.424s ↔ ログ同値 → 一致
  - 構成B: 記事 0.365s/0.357s/0.367s、eslint 0.17秒で throw ↔ ログ同値、`eslint-ts7.log`全文一致 → 一致
  - 構成C: 記事 0.392s/0.362s/0.367s、eslint 7件・8.9秒（Aと一致） ↔ ログ同値 → 一致
  - `--checkers 1/2/4/8`・`--singleThreaded` の数値 ↔ ログの「フェーズ4」記録と一致
  - pnpm 10.13.1 追試の数値・`npm ls`表示差の記述 ↔ ログと一致
  - 予測6件中4件が外れたという記事の総括 ↔ ログ「予測と実測の答え合わせ」表（6行）と一致
- 創作の疑いがある記述: なし。`typescript-eslint/dist/index.js`の判定コード引用、`version.cjs`の中身、`unstable/*`のkeys数もログの実行結果と一致。
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
$ bash .claude/skills/review-article/scripts/check-article.sh articles/typescript7-alias-tsc6.md --expect-published false
OK: articles/typescript7-alias-tsc6.md (slug=typescript7-alias-tsc6, published=false)
```

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] （任意）suggestion のalt テキストを気が向けば調整する
- [ ] 判定は既に「公開可」のため、Front Matter を `published: true` に変えて `git push` してよい
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
