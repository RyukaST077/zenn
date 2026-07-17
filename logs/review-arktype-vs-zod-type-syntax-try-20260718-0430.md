# 公開前レビュー: ArkTypeの型主導構文でZodと同じschemaを書き比べてみた / arktype-vs-zod-type-syntax-try

## レビューの前提

- 対象記事: articles/arktype-vs-zod-type-syntax-try.md
- 出典ログ: logs/run-arktype-20260718-0407/execution-log.md（＋一次証跡 commands.log を突合に使用）
- レビュー日時: 2026-07-18 04:30
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug妥当・重複なし / 秘密情報・個人パスの漏れなし）をすべてクリア。
  - 事実整合: 本文のコマンド・出力・エラー・コードは出典ログおよび一次証跡 `commands.log` にすべて裏付けあり。結論（完了条件3つ達成）もログの結果サマリーと一致。
  - 機械チェックの WARN 2件はいずれも目視で **false positive** と確認（下記）。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] type.fn 節（本文 L328 のコード内コメント）— コメント「型でも弾かれる（コンパイルエラー）」は当初の期待を書いたもので、直後の本文が「実際は型では弾けなかった」と訂正する構成。読者が矛盾と受け取らないよう、コメント末尾に「※実際は後述のとおり型では弾けなかった」等を一言添えると親切。
2. [suggestion] 前提コメント（L9 `<!-- 前提: ... -->`）— ドラフト運用上は意図的だが、公開前に残すか外すか判断する。Zennでは非表示なので実害はない。
3. [suggestion] topics（L5、4個）— `arktype/zod/typescript/validation` で妥当。到達性を上げるなら `schema` 等を1つ追加してもよい（任意・最大5個以内）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 本文 L328（type-fn.ts コメント） | コード内コメントが当初の期待（型でも弾かれる）のまま。本文は「実際は弾けなかった」と訂正する流れ | コメントに一言補足を足すと、コードだけ拾い読みした読者の誤解を防げる |
| 2 | L9 前提コメント | `<!-- 前提: ... -->` が残存（ドラフト運用としては意図的） | 公開前に残置/除去を明示的に判断できる。Zenn表示には出ないため任意 |
| 3 | L5 topics | 4個で妥当。`schema` 等の追加余地あり | 検索到達性がわずかに上がる（任意） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug=arktype-vs-zod-type-syntax-try（30字・文字種OK・ローカル重複なし）/ 秘密情報なし / 個人パス（/Users/…）は本文で `.../` に伏せ済み |
| Front Matter | OK | title/emoji/type/topics/published すべて揃う。type=tech、topics 4個・英小文字、emoji=🦖 |
| 事実性（ログ照合） | OK | コマンド・出力・エラー全文・コードが execution-log.md / commands.log と一致。結論も一致（下記詳細） |
| 画像 | OK | CLI/API完結の記事で画像参照なし（ログもスクショ0枚）。出力はコードブロックで提示、意図に合致 |
| Markdown構造 | OK | H1なし・H2階層正常（11節）。コードフェンス34行=偶数で閉、`:::` 4行で閉。壊れリンクなし |
| 文章品質・トーン | OK | 新人の経験談トーン。詰まった点4件が具体的。冒頭に結論と対象読者。再現性（OS/Node/TS/各バージョン）明記 |
| 完成度 | OK | プレースホルダ・要素材マーカーなし。長さ・まとまりとも公開に耐える |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件3つすべて確認（3つ目は推論ズレを記録）」 ↔ ログ「達成（3条件すべて客観確認、#3はズレ記録）」 → **一致**
- 主要な一次情報の裏付け（すべて commands.log / execution-log に存在）:
  - npm ls 出力（arktype@2.2.3 / typescript@7.0.2 / zod@4.4.3）… commands.log L27-30 一致
  - TS7.0.2 / `npx tsc --version` … commands.log L33 一致
  - hello.ts の警告出力（MODULE_TYPELESS_PACKAGE_JSON）… commands.log L37-42 一致
  - strict:false で型がエラー文になる … commands.log L48 に該当エラーあり（本文の要約も整合）
  - run.ts の4ケース出力・エラーメッセージ比較表 … commands.log L59-87 と完全一致
  - TS2375（推論ズレ）全文 … commands.log L89-92 一致
  - type-error-demo の TS2322×2 と TS5112 … commands.log L94-96 一致
  - type.fn の TS2578 と実行時 throw … commands.log L100 / L103-106 一致
- **特記（フィデリティ上むしろ良好な点）**: type.fn 節について、出典ログの散文サマリー（execution-log.md L239）は「コンパイル時は @ts-expect-error が有効（＝型でも弾かれる）」と記していたが、一次証跡 commands.log L100 は `error TS2578: Unused '@ts-expect-error' directive.` を示す＝**型では弾けていない**。記事本文（L336-342）は raw 出力に忠実に「型では弾けず、弾いたのはランタイムだけ」と正しく解釈しており、execution-log の要約ミスに引きずられていない。創作ではなく一次証跡準拠と確認。
- 創作の疑いがある記述: なし
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

### 機械チェック WARN の目視切り分け

- **[WARN] title 70文字**: → **false positive**。実際のタイトル「ArkTypeの型主導構文でZodと同じschemaを書き比べてみた」は 34 文字（Python `len` 実測）で、目安60字を下回る。スクリプトがマルチバイトをバイト長で数えているための過大表示。指摘不要。
- **[WARN] example.com / 空リンク**: → **false positive**。検出箇所（本文 L211-213, L217, L275, L282）はすべてテスト用のメールアドレス（`alice@example.com` 等）で、コードブロック内のサンプルデータ。参考リンク節（L375-378）は arktype.io / zod.dev / typescriptlang.org / nodejs.org の実在URLで、プレースホルダや空リンクはなし。指摘不要。

## 次のアクション

- [ ] （任意）上記 suggestion を必要に応じて反映する
- [ ] 判定は「公開可」。Front Matter を `published: true` に変えて `git push`（＝マージで公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
- [ ] 公開フローは `/publish-pr` で feature ブランチ→PR 作成が定石（main 直 push しない）
