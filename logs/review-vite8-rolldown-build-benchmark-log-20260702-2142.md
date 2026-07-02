# 公開前レビュー: Vite 8（Rolldown）ビルド時間ベンチ / vite8-rolldown-build-benchmark-log

## レビューの前提

- 対象記事: articles/vite8-rolldown-build-benchmark-log.md
- 出典ログ: logs/run-vite8-rolldown-20260702-2116/execution-log.md
- レビュー日時: 2026-07-02 21:42
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug妥当 / 秘密情報なし）すべてクリア。
  - 事実整合: 記事の主要な数値・コマンド・エラー・結論がすべて出典ログに裏付けられており、ログを超えた断定・創作は検出されなかった。
  - 機械チェック `fail=0 warn=0`、参照画像6枚すべて実在、孤立画像・プレースホルダなし。
  - blocker / warning 0 のため、Front Matter を `published: true` にして push してよい状態。

## 最優先で直すべき指摘（上位3件）

いずれも suggestion（任意）。公開をブロックするものはない。

1. [suggestion] 冒頭 line 9 の前提コメント — 公開前に削除を検討（内部ログパスの露出。HTMLコメントで非表示だがソースには残る）。
2. [suggestion] タイトル line 2「8倍速のはずが実際は1.9倍」— 数値自体はログ裏付けありだが、やや煽り気味。読了後の納得感を優先するなら現状維持で可。
3. [suggestion] line 170 の dev 起動ログ `ready in 167 ms` と、後述の計測値 `108/107/107 ms` の関係を一言補足すると混乱が減る。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | line 9 `<!-- 前提: 出典ログ ... -->` | 内部ログパス（`logs/run-...`）が公開ソースに残る。Zennでは非レンダリングだが GitHub 上では見える | 公開直前に削除すると内部構成を露出しない。制作履歴として残す判断でも可 |
| 2 | line 2 タイトル | 「8倍速のはず」の主語（＝バンドル処理のみ8x／全体は1.9x）は本文で説明済みだが、タイトル単独ではやや誇張的 | 期待値と結論のギャップを狙う構成として有効。気になるなら「バンドルは8倍でもビルド全体は1.9倍」等に調整可 |
| 3 | line 170 | 環境構築時の初回起動 `ready in 167 ms` と、計測節（line 222）の `108/107/107 ms` が別物であることが暗黙 | 「初回起動の値。計測は別途3回取得」と一言添えると値の食い違いに読者が戸惑わない |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 34字・汎用でない・ローカル重複なし / 秘密情報・個人パスなし |
| Front Matter | OK | title/emoji(⚡)/type(tech)/topics(5)/published すべて妥当。title 53字 |
| 事実性（ログ照合） | OK | 数値・コマンド・エラー・結論すべてログ裏付けあり。創作なし |
| 画像 | OK | 参照6枚すべて実在・alt付き・孤立画像なし。ログの screenshots/ から連番リネーム済み |
| Markdown構造 | OK | コードフェンス28行（偶数）/ ::: 6行（偶数）/ 見出し階層正常 |
| 文章品質・トーン | OK | 経験談トーン・詰まった点3件を具体的に記載・環境/バージョン明記 |
| 完成度 | OK | 要素材マーカー・プレースホルダなし。再現手順あり |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「完了条件はすべて達成」↔ ログ「完了条件の判定: **達成**」→ **一致**
- 主要数値の突合（記事 ↔ ログ）:
  - 比較表（line 300-302 ↔ ログ line 40-42）: build cold built in 8.0x / real 1.9x / dev 1.05〜1.14x → **完全一致**
  - Vite7 build cold `built in` 1.47/1.39/1.39s・real 3.00/2.59/2.57s・dev 108/107/107ms（line 222 ↔ ログ line 122）→ **一致**
  - Vite8 build cold 185/173/167ms・real 1.49/1.36/1.33s・dev 100/106/102ms・592.47KB/1235modules（line 257 ↔ ログ line 141）→ **一致**
  - rolldown-vite `built in 214ms` / `vite/7.3.1` / deprecated（line 320-324 ↔ ログ line 155-165）→ **一致**
  - 所要時間 見積4.0h→実測0.5h（line 329 ↔ ログ line 12）→ **一致**
- コマンド/エラー: peer 不一致 WARN・TS7016 エラー全文・rolldown 依存確認コマンドいずれもログの実行ログと一致。創作コードなし（store.ts/App.tsx/Dashboard.tsx はログ line 100 の作成記録に対応）。
- 予測外の事象（Invalid key 警告の不発）も記事・ログで整合。
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/vite8-rolldown-build-benchmark-log.md (slug=vite8-rolldown-build-benchmark-log) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=34 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 53文字
[PASS] emoji あり: ⚡
[PASS] topics 5個
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/01-vite7-dev-home.png
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/02-vite7-dev-dashboard.png
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/03-vite7-preview.png
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/04-vite7-preview-dashboard.png
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/05-vite8-preview.png
[PASS] 画像あり: /images/vite8-rolldown-build-benchmark-log/06-vite8-preview-dashboard.png
[PASS] コードフェンスが閉じている: フェンス行=28
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

補足: `images/vite8-rolldown-build-benchmark-log/` に配置された画像は6枚のみで、本文参照と1:1で対応（孤立画像なし）。

## 適用した修正（修正適用時のみ）

なし（修正適用は指定されていないため非破壊）。

## 次のアクション

- [ ] （任意）上記 suggestion 3件を必要に応じて反映する
- [x] blocker / warning は 0 件 — 追加修正なしで公開可能
- [ ] Front Matter を `published: true` に変えて `git push`（もしくは `/publish-pr` でPR作成）で公開
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
