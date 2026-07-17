# 修正適用レポート: ArkTypeの型主導構文でZodと同じschemaを書き比べてみた / arktype-vs-zod-type-syntax-try

## 採用した前提

- 対象記事: `articles/arktype-vs-zod-type-syntax-try.md`（published: false のまま維持）
- レビューレポート: `logs/review-arktype-vs-zod-type-syntax-try-20260718-0417.md`（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-arktype-20260718-0407/execution-log.md`
  （加えて生ログ `logs/run-arktype-20260718-0407/commands.log` を一次情報として照合）
- 適用範囲: blocker ＋ warning ＋（安全・機械的な）suggestion
- slug リネーム: なし（指摘なし・現 slug は 30字で妥当）
- 前回の修正レポート: なし（初回修正・ループ検出対象なし）

## 適用した修正

### warning #1 — `type.fn` のコンパイル時挙動（事実整合）【適用】

- 分類: C（削減・訂正）＋ B（ログ由来の補完）
- 箇所: 「触ってみて分かったこと」節（コード内コメント / 実行結果の本文）
- 内容:
  - コード内コメント（旧: `// @ts-expect-error 型でも弾かれる（コンパイルエラー）が、ランタイム検証も走ることを確認`）を、
    実挙動どおり「`@ts-expect-error` のつもりで置いたが、型チェックは `lengthOf(123)` を弾かず『未使用』扱いになった（TS2578）。ランタイムでは throw する」に訂正。
  - 本文の「コンパイル時は `@ts-expect-error` が有効（＝型でもちゃんと弾かれる）で、ランタイムでも…throw」という断定を削除。
    代わりに `tsc` 出力 `src/type-fn.ts(12,3): error TS2578: Unused '@ts-expect-error' directive.` を新規コードブロックで提示し、
    「型チェックでは弾けず、弾いてくれたのはランタイム側だけだった」という気づきに書き換えた。
- 根拠（一次情報）: `commands.log` L99-101 `=== tsc (type-fn) ===` / `src/type-fn.ts(12,3): error TS2578: Unused '@ts-expect-error' directive.`
  （execution-log L239 の narrative は生ログと食い違っており、生ログを正とした）
- 捏造なし: 追記した `tsc` 出力・throw メッセージはすべて `commands.log` L100-106 に存在する実出力。

### suggestion #1 — Front Matter title が長い【適用（安全・機械的）】

- 箇所: Front Matter `title`
- 内容: `"Zodしか知らない新人がArkTypeの型主導構文で同じschemaを書き比べてみた"`（機械チェック 94字）→
  `"ArkTypeの型主導構文でZodと同じschemaを書き比べてみた"`（同 70字）に短縮。誇大語なし・意味は保持。
- 補足: 目安60字にはまだ届かず機械チェックは WARN のまま（体裁のみ・非ブロッキング）。レビュー提案の文面をそのまま採用した。

### suggestion #2 — 環境構築の警告の因果が不明瞭【適用（安全・機械的）】

- 箇所: 環境構築節（`MODULE_TYPELESS_PACKAGE_JSON` の説明）
- 内容: 「先に `npm pkg set type=module` を打っていたので…消えます」という時系列と噛み合わない説明を、
  ログの実順序（`"type"` 未設定のまま `hello.ts` 実行 → 警告 → `npm pkg set type=module` で解消）どおりに書き換えた。
- 根拠: execution-log L108-109 / 詰まった点#3（`npm pkg set type=module` で解消）。

## スキップ / 未解消の指摘

### suggestion #3 — 冒頭の前提コメント `<!-- 前提: ... -->` 【スキップ】

- 理由: ドラフト管理用として意図的に置いているもの。レビューでも「意図確認のみ・そのままで問題ない」とされており、
  公開時も表示されない。パイプライン運用上の前提追跡に使うため保持する。

## セルフチェック結果（check-article.sh 再実行）

```
SUMMARY fail=0 warn=2
```

- `[WARN] title が長い: 70文字` → suggestion #1 で 94→70 に短縮済み（目安60字未満は未達だが体裁のみ・非ブロッキング）。
- `[WARN] example.com / 空リンク` → **false positive**（レビュー確認済み）。検出箇所は検証データ内の `alice@example.com` 等、
  RFC 2606 の予約ドメイン。壊れたリンク・プレースホルダではない。
- `published=false` を維持していることを確認。フェンス（34行・偶数）/ `:::`（4行）閉じ・要素材/秘密情報なしも PASS。

## 秘密情報・匿名化

- 追加の秘密情報検出なし（機械チェック PASS）。個人パスは本文で `.../` に伏字済み。マスク対応は不要。

## 次のアクション

- `/review-article articles/arktype-vs-zod-type-syntax-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
