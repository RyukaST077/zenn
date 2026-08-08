# 実践タスク: Node 26.7 の `--test-coverage-include-all` で「テストされていないファイル」を炙り出す

## このタスクの前提

- 出典レポート: `research/search-topic-20260809-0403.md`
- 元テーマ: テーマ2 / 「Node 26.7 の `--test-coverage-include-all` で「テストされていないファイル」を炙り出す」（レポートの「最初に試すべき1本」）
- 対象技術: Node.js 26.7.0 の標準テストランナー（`node --test`）のコードカバレッジ
- 記事の方向性（記事タイプ）: 「試してみた」＋「数字の落差を書き比べた」
- 想定筆者 / 想定読者: Web系の新人エンジニア / `node --test` でテストを書き始めた新人〜実務2年目、c8・nyc から乗り換えを検討している人
- 検証に使える想定時間: 半日（約3時間45分）
- 判断方針: 引数はレポートパスのみ指定。テーマ・時間・スキルレベルは未指定のため、テーマは出典レポートの「最初に試すべき1本」、時間は「半日〜1日」のうち半日、想定筆者は新人エンジニアというデフォルト前提を採用した
- 実行環境の担保: Node.js の CLI とローカルファイルだけで完結する。認証・課金・外部通信・ブラウザ操作は一切不要（したがって Playwright も不要で、完了確認はすべて CLI 出力とテキスト差分で行う）。**検証機に必要な 2 バージョンが既にインストール済みであることを実機確認した**（`~/.nvm/versions/node` に `v26.7.0` と `v26.5.0`）

### 事前に裏取りした一次情報（このタスク作成時に確認済み）

| 確認したこと | 結果 | 出典 |
|---|---|---|
| リリース日と該当PR | v26.7.0 は 2026-08-05。`test: add support for --test-coverage-include-all`（PR #64830, SEMVER-MINOR） | [nodejs/node Release v26.7.0](https://github.com/nodejs/node/releases/tag/v26.7.0) |
| フラグの意味 | 「テスト実行中に一度も読み込まれなかったソースファイルを、カバレッジ 0% として報告に含める」。候補ファイルは **cwd から探索**され、`--test-coverage-include` / `--test-coverage-exclude` の**同じフィルタが適用される** | [Node v26.x docs `test.html` の `coverageIncludeAll`](https://nodejs.org/docs/latest-v26.x/api/test.html) / PR #64830 |
| `--experimental-test-coverage` の要否 | v26.7.0 でも**カバレッジ本体はまだ experimental**（`--experimental-test-coverage` が必要。Added in v19.7.0, v18.15.0）。`--test-coverage-include-all` 自体は experimental 接頭辞なし | [Node v26.x docs `cli.html`](https://nodejs.org/docs/latest-v26.x/api/cli.html) / ローカルの `node --help` |
| 26.7 と 26.5 のフラグ差 | `node --help` の比較で、**26.7.0 にのみ** `--test-coverage-include-all  include source files that were never loaded in the coverage report` が存在。26.5.0 には無い | ローカル実機（`nvm use 26.7.0` / `26.5.0` で `node --help \| grep coverage`） |
| 旧バージョンでの挙動 | 26.5.0 で同フラグを渡すと `node: bad option: --test-coverage-include-all` | ローカル実機で確認済み |
| 既定の除外 | core modules と `node_modules/` は既定で報告対象外。**テストファイル自身も既定で除外**され、`--test-coverage-exclude` で上書きできる | [Node v26.x docs `test.html`](https://nodejs.org/docs/latest-v26.x/api/test.html) |
| 提案の経緯 | Issue #58887。「`--test-coverage-include` に一致しても未実行ファイルが出ないため、未テストファイルを足すとカバレッジ率が上がってしまう」。istanbul/nyc の `--all` が比較対象。従来の回避策は「全ファイルをテストファイルとして `node --test` に渡す」で、無駄な実行コストがかかった | [nodejs/node Issue #58887](https://github.com/nodejs/node/issues/58887) |

> 要確認（実行時に実機で確かめる）: `--test-coverage-include` を**付けずに** `--test-coverage-include-all` だけを渡したとき、cwd 探索がどこまで広がるか（`test/` 配下や設定ファイルが混ざるか）。ドキュメントの文面からは「既定の除外のみが効く」と読めるが、断定できないので実測する。

## 完成イメージ（成果物）

- 作るもの:
  - 最小の検証リポジトリ `practice-work/node-coverage-include-all/`
    - `src/` に **3 種類**のファイルを配置する
      - (a) テストがあるファイル … `src/greet.js`
      - (b) 他の src から import されるがテストが無いファイル … `src/format.js`
      - (c) **どこからも import されないファイル** … `src/legacy-report.js`, `src/dead-branch.js`
    - `test/greet.test.js` に (a) のテストだけを書く
  - 5〜6 パターンのカバレッジ出力（全文保存）と、それを突き合わせた**差分表**（`results/summary.md`）
- 「できた」と言える完了条件:
  1. `--test-coverage-include-all` **なし**の出力に `src/legacy-report.js` と `src/dead-branch.js` が**現れない**ことを確認できている
  2. `--test-coverage-include-all` **あり**の出力に上記 2 ファイルが **0% で現れる**ことを確認できている
  3. 上記 2 パターンの **総カバレッジ率（all files 行）の数字の落差**が記録されている
  4. Node 26.5.0 で同じコマンドを実行したときの `node: bad option: ...` が全文で記録されている
  5. `results/` に各パターンの出力全文（txt）と差分表が残っている
- 完了確認の方法: CLI 出力（`node --test ...` の標準出力を `tee` でファイル保存）と `diff` の結果。ブラウザ確認要素は無いため Playwright は使わない
- 記事タイトル案（そのまま使える形）:
  1. カバレッジ90%だと思っていたら、未テストのファイルが数えられていなかった（Node 26.7 `--test-coverage-include-all`）
  2. Node 26.7 の `--test-coverage-include-all` を入れたら、カバレッジが何%下がったか実測した
  3. `node --test` のカバレッジが実態より高く出る理由を、新人が5パターン試して確かめた

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**（外部サービス・課金・サインアップを一切使わない）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js **26.7.0**（本命）と **26.5.0**（フラグ無し比較用）。どちらも `~/.nvm/versions/node` に導入済みであることを確認済み。切り替えは `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26.7.0`
- [ ] インストールするもの: 検証本編は**追加インストールなし**（Node 標準機能のみ）。フェーズ4の比較でのみ `c8` を devDependency として入れる（MIT / 無料 / 認証不要）
- [ ] 無料枠 / コストの確認: **費用ゼロ**。ネットワークは npm からの `c8` 取得のみ（フェーズ4を省略すればオフラインでも完走できる）
- [ ] 記録用の準備: 作業ディレクトリ `practice-work/node-coverage-include-all/` を作り、その中に `results/`（出力全文の保存先）と `NOTES.md`（記録テンプレの実体）を用意する
- [ ] 環境情報の記録: `node -v` / `sw_vers -productVersion` / `uname -m` を `results/env.txt` に保存する

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 25分）

- [ ] v26.7.0 のリリースノートで該当 PR (#64830) と SEMVER-MINOR 表記を確認し、引用する行をコピーする（目安: 10分）
  - 記録すること: リリース日（2026-08-05）、PR番号、Notable Changes に並ぶ他の項目（perfetto など）。「なぜこのフラグが今出たのか」の文脈
- [ ] Issue #58887 を読み、「未テストファイルが報告に出ないと何が困るのか」を自分の言葉で1〜2行にまとめる（目安: 10分）
  - 記録すること: nyc/istanbul の `--all` との対応関係、フラグが無かった時代の回避策（全ファイルをテストとして渡す）とその欠点。記事の「なぜこの技術を試すのか」にそのまま使う
- [ ] `node --help | grep -i coverage` を 26.7.0 と 26.5.0 の両方で実行し、出力を `results/help-26.7.txt` / `results/help-26.5.txt` に保存する（目安: 5分）
  - 記録すること: 2 つの help の diff。`--test-coverage-include-all` の**公式の1行説明文**（`include source files that were never loaded in the coverage report`）。カバレッジ本体が今も `--experimental-` 付きである事実

### フェーズ2: 環境構築（目安: 35分）

- [ ] `practice-work/node-coverage-include-all/` を作り、`package.json`（`{"type":"module"}`）と `src/` `test/` `results/` を用意する（目安: 10分）
  - 記録すること: 実行したコマンド。`type: module` にした理由（ESM で書くため）。この時点のディレクトリツリー（`find . -type f` の出力）
- [ ] 3 種類のソースファイルを書く（目安: 15分）
  - `src/greet.js`: テスト対象。分岐を1つ含める（例: 名前が空なら `"Hello, world"`）
  - `src/format.js`: `greet.js` から import される。**関数を2つ export し、うち1つは greet から呼ばれない**（部分カバレッジを作るため）
  - `src/legacy-report.js`: どこからも import しない。関数を2〜3個置く
  - `src/dead-branch.js`: どこからも import しない。`if/else` と `switch` を含め、branch/function カバレッジが 0% になることを見せる
  - 記録すること: 各ファイルの行数と「意図した期待カバレッジ」（自分の予想を先に書いておく → 実測との差が記事のヤマになる）
- [ ] `test/greet.test.js` に `node:test` + `node:assert` で `greet.js` のテストだけを書き、`node --test` が緑になることを確認する（目安: 10分）
  - 記録すること: `node --test` の出力（pass/fail 件数）。**あえて `format.js` と未参照2ファイルのテストは書かない**という設計意図

### フェーズ3: 実装・検証【本編】（目安: 100分）

各パターンは必ず `2>&1 | tee results/<name>.txt` で全文保存する。実行前に「こうなるはず」の予想を `NOTES.md` に書いてから実行する。

- [ ] パターンA: `node --test --experimental-test-coverage` を実行し、`results/A-baseline.txt` に保存する（目安: 15分）
  - 記録すること: 表に現れたファイル一覧（**未参照2ファイルが出ていないこと**）、`all files` 行の line/branch/function %。この数字が「見かけ倒しの90%台」の役
- [ ] パターンB: `--test-coverage-include='src/**'` を足して実行し、`results/B-include.txt` に保存する（目安: 15分）
  - 記録すること: A との diff（`diff results/A-baseline.txt results/B-include.txt`）。**include を付けただけでは未参照ファイルが出ないこと**が確認できたか。glob をシングルクォートで囲む必要があったか（シェルの展開に食われないか）
- [ ] パターンC: さらに `--test-coverage-include-all` を足して実行し、`results/C-include-all.txt` に保存する（目安: 20分）
  - 記録すること: 新たに現れたファイル名と、その行の値（0% 表記の形式）。`all files` 行が B から**何ポイント下がったか**（例: 「92.31% → 61.05%」）。表の行数の増加
- [ ] パターンD: `--test-coverage-include` を**付けず**に `--test-coverage-include-all` だけで実行し、`results/D-include-all-only.txt` に保存する（目安: 20分）
  - 記録すること: cwd 探索の範囲（`test/` 配下や `package.json` 隣の雑多なファイルが混ざるか、`node_modules/` が本当に除外されるか）。C との差。**ここが「要確認」項目**なので、ドキュメントの記述と実測が一致したかを明記する
- [ ] パターンE: Node **26.5.0** に切り替えて同じ C のコマンドを実行し、エラー全文を `results/E-node26.5.txt` に保存する（目安: 15分）
  - 記録すること: `node: bad option: --test-coverage-include-all` の全文と終了コード（`echo $?`）。バージョン差でどう失敗するかは「読者が真似したときに最初に踏む壁」なので必ず残す
- [ ] 5 パターンの「出たファイル一覧」と「総カバレッジ率」を `results/summary.md` の表に手で書き起こす（目安: 15分）
  - 記録すること: 表そのもの（記事の主役）。予想と実測がズレた箇所を★で印を付ける

### フェーズ4: 深掘り・比較（目安: 40分）

- [ ] `--test-coverage-lines=80` をパターンB と C にそれぞれ付けて実行し、**終了コードが変わるか**を確認する（目安: 15分）
  - 記録すること: 各実行の `echo $?`。「include-all を入れた途端に CI が落ちる」という実務インパクトが出るか。しきい値未達時のメッセージ全文
- [ ] `c8` をローカルに入れ、`npx c8 --all node --test` と `npx c8 node --test` を実行して、Node 標準の C パターンと出力を比べる（目安: 25分）
  - 記録すること: c8 の `--all` と `--test-coverage-include-all` で**同じファイルが同じ扱いになるか**、率の値が一致するか。c8 のインストールサイズ・実行時間の体感差。「標準機能で置き換えられそうか」の所感（断定はしない）
  - 省略可: ネットワークを使いたくない場合はここを飛ばし、記事では「未検証」と明記する

### フェーズ5: 振り返り・記事化準備（目安: 25分）

- [ ] `NOTES.md` の記録テンプレを見返して、詰まった点を時系列で棚卸しする（目安: 10分）
  - 記録すること: 詰まりの順番、費やした時間、原因が分かった瞬間のきっかけ
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋め、各見出しに貼る `results/*.txt` の抜粋を選ぶ（目安: 15分）
  - 記録すること: どのログをどこに貼るか。長すぎるログの省略方針（`...` で省く場合は省いた旨を書く）

> 目安時間の合計: 約 3 時間 45 分（25 + 35 + 100 + 40 + 25 = 225分）。半日の想定内。フェーズ4を省くと約 3 時間 5 分。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `--test-coverage-include-all` が `node: bad option` で落ちる | 実行中の Node が 26.7.0 未満。26.5.0 では未実装（実機確認済み） | `node -v` を確認 → `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26.7.0` | 「バージョンで存在しないフラグ」の失敗ログとして冒頭に置く。読者が最初に踏む壁 |
| 2 | カバレッジ表がそもそも出ない | `--experimental-test-coverage` を付け忘れている。v26.7.0 でもカバレッジ本体はまだ experimental | フラグを2つ並べる（`--experimental-test-coverage --test-coverage-include-all`） | 「新フラグだけでは動かない」という前提の説明。バージョンが上がっても experimental が残る事実は読者に有用 |
| 3 | `--test-coverage-include='src/**'` が効かない / 意図しないファイルが入る | シェルが glob を先に展開してしまう、または glob 構文の理解違い（`src/*` と `src/**` の差） | クォートで囲む。`--test-coverage-include` を外した状態と見比べて、どちらの挙動が変わったか切り分ける | 「glob の書式で30分溶かした」は定番の詰まり。クォートあり/なしの出力を並べて見せる |
| 4 | include-all を付けても期待したファイルが 0% で出てこない | 候補探索が **cwd 基準**なので、実行ディレクトリが違う／`node_modules` 等の既定除外に当たっている／include の glob と AND 条件で弾かれている | `pwd` を確認して repo ルートから実行。include を外して範囲を広げてから絞り込む | 「フラグの探索基準は cwd」という一次情報を、失敗を経由して伝える |
| 5 | 未参照ファイルが 0% ではなく想定外の率で出る | ESM の副作用や、テスト以外の経路で読み込まれている（設定ファイル・index からの再export など） | `src/legacy-report.js` を本当にどこからも import していないか `grep -rn legacy-report .` で確認 | 「自分の予想と実測が違った」ポイント。★印を付けて記事の見せ場にする |
| 6 | `--test-coverage-lines=80` を足したら CI 的に落ちる | include-all で分母が増え、しきい値を割るため（意図どおりの挙動） | 終了コードを記録し、しきい値をいくらまで下げれば通るか二分探索する | 「入れた瞬間に赤くなる」実務インパクト。導入時の段階的な下げ方を提案として書ける |
| 7 | 出力が長すぎて記事に貼れない | カバレッジ表はファイル数に比例して伸びる | src を 4 ファイル程度に抑える。貼るときは `all files` 行と該当行だけ抜く | 「省略した」旨を明記する誠実さ。全文は results/ に残した、と書ける |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする（`NOTES.md` に貼って使う）。これがそのまま経験談の一次情報になる。

```md
## <タスク名>
- 実行したコマンド:
- 実行前の予想（重要。先に書く）:
- 出た出力 / エラー（全文。要約しない）:
- 予想との差（★を付ける）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（c8 --all / nyc --all）と比べて感じた違い:
- 保存したログのパス:
- 記事に書きたい気づき:
```

数値は最後に必ずこの形で1行にまとめる:
`パターン<X>: all files = lines xx.xx% / branch xx.xx% / funcs xx.xx% / 出たファイル数 n`

## 記事への写像（タスク → 見出し）

出典レポートの記事構成案（10節）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・環境情報（`results/env.txt`） | Node 26.7 が出たので標準テストランナーの新フラグを1つだけ試した、という宣言。検証環境（Node / OS / arch）を明記 |
| 2. なぜこの技術を試すのか | フェーズ1のIssue #58887 まとめ | 「未テストのファイルが報告に出ないと、カバレッジ率が実態より高く見える」問題を自分の言葉で |
| 3. 事前に調べたこと | フェーズ1の全記録 | リリースノート（PR #64830 / SEMVER-MINOR）、`node --help` の1行説明、`--experimental-test-coverage` が今も必要という事実、nyc `--all` との関係 |
| 4. 環境構築（最小プロジェクトの構成） | フェーズ2の記録 | ディレクトリツリーと 4 ファイルのコード全文。3 種類（テスト有り / import されるがテスト無し / どこからも未参照）を作った意図 |
| 5. 実際に試したこと（パターン比較） | フェーズ3の A〜E と `results/summary.md` | 5 パターンのコマンドと出力抜粋、差分表。**「92% → 61%」のような数字の落差**を主役に |
| 6. 詰まった点 | 詰まりポイント表 + 記録テンプレ | 実際に踏んだものだけを時系列で。`bad option` エラー全文、glob のクォート、cwd 基準の探索。踏まなかった項目は書かない |
| 7. 触ってみて分かったこと | フェーズ3の予想 vs 実測（★印） | include だけでは足りず include-all が必要だった点、0% 行の見え方、探索が cwd 基準である点 |
| 8. 既存技術と比べて感じたこと | フェーズ4の c8 比較 + しきい値の終了コード | c8 `--all` との対応と差。省略した場合は「未検証」と明記 |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | `node --test` を使っていて「カバレッジの数字を信じている」人。既存プロジェクトに後から入れるときの段階的なしきい値設定 |
| 10. まとめ | フェーズ5 | 分かったこと3点と、次に試したいこと（候補#4 の `context.log()` / `test:log`） |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない（experimental な機能なので特に）
- **実行前の予想を先に書いておき、実測とのズレをそのまま出す**。これがこの記事の一番の読みどころになる
- カバレッジ率は「自分のサンプル構成に完全依存する数字」なので、**構成（4ファイルの中身）を全部記事に載せる**
- うまくいった点だけでなく、詰まった点と解決過程を書く。エラーは要約せず全文を貼る
- 公式ドキュメント（cli.html / test.html）、リリースノート、Issue #58887 へのリンクを入れる
- 再現性のため Node のパッチバージョン・OS・CPU アーキテクチャを明記する

## 参考リンク

- 公式ドキュメント:
  - [Node.js v26.x CLI options（`--test-coverage-include-all` / `--experimental-test-coverage`）](https://nodejs.org/docs/latest-v26.x/api/cli.html)
  - [Node.js v26.x Test runner — Collecting code coverage / `coverageIncludeAll`](https://nodejs.org/docs/latest-v26.x/api/test.html)
- リリース情報 / 経緯:
  - [nodejs/node Release v26.7.0（2026-08-05）](https://github.com/nodejs/node/releases/tag/v26.7.0)
  - [PR #64830 test: add support for `--test-coverage-include-all`](https://github.com/nodejs/node/pull/64830)
  - [Issue #58887（提案の経緯 / nyc `--all` との比較）](https://github.com/nodejs/node/issues/58887)
- 比較対象:
  - [c8（`--all` オプション）](https://github.com/bcoe/c8)
- 関連する自分の過去記事（重複回避のため冒頭で差分を示す）:
  - `articles/node-test-randomize-seed-extraction.md`（同じ `node --test` だが機能は順序ランダム化。カバレッジとは別軸）

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: **なし**。ローカル実行のみ。npm 取得はフェーズ4の `c8` だけ
- ライセンス / 規約: Node.js は MIT、c8 は ISC。生成するコードはすべて自作の最小サンプル
- セキュリティ（APIキーの扱い等）: 秘密情報を一切扱わない。ログ全文を記事に貼るため、貼る前に**絶対パスにユーザー名が含まれていないか**確認し、必要なら `~/` に置換する
- 記事の正確性リスク: カバレッジ本体は experimental のため、将来フラグ名や出力形式が変わり得る。記事には**検証時点のパッチバージョンを必ず併記**する
- 撤退ライン:
  - パターンC で未参照ファイルが 0% として現れない場合、30分粘っても再現しなければ「cwd / glob / 既定除外」の切り分けログをそのまま「詰まった記録」として記事化し、そこで検証を止める
  - フェーズ4の c8 でネットワークやインストールに 15分以上かかる場合は打ち切り、「未検証」と明記する

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める（実行前の予想を先に書く）
- [ ] 完了条件5点を満たしたら「記事への写像」に沿って本文ドラフトへ展開する
- [ ] 余った時間で候補#4（Node 26.6 `context.log()` / `test:log`）の下調べに進む
