# 修正適用レポート: node26-context-log-test-log-attribution

## 採用した前提

- 対象記事: `articles/node26-context-log-test-log-attribution.md`（引数で明示指定）
- レビューレポート: `logs/review-node26-context-log-test-log-attribution-20260812-1619.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`（引数で明示指定）
  - 併せて `workspace/results/fail-26.5.txt` の生ファイルを直接確認
- 適用範囲: blocker ＋ warning（既定）。suggestion は安全・機械的なものだけ適用
- slug リネーム: 指摘なし → 実施せず
- 過去の修正レポート: なし（本記事に対する初回の revise）
- 修正日時: 2026-08-12 16:21

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 適用内容 |
|---|---|---|---|---|
| 1 | warning #1 | 「環境構築とバージョンゲート」166〜169行 | C 削減修正 | 見出し文を `26.5.0 側の出力（全文）:` → `` 26.5.0 側の出力（`node --test` 以降の抜粋）: `` に変更し、出力ブロック先頭の `v26.5.0` の1行を削除。これで記事に示した `nvm use 26.5.0` / `node --test --test-reporter=spec probe.test.mjs` の再現結果と、貼った出力の先頭行が一致する |
| 2 | suggestion #1 | 「`entryFile` と組み合わせる」節・出力ブロック直前 | B ログ由来の補完 | 「※ 以下の出力は、パスを末尾2階層に短縮して表示しています。」を1文追加。根拠は出典ログ627行の注記「`results/entryfile.txt` / パスは末尾2階層に短縮して表示」 |
| 3 | suggestion #2 | 194行 | C 削減修正 | 「フラグで有効化できるものでもないので、26.6 未満を〜」→「`--experimental-*` を促すヒントも出ないので、フラグで有効化できる類のものでもなさそうです。いずれにせよ 26.6 未満を〜」。未実測の断定を観測範囲（ヒントが出ない）に寄せた |
| 4 | suggestion #3 | Front Matter `topics`（5行） | A 機械修正 | `nodetest` → `test`。`topics` は4個のまま |

件数: blocker 0件 / warning 1件（すべて適用）/ suggestion 3件適用・2件スキップ。

### 修正の根拠となった一次情報

- `results/fail-26.5.txt` の1行目 `v26.5.0` / 2行目 `typeof t.log check via runtime below` は
  いずれも検証ハーネスの `node -v` と `echo` によるもので、記事のコマンド列からは出ない。
  記事に足すのではなく、ハーネス由来の1行目を落として「抜粋」と明示する方向で解消した
  （ログに無い記述の書き足しはしていない）。
- `entryFile` のパス短縮は出典ログ627行の注記どおり。記事側で新たな加工はしていない。

## スキップした指摘

| # | 重大度 | 指摘 | スキップ理由 |
|---|---|---|---|
| 4 | suggestion | `:::message` と「使ったもの・環境」で環境情報が二重 | 導入部の構成を変える書き直しになり、「意味を保つ最小修正」の範囲を超える。任意の改善提案であり、事実性・公開安全には影響しない。再レビューで warning 以上に上がった場合に対応する |
| 5 | suggestion | 9行の前提コメント `<!-- 前提: ... -->` | レポート自身が「現状は害なし」としており、パイプラインの追跡情報として意図的に残す判断。Zenn 上では HTML コメントのため表示されない |

## 未解消の指摘

なし（warning はすべて解消）。

## 補足・申し送り

- 194行を観測範囲に寄せた一方で、末尾の `:::message alert`（760行付近）の
  「フラグでは有効化できない」は出典ログ744行の申し送り文言そのままであり、ログに裏付けが
  あるためチェックリスト行としては変更していない。表現の強さを揃えたい場合は再レビューで指摘可。
- 秘密情報のマスク漏れは検出されず（`grep '/Users/'` 0件）。git 履歴に関する警告事項なし。
- `published: false` を維持していることを最終確認済み。

## セルフチェック結果（scripts/check-article.sh 再実行）

```
== check-article: articles/node26-context-log-test-log-attribution.md (slug=node26-context-log-test-log-attribution) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=39 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 43文字
[PASS] emoji あり: 🪵
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 次のアクション

- `/review-article articles/node26-context-log-test-log-attribution.md` で再レビュー
- 判定が「公開可」になったら `/publish-pr` へ
