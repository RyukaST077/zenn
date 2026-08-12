# 修正適用レポート: node26-context-log-test-log-attribution

## 採用した前提

- 対象記事: `articles/node26-context-log-test-log-attribution.md`（引数で明示指定）
- レビューレポート: `logs/review-node26-context-log-test-log-attribution-20260812-1630.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`（引数で明示指定）
  - 併せて `workspace/reporters/group.mjs` / `workspace/field-diff.mjs` /
    `workspace/results/data-payload.txt` の生ファイルを直接確認
- 適用範囲: blocker ＋ warning（既定）。suggestion は安全・機械的なものだけ適用
- slug リネーム: 指摘なし → 実施せず
- 過去の修正レポート: `logs/revise-...-20260812-1621.md`（1回目）。前回「修正不能」とした指摘は
  無く、同一指摘の再来によるループは発生していない
- 修正日時: 2026-08-12 16:38

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 適用内容 |
|---|---|---|---|---|
| 1 | warning #1 | 「帰属先を復元してみる」`reporters/group.mjs` のコードブロック先頭 | B ログ由来の補完 | 生ファイル1行目のコメント `// test:log を testId でグルーピングし直して、並行実行で混ざったログを復元する` を復活させた。これでブロックが14行になり、584行「14行でここまで来る」・724行「14行の reporter で」と一致する（レビューが提示した2案のうち、生ファイルどおりで最も正確な前者を採用。行数表記は変更していない） |
| 2 | warning #2 | 「環境構築とバージョンゲート」193行 | C 削減修正 | 3文目の前半「`--experimental-*` を促すヒントも出ないので、」を削除し、「フラグで有効化できる類のものでもなさそうです。いずれにせよ 26.6 未満を〜」に短縮。1文目の「`--experimental-何か` を促すヒントは一切出ません」は残し、同一段落内の二重記述を解消 |
| 3 | suggestion #1 | 761行付近（`:::message alert` 1項目目） | C 削減修正 | 「フラグでは有効化できない」→「`--experimental-*` を促すヒントも出ない（有効化する手段は見つからなかった）」。本文193行の観測範囲に強さを揃えた |
| 4 | suggestion #5 | 451行付近 | C 削減修正 | 「`console.log({ cb: () => 'nope' })` なら何の問題もなく出ていた」→「`console.log` に同じオブジェクトを渡すぶんには落ちないので」。`workspace/` に出力ファイルが無い記述なので、実測物を匂わせない書き方に寄せた |
| 5 | suggestion #2 | 「`JSON.stringify` した時点で〜」`inspect` 出力ブロック前後 | B ログ由来の補完 | ブロック直前に「出力は4件のうち1件目（`fetched user`）のみ抜粋します。」を追加。さらに直後の段落に、`results/data-payload.txt` 24〜54行から `no payload at all` / `primitive payload` / `array payload` の `message` と `data` の行だけを抜粋したブロックを追加し、「`data` 無し・プリミティブ・配列」の記述を実測で裏付けた |
| 6 | suggestion #3 | 「フィールド差分」`node field-diff.mjs` 実行の直後 | B ログ由来の補完 | `:::details field-diff.mjs（全文）` を追加し、`workspace/field-diff.mjs` を逐語で掲載。中心図表（フィールド差分表）の再現性が閉じた |

件数: blocker 0件 / warning 2件（すべて適用）/ suggestion 4件適用・3件スキップ。

### 修正の根拠となった一次情報

- `workspace/reporters/group.mjs`: `wc -l` = 14、1行目が上記コメント行。記事へは逐語で復活させた
- `workspace/field-diff.mjs`: 25行を逐語で掲載（絶対パス等は含まれない）
- `workspace/results/data-payload.txt` 24〜54行: 追加した3件の `message` / `data` 行はここからの
  逐語抜粋。ファイル内の絶対パス行は記事に持ち込んでいない（マスク不要化のため抜粋対象外）

## スキップした指摘

| # | 重大度 | 指摘 | スキップ理由 |
|---|---|---|---|
| 4 | suggestion | `topics` の `test` / `testing` が実質重複 | レビュー自身が「Zenn の妥当性としては現状でも問題なし」としており、露出面の最適化は事実性・公開安全に影響しない。前回 revise で `nodetest`→`test` に変更した直後でもあり、往復を避けて現状維持 |
| 6 | suggestion | `:::message`（19〜21行）と「使ったもの・環境」の環境情報が二重 | 導入部の構成変更にあたり「意味を保つ最小修正」の範囲を超える。前回 revise から繰り越しのスキップ（判断を変えていない） |
| 7 | suggestion | 9行の前提コメント `<!-- 前提: ... -->` | Zenn 上は非表示で害がなく、パイプライン追跡情報として意図的に残す。レビューも「意図的に残すなら現状維持で可」としている |

## 未解消の指摘

なし（blocker 0 / warning 2件はすべて解消済み）。

## 補足・申し送り

- `published: false` を維持していることを最終確認済み。
- 秘密情報・個人パスの新規混入なし（追加した抜粋は絶対パス行を含まない）。
- 追加した `:::details` と抜粋ブロックにより、コードフェンス行が74→78、`:::` 行が6→8に増えたが、
  いずれも対応が取れており機械チェックは PASS。

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
[PASS] コードフェンスが閉じている: フェンス行=78
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 次のアクション

- `/review-article articles/node26-context-log-test-log-attribution.md` で再レビュー
- 判定が「公開可」になったら `/publish-pr` へ
