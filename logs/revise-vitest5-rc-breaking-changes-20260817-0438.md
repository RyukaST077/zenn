# 修正レポート: Vitest 5 RC に上げてみたら、テストより先に npm が落ちた / vitest5-rc-breaking-changes

## 修正の前提

- 対象記事: `articles/vitest5-rc-breaking-changes.md`（リネームなし）
- レビューレポート: `logs/review-vitest5-rc-breaking-changes-20260817-0434.md`（判定: 要修正 / blocker 0・warning 4・suggestion 4）
- 出典ログ: `logs/run-vitest5-rc-breaking-changes-20260817-0412/execution-log.md`（`workspace/` も参照）
- 適用範囲: warning 全4件 ＋ suggestion 1・2・4（安全で機械的なもの）。suggestion 3（前提コメント）はレビュー側が「現状維持で問題なし」としているため未適用
- slug リネーム: 指摘なしのため実施せず
- 修正日時: 2026-08-17 04:38
- `published: false` を維持（変更なし）

## 結果サマリー

- 適用: blocker 0 件 / warning 4 件 / suggestion 3 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: `SUMMARY fail=0 warn=2`（WARN 2件はレビューで false positive 判定済み。内容は修正前と同一）

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | warning 1 / 「テストより先に npm が落ちた」 | A | `peerDependencies は13個あって` → `peerDependencies は12個あって` | 記事内に引用済みの `npm view vitest@rc` 出力（12件）。出典ログ フェーズ1-2 の同出力 |
| 2 | warning 2 / 「8項目の結果まとめ」末尾 | A/C | 「C は…、G は再現せず、H は…片方だけ。予想を3つ外した」を2段落に分割。C は「予想どおりマッチ先が `'math adds'` → `'math > adds'` に入れ替わった（終了コード 0）」として的中側に置き、「予想を外したのは A・G・H の3つです。A は 4.1 で警告が出ると思っていたのに無言だった」と明記 | 記事 L64（C の予想）と `-t` 2×2 表（実測）が一致。出典ログ「一番の収穫」が外した3つを A の警告・G の `.vitest`・H の POOL_ID と記載 |
| 3 | warning 3 / 「G: `.vitest/` ディレクトリ」 | A | 「試した3経路では出なかった」 → 「試した4経路では出なかった」 | 記事の経路表4行、記事内の他2箇所（4経路）、出典ログ「詰まった点」#4 |
| 4 | warning 4 / 「B: `clearMocks` の既定が true に」 | A | フェンス情報を ` ```ts:vitest.config.ts ` → ` ```ts:vitest.escape.config.ts ` に変更。直後に「`vitest.config.ts` として置くと他の項目の検証条件（既定値のまま観測する）を壊すので、別名にして `--config` で読ませています」の1文を追加 | 出典ログ 4-1 の実行コマンド `npx vitest run test/tmp-escape.test.ts --config vitest.escape.config.ts`。記事の「`vitest.config.ts` を書かない」条件 |
| 5 | suggestion 1 / 端末出力のマスク明記 | B | ベースライン節の末尾に「以降に貼る端末出力はホームディレクトリのパスを `/Users/.../` にマスクし、作業ディレクトリ名を再現手順に合わせて `vitest5-check` に揃えています。それ以外は実行時の出力そのままです」を追加 | 実際の作業ディレクトリは `fixtures/vitest5-rc-breaking-changes`（出典ログ）。記述は事実の注記のみ |
| 6 | suggestion 2 / F の after ブロック | B | after ブロックに `function boom(): never { throw new Error('boom happened') }` を追加（before ブロックにしか定義が無かった） | `logs/run-*/workspace/test-v5-fixed/f-tothrow-empty.test.ts` に同定義が存在（実物からの転記） |
| 7 | suggestion 4 / H 節に 5 側の実測値 | B | 「5 に上げて変わったのは `VITEST_WORKER_ID` だけ」→「5.0.0-rc.1 では `VITEST_WORKER_ID=1` / `VITEST_POOL_ID=1` で、変わったのは `VITEST_WORKER_ID` だけ（0 → 1）でした」 | 出典ログ 項目別結果表（H 行）の 5.0.0-rc.1 実測値。端末出力の捏造は避け、本文の数値記述のみ追加 |

## 削除した記述（分類C で削ったもの）

なし（削減が必要な、裏付けの無い記述は検出されなかった）。

## 未解消の指摘

なし。

## 未適用（任意判断）

| # | 指摘（重大度） | 未適用の理由 |
|---|---|---|
| 1 | suggestion 3 / 冒頭 `<!-- 前提: ... -->` コメント | レビュー側が「既存の公開済み記事も同様で慣行どおり。意図的な運用なら現状維持で問題なし」としているため、既存記事との一貫性を優先して残した |

## 警告

- 機械チェックの WARN 2件（`title が長い: 74文字` / `秘密情報の疑い [user-path]`）は修正前と同一で、レビューレポートで false positive と判定済み（74 はバイト数で実文字数 36、パスは全て `/Users/.../` にマスク済み）。今回の修正で行番号のみ変動している。
- 秘密情報・実キーの混入なし。git 履歴に関する懸念もなし。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/vitest5-rc-breaking-changes.md (slug=vitest5-rc-breaking-changes) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=27 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 74文字 (60字目安)
[PASS] emoji あり: 🧪
[PASS] topics 5個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 162,165,167,188,265,286,596
SUMMARY fail=0 warn=2
```

## 次のアクション

- [ ] `/review-article articles/vitest5-rc-breaking-changes.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
