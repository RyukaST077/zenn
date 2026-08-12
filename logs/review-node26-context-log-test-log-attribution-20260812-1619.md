# 公開前レビュー: Node 26.6のt.log()を試したら、ログに帰属が付くのはイベント側だけだった / node26-context-log-test-log-attribution

## レビューの前提

- 対象記事: `articles/node26-context-log-test-log-attribution.md`（引数で明示指定）
- 出典ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`（引数で明示指定）
  - 併せて `logs/run-node-test-context-log-20260812-1603/workspace/results/*` の生ファイル、
    および `workspace/*.test.mjs` / `workspace/reporters/*.mjs` の実物と突合した
- レビュー日時: 2026-08-12 16:19
- 修正の適用: なし（レポートのみ・非破壊）。引数に修正適用の指定が無かったためデフォルトを採用
- 公開基準: 標準（引数に強弱の指定なし）

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 5 件
- 根拠（判定を決めた主な指摘）:
  - warning #1: 「26.5.0 側の出力（全文）」として貼ったブロックが、実ファイル
    `results/fail-26.5.txt` の2行目を落としており、かつ残した1行目 `v26.5.0` が
    記事に示したコマンド（`nvm use` → `node --test`）からは出ないため、読者が再現すると
    出力が一致しない。
- 公開安全（published / slug / 秘密情報）は 3項目すべてクリア。事実性は下記のとおり
  ほぼ全面的にログ・生ファイルと一致しており、**創作・誇大の混入は検出されなかった**。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「環境構築とバージョンゲート」節・166〜192行（`26.5.0 側の出力（全文）`）
   — 出力ブロック先頭の `v26.5.0` は検証スクリプトが `node -v` で出した行であり、
   直前に示した `nvm use 26.5.0` / `node --test ...` では出ない。
   **直し方**: 直前のコマンドブロック（160〜164行）に `node -v` を1行足して
   `nvm use 26.5.0` / `node -v` / `node --test --test-reporter=spec probe.test.mjs` にする。
   または出力ブロックから `v26.5.0` の1行を削り、`（全文）`→`（抜粋）` に変える。
   （生ファイル2行目の `typeof t.log check via runtime below` は検証ハーネスの echo なので、
   記事に足す必要はない。`全文` という語だけ外すのが最小修正）
2. [suggestion] 「`entryFile` と組み合わせる」節・697〜701行 — 引用した JSON の
   `"file":"workspace/entry.test.mjs"` は、出典ログ側で「パスは末尾2階層に短縮して表示」と
   注記されている加工後の値。記事には注記が無く、相対パスが実際に出るように読める。
   **直し方**: コードブロック直前に「※ パスは末尾2階層に短縮して表示しています」を1文追加。
3. [suggestion] 194行 — 「フラグで有効化できるものでもないので」は、出典ログでも
   「フラグでは有効化できない」と書かれてはいるが、実際にフラグを試した記録は無い
   （観測されたのは「`--experimental-*` を促すヒントが出ない」ことまで）。
   **直し方**: 「`--experimental-*` を促すヒントも出ないので、フラグで有効化できる類の
   ものでもなさそうです」のように観測範囲に寄せる。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「環境構築とバージョンゲート」166〜192行 | `26.5.0 側の出力（全文）` と書いたブロックが、実ファイル `results/fail-26.5.txt` の2行目（`typeof t.log check via runtime below`）を落としている。一方で同じくハーネス由来の1行目 `v26.5.0` は残しているため、記事のコマンドを再現しても先頭行が一致しない | 160〜164行のコマンドブロックに `node -v` を追加する（推奨）。または出力から `v26.5.0` を削り、見出し文を `（全文）`→`（抜粋）` に変える | `results/fail-26.5.txt`（1行目 `v26.5.0` / 2行目 `typeof t.log check via runtime below`）と記事の突合 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 697〜701行（`entryFile`） | 引用 JSON のパスが短縮済みである注記が無い | 「相対パスで出る」という誤解を防げる。出典ログの注記（627行）と整合する |
| 2 | 194行 | 「フラグで有効化できるものでもない」が未実測の断定 | 観測範囲に寄せることで、記事全体で貫かれている「実測したことだけ書く」姿勢と揃う |
| 3 | Front Matter `topics`（5行） | `nodetest` は Zenn の一般的なトピック名として定着しておらず、流入が期待しにくい | `nodetest` → `testing` は既にあるので `test` や `ci` 等、より読者の多いトピックに替えると露出が増える（`topics` は4個で上限5個には余裕あり） |
| 4 | 19〜21行の `:::message` と 23〜28行「使ったもの・環境」 | 環境情報（macOS 26.5 / v26.7.0 / v26.5.0 / 依存ゼロ）がほぼ同内容で二重に書かれている | どちらかに寄せると導入が締まる。`:::message` は「筆者の経験レベル」＋バージョン一行に絞るのが読みやすい |
| 5 | 9行の前提コメント `<!-- 前提: 出典ログ ... -->` | パイプライン内部のメタ情報。公開しても表示はされないが、リポジトリ上には残る | 公開前に消すか、意図的に残すかを一度決めておくと後続記事でも迷わない（現状は害なし） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / slug 39文字・具体的・`articles/` 内で重複なし（`node26-*` は8本あるが本 slug と衝突する名前は無し）/ 秘密情報の検出なし。**生ファイルに含まれる `/Users/katayamaryuunosuke/...` は記事側で `/path/to/` 等に全てマスク済み**（`grep '/Users/'` → 0件） |
| Front Matter | OK | title 53文字・誇大表現なし・emoji 1つ・type=tech・topics 4個。`nodetest` の妥当性のみ suggestion |
| 事実性（ログ照合） | OK（warning 1件） | 下記「事実整合の照合結果」参照。創作コード・創作エラー・裏付け無しの数値は検出されず |
| 画像 | OK | 画像参照 0 件。出典ログが「ブラウザ確認不要・スクショ0枚」と明記しており（16行・679〜681行）、CLI 検証のため画像なしは妥当。チェックリストの「スクショ無しは warning」は本記事では該当しないと判断した |
| Markdown構造 | OK | フェンス74行（偶数）/ `:::` 6行（偶数）/ H2・H3 の階層が破綻なし（機械チェックが拾った `## 2026-08-03,...` や `# via console.log` はすべてコードフェンス内で、見出しではない）/ 参考リンク4本すべて実在する GitHub URL |
| 文章品質・トーン | OK | 「詰まった点」に6件が具体的に記述。予想が外れた箇所（`console.log` は素のまま出るはず／`type: module` 忘れは落ちるはず／固有フィールドは3つのはず）を正直に書いており経験談トーンが一貫。再現性（OS/arm64/Node 2バージョン/依存ゼロ）明記済み |
| 完成度 | OK | `要素材` マーカー0件・プレースホルダ0件。再現手順・注意点リスト・未解決事項2件まで揃っており、公開に耐える |

## 事実整合の照合結果（ログとの突合）

- **結論の一致**: 記事「まとめ」（721〜725行）↔ ログ「結果サマリー / 完了条件の検証」（19〜35行）
  → **一致**。ログは完了条件4件すべて達成、未解決として残した事実が2件（循環参照の
  デシリアライズ失敗の理由 / `parentId` が `undefined` にならない理由）。記事も同じ2件を
  「分からないまま残ったこと」として明記している。達成の過大申告も、逆の過小申告も無い。
- **ログが最も強く警告していた点への対応**: ログの申し送り（701行）は
  「『`context.log` を使えば並行実行のログが読めるようになる』と書くと**嘘になる**」と
  していた。記事は 17行（はじめに）・585行（帰属先を復元してみる）・719行（向いていそうか）の
  3箇所で「イベントには帰属が載っているが組み込み reporter は捨てて描画する／読むには
  reporter を自作する必要がある」と正しく書き分けている。**このレビューで最も重視した点だが、問題なし。**
- **引用の verbatim 検証**（記事の主張の土台になっている出力を生ファイルと1文字単位で突合）:
  | 記事の箇所 | 突合先 | 結果 |
  |---|---|---|
  | 212〜225行 spec 出力「全文」 | `results/reporter-spec.txt`（12行） | 完全一致 |
  | 237〜257行 tap 出力「全文」 | `results/reporter-tap.txt`（19行） | 完全一致 |
  | 261〜263行 dot 出力「全文」 | `results/reporter-dot.txt`（1行） | 完全一致 |
  | 168〜192行 26.5.0 の `TypeError` | `results/fail-26.5.txt` | 2行目のみ欠落（→ warning #1）。`TypeError: t.log is not a function` とスタック5行は一致 |
  | 200〜204行 `MODULE_TYPELESS_PACKAGE_JSON` 警告 | `results/type-module.txt` | 一致（`(Use node --trace-warnings ...)` の1行のみ省略。206行の「exit code は 0」も `exit=0` と一致） |
  | 299〜318行 `ERR_MODULE_NOT_FOUND` と「終了コードは 7」 | ログ291〜313行 / `exit=7` | 一致 |
  | 327〜337行 dump の JSON 10行・「10件のうち8件がサマリ」 | ログ316〜328行 | 一致（サマリ8行を実数で確認） |
  | 382〜403行 `inspect` 出力 | `results/data-payload.txt` | 一致（`Map(1) { 'k' => 'v' }` / `Uint8Array(3) [ 1, 2, 3 ]` / `line: 13`）。408行の「`data` を渡さない場合は `data` キーが付かない」「`123` / `['a','b']` もそのまま載る」も同ファイルの `data: undefined` / `data: 123` / `data: [ 'a', 'b' ]` で裏付けあり |
  | 423〜448行 `could not be cloned.` 全文 | ログ417〜444行 / `results/data-payload-errors.txt` | 一致 |
  | 466〜486行 `Unable to deserialize cloned data.` | ログ445〜465行 | 一致 |
  | 488行「`--test-isolation=none` なら両方通る（関数は `data: { cb: [Function: cb] }`）」 | `results/data-payload.txt`（`data: { cb: [Function: cb] }` / `exit=0`） | 一致 |
  | 532〜544行 フィールド差分表・「76行（log 26 / diagnostic 50）」 | `results/field-diff.md`（`test:log=26 test:diagnostic=50`、26+50=76） | 一致。「固有は4つ（`data`/`name`/`parentId`/`testId`）対 `level` の1つ」も一致 |
  | 613〜620行 tree の帰属表（testId 1/5/6/7/3/4） | ログ495〜502行（`results/attribution.md`） | 完全一致 |
  | 668〜673行 suite の帰属表 | ログ597〜602行 | 完全一致 |
  | 44〜67行 並行実行の spec 出力 / 570〜582行 group.mjs の出力 | ログ532〜556行 / 559〜573行（`results/concurrency.txt`） | 完全一致 |
  | 632〜637行 `parentId` の観測 | `results/parentid-check.txt` | 一致（見出し行・分離あり/なし両方で `parentId: 0`。絶対パスは記事側で `...` に省略済み） |
  | 697〜700行 `file` vs `entryFile` | `results/entryfile.txt` | 一致（ただしパス短縮の注記が無い → suggestion #1） |
- **貼ったコードの実物照合**: `probe.test.mjs` / `data.test.mjs` / `conc.test.mjs` /
  `tree.test.mjs` / `suite.test.mjs` / `entry.test.mjs` / `lib/imported-tests.mjs` /
  `reporters/{dump,inspect,group}.mjs` はいずれも `workspace/` の実ファイルと一致。
  **創作コードは無し**。行番号の整合も取れている（例: `data.test.mjs` の `test(...)` は
  実ファイルでも13行目で、イベントの `line: 13` と一致。26.5.0 のスタックの `:6:5` は
  `probe.test.mjs` の `t.log` 行と一致）。「group.mjs は14行」「dump.mjs は7行相当」も実物どおり。
- **記事に持ち込まれていないログの内部メタ（適切に除外されている）**:
  - 実測時間「約5分」（AI単独実行値。ログ12行・702行が「記事にそのまま書かない」と指示）→ 記事に**記載なし**。◎
  - 実行者がAIエージェント単独である旨（ログ11行が「記事に転記しない」）→ 記事に**記載なし**。◎
  - `TaskCreate` が使えなかった環境制約（ログ17行）→ 検証内容に無関係なので不記載で正しい。◎
  - 見積もり時間（235分）やフェーズ別の見積もり→実測 → 不記載。AI実測値との対比は誤解を招くため妥当。◎
- **創作の疑いがある記述**: なし。
- **数値の裏付け無し**: なし（`0.614875ms` 等の計測値もすべて生ファイル由来）。
- **残存する `要素材` マーカー**: 0 件。

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

機械チェックの false positive の切り分け:

- `[INFO] /images 参照なし` … 出典ログが「ブラウザ確認不要・スクショ0枚」と明記した CLI 検証
  のため問題なし。指摘に数えない。
- 見出し階層の目視時、`## 2026-08-03, Version 26.6.0 (Current), @aduh95` や `# via console.log`、
  `# tests 1` 等が `#` 始まりで現れるが、**すべてコードフェンス内の引用**であり Markdown の
  見出しとしては解釈されない。構造上の問題なしと判断した。

## 適用した修正

なし（修正適用の指定が無かったため、記事本文は一切変更していない）。

## 次のアクション

- [ ] warning #1（26.5.0 出力の `全文` 表記／`node -v` の追加）を直す
- [ ] 併せて suggestion #1（`entryFile` のパス短縮注記）も直すと、引用の扱いが記事全体で揃う
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` に本レポートを渡してもよい）
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` にして PR を作る
      （main へのマージ＝公開。「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
