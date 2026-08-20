# 公開前レビュー: TypeScript 7に上げたらeslintが1件も走らなくなった話と、公式のalias構成 / typescript7-alias-tsc6

## レビューの前提

- 対象記事: `articles/typescript7-alias-tsc6.md`（引数で明示）
- 出典ログ: `logs/run-typescript7-alias-tsc6-20260818-1209/execution-log.md`（引数で明示）
- 参照した関連記事: `articles/typescript7-tsc-bin-collision-log.md`（前回記事。冒頭の記述の裏取りに使用）
- レビュー日時: 2026-08-18 12:35
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - warning #1: まとめの「予測は6つ書いて**3つ**外しました」が、出典ログの「予測と実測の答え合わせ」表（6予測中 **4つが外れ**）と一致しない。かつ記事本文自身が4つ目の外れ（Yarn issue が Open だと思っていたら Closed）を書いているため、記事内でも矛盾している。
- 公開安全（published/秘密情報/slug）はすべてクリア。事実整合もこの1点を除いて出典ログと高い精度で一致している。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「まとめ」節（L643）— 「6つ書いて3つ外しました」→「6つ書いて4つ外しました」に直し、列挙に「Yarn の issue #4368 を Open だと思っていたら Closed だったこと」を加える。
2. [suggestion] 見出し「## 事前に調べたこと（実行前に予測を2つ書いた）」（L80）— まとめの「6つ書いて」と数が繋がらない。見出しを「（実行前に書いた予測のうち2つ）」等にするか、まとめ側を「実行前後に立てた予測は全部で6つ」と補足する。
3. [suggestion] 「## 数字の比較」節（L539）— 「中央値で 3.478s → 0.372s」の 0.372s は、記事に載っているどの3回組の中央値でもない（構成Cの中央値は 0.367s、構成Bは 0.365s）。「構成B/Cを通した代表値として約0.37s」等に言い換えるのが安全。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「まとめ」L643 | 「実行前の予測は、6つ書いて3つ外しました。」が出典ログと不一致。ログの「予測と実測の答え合わせ」表は6行中 当たり2 / **外れ4**（exports=当たり、ERESOLVE=外れ、lintの落ち方=外れ、bin衝突=当たり、fixtureの倍率=外れ、Yarn issue Open=外れ）。記事本文も L595 で「試す前は Open だと思っていたので、情報の鮮度は見ておくべきでした」と4つ目の外れを書いており、まとめの「3つ」と食い違う | 「6つ書いて**4つ**外しました。」に修正し、続く列挙に「Yarn の issue #4368 を Open だと思い込んでいたら、確認時点では Closed だったこと」を追加する | 出典ログ「### 予測と実測の答え合わせ」表（L633-642）／記事 L595 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 見出し L80「事前に調べたこと（実行前に予測を2つ書いた）」 | 本文で明示的に立てた予測は2つだが、まとめでは「6つ書いて」となる。読者が数を追えない | 見出しを「（実行前に書いた予測のうち主な2つ）」に、またはまとめ側で「実行前・各フェーズ前に立てた予測は合計6つ」と補足すれば、答え合わせの数が読者の中で閉じる |
| 2 | L539「中央値で 3.478s → 0.372s、この fixture では約9.3倍でした」 | 0.372s はどの3回組の中央値でもない（A=3.478 は中央値で正しいが、B=0.365 / C=0.367 が中央値）。出典ログの記載をそのまま引き継いだ値だが、記事の表と突き合わせた読者が再計算できない | 「約0.37s（構成B/Cの代表値）」等に言い換えると、直上の比較表と数字が一致して検算できる |
| 3 | L13「（「TypeScript 7と6の併用検証がtscのbin衝突で止まった記録」）」 | 前回記事をタイトル文字列でのみ参照しており、リンクが無い。前回記事は `published: true` で公開済み | Zenn の記事URL（または `https://zenn.dev/<user>/articles/typescript7-tsc-bin-collision-log`）へのリンクにすると、続編としての導線が効く |
| 4 | L621-630「『APIが無い』の正確なところ」のキー一覧 | 各サブパスのキー例がログの実出力（アルファベット順）と並び順が違う（例: ログは `unstable/ast ... CharacterCodes, CommentDirectiveType, InternalSymbolName, LanguageVariant, ModifierFlags, NodeFlags, ScriptKind, SyntaxKind, ...`、記事は `SyntaxKind, NodeFlags, ModifierFlags, cast, ...`）。挙げている名前自体はすべてログに実在するので創作ではないが、`Object.keys` の生出力に見える体裁で並び替えられている | 「keys の一部を抜粋（順不同）」と一言添えると、生出力との誤読が消える |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false`。秘密情報・APIキー・トークン類なし。ローカル絶対パスは `/…/node_modules/...` に省略済みで `/Users/<氏名>` の露出なし。slug `typescript7-alias-tsc6`（22字・`a-z0-9-`）は具体的で `articles/` 内に重複なし |
| Front Matter | OK | title 46字（誇大表現なし）／emoji ⚡ 1つ／type `tech`／topics 4個すべて英小文字（typescript, eslint, npm, nodejs）／published false |
| 事実性（ログ照合） | 要修正 | warning #1 の1点のみ。それ以外の実測値・コマンド・エラー全文はすべてログに一致（下記「事実整合の照合結果」参照） |
| 画像 | OK | 参照は1件 `/images/typescript7-alias-tsc6/benchmark.png` で実在（621KB）。alt テキストあり。孤立画像なし。ログのスクショも1枚のみなので不足ではない |
| Markdown構造 | OK | H1 なし（## 開始）で階層破綻なし。コードフェンス 74行＝偶数で閉じている。`:::message` 2行＝閉じている。外部リンク4本すべて実URL、プレースホルダ・TODO なし |
| 文章品質・トーン | OK | 「新人が1日触った範囲」と繰り返し断り、公式値と自作 fixture の値を明確に分離。詰まった点（eslint OOM / 0.17秒 throw / `--checkers` の引数ミス）が具体的に書かれている。環境（OS/Node/npm/pnpm/各パッケージ版/コア数）も明記 |
| 完成度 | OK | `要素材` マーカー 0 件、プレースホルダ 0 件、652行で公開に十分な分量。冒頭の `<!-- 前提: ... -->` コメントは他記事と同じ運用のため意図的とみなす |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「両立しました。`tsc` は 7.0.2 で 0.37秒、`eslint` は構成Aと同じ7件」↔ ログ「完了条件の判定: 達成（5/5）」「構成C: 7 errors（8.9s）**Aと完全一致**」→ **一致**
- 突合して一致を確認した主な数値・出力:
  - 環境: macOS 26.5 / Darwin 25.5.0 arm64 / 論理10コア / Node v22.17.0 / npm 10.9.2 / pnpm 10.13.1 → ログ「再現性メモ」と一致
  - dist-tags（typescript 7.0.2 / @typescript/typescript6 6.0.2 / typescript-eslint 8.67.0 / eslint 10.8.1）→ 一致
  - fixture 規模 203ファイル / 13,841行、Types 309849 / Instantiations 1843316 / Memory 570562K / Check 3.19s / Total 3.49s → 一致
  - 構成A: 3.478 / 3.535 / 3.424、eslint 7 errors 8.515s、`added 87 packages in 3s`、peer 警告ゼロ → 一致
  - 構成B: ERESOLVE 警告8回で exit 0、`added 9 packages, removed 8 packages, and changed 1 package in 1s`、`npm ls` の `invalid: ">=4.8.4 <6.1.0"`、26MB / node_modules 49M、tsc 0.365 / 0.357 / 0.367、CPU 145%→434%、9.5倍 → 一致
  - 構成B の eslint エラー全文（`typescript-eslint does not support TS 7.0.` 以下スタックトレースまで）→ `eslint-ts7.log` 引用と一致
  - 8.63.0 での `TypeError: Cannot read properties of undefined (reading 'Cjs')` → ログ L345（knowledge 2026-07-09 参照）に裏付けあり
  - 構成C: `added 90 packages in 2s`、`npm ls --depth=0` の alias 表示、`.bin/tsc -> ../@typescript/native/bin/tsc` / `.bin/tsc6 -> ../typescript/bin/tsc6`、tsc 0.392/0.362/0.367、tsc6 3.447s、eslint 7 errors 8.889s → 一致
  - `--checkers` 1/2/4/8 と `--singleThreaded` の全数値、1.9倍/1.7倍/1.2倍、並列オフでも2.9倍 → 一致
  - `error TS5093`（--builders）/ `error TS5025`（tsc6 --checkers）/ `error TS5023`（引数の渡し方ミス）→ 一致
  - pnpm 追試（0.380/0.384/0.375、7 problems、シム 1848 bytes）→ 一致
  - Yarn #4368 の条件（Yarn 4.16.0 / nodeLinker: node-modules / 6.0.1 + 7.0.1-rc / `lstat '.../lib/_tsc.js'`）と **Closed** 表記、および Yarn 未検証の明記 → 一致
  - 前回記事の記述（2026-07-11、`tsc` も `tsc6` も `Version 6.0.3`、`.bin/tsc -> ../@typescript/old/bin/tsc`、`.bin/tsc6 -> ../@typescript/typescript6/bin/tsc6`）→ `articles/typescript7-tsc-bin-collision-log.md` L25/L89/L91/L116/L117 と一致
  - 未検証項目の明記（Yarn 4 / 診断メッセージ文言差 / emit 差 / メモリ）→ ログ「未達・撤退した項目」と一致
- 創作の疑いがある記述: **なし**（上記 warning #1 は創作ではなく集計ミス）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
$ bash scripts/check-article.sh articles/typescript7-alias-tsc6.md --expect-published false
OK: articles/typescript7-alias-tsc6.md (slug=typescript7-alias-tsc6, published=false)
EXIT=0
```

## 適用した修正

なし（修正適用の指定が無いため、記事本文は一切変更していない）。

## 次のアクション

- [ ] warning #1（まとめの「3つ外しました」→「4つ外しました」＋ Yarn issue の追記）を直す
- [ ] 余力があれば suggestion 1〜4 も反映する
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
