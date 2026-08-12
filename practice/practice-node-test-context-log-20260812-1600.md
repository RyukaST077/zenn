# 実践タスク: node:test の `context.log()` と `test:log` イベントで「このログはどのテストのものか」を取り戻す

## このタスクの前提

- 出典レポート: `research/search-topic-20260812-1553.md`
- 元テーマ: テーマ1 /「node:testの`context.log()`を`console.log`/`t.diagnostic`と書き比べ、`test:log`をカスタムreporterで拾ってみた」（レポートの「最初に試すべき1本」）
- 対象技術: Node.js 26.6.0 で追加された標準テストランナーの `context.log(message[, data])` と `test:log` イベント（PR #64389 / SEMVER-MINOR）
- 記事の方向性（記事タイプ）: 「試してみた」＋「既存3手段との書き比べ」＋「イベントの実ダンプ」
- 想定筆者 / 想定読者: Web系の新人エンジニア / `node --test` を使い始めた新人〜実務2年目、CIでテストログが読みづらいと感じている人
- 検証に使える想定時間: 半日（合計 約3時間50分）
- 判断方針: 引数は対象レポートのパスのみ指定。テーマ・時間・スキルレベルは未指定のため、テーマは出典レポートの「最初に試すべき1本」、時間は「半日〜1日」のうち半日、想定筆者は新人エンジニアというデフォルト前提を採用した
- 実行環境の担保: Node.js の CLI とローカルファイルだけで完結する。認証・課金・外部通信・ブラウザ操作は一切不要（したがって Playwright も不要で、完了確認はすべて CLI 出力と JSON ダンプで行う）。**必要な Node バージョンがローカルに導入済みであることを実機確認した**（`~/.nvm/versions/node` に `v26.7.0` と `v26.5.0`）

### 事前に裏取りした一次情報（このタスク作成時に実機＋一次情報で確認済み）

| 確認したこと | 結果 | 出典 |
|---|---|---|
| リリースと該当PR | `context.log()` と `test:log` は **v26.6.0（2026-08-03）** の Notable Changes。`test_runner: add context.log() and test:log event`（PR #64389, SEMVER-MINOR, Moshe Atlow, commit `bb51f2c960`）。同リリースで `entryFile` も追加（PR #64309） | [Node.js v26.6.0 リリースノート](https://nodejs.org/en/blog/release/v26.6.0) |
| API シグネチャ | `log(message[, data])`。**`TestContext` と `SuiteContext` の両方**に追加。第2引数は「不透明な構造化ペイロード」で加工されずイベントに載る | PR #64389 / ローカル実機 |
| 設計意図（PR本文） | 「テストツリーを非バッファで描画する reporter に、**キャプチャした stdout では実現できない live で帰属つきのログ経路**を与える」。`test:diagnostic` はバッファされ**定義順**に出るのに対し、`test:log` は**即時・実行順**に出る（プロセス分離下でもファイル単位の宣言順バッファを迂回する） | [nodejs/node PR #64389](https://github.com/nodejs/node/pull/64389)（2026-07-12 merge） |
| 組み込み reporter での見え方 | PR 本文では「組み込み reporter は `test:diagnostic` と同一に描画する」。ただし**出力位置は異なる**ことを実機確認（下記） | PR #64389 / ローカル実機 |
| `test:log` の実フィールド | `name` / `nesting` / `testId` / `parentId` / `message` / `data`（渡した場合のみ） / `line` / `column` / `file` / `entryFile` | ローカル実機（カスタム reporter で JSON ダンプ） |
| `test:diagnostic` の実フィールド | `nesting` / `message` / `level` / `line` / `column` / `file` / `entryFile`。**`name` / `testId` / `parentId` が無い** = テストへの帰属情報を持たない | ローカル実機（同上） |
| 26.5.0 との差 | 26.5.0 では `typeof t.log === 'undefined'`（機能なし）。26.7.0 では `'function'`。**エラーにならず静かに undefined** なので、呼ぶと `TypeError: t.log is not a function` になる | ローカル実機（`nvm use` で両方実行） |
| spec reporter での出力位置（実機） | `context.log()` は**テスト結果行（`✔ probe`）より前**に `ℹ via context.log` として出た。`t.diagnostic()` は**テスト結果行より後**に出た。これが「即時・実行順」対「バッファ・定義順」の可視化になる | ローカル実機 |
| サブテストへの帰属（実機） | 親 `testId:2` の中のサブテストのログは `name:"child" / nesting:1 / parentId:2 / testId:8` として出た。**`testId` は実行順の採番で連番ではない** | ローカル実機 |
| 失敗テストでの帰属（実機） | throw する直前の `t.log()` も、失敗テスト名に正しく帰属して出力された | ローカル実機 |
| 並行実行での帰属（実機） | `concurrency: true` で待ちを挟んだテストのログ2本が、どちらも同じ `testId` / `name` を保って出た（インターリーブしても帰属が壊れない） | ローカル実機 |
| Stability | テストランナーモジュール本体は **Stability: 2 - Stable**。`context.log()` 個別の stability 表記は公式 HTML から取得しきれなかったため **要確認**（フェーズ1で `test.html#contextlogmessage-data` を直接読んで引用する） | [Node v26.x docs `test.html`](https://nodejs.org/docs/latest-v26.x/api/test.html) |

> 注意: 手元に **26.6.0 そのものは無く 26.7.0（26.6の機能を含む）と 26.5.0** がある。記事では「26.6.0 で追加された機能を 26.7.0 で検証し、26.5.0 を機能なしの対照にした」と正確に書く。

## 完成イメージ（成果物）

- 作るもの: 依存パッケージゼロの最小 Node プロジェクト。①3種のログ（`console.log` / `t.diagnostic()` / `t.log()`）を同一テストに仕込んだテストファイル群、②`test:log` と `test:diagnostic` を購読して全フィールドを JSON でダンプするカスタム reporter、③各パターンの出力全文を保存した `results/` ディレクトリ
- 「できた」と言える完了条件:
  1. `results/` に spec / tap / dot の3 reporter × 3種ログの出力全文が保存されている
  2. カスタム reporter の JSON ダンプで、`test:log` に `name` / `testId` / `parentId` があり `test:diagnostic` には無いことが**自分の実行結果として**示されている
  3. 並行実行・サブテスト・失敗テストの3パターンで、ログの帰属先を示した比較表が埋まっている
  4. Node 26.5.0 で `t.log()` を呼んだ失敗ログ（`TypeError`）が保存されている
- 完了確認の方法: すべて CLI 出力と保存済みテキスト/JSON ファイルの差分で判定する（ブラウザ確認・Playwright は不要）
- 記事タイトル案（そのまま使える形）:
  1. `node --test` のログが「どのテストのものか」分からない問題は、Node 26.6 の `context.log()` で終わった
  2. Node 26.6 の `context.log()` を `console.log` / `t.diagnostic` と書き比べたら、出力位置まで違った
  3. `test:log` イベントを自作 reporter で拾ったら、`test:diagnostic` に無いフィールドが3つあった

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**（課金・サインアップ・外部通信なし）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js **26.7.0**（本命 / 26.6 の機能を含む）と **26.5.0**（機能なしの対照）。どちらも `~/.nvm/versions/node` に導入済みを確認済み。切り替えは `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26.7.0`
- [ ] インストールするもの: **追加インストールなし**（Node 標準機能のみ / `package.json` も最小1ファイル）
- [ ] 無料枠 / コストの確認: **費用ゼロ・完全オフラインで完走できる**
- [ ] 記録用の準備: 作業ディレクトリ `practice-work/node-test-context-log/` を作り、その中に `results/`（出力全文の保存先）と `NOTES.md`（記録テンプレの実体）を用意する
- [ ] 環境情報の記録: `node -v` / `sw_vers -productVersion` / `uname -m` を `results/env.txt` に保存する

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] v26.6.0 のリリースノートで `test_runner: add context.log() and test:log event`（PR #64389）と SEMVER-MINOR 表記を確認し、引用する行をコピーする（目安: 10分）
  - 記録すること: リリース日（2026-08-03）、PR番号とコミットハッシュ、同リリースの他項目（`entryFile` の PR #64309 / FFI `getCurrentEventLoop`）。「テストログ周りが一度にまとめて強化された」という文脈
- [ ] 公式 API ドキュメント `test.html` の `context.log(message[, data])` と `Event: 'test:log'` の項を直接読み、**stability 表記と `data` 引数の説明を verbatim で引用**する（目安: 10分）
  - 記録すること: `context.log` に experimental 表記があるか無いか（**このタスク作成時に確定できなかった箇所。ここで必ず自分の目で確認する**）。ドキュメントに載っているフィールド一覧と、後で実測するフィールド一覧のズレ
- [ ] PR #64389 の本文を読み、「なぜ `console.log` や `t.diagnostic` では足りないのか」を自分の言葉で2〜3行にまとめる（目安: 10分）
  - 記録すること: 「非バッファ reporter に live で帰属つきのログ経路を与える」という設計意図。`test:diagnostic` は**バッファ・定義順**、`test:log` は**即時・実行順**という対比。記事の「なぜこの技術を試すのか」にそのまま使う

### フェーズ2: 環境構築（目安: 25分）

- [ ] `practice-work/node-test-context-log/` を作り、`results/` と `NOTES.md`、`{"type":"module"}` だけの `package.json` を置く（目安: 5分）
  - 記録すること: 追加依存が本当にゼロで済んだか。`type: module` を付けなかった場合に何が起きるか（付け忘れは新人が踏む定番）
- [ ] 26.7.0 と 26.5.0 で `node -v` と `node -e "console.log(typeof require('node:test').test)"` を実行し、`results/env.txt` に環境情報を保存する（目安: 5分）
  - 記録すること: `nvm use` の切り替えコマンド全文、OS / arch。バージョン切り替えを記事の再現手順として書けるようにする
- [ ] 3種のログを1テストに並べた `probe.test.mjs` を書き、26.7.0 で `node --test --test-reporter=spec` を実行して**動くこと**を確認する（目安: 10分）
  - 記録すること: 初回実行の出力全文。`console.log` / `t.diagnostic` / `t.log` の**3行がどの順で並んだか**（実機では `context.log` が結果行の前、`t.diagnostic` が後に出た）。この「順番の違い」に気づいた瞬間をメモする
- [ ] 同じファイルを **26.5.0** で実行し、`t.log is not a function` で落ちるログを `results/fail-26.5.txt` に保存する（目安: 5分）
  - 記録すること: エラー全文とスタックトレース。「26.5 では `typeof t.log` が `undefined`」＝機能の有無がバージョンで静かに変わる事実。記事冒頭の「バージョンゲート」節に使う

### フェーズ3: 実装・検証【本編】（目安: 110分）

- [ ] `probe.test.mjs` を spec / tap / dot の3 reporter で実行し、出力全文を `results/reporter-{spec,tap,dot}.txt` に保存する（目安: 20分）
  - 記録すること: 3種のログが reporter ごとにどう表現されるか（`ℹ` 接頭辞 / TAP コメント `#` / dot での扱い）。**`console.log` だけは reporter の構造に乗らず素のまま出る**はずなので、その差を明示する。「組み込み reporter は test:log を test:diagnostic と同一に描画する」という PR の記述が自分の出力でも成り立つか
- [ ] `test:log` と `test:diagnostic` を購読し、イベントオブジェクトを1行 JSON でダンプするカスタム reporter（`reporters/dump.mjs`）を書く（目安: 25分）
  - 記録すること: reporter の実装全文（async generator で `source` を回すだけの十数行）。`--test-reporter=./reporters/dump.mjs` の**相対パス指定でハマったか**。ダンプ結果を `results/events.jsonl` に保存
- [ ] ダンプから `test:log` と `test:diagnostic` の**フィールド一覧を突き合わせ**、差分表を `NOTES.md` に作る（目安: 20分）
  - 記録すること: `test:log` にあって `test:diagnostic` に無い3フィールド（`name` / `testId` / `parentId`）。逆に `test:diagnostic` だけが持つ `level`。両方が持つ `file` / `entryFile` / `line` / `column`。**この表が記事の中心的な図表になる**
- [ ] `t.log('msg', { ... })` の第2引数に構造化データを渡し、イベントの `data` フィールドに**加工されず載る**ことを確認する（目安: 15分）
  - 記録すること: 渡したオブジェクトとダンプ結果の一致。ネストした配列/オブジェクトが保持されるか。循環参照や関数を渡したときにどうなるか（試して壊れたらそれも素材）
- [ ] サブテスト（`t.test()`）・`describe`/`it`・失敗テストの3パターンでログの帰属を確認し、`nesting` / `testId` / `parentId` の値を表にする（目安: 20分）
  - 記録すること: サブテストが `nesting:1` / `parentId:<親のtestId>` を持つこと。**`testId` は実行順の採番で連番にならない**という気づき。throw する直前の `t.log()` も失敗テスト名に正しく帰属したこと
- [ ] `concurrency: true` で待ちを挟んだテストを複数走らせ、ログがインターリーブしても `testId` / `name` で帰属が復元できることを確認する（目安: 10分）
  - 記録すること: インターリーブした出力全文。同じ `console.log` を並行実行で流したときの「どのテストのものか分からない」状態との対比。**これが記事の主題そのもの**なので、before/after を並べて貼る

### フェーズ4: 深掘り・比較（目安: 40分）

- [ ] `SuiteContext` にも `log()` があることを確認し、`describe` 直下から呼んだときのイベントを見る（目安: 10分）
  - 記録すること: suite から呼んだときの `name` / `nesting` の値。テスト単位のログとスイート単位のログを使い分けられるか
- [ ] `entryFile` が `file` と食い違うケースを作る（テストファイルから別ファイルを import してそこでログを出す / `--test` に渡すファイルを変える）（目安: 15分）
  - 記録すること: `file` と `entryFile` が同じになったケースと違ったケース。同リリースで入った `entryFile`（PR #64309）が何を指すのかを実測で言い切る。**分からなければ「ここまでは確認できた」と範囲を明示して書く**
- [ ] 3手段の使い分け方針（`console.log` / `t.diagnostic()` / `t.log()`）を、実測にもとづく判断基準として3行でまとめる（目安: 15分）
  - 記録すること: 「帰属が要る/要らない」「構造化データを載せたい」「reporter で機械処理したい」の軸。**26.6 未満をサポートするなら使えない**という実務上の制約も必ず書く

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] `NOTES.md` を見返して詰まった点を棚卸しし、★印を付けて記事の見せ場を決める（目安: 15分）
  - 記録すること: 見積もりと実測の差が大きかったタスク。予想と違った挙動（順番の違い・`testId` の非連番など）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋め、貼る出力ファイルを見出しごとに割り当てる（目安: 15分）
  - 記録すること: 各見出しに対応する `results/` のファイル名。素材が足りない見出しがあれば、そこだけ追加実行する

> 目安時間の合計: 約 3時間50分（30 + 25 + 110 + 40 + 30 = 235分。半日の想定内に収まっている）

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `TypeError: t.log is not a function` で落ちる | 実行中の Node が 26.6.0 未満。26.5.0 では `typeof t.log === 'undefined'` で、**フラグ違いのようなエラーメッセージは出ない**（実機確認済み） | `node -v` を確認 → `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26.7.0` | 「バージョンで静かに存在しない API」の失敗ログとして冒頭に置く。読者が最初に踏む壁 |
| 2 | 3種のログの出力順が想定と違う | `test:log` は**即時・実行順**、`test:diagnostic` は**バッファされ定義順**に出る（PR #64389 の設計）。実機では spec reporter で `context.log` が結果行の前、`t.diagnostic` が後に出た | 3種を同一テストに並べて1回実行し、出力の並びをそのまま貼って観察する | 「同じに見える2つの API が出力位置で違う」ことを実測で示す。仕様書の翻訳では出てこない情報 |
| 3 | カスタム reporter が読み込めない / 何も出ない | `--test-reporter` の値がパス解決できていない（`./` 無しの相対指定）、または `export default` が async generator になっていない | `--test-reporter=./reporters/dump.mjs` と `./` 付きで指定し、まず全イベントを無条件にダンプして届いているか確かめる | 「reporter を自作する最小形」を十数行のコードで示す。ここは新人がいちばん躓く |
| 4 | `test:diagnostic` に `name` が無くて集計できない | `test:diagnostic` は帰属情報（`name` / `testId` / `parentId`）を持たない設計。サマリ行（`tests 7` など）も同じイベントで流れてくる | ダンプを両イベントで並べ、フィールドの有無を機械的に比較する（`jq` かスクリプトで keys を取る） | 差分表がそのまま記事の中心図表になる。「なぜ従来は集計できなかったのか」の答え |
| 5 | サマリ行まで自作 reporter に混ざる | `tests` / `pass` / `duration_ms` などのサマリも `test:diagnostic` として流れる（実機確認済み） | `data.name` の有無や `level` フィールドでフィルタする | 「イベントを購読したら想定外のものまで来た」という具体的なつまずき |
| 6 | `type: module` を付け忘れて import 構文で落ちる | `package.json` に `"type": "module"` が無いと `.mjs` 以外で ESM が使えない | 拡張子を `.mjs` にするか `package.json` に `type` を足す | 依存ゼロでも最小設定は要る、という前置き。短くていいので触れておく |
| 7 | 並行実行のログがインターリーブして読めない | `concurrency` 有効時は複数テストが同時に進むため出力が混ざる（これは**バグではなく主題**） | インターリーブしたまま保存し、`testId` でグルーピングし直すスクリプトを書く | before（`console.log` で混ざって読めない）/ after（`test:log` で復元できる）の対比。記事の山場 |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を `NOTES.md` に都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（`console.log` / `t.diagnostic`）と比べて感じた違い:
- 保存した出力ファイル（`results/` のどれ）:
- 記事に書きたい気づき（★印を付ける）:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・`results/env.txt` | Node 26.6 でテストランナーに入った小さな API を1つだけ試した、という宣言。検証環境（Node 26.7.0 / 26.5.0、OS、arch）を明記 |
| 2. なぜこの技術を試すのか | フェーズ1の PR #64389 まとめ、フェーズ3の並行実行タスク | 「テスト中の `console.log` がどのテストのものか分からない」問題。PR の「live で帰属つきのログ経路」という設計意図を引用 |
| 3. 事前に調べたこと | フェーズ1の全記録 | リリースノート（PR #64389 / SEMVER-MINOR / 2026-08-03）、API ドキュメントの stability 表記、`test:diagnostic` はバッファ・定義順で `test:log` は即時・実行順という対比 |
| 4. 環境構築（Node バージョンの確認） | フェーズ2の記録、`results/fail-26.5.txt` | `nvm use` の手順と、26.5.0 で `t.log is not a function` になったエラー全文。「26.6 未満では静かに存在しない」という最初のゲート |
| 5. 実際に試したこと（3種のログ比較・reporter ごとの出力） | フェーズ3の前半、`results/reporter-*.txt` | 3種のログを並べたテストコード全文と、spec / tap / dot の出力全文。**出力位置の違い**を並べて見せる |
| 6. 詰まった点 | 詰まりポイント表・記録テンプレの★ | reporter のパス解決、サマリ行の混入、`type: module` 忘れ。エラー全文と解決過程 |
| 7. 触ってみて分かったこと（カスタム reporter で取れる情報） | フェーズ3の後半、`results/events.jsonl` | reporter 実装全文と `test:log` / `test:diagnostic` のフィールド差分表。`data` 引数が加工されず載ること。`nesting` / `parentId` でツリーを復元できること |
| 8. 既存技術と比べて感じたこと | フェーズ4の使い分けまとめ | `console.log` / `t.diagnostic()` / `t.log()` の3軸での使い分け。`SuiteContext` にもある話、`entryFile` の実測 |
| 9. どんな人に向いていそうか | フェーズ4・5 | CI のログを機械処理している人、並行実行でログが読めない人。逆に 26.6 未満をサポートするなら使えないという制約 |
| 10. まとめ | フェーズ5の棚卸し | 新人が半日で確かめられた範囲の明示と、確かめきれなかったこと（stability 表記の解釈など）を正直に書く |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない
- **26.6.0 そのものではなく 26.7.0 で検証した**ことを正確に書く（26.6 で入った機能を、26.6 を含む 26.7 で確認した）
- リリースノートの記述だけを根拠に挙動を断定せず、必ず自分の実行結果を貼る
- うまくいった点だけでなく、詰まった点と解決過程を書く
- テストランナー本体は Stable だが、この API 個別の stability 表記はフェーズ1で確認した内容を引用する
- 公式ドキュメント・PR へのリンクを入れ、再現手順（Node バージョン・OS・arch）を明記する

## 参考リンク

- 公式ドキュメント: [Node.js v26.x `test` API](https://nodejs.org/docs/latest-v26.x/api/test.html)（`context.log(message[, data])` と `Event: 'test:log'` の項）
- リリースノート: [Node.js v26.6.0](https://nodejs.org/en/blog/release/v26.6.0) / [GitHub Release v26.6.0](https://github.com/nodejs/node/releases/tag/v26.6.0)
- 実装 PR: [nodejs/node#64389 `test_runner: add context.log() and test:log event`](https://github.com/nodejs/node/pull/64389)
- 関連 PR: [nodejs/node#64309 `test_runner: report entryFile in TestStream events`](https://github.com/nodejs/node/pull/64309)

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: **なし**。追加依存ゼロ・外部通信なしでオフライン完走できる
- ライセンス / 規約: Node.js 標準機能のみ（MIT）。引用はリリースノートと PR 本文からの短い引用に留め、出典 URL を必ず併記する
- セキュリティ（APIキーの扱い等）: 秘密情報を一切扱わない。ただし `results/` に絶対パス（`/Users/<name>/...`）が入るため、**記事に貼る前にパスをマスクする**
- 撤退ライン: フェーズ3のカスタム reporter が45分たっても動かない場合は、`--test-reporter=tap` の出力テキストからの読み取りに切り替え、「reporter 自作でつまずいた」ことを記事の詰まった点として書く。フェーズ4の `entryFile` 調査は20分で切り上げ、「確認できた範囲まで」として書く（ここは記事の主題ではない）

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` で実行）
- [ ] 記録テンプレ（`NOTES.md`）を埋めながら進める
- [ ] 完了条件4つを満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/draft-article`）
