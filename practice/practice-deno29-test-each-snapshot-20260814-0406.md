# 実践タスク: Deno 2.9 の `Deno.test.each()` / `t.assertSnapshot()` を node:test と書き比べる

## このタスクの前提

- 出典レポート: `research/search-topic-20260814-0402.md`
- 元テーマ: 上位候補1（28点）＝ レポートの「最初に試すべき1本」。引数でテーマ指定が無かったためデフォルト採用
- 対象技術: Deno 2.9 のテストランナー（`Deno.test.each()` / `t.assertSnapshot()`）と、比較対象としての Node.js `node:test`
- 記事の方向性（記事タイプ）: 比較 ＋ 検証ログ（「書き比べてみた」）
- 想定筆者 / 想定読者: Web系の新人エンジニア（Node/TS中心）/ テストを書き始めた新人〜実務2年目
- 検証に使える想定時間: 半日〜1日（本プランの合計目安は約4時間30分）
- 判断方針: 引数は「対象レポート」のみ指定。テーマ・時間・スキルレベルはレポートのデフォルト前提を採用
- 実行環境の担保: すべて CLI（`deno test` / `node --test`）で完結。認証・課金・外部サービス・人手サインアップは一切不要。ブラウザ表示は本編に不要なため、完了確認は CLI 出力の全文保存で行う（フェーズ4の HTML 断片だけ Playwright スクショを撮る）

### ローカル環境の実測（本プラン作成時に確認済み）

```
deno   2.8.3    ← Homebrew 管理（/opt/homebrew/bin/deno -> Cellar/deno/2.8.3/bin/deno）
node   v22.17.0（nvm default）
nvm    導入済み。v26.7.0 / v26.5.0 は **インストール済み**（追加DL不要）
```

> レポートには `nvm install 26` と書かれているが、実測では **v26.7.0 は導入済み**。`nvm use 26.7.0` だけでよい。
> 一方 deno は **Homebrew 管理**のため、`deno upgrade` は「パッケージマネージャ経由でインストールされている」旨のエラーで拒否される可能性が高い（フェーズ2で最初に踏む想定の壁）。

### 裏取りした一次情報（2026-08-14 時点）

| 項目 | 確認内容 | 出典 |
|---|---|---|
| Deno 2.9 リリース日 | 2026-06-25 | deno.com/blog/v2.9 |
| `Deno.test.each` API | `Deno.test.each(cases)(name, fn)`。`Deno.test.only.each` / `Deno.test.ignore.each` もあり。ケースごとに**独立してフィルタ可能な実テスト**を登録 | 同上 |
| 名前補間 | `%s` `%i` `%d` `%f` `%j` `%o`、インデックスは `%#`、オブジェクトは `$a` / `$key.nested` | 同上 |
| `t.assertSnapshot` | `await t.assertSnapshot(value)`。import 不要（`@std/testing/snapshot` と同フォーマット） | 同上 |
| スナップショット保存先 | テストファイル隣の `__snapshots__/<test file>.snap` | 同上 |
| 更新方法 | `deno test --update-snapshots` / `deno test -u`。フル実行時に**未使用エントリは自動 prune**。既定の場所なら read/write 権限フラグ不要 | 同上 |
| node:test のパラメータ化 | **存在しない**（`test.each` 相当の標準APIは無い。`for...of` + `test()` を手書き） | nodejs.org/api/test.html |
| node:test のスナップショット | `t.assert.snapshot(value)`。**v22.3.0 で追加 / v23.4.0 で stable**。保存先はテストファイル名 + `.snapshot`、更新は `--test-update-snapshots`。`t.assert.fileSnapshot(value, path)` もあり | 同上 |

> 要確認（実行時に確かめる）: Node **22.17.0** で `t.assert.snapshot()` が `--experimental-test-snapshots` 無しで動くか。v22 系では experimental 扱いのためフラグが要る可能性がある。**この差自体が記事のネタ**になるので、22 と 26.7 の両方で必ず試す。

## 完成イメージ（成果物）

- 作るもの: 検証用ディレクトリ `tmp-deno29-test/` に、**同じ対象コードに対する Deno 版テストと node:test 版テストの2セット**と、両者の実行ログ・スナップショットファイル一式
  - 対象コード: `add(a, b)`（数値）と `renderHeader({ title })`（HTML断片を返す）
  - Deno 版: `Deno.test.each()` によるパラメータ化 ＋ `t.assertSnapshot()`
  - Node 版: `for...of` + `test()` による手書きパラメータ化 ＋ `t.assert.snapshot()`
- 「できた」と言える完了条件:
  1. `deno --version` が **2.9 系**になった出力を保存できている
  2. `deno test` で `Deno.test.each()` のケースが**ケース単位の個別テスト名**（例: `add(1, 2) = 3`）で出力される
  3. `__snapshots__/*.snap` が生成され、出力を意図的に変えると**失敗し、差分が表示され**、`deno test -u` で更新して再パスするまでのログが揃っている
  4. Node 26.7.0 で同等シナリオが動き、`*.snapshot` ファイルが生成され、`--test-update-snapshots` で更新できている
  5. 「行数 / テスト名の出方 / 失敗時出力 / 更新フロー」の4観点で比較表が埋まっている
- 完了確認の方法: 全コマンドの標準出力・標準エラーを `logs/` にリダイレクトして全文保存（CLI 出力が一次情報）。加えてフェーズ4で `renderHeader()` の HTML を Playwright でスクショ1枚
- 記事タイトル案（そのまま使える形）:
  1. `node:testしか知らない新人が、Deno 2.9のtest.each()とスナップショットを書き比べてみた`
  2. `Deno 2.9のDeno.test.each()とt.assertSnapshot()を、node:testの同等コードと並べて書いた記録`
  3. `パラメータ化テストとスナップショットを「標準機能だけ」で書く：Deno 2.9 vs node:test`

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**（ローカルCLIのみ。課金・サインアップ・外部APIなし）
- [ ] ローカル環境: deno 2.8.3（→2.9 に上げる）/ node v22.17.0 / nvm に v26.7.0 導入済み
- [ ] インストールするもの: Deno 2.9（Homebrew 経由 or 公式インストーラでユーザーローカルへ）。Node は追加DL不要
- [ ] 無料枠 / コストの確認: **すべて無料**。ネットワークは Deno バイナリ取得のみ
- [ ] 記録用の準備: `tmp-deno29-test/`（リポジトリ本体を汚さない作業場）と `tmp-deno29-test/logs/`（全コマンドの出力保存先）を作る。`articles/` `practice/` には途中生成物を置かない

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] deno.com/blog/v2.9 の該当節を読み、`Deno.test.each()` の**配列ケース / オブジェクトケース**の書式と名前補間トークンを手元にメモする（目安: 15分）
  - 記録すること: 公式の例と、自分が「ここは実際に確かめたい」と思った点（`%#` は使えるか、`$a.b` のネストは効くか）。読んで分かったこと／分からなかったことを分けて書く
- [ ] nodejs.org/api/test.html のスナップショット節を読み、`t.assert.snapshot()` の**追加バージョンと stable 化バージョン**、更新フラグ、保存先の拡張子を控える（目安: 15分）
  - 記録すること: 「node:test には `test.each` が無い」ことを公式ドキュメントで確認した事実（比較記事の前提になるので出典URLごと残す）。Node 22 と 26 でスナップショットの扱いが違いそうか、の仮説

### フェーズ2: 環境構築（目安: 45分）

- [ ] 現状のバージョンを記録する（目安: 5分）
  ```bash
  mkdir -p tmp-deno29-test/logs && cd tmp-deno29-test
  { deno --version; which -a deno; node --version; } 2>&1 | tee logs/00-before-versions.txt
  ```
  - 記録すること: `deno 2.8.3` と `/opt/homebrew/bin/deno` の出力。**deno がどこから入っているか**は次のタスクの結果を左右するので必ず残す
- [ ] `deno upgrade` を素直に実行し、成功/失敗をそのまま記録する（目安: 10分）
  ```bash
  deno upgrade 2>&1 | tee logs/01-deno-upgrade.txt
  ```
  - 記録すること: **エラーが出たらメッセージ全文**。Homebrew 管理下の Deno は upgrade を拒否する想定。「公式の案内どおりに叩いたら断られた」瞬間が記事の山場なので、要約せず貼れる形で保存する
- [ ] 上で失敗した場合の代替で 2.9 系を用意し、バージョンを再記録する（目安: 20分）
  - 手段A（推奨・簡単）: `brew update && brew upgrade deno`
  - 手段B（リポジトリを汚さずユーザーローカルに入れる）: 公式インストーラで別パスへ入れ、`DENO_INSTALL` / フルパス指定で使う
  - どちらでも `deno --version` が 2.9 系になればよい
  ```bash
  { deno --version; } 2>&1 | tee logs/02-after-versions.txt
  ```
  - 記録すること: 採用した手段とその理由、所要時間、`2.8.3 → 2.9.x` のバージョン差分。**手段Aで入った版数が 2.9 未満だった場合はそれも記録**して手段Bへ切り替える
- [ ] Node 26.7.0 を使える状態にする（目安: 5分）
  ```bash
  source ~/.nvm/nvm.sh && nvm use 26.7.0 && node --version | tee logs/03-node-version.txt
  ```
  - 記録すること: レポートには `nvm install 26` とあったが、実際は**インストール済みで `nvm use` だけでよかった**という差分。新しいシェルを開くたびに `nvm use` が要る点も
- [ ] 対象コードを作り、両ランタイムから読める形にする（目安: 5分）
  - `src/add.ts`: `export function add(a: number, b: number) { return a + b; }`
  - `src/render.ts`: `export function renderHeader({ title }: { title: string }) { return \`<header><h1>${title}</h1></header>\`; }`
  - 記録すること: Deno と Node で同じ `.ts` を共有できたか、拡張子付き import（`./add.ts`）の要否など、**ランタイム間で書き分けが必要になった箇所**

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] Deno 側: `Deno.test.each()` の**配列ケース**で `add()` のテストを書き、テスト名の出方を確認する（目安: 20分）
  ```bash
  deno test tests_deno/add_test.ts 2>&1 | tee logs/10-deno-each-array.txt
  ```
  - 記録すること: `%i` 補間でテスト名がどう展開されたかの出力全文。ケースが**1件ずつ独立したテストとして数えられている**か（合計件数の表示）。`deno test --filter "add(1, 2)"` で1ケースだけ実行できるかも試して結果を残す
- [ ] Deno 側: **オブジェクトケース**と `$key` 補間、`%#`（インデックス）を試す（目安: 20分）
  - 記録すること: `$a + $b = $sum` がそのまま名前になるか、ネスト（`$obj.key`）が効くか。**効かなかった書き方があればそれこそ記事の価値**。公式に書いてあるのに動かない/書式が違った場合はバージョンとセットで記録
- [ ] Deno 側: **わざと1ケースだけ落として**失敗時出力を採取する（目安: 15分）
  ```bash
  deno test tests_deno/add_test.ts 2>&1 | tee logs/11-deno-each-fail.txt; echo "exit=$?"
  ```
  - 記録すること: 失敗したケース名が**どのケースか特定できる形で出るか**。エラー全文と exit code。「for ループで書いていたときは何番目が落ちたか分からなかった」という自分の実感と並べる
- [ ] Deno 側: `renderHeader()` に `await t.assertSnapshot()` を付け、`__snapshots__/*.snap` の生成を確認する（目安: 20分）
  ```bash
  deno test tests_deno/render_test.ts 2>&1 | tee logs/12-deno-snapshot-create.txt
  cat tests_deno/__snapshots__/render_test.ts.snap | tee logs/13-deno-snap-content.txt
  ```
  - 記録すること: 初回実行で**自動生成されたのか、`-u` が必要だったのか**。生成された `.snap` の中身（フォーマット）。権限フラグ（`--allow-write`）を求められたか＝公式の「既定の場所なら権限不要」が本当かの実測
- [ ] Deno 側: `renderHeader()` の出力を変更 → 失敗 → `deno test -u` → 再パス、のサイクルを一気通貫でログに残す（目安: 20分）
  ```bash
  # 1. render.ts を書き換えてから
  deno test tests_deno/render_test.ts 2>&1 | tee logs/14-deno-snap-mismatch.txt
  deno test -u tests_deno/render_test.ts 2>&1 | tee logs/15-deno-snap-update.txt
  deno test tests_deno/render_test.ts 2>&1 | tee logs/16-deno-snap-repass.txt
  git --no-pager diff --no-index /dev/null tests_deno/__snapshots__/render_test.ts.snap > logs/17-snap-after.txt 2>&1 || true
  ```
  - 記録すること: **差分表示の見た目**（どこが変わったと言ってくれるか）、更新を促すメッセージの文面、更新後のファイル差分。ここは記事に貼る中心素材なので出力を省略しない
- [ ] Node 側: `node:test` で同じ表を `for...of` + `test()` で手書きし、**行数とテスト名の出方**を Deno 版と比べる（目安: 25分）
  ```bash
  source ~/.nvm/nvm.sh && nvm use 26.7.0
  node --test tests_node/ 2>&1 | tee logs/20-node-loop-params.txt
  wc -l tests_deno/add_test.ts tests_node/add.test.js | tee logs/21-loc-compare.txt
  ```
  - 記録すること: 両ファイルの行数、テスト名を自前でテンプレート文字列にした手間、失敗時にケースを特定できるかの差。**「同じことをやるのに何を自分で書く必要があったか」**を箇条書きで

### フェーズ4: 深掘り・比較（目安: 45分）

- [ ] Node 側スナップショットを `t.assert.snapshot()` で書き、**Node 26.7.0 と Node 22.17.0 の両方**で実行して差を見る（目安: 20分）
  ```bash
  nvm use 26.7.0 && node --test --test-update-snapshots tests_node/ 2>&1 | tee logs/22-node-snap-26.txt
  nvm use 22.17.0 && node --test tests_node/ 2>&1 | tee logs/23-node-snap-22.txt
  ```
  - 記録すること: 生成された `*.snapshot` の中身と Deno の `.snap` とのフォーマット差。**Node 22 でフラグ（`--experimental-test-snapshots`）を要求されたか**＝stable 化バージョンの境界を実測できたか。要求されたらそのエラー全文
- [ ] `renderHeader()` が返す HTML を最小ページに埋めて Playwright でスクショを1枚撮る（目安: 15分）
  ```bash
  npx --yes playwright@latest install chromium
  npx --yes playwright@latest screenshot --viewport-size=800,200 file://$PWD/preview.html logs/render-header.png
  ```
  - 記録すること: スクショのパス。スナップショットテストが守っている HTML が**実際にはこう見える**という記事用の絵。うまく撮れない/DLが重い場合は**深追いせず撤退**し、その判断も記録する（本編の完了条件には含めない）
- [ ] 4観点（行数 / テスト名 / 失敗時出力 / 更新フロー）の比較表を Markdown で書き起こす（目安: 10分）
  - 記録すること: 表そのもの。加えて「**どちらを使いたいと思ったか、その理由**」を新人視点で1段落。断定はせず「今回試した範囲では」と限定する

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] `logs/` を頭から見返し、詰まった点を時系列で棚卸しする（目安: 15分）
  - 記録すること: 各詰まりの「症状 → 試したこと → 効いた対処 → 所要時間」。特に `deno upgrade` 拒否の件は独立した見出しになる分量があるか判断する
- [ ] 下の「記事への写像」に沿って本文ドラフトの見出しを埋め、素材が足りない見出しを洗い出す（目安: 15分）
  - 記録すること: 素材が薄い見出しと、それを埋めるために追加で叩くべきコマンド

> 目安時間の合計: 約 4 時間 30 分（フェーズ1 30分 / 2 45分 / 3 120分 / 4 45分 / 5 30分）。「半日〜1日」の想定内に収まっている。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `deno upgrade` が通らない | ローカルの deno は **Homebrew 管理**（`/opt/homebrew/bin/deno -> Cellar/deno/2.8.3`）。Deno の upgrade はパッケージマネージャ経由の導入を検出すると拒否する | エラー全文を保存 → `brew update && brew upgrade deno` → それでも 2.9 未満なら公式インストーラでユーザーローカルへ | 「公式ブログの手順どおり `deno upgrade` を叩いたら断られた」＝最初の詰まり。導入経路によって手順が変わる話は再現性が高く読者に刺さる |
| 2 | Node 22 でスナップショットがフラグを要求する | `t.assert.snapshot()` は v22.3.0 追加・**v23.4.0 で stable**。22 系では experimental 扱いの可能性 | 22 で失敗したら 26.7.0 に切り替えて再実行し、両方の出力を並べる | 「同じコードがNodeの版数で通ったり通らなかったりする」実測。stable 化バージョンの意味を体感として書ける |
| 3 | `nvm use` がシェルごとに要る | nvm は shell 関数。新しいターミナル/スクリプト実行ごとに default（22.17.0）へ戻る | 各コマンドの前に `source ~/.nvm/nvm.sh && nvm use 26.7.0`、実行直前に必ず `node --version` を記録 | 「Node 26 で試したつもりが 22 で走っていた」系のミスは新人あるあるとして書ける。バージョンをログ先頭に必ず出す運用も紹介できる |
| 4 | 名前補間が期待どおりに展開されない | `%i` と `$key` は**配列ケース用 / オブジェクトケース用**で使い分ける。取り違えるとリテラルのまま出る | ケースの形（配列 or オブジェクト）と補間記法を対応させて書き直す。`%#`（インデックス）も試す | 公式の表を読むだけでは分からない「どっちを使うか」の実感。失敗した名前出力をそのまま貼ると具体的 |
| 5 | スナップショットの差分が読めない／更新して良いのか迷う | `-u` は「意図した変更のときだけ」使うもの。安易に更新すると壊れたまま緑になる | まず差分を全文保存し、**変更が意図どおりか確認してから** `-u`。フル実行時に stale が prune される挙動も確認 | スナップショットテストの運用上の勘所。新人が最初に誤解する点として1見出し立てられる |
| 6 | Deno と Node で同じ `.ts` を共有できない | import 時の拡張子要否・型の扱いがランタイムで違う | 対象コードは依存ゼロの純関数にし、必要なら Node 側だけ `.js` に写す。写した事実を記録 | 「比較のために公平な条件を作るのが地味に大変だった」という検証設計の話。比較記事の誠実さになる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術と比べて感じた違い:
- スクショを撮った箇所:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの記事構成案（10見出し）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提ブロック / 環境実測 | 新人が試した範囲であること、検証環境（deno 2.8.3→2.9 / node 22.17.0 と 26.7.0 / macOS）の明示 |
| 2. なぜこの技術を試すのか | フェーズ1の「分からなかったこと」メモ | node:test では毎回 `for` を書いていた、という具体的な痛みから入る |
| 3. 事前に調べたこと | フェーズ1の2タスク | Deno 2.9 リリースノートと node:test 公式の要点（`test.each` は node:test に無い、を出典URL付きで） |
| 4. 環境構築 | フェーズ2（特に `deno upgrade` 拒否） | Homebrew 管理だと `deno upgrade` が使えない話と代替手段。`nvm use` だけで済んだ話 |
| 5. 実際に試したこと | フェーズ3の全タスク | 配列/オブジェクトケース、名前補間、`__snapshots__` 生成、失敗→`-u`→再パスのログ |
| 6. 詰まった点 | 詰まりポイント表 + 記録テンプレ | エラー全文と、効いた対処。うまくいかなかった書き方も残す |
| 7. 触ってみて分かったこと | フェーズ3・4の気づき欄 | ケース単位で個別テストになる利点、スナップショット更新フローの体感 |
| 8. node:testと比べて感じたこと | フェーズ3最終タスク + フェーズ4の比較表 | 4観点（行数 / テスト名 / 失敗時出力 / 更新フロー）の表と、Node 22/26 の差 |
| 9. どんな人に向いていそうか | フェーズ4の1段落 | 表が多いテストを書く人／スナップショットを標準機能だけで回したい人 |
| 10. まとめ | フェーズ5の棚卸し | 次に試したいこと、今回試していない範囲（CSS module imports 等は範囲外と明記） |

補足: 過去記事 `deno29-task-cache-boundaries` / `deno29-package-lock-seed-ci-check` との違い（＝今回は**テスト機能**という切り口）を冒頭で明示する。

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しない（「今回の環境では」を付ける）
- うまくいった点だけでなく、`deno upgrade` が拒否された等の詰まりを残す
- 実行ログは要約せず全文を貼る。バージョン出力を各ログの先頭に置く
- 公式リンク（deno.com/blog/v2.9、docs.deno.com のテスト章、nodejs.org/api/test.html）を必ず入れる
- 比較記事なので「条件を揃えるためにやったこと」も書く（公平さの担保）

## 参考リンク

- 公式ドキュメント: https://deno.com/blog/v2.9 ／ https://docs.deno.com/runtime/fundamentals/testing/ ／ https://nodejs.org/api/test.html
- チュートリアル / クイックスタート: `deno test --help` と `node --test --help` の出力（オフラインで確認できる一次情報）
- 関連記事・既知の詰まりポイント: 本リポジトリの `articles/deno29-task-cache-boundaries.md` / `articles/deno29-package-lock-seed-ci-check.md`（切り分けの明示に使う）

## 想定リスク・注意点

- コスト: **ゼロ**。課金トリガー無し。ネットワークは Deno バイナリと（任意で）Playwright Chromium の取得のみ
- ライセンス / 規約: 対象コードは自作の純関数のみ。外部コードの転載なし
- セキュリティ: APIキー・トークンを一切使わない。ログに秘密情報が混ざらないので `logs/` をそのまま記事に貼れる
- 撤退ライン:
  - `brew upgrade` でも公式インストーラでも **Deno 2.9 に到達できない**場合 → 「2.9 に上げられなかった記録」として記事を切り替える（それ自体が失敗ログ記事になる）。判断は環境構築に60分かけた時点
  - Playwright の Chromium DL が10分を超える → スクショは諦めてログのみで進める（完了条件に含めていない）
  - 作業ディレクトリ `tmp-deno29-test/` はリポジトリにコミットしない。記事に載せるのは `logs/` の中身とコードの抜粋のみ

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` で実行）
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件を満たしたら「記事への写像」に沿って `/draft-article` で本文ドラフトへ展開する
