# 修正適用レポート: スクロール完了を await で待つChrome 150の新API / scroll-promise-await-vs-settimeout-scrollend

## 採用した前提

- 対象記事: `articles/scroll-promise-await-vs-settimeout-scrollend.md`（published: false のまま維持）
- レビューレポート: `logs/review-scroll-promise-await-vs-settimeout-scrollend-20260721-0417.md`（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: `logs/run-scroll-promises-20260721-0407/execution-log.md`
- 適用範囲: blocker ＋ warning（suggestion は安全・機械的なもののみ任意適用）
- slug リネーム: なし（指摘なし）
- 過去の修正レポート: 同 slug の `logs/revise-*.md` は無し（初回修正・ループなし）

## 適用サマリー

- 適用: 3 件（warning 1 / suggestion 2）
- スキップ: 1 件（suggestion 1・意図的判断）
- 未解消: 1 件（warning・機械チェックの仕様上解消不能。下記参照）
- セルフチェック: `SUMMARY fail=0 warn=1`（published:false 維持）

## 指摘ごとの対応

### warning

| # | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|
| 1 | Front Matter `title`（2行目） | C 削減（短縮） | 適用（ただし機械WARNは仕様上残存） | 67字 → **60字** に短縮 |

- 変更: `"スクロール完了を await で待てるChrome 150の新APIを、setTimeout / scrollend と書き比べてみた"`（67字）→ `"スクロール完了を await で待つChrome 150の新API、setTimeout / scrollend と比較"`（60字）
- 意味は保持（await でスクロール完了を待つ Chrome 150 新API を setTimeout / scrollend と比較する、という主旨）。冗長な「待てる／を、」「書き比べてみた」を圧縮。
- **未解消として記録**: `check-article.sh` の title 長判定は `wc -m` を**ロケール未設定（C ロケール）で実行するためバイト数を数える**（日本語1文字＝3バイト）。そのため 60 バイト以下は日本語タイトルでは事実上到達不能で、短縮後も `[WARN] title が長い: 94文字` が残る（60字＝94バイト）。レビューレポートが示した基準「60**字**」は文字数の意図であり、その意味では 60 字ちょうどに収まっている。バイト基準WARNは blocker ではないため、Step 6（未解消 warning は明記して続行）に従い保存する。

### suggestion

| # | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|
| 1 | 画像 01/02/03 が完全同一 | C 削減 | 適用 | 3枚→1枚に集約。重複画像2枚を削除 |
| 2 | 冒頭 `<!-- 前提: ... -->` コメント | — | スキップ（意図的に残す） | リポジトリ規約・トレーサビリティのため保持 |
| 3 | 参考リンク節の生URL | 体裁 | 適用 | 本文と同じタイトル付きリンクに統一 |

- **suggestion 1（画像集約）適用**: 出典ログでも 01/02/03 は「いずれも +400ms 静定後のため Section 5＝最終位置が写る」「手法Cの途中検知は数値 detectY=3379 に表れスクショには出ない」と記録されており、実ファイルも md5 `f576…` でバイト単位同一だった。読者が別々の証拠と誤解しないよう、本文（旧163-169行）を「3手法とも静定後は同じ Section 5 に落ち着き、差は検知時の detectY に出る」と明記したうえでスクショを 1 枚に集約。参照を失う `02-method-b-scrollend.png` / `03-method-c-settimeout.png`（01と同一画像）は孤立画像化を避けるため削除した（情報の欠落なし。原本は出典ログの `screenshots/` に存在）。手法Cの `detectY=3379` の説明・最終位置3828の記述はそのまま保持。
- **suggestion 2（参考リンク）適用**: 末尾の生URL 5件を、本文38-44行で既に使っているタイトル付きリンク表記に統一（URL・タイトルは本文からの転記のみ。新規情報の追加なし）。
- **suggestion 3（前提コメント）スキップ**: このコメントは本リポジトリの**公開済み記事でも保持されている規約**（例: `articles/…bun-cookiemap…`（published:true）も同形式のコメントを残置）。Zenn 上は非表示で害がなく、`review-article` が出典ログを辿る手がかりにも使う。消し忘れではなく意図的に残す判断とし、変更しない。

## 捏造していないことの確認

- 追加・変更した記述はすべて出典ログ（execution-log.md）由来。新しい数値・成功・コード・画像は書き足していない。
- 画像は削除のみ（重複ファイル）。新規スクショの追加・生成はしていない。
- タイトル短縮・リンク体裁・画像集約はいずれも既存の一次情報の範囲内。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=44 (12-50)
[WARN] title が長い: 94文字 (60字目安)   ← バイト数判定のため日本語では解消不能（本文参照）
[PASS] 画像あり: /images/…/01-method-a-await.png
[PASS] 画像あり: /images/…/04-intoview-workaround.png
[PASS] コードフェンスが閉じている: フェンス行=24
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし / プレースホルダ残りなし / 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- 修正前 `warn=1`（title）→ 修正後も `warn=1`（同 title・バイト基準）。画像同一性の suggestion は解消（残り画像 01/04 はいずれも参照済み・孤立なし）。
- `published: false` を維持していることを最終確認済み。

## 未解消の指摘（再レビューの判断に委ねる）

- warning 1: `title` のバイト基準 WARN。文字数基準（レビューの意図する 60 字）は満たしたが、`check-article.sh` の実装（Cロケールでの `wc -m` = バイト数）上、日本語タイトルでは 60 バイト以下にできず WARN が残る。ツール側の仕様に起因する残存であり、記事本文の問題ではない。

## 次のアクション

- `/review-article articles/scroll-promise-await-vs-settimeout-scrollend.md` で再レビュー。
- 公開可になったら `/publish-pr` で公開（published:true 化＋PR）。
</content>
</invoke>
