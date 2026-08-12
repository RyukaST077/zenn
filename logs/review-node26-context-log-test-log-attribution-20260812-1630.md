# 公開前レビュー: Node 26.6のt.log()を試したら、ログに帰属が付くのはイベント側だけだった / node26-context-log-test-log-attribution

## レビューの前提

- 対象記事: `articles/node26-context-log-test-log-attribution.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`（引数で明示指定）
  - 併せて `workspace/*.test.mjs` / `workspace/reporters/*.mjs` / `workspace/field-diff.mjs` /
    `workspace/results/*`（`type-module.txt` / `parentid-check.txt` / `data-payload.txt` /
    `data-payload-errors.txt` / `commands.log`）の生ファイルと突合した
- レビュー日時: 2026-08-12 16:30
- 修正の適用: なし（レポートのみ・非破壊）。引数に修正適用の指定が無かったためデフォルトを採用
- 公開基準: 標準（引数に強弱の指定なし）
- 参考: 本記事は2回目のレビュー。前回 `logs/review-...-20260812-1619.md` の warning 1件は
  `logs/revise-...-20260812-1621.md` で解消済みであることを本文で確認した
  （出力見出しが `（node --test 以降の抜粋）` に変わり、`v26.5.0` の1行が削除されている。
  `entryFile` のパス短縮注記も 696行に追加されている）

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 2 件 / suggestion: 7 件
- 根拠（判定を決めた主な指摘）:
  - warning #1: `reporters/group.mjs` を「14行」と2箇所で書いているが、記事に貼ってある
    コードは13行（生ファイル先頭のコメント行を落としているため）。読者が数えると合わない。
  - warning #2: 193行の段落内で「`--experimental-*` を促すヒントは出ない」という同一の観測を
    2回書いている（前回の revise で文を足した際の重複と見られる）。
- 公開安全（`published: false` / slug / 秘密情報・個人パス）は全項目クリア。
  `grep '/Users\|katayama\|@casareal'` は0件で、生ファイルの絶対パスは `/path/to/` に
  マスクされている。
- 事実性は今回も全面的にログ・生ファイルと一致し、**創作・誇大・ログを超えた断定は検出されなかった**。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「帰属先を復元してみる」584行 ＋「まとめ」724行 — `group.mjs` を「14行」と
   書いているが、551〜565行に貼ったコードブロックは13行。生ファイルは先頭に
   `// test:log を testId でグルーピングし直して、並行実行で混ざったログを復元する` という
   コメント行があって14行。
   **直し方**: コードブロック先頭にそのコメント行を復活させる（生ファイルどおりで最も正確）か、
   584行「14行でここまで来る」と724行「14行の reporter で」を「13行」に直す。どちらか一方。
2. [warning] 「環境構築とバージョンゲート」193行 — 段落の1文目
   「`--experimental-何か` を促すヒントは一切出ません」と3文目
   「`--experimental-*` を促すヒントも出ないので、フラグで有効化できる類のものでもなさそうです」が
   同じ事実の二重記述になっている。
   **直し方**: 3文目の前半を削って
   「フラグで有効化できる類のものでもなさそうです。いずれにせよ 26.6 未満をサポートする
   プロジェクトでは単純に使えません。」にする（1文目は残す）。
3. [suggestion] 761行（`:::message alert` の1項目目） — 「フラグでは有効化できない」と断定して
   いる一方、本文193行は revise で「〜類のものでもなさそうです」と観測範囲に弱められており、
   強さが食い違う。
   **直し方**: 761行を「フラグで有効化するヒントも出ない（有効化手段は見つからなかった）」等、
   本文と同じ強さに揃える。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「帰属先を復元してみる」551〜565行 / 584行 / 724行 | `group.mjs` を「14行」と2箇所で書いているが、貼ったコードは13行。生ファイルの先頭コメント行を落としているため自己矛盾している | コードブロック先頭に `// test:log を testId でグルーピングし直して、並行実行で混ざったログを復元する` を復活させる、または「14行」→「13行」（584行・724行の2箇所）に統一 | `workspace/reporters/group.mjs`（`wc -l` = 14、1行目がコメント）／出典ログ574行「全文14行」 |
| 2 | 「環境構築とバージョンゲート」193行 | 同一段落で「`--experimental-*` を促すヒントは出ない」を2回述べている（編集の重複と読める） | 3文目を「フラグで有効化できる類のものでもなさそうです。いずれにせよ 26.6 未満を〜」に短縮し、重複部分を削除 | 記事193行の文面／`logs/revise-...-1621.md` 修正#3（この文を追記した記録） |

> 重大度の補足: チェックリストは「冗長」を suggestion に割り当てているが、#2 は同一段落内での
> 同一事実の二重記述であり、修正記録から**直前の編集で入った未整理の跡**と特定できるため、
> 公開前に直すべき warning に上げた（機械チェックでは検出されない種類）。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなる／どう直すか |
|---|---|---|---|
| 1 | 761行（`:::message alert`） | 「フラグでは有効化できない」の断定が、本文193行の弱めた表現と不整合 | 「有効化のヒントも出ない／有効化手段は見つからなかった」に揃えると、記事全体で観測範囲が一貫する |
| 2 | 「`JSON.stringify` した時点で〜」380〜403行 | 貼った `inspect` 出力は `data.test.mjs` の4イベントのうち1件目のみ。生ファイル `results/data-payload.txt` には `no payload at all` / `primitive payload` / `array payload` の3件も入っている。記事は「全文」と書いていないので誤りではないが、直後の407行で `data` 無し・プリミティブ・配列に言及しているので、出力を見せずに述べている形になる | ブロック直前に「（1件目のみ抜粋）」を入れるか、`data: undefined` と `data: 123` の2件を数行だけ足すと、407行の記述が実測で裏付けられて読める |
| 3 | 「フィールド差分」521〜527行 | `node field-diff.mjs` を実行しているが `field-diff.mjs` のコードが記事に無く、読者はこのコマンドを再現できない | `:::details field-diff.mjs（全文）` で `workspace/field-diff.mjs` を折りたたみ掲載すると、中心図表の再現性が閉じる |
| 4 | Front Matter 5行 `topics` | `testing` と `test` が実質重複（前回 revise で `nodetest`→`test` に変更した結果） | `test` を `node` など別軸のトピックに替えると露出面が広がる。Zenn の妥当性としては現状でも問題なし |
| 5 | 451行 | 「`console.log({ cb: () => 'nope' })` なら何の問題もなく出ていた」は出典ログ468行の記述が根拠で、`workspace/` にこれを実行した出力ファイルは無い（記事＞ログではないので事実性違反ではない） | 「`console.log` に同じオブジェクトを渡すぶんには落ちないので」等、実測物の範囲を匂わせない書き方にすると安全側 |
| 6 | 19〜21行（`:::message`）と 23〜28行（「使ったもの・環境」） | Node/OS/依存ゼロの情報が2箇所に重複している | どちらかに寄せると導入が短くなる（前回レビューからの繰り越し。revise では構成変更を避けてスキップ済み） |
| 7 | 9行 `<!-- 前提: 出典ログ ... -->` | パイプライン追跡用コメントが残存（Zenn 上は非表示なので害はない） | 公開版から消すなら publish 直前に削除。意図的に残すなら現状維持で可 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 39字・具体的で `articles/` 内に重複なし / 秘密情報・個人パス 0件（絶対パスは `/path/to/` にマスク済み） |
| Front Matter | OK | title 43字・誇大表現なし、type=tech、topics 4個。`test`/`testing` の重複は suggestion 止まり |
| 事実性（ログ照合） | OK | 下記「事実整合の照合結果」参照。数値・出力・コードすべて裏付けあり。唯一の数値ずれ（14行 vs 13行）は warning #1 |
| 画像 | OK（対象外） | スクショ0枚の CLI 検証。`/images` 参照なし＝ログの「画像は不要」と一致 |
| Markdown構造 | OK | フェンス74行で閉、`:::` 6行で閉、H2/H3 のみで階層破綻なし、リンク4本すべて実在ドメイン・プレースホルダなし |
| 文章品質・トーン | 要修正 | 経験談トーン・詰まった点・再現性は十分。193行の重複（warning #2）と `:::message alert` の強さ不一致 |
| 完成度 | 要修正 | `要素材`・プレースホルダ残存なし。行数表記の自己矛盾（warning #1）のみ |

## 事実整合の照合結果（ログとの突合）

- 結論: 記事「確かめられたのは…／分からないまま残ったことが2つ」 ↔ ログ「完了条件4件すべて達成、
  未解決として残した事実が2件（循環参照のデシリアライズ失敗 / `parentId` が常に 0）」 → **一致**
- 主要な主張の裏付け（すべて生ファイルまで確認）:
  - spec 出力12行（209〜224行）＝ `results/reporter-spec.txt` と一致。tap / dot 全文も一致
  - フィールド差分表（531〜543行）＝ `results/field-diff.md` と完全一致。「76行（log 26 / diagnostic 50）」も一致
  - 帰属表（612〜619行）・suite 表（667〜672行）＝ `results/attribution.md` と一致
  - 並行実行の before（44〜68行）／after（569〜582行）＝ `results/concurrency.txt` と一致
  - `TypeError: t.log is not a function`（168〜191行）＝ `results/fail-26.5.txt`（ハーネス由来の1行目を
    落として「抜粋」と明記済み。前回 warning の解消を確認）
  - `ERR_MODULE_NOT_FOUND` 全文と「終了コードは 7」＝ ログ313行 `exit=7` と一致
  - `type: module` 忘れの警告と「exit code は 0」＝ `results/type-module.txt`（末尾 `exit=0`）と一致
  - 関数ペイロードの `could not be cloned.` / 循環参照の `Unable to deserialize cloned data.` ＝
    `results/data-payload-errors.txt` と一致。`--test-isolation=none` で両方通る点も
    `commands.log` 35〜36行（`exit=1` → `exit=0`）と `data-payload-errors.txt` 59〜70行で裏付け
  - `parentId` が常に `0`（631〜637行）＝ `results/parentid-check.txt` と一致（分離あり／なし両方）
  - 貼ったテストコード6本・reporter 3本は `workspace/` の実ファイルと**逐語一致**（`group.mjs` の
    先頭コメント1行のみ欠落 → warning #1）
- 誇大・ログ超えの断定: **検出なし**。ログの申し送り3点（①「読めるようになる」と書かない
  ②実測5分を書かない ③絶対パスをマスク）はいずれも守られている（584行で明示的に訂正、
  時間の記述なし、パスは `/path/to/`）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

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

`[INFO] /images 参照なし` は false positive ではなく妥当（出典ログ「スクショ 0 枚 / 画像は不要」）。

## 適用した修正

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [ ] warning #1（`group.mjs` の 14行/13行）と warning #2（193行の重複文）を直す
- [ ] 可能なら suggestion #1（`:::message alert` の強さ揃え）と #3（`field-diff.mjs` の掲載）も
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr`（Front Matter を `published: true` にして PR）
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
