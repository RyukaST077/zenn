# 実践タスク: pnpm 11 の `minimumReleaseAge` 既定24hを、公開直後のバージョンで実際に踏む

## このタスクの前提

- 出典レポート: `research/search-topic-20260808-0402.md`
- 元テーマ: **候補2**「pnpm 11 で『昨日出たパッケージ』がinstallできない — minimumReleaseAge 既定24hを実際に踏む」（合計27点 / 優先度: 高）
- 対象技術: pnpm 11.20.0（`minimumReleaseAge` / `minimumReleaseAgeStrict` / `blockExoticSubdeps`、SQLiteストア）。比較対象として pnpm 10.13.1
- 記事の方向性（記事タイプ）: 検証ログ・詰まった点まとめ（「わざと踏んで出力を採る」型）
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目、pnpm を使っていて CI の install 失敗に心当たりがある人
- 検証に使える想定時間: **1日（約6時間30分）** ← 引数で時間指定がなかったため、デフォルト前提「半日〜1日」の上限を採用
- 判断方針: 引数で指定されたのは対象レポートのパスのみ。テーマ・時間・スキルレベルはデフォルト前提を採用（ただしテーマは下記の理由で「最初に試すべき1本」から候補2へ変更）
- 実行環境の担保: `npx pnpm@<version>` / `curl https://registry.npmjs.org/...`（いずれも**認証不要・無料・ローカル完結**）だけで完結する。ブラウザ確認が不要なテーマなので Playwright は使わない（完了判定は CLI の stdout/stderr と終了コード）。課金APIキー・人手サインアップ・手動デプロイなし

### 重要: 「最初に試すべき1本」から候補2へ切り替えた（理由）

出典レポートの推奨は候補1「TS6のプロジェクトをTS7 GAに上げ、tsconfig既定値の変更で出たエラーを潰した記録」だったが、**このリポジトリで2コミット前に公開済みの記事と実質同一**だったため採用しなかった。

| 項目 | 内容 |
|---|---|
| 既存記事 | `articles/typescript6-deprecated-tsconfig-already-error.md`（published: true、コミット 3586eff） |
| 既存記事の中身 | 旧世代 tsconfig（`target: es5` / `moduleResolution: node` / `baseUrl`+`paths` / `downlevelIteration` / `esModuleInterop: false`）を TypeScript 5.9.3 / 6.0.3 / 7.0.2 の3世代に通し、警告→ハードエラーの境界とエラー全文、TS7で終了コード0になる最終tsconfigまでを記録済み |
| 既存の実践計画 | `practice/practice-typescript7-tsconfig-defaults-20260727-0408.md`（同一テーマの計画がすでに実行され記事化されている） |
| レポートが挙げた「自分の文脈」 | 「過去記事 `typescript7-tsc-bin-collision-log` の続きを書ける」 → その続きは上記の公開済み記事で**すでに書かれている**（bin衝突の回避策＝版ごとにディレクトリを分ける、まで結論が出ている） |

出典レポート自身が前提に「`articles/` の過去32本と実質同一のテーマは除外」を掲げているので、その方針に従って**同点1位（27点）・優先度「高」の候補2**へ切り替えた。候補2は既存の `articles/npm12-allowscripts-local-fixture.md` と流儀（サプライチェーン既定を無害なfixtureで踏む）は同じだが、**対象ツール（npm 12 → pnpm 11）も設定項目（install scripts → minimumReleaseAge / blockExoticSubdeps）も別**なので重複しない。

### 裏取りで判明した事実（レポートの前提を1点修正）

Step 3 の一次情報確認で、レポートの想定と実際の挙動がずれる点が見つかった。**これが記事の主題そのもの**になるので先に明示する。

| レポートの記述 | 一次情報で確認した事実 | この計画での扱い |
|---|---|---|
| 「pnpm 11 では公開24時間以内のバージョンが**入らない**（installが失敗する）」 | `minimumReleaseAge` は既定 `1440`（分＝24時間）だが、**`minimumReleaseAgeStrict` の既定は「`minimumReleaseAge` を明示設定した場合のみ true、そうでなければ false」**。つまり素の pnpm 11 では、新しすぎる版は**エラーにならず、条件を満たす古い版へ黙ってフォールバックする**ことがある | 検証の主軸を「**失敗するのか、黙って古いのが入るのか**」の切り分けに置く。エラー（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`）が出るのは主に、範囲内に条件を満たす版が1つも無いとき（exact指定など）と strict を明示 true にしたとき |
| 「`.npmrc` の `minimum-release-age` を 0 にして緩める」 | pnpm 11 から **`.npmrc` は auth/registry 専用**になり、pnpm 固有の設定は `pnpm-workspace.yaml`（または `~/.config/pnpm/config.yaml`）へ移動。`.npmrc` に書いても効かない | 「`.npmrc` に書いて効かない」ことを**わざと1回踏んで**記録する（新人が一番ハマる所） |

出典: [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0) / [pnpm Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution)

## 完成イメージ（成果物）

- **作るもの**: 依存が1個だけの極小 fixture（`package.json` と `pnpm-workspace.yaml` のみ、コードは書かない）を複数ディレクトリに用意し、**pnpm 10.13.1 と pnpm 11.20.0 で同じ install を実行した出力差分**を採取した検証ログ一式（`logs/` にコマンド・stdout/stderr 全文・終了コード・解決された版・所要時間）
- **「できた」と言える完了条件**:
  1. `npx pnpm@10.13.1 --version` / `npx pnpm@11.20.0 --version` が期待した版を出力する（**版ゲート通過**）
  2. registry API で「公開から24時間以内のバージョン」を実データで1件以上特定し、その publish 時刻をログに保存している
  3. その版を **exact 指定**して pnpm 11 で install し、`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` を含む**エラー全文と終了コード**を保存している
  4. 同じ指定を pnpm 10 で実行し、**成功する**ことを対比として保存している
  5. **range 指定（`^`）の場合に、エラーになるのか古い版へ黙ってフォールバックするのか**を、解決された実際の版で示せている
  6. `.npmrc` に書いた設定が効かず、`pnpm-workspace.yaml` に書くと効くことを、同一コマンドの出力差で示せている
  7. `blockExoticSubdeps` に引っかかる依存（transitive な git/tarball 依存）をローカル fixture で再現し、出力を保存している
  8. SQLiteストア（`$STORE/index.db`）の実在を確認し、コールド/ウォームの install 時間を各3回計測した表がある
- **完了確認の方法**: すべて CLI 出力（stdout + stderr + `echo "exit=$?"`）。ブラウザ表示を伴わないため Playwright は不要
- **記事タイトル案（そのまま使える形）**:
  1. pnpm 11で「昨日出たバージョン」を入れようとしたら、エラーではなく**古い版が黙って入った**
  2. 新人がpnpm 11のサプライチェーン既定（minimumReleaseAge 24h）をわざと全部踏んでみた
  3. `.npmrc`に書いても効かない — pnpm 11の設定の置き場所ごと変わっていた話

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**（npm public registry の read のみ。`npm login` もしない）
- [ ] ローカル環境: Node.js **22.13 以上**（pnpm 11 の `engines` は `>=22.13`。当環境は v22.17.0 で条件を満たす）／ npm 10.9.2
- [ ] インストールするもの: なし（`npx pnpm@11.20.0` / `npx pnpm@10.13.1` でその都度取得。グローバルの pnpm は**書き換えない**）
  - 動作確認済み: `npx --yes pnpm@11.20.0 --version` → `11.20.0`、`corepack pnpm@11.20.0 --version` → `11.20.0`
- [ ] 無料枠 / コストの確認: すべて無料。ダウンロード量は pnpm 本体と依存1個ぶんのみ
- [ ] 記録用の準備: 作業ディレクトリを `$(mktemp -d)` 配下に作り、ログは `logs/run-pnpm11-<日時>/` に保存する。リポジトリ内には fixture を残さない
- [ ] グローバル環境を汚さないこと: `corepack enable`（PATH に shim を張る）は使わず、`npx pnpm@<version>` 形式で版を固定する。既存のグローバル pnpm（10.13.1）はそのままにする

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 45分）

- [ ] `npm view pnpm dist-tags --json` と `npm view pnpm@latest engines --json` を実行し、検証時点の pnpm の latest 版と Node 要件を記録する（目安: 10分）
  - 記録すること: 実行したコマンドと出力全文。`latest` の値（2026-08-08 時点は `11.20.0`）。`12.0.0-rc.1` が既に存在すること。ローカルの `node -v` / `npm -v` / `pnpm --version`（グローバル版）
- [ ] [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0) と [Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution) を読み、pnpm 11 で既定が変わった設定を表にする（目安: 20分）
  - 記録すること: `minimumReleaseAge`(既定1440分) / `minimumReleaseAgeStrict`(条件付き既定) / `minimumReleaseAgeExclude` / `minimumReleaseAgeIgnoreMissingTime`(既定true) / `blockExoticSubdeps`(既定true) / `strictDepBuilds`(既定true) / `verifyDepsBeforeRun`(既定`install`) / `allowBuilds`。**設定の置き場所が `.npmrc` から `pnpm-workspace.yaml` に移った**という記述の該当箇所を引用でメモ
- [ ] 検証前に「こうなるはず」という**予測を3つ書き出して固定する**（目安: 5分）
  - 記録すること: 予測（例: ①公開直後の版を指定すると install が失敗する ②`.npmrc` に `minimum-release-age=0` を書けば緩む ③pnpm 10 では同じ指定が通る）。**後で外れた予測が記事の山場になる**ので、検証前に書いて動かさない
- [ ] 版ゲート: `npx --yes pnpm@11.20.0 --version` と `npx --yes pnpm@10.13.1 --version` が期待値を返すことを確認する（目安: 10分）
  - 記録すること: 両コマンドの出力と所要時間（初回は pnpm 本体のダウンロードが走る）。`grep -q` で機械検証した結果。**グローバルの `pnpm --version`（10.13.1）と混ざらないこと**を確認した手順

### フェーズ2: 環境構築（目安: 45分）

- [ ] `mktemp -d` で作業ルートを作り、`logs/` と検証用サブディレクトリ（`case-a-exact` / `case-b-range` / `case-c-npmrc` / `case-d-exotic`）を掘る（目安: 10分）
  - 記録すること: 作業ルートの絶対パス。ディレクトリ構成。ログ保存の規約（`<case>-<pnpm版>.log` に stdout+stderr、末尾に `exit=<code>`）
- [ ] すべての実行を包む小さなシェル関数（コマンド・出力・終了コード・所要時間をログへ落とす）を用意する（目安: 15分）
  - 記録すること: 関数のソース。**macOS の `date` は `%3N`（ミリ秒）に非対応**なので、時間計測は `python3 -c 'import time;print(int(time.time()*1000))'` などに置き換える（過去記事で踏んだ既知の罠）
- [ ] 依存1個だけの `package.json` を各ケースに置き、`pnpm-workspace.yaml` は**まだ置かない**（＝pnpm 11 の素の既定で走る状態）（目安: 10分）
  - 記録すること: `package.json` の全文。`private: true` を付けたか。ロックファイルが無い状態から始めていること（既存ロックがあると `minimumReleaseAge` が効かない既知の挙動があるため）
- [ ] pnpm のストア位置を `npx pnpm@11.20.0 store path` で確認し、`index.db` の有無を見る（目安: 10分）
  - 記録すること: ストアの絶対パス。`ls -la` の出力。`index.db`（Store v11 の SQLite）が存在するか、旧 `index/` ディレクトリと共存しているか。**pnpm 10 と 11 でストアパスが同じか違うか**（後の計測の前提になる）

### フェーズ3: 実装・検証【本編】（目安: 170分）

- [ ] registry API から「**直近24時間以内に公開されたバージョン**」を実データで特定する（目安: 30分）
  - やること: `curl -s https://registry.npmjs.org/<pkg>` の `time` フィールド（各版の publish 時刻が ISO8601 で入る）を `node -e` か `python3` で読み、`now - published < 24h` の版を探す。対象は**頻繁にリリースされる無害なパッケージ**を機械的に選ぶ（例: リリース頻度の高い型定義や CLI）。手作業でパッケージ名を決め打ちしない
  - 記録すること: 使ったコマンド全文。見つかった `<pkg>@<version>` と publish 時刻（UTC）、検証時刻との差（時間）。**該当が見つからなかった場合の探索の広げ方**（候補パッケージを増やす／48h に緩めて「境界のすぐ外」を使う）も記録する
  - 注意: 「危険なパッケージ」として扱わない。選定条件は**公開日時のみ**であることを記録に明記する
- [ ] 【ケースA】pnpm 11 で、その版を **exact 指定**して install し、失敗ログを採る（目安: 25分）
  - やること: `npx pnpm@11.20.0 add <pkg>@<version>` を `case-a-exact/` で実行
  - 記録すること: **エラー全文（要約せず貼る）**。`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` というコードが実際に出るか、出るなら前後のメッセージ（「was published at ... within the minimumReleaseAge cutoff」等）。**終了コードの実測値**。所要時間
- [ ] 【ケースA'】同じ exact 指定を pnpm 10.13.1 で実行し、成功することを確認する（目安: 15分）
  - 記録すること: 成功時の出力と終了コード。解決された版（`node_modules/<pkg>/package.json` の `version`）。**同じコマンドで結果が割れる**という対比が記事の核なので、2つのログを並べた形で保存する
- [ ] 【ケースB】pnpm 11 で **range 指定（`^` や タグ無し `pnpm add <pkg>`）**を実行し、「失敗するのか、古い版に落ちるのか」を確定させる（目安: 30分）
  - やること: `case-b-range/` で `npx pnpm@11.20.0 add <pkg>` を実行し、**実際にインストールされた版**を確認する
  - 記録すること: 解決された版と、その版の publish 時刻。最新版との差（何日前か）。**`minimumReleaseAgeStrict` が未設定のとき既定 false になるため、エラーではなく黙ってフォールバックする**という一次情報どおりの挙動になったか。ここでフェーズ1の予測①が当たったか外れたかを明記する（外れた場合それが記事タイトルになる）
- [ ] 【ケースB'】`pnpm-workspace.yaml` に `minimumReleaseAgeStrict: true` を明示し、同じ range 指定を再実行して挙動が変わることを示す（目安: 20分）
  - 記録すること: 置いた YAML 全文。再実行の出力差分（フォールバック → エラーに変わるか）。`pnpm store prune` やディレクトリを作り直してキャッシュ・ロックの影響を排除した手順
- [ ] 【ケースC】`.npmrc` に `minimum-release-age=0` を書いて**効かないこと**を確認し、その後 `pnpm-workspace.yaml` に `minimumReleaseAge: 0` を書いて**通ること**を確認する（目安: 30分）
  - やること: `case-c-npmrc/` で ①`.npmrc` 版 → 失敗のまま ②`pnpm-workspace.yaml` 版 → 成功、の順に実行
  - 記録すること: 2つの設定ファイルの全文と、同一コマンドの出力差分（ここが一番きれいな before/after になる）。pnpm が「その設定は無視した」旨の警告を出すか、それとも**沈黙するか**（沈黙するなら新人が気づけないポイントとして強調する）。フェーズ1の予測②の当否
- [ ] 【ケースD】`blockExoticSubdeps` を、**transitive な git/tarball 依存**をもつローカル fixture で踏む（目安: 20分）
  - やること: `case-d-exotic/` にローカルの子パッケージを作り、その子の `dependencies` に git URL または tarball URL を書く。親から子をローカルパス依存で参照して install する（直接依存は exotic でも許され、**transitive のみ** blocked という仕様を突く形にする）
  - 記録すること: fixture のディレクトリ構成と両方の `package.json`。エラー全文と終了コード。`blockExoticSubdeps: false` にして通ることの確認。**ネットワークに出る git 依存が使えない場合はローカルの `file:` tarball（`npm pack` で作る）で代替**した旨と、その手順

### フェーズ4: 深掘り・比較（目安: 80分）

- [ ] SQLiteストアの実体を確認し、コールド/ウォームの `pnpm install` 時間を pnpm 11 で各3回計測する（目安: 45分）
  - やること: 依存が数個ある fixture で ①ストアを消した状態（コールド）②温めた状態（ウォーム）を各3回。同一マシン・同一 fixture・同一ネットワーク条件で回す
  - 記録すること: `store path` と `index.db` の**ファイルサイズ**（計測前後）。6回ぶんの実測値と平均。**1回計測で結論を出さない**。回線速度に左右されるためコールドの数値は「参考値」と明記する。可能なら pnpm 10 でも同じ計測をして並べる（ストア形式が違うため直接比較にならないことも書く）
- [ ] pnpm 11 の他の新既定（`strictDepBuilds: true` / `verifyDepsBeforeRun: install` / `allowBuilds`）のうち、**手を動かさずに踏めたもの**を拾い上げる（目安: 20分）
  - 記録すること: フェーズ2〜3の実行中に出た警告・追加の出力のうち、`minimumReleaseAge` 以外の新既定に由来するもの全文。`onlyBuiltDependencies` などの旧設定名を使うとどう言われるか。**踏まなかった項目は「未検証」と明記**して推測で書かない
- [ ] 既知の Issue と自分の観測を突き合わせる（目安: 15分）
  - やること: [pnpm/pnpm#11982](https://github.com/pnpm/pnpm/issues/11982)（ロックファイル無しの fresh install で固定版指定が latest タグを見てしまう）、[#10438](https://github.com/pnpm/pnpm/issues/10438)（ロックに既にある依存には効かない）、[#10100](https://github.com/pnpm/pnpm/issues/10100)（新しい major が出るとフォールバックしない）を読む
  - 記録すること: 自分の実測が各 Issue の再現条件に**当てはまったか / 当てはまらなかったか**。当てはまらない場合は「この版では確認できなかった」と書く（Issue の記述をそのまま自分の観測として書かない）

### フェーズ5: 振り返り・記事化準備（目安: 45分）

- [ ] フェーズ1で固定した予測3つの**当否表**を作る（目安: 10分）
  - 記録すること: 予測 / 実測 / なぜ外れたか。外れた予測は記事の導入にそのまま使う
- [ ] 「どの設定が、どこに書くと、どう効くか」の対応表を実測だけで埋める（目安: 15分）
  - 記録すること: 設定名 / 書く場所（`.npmrc` or `pnpm-workspace.yaml`）/ 既定値 / 効いたか / 出力の変化。**推測で埋めた行を作らない**
- [ ] 記録テンプレを見返して詰まった点を棚卸しし、「手元で試すときの最短手順」を再現可能な形にまとめる（目安: 10分）
  - 記録すること: 版・OS・Node 版を含む最短コマンド列。実行環境ブロック（`OS` / `Node.js` / `npm` / `pnpm` / 検証日時）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 10分）
  - 記録すること: 各見出しに対して、貼るログのファイル名を紐づける。素材が足りない見出しがあれば、その場で追加実行するか見出しを落とす

> 目安時間の合計: 45分 + 45分 + 170分 + 80分 + 45分 = **385分（約6時間25分）**。指定時間「1日（約6〜7時間）」に収まっている。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | pnpm 11 なのに「新しすぎる版」でエラーにならず、install が普通に成功してしまう | `minimumReleaseAgeStrict` の既定が「`minimumReleaseAge` を明示設定したときだけ true」。素の既定では条件を満たす古い版へ**黙ってフォールバック**する | 失敗させたいなら exact 指定（範囲内に代替が無い状態）にするか、`pnpm-workspace.yaml` に `minimumReleaseAgeStrict: true` を明示する | **これが記事の主題**。「入らない」ではなく「気づかないうちに古い版が入る」ほうが実務では怖い、という切り口にする |
| 2 | `.npmrc` に `minimum-release-age=0` と書いたのに何も変わらない | pnpm 11 から `.npmrc` は auth/registry 専用になり、pnpm 固有の設定は `pnpm-workspace.yaml` / `~/.config/pnpm/config.yaml` へ移動した | 設定を `pnpm-workspace.yaml` に camelCase（`minimumReleaseAge: 0`）で書き直して同じコマンドを再実行し、出力差を採る | ネット上の古い記事・LLMの回答がまだ `.npmrc` 前提なので、**同一コマンドの before/after** を貼るだけで価値になる |
| 3 | ロックファイルやストアが残っていて、2回目以降の実行結果が変わる／再現しない | `minimumReleaseAge` はロックに既に載っている依存には効かない（[#10438](https://github.com/pnpm/pnpm/issues/10438)）。ストアが温まっていると解決結果も時間も変わる | ケースごとにディレクトリを分け、毎回 `rm -rf node_modules pnpm-lock.yaml` から始める。ストア依存の検証では `store path` を確認してから消す | 「1回試して終わり」との差が出る部分。**再現手順に「どこから消して始めるか」を明記**すると読者が同じ結果に辿り着ける |
| 4 | 「24時間以内に公開された版」が検証タイミング次第で見つからない | 対象パッケージのリリース頻度に依存する。夜中に走らせると直近リリースがないこともある | 候補パッケージを複数用意して registry の `time` を機械的に走査する。見つからなければ閾値側を動かす（`minimumReleaseAge` を大きめの値に設定して「境界のすぐ外」の版を新しすぎ扱いにする） | 「実データで踏む」検証の段取りそのものが素材。**閾値を動かして踏む**のは再現性の高い代替手段として書ける |
| 5 | グローバルの pnpm（10.13.1）と検証対象の 11 が混ざり、どの版で走ったか分からなくなる | `pnpm` を直接叩くと PATH 上のグローバル版が動く。`corepack enable` すると shim が張られてさらに紛らわしい | 常に `npx --yes pnpm@<version>` 形式で叩き、各ケースの先頭で `--version` をログに残して `grep -q` で機械検証する | 過去記事（TS の bin 衝突）と同じ教訓の再演。**「比較の前に版ゲートを置く」**という自分の型として書ける |
| 6 | Node のバージョンが足りず pnpm 11 が起動しない | pnpm 11 は `engines: node >=22.13`、Node 18〜21 のサポートを打ち切っている | `node -v` を先に確認する。足りなければ nvm 等で 22 系に切り替える（当環境は v22.17.0 で条件を満たす） | 「pnpm を上げる前に Node を上げる必要がある」という前提を冒頭に書くと、読者の環境差でハマるのを防げる |
| 7 | `blockExoticSubdeps` を踏ませたいのに、直接依存に git URL を書いてしまい弾かれない | 仕様上、**直接依存は exotic source を使ってよく、transitive のみ**が禁止される | 親→子（ローカルパス）→ git/tarball の2段構成にする。ネットワーク制約で git 依存が使えないなら `npm pack` で作ったローカル tarball を子の依存にする | 仕様の細かい線引き（直接はOK・推移はNG）を**実測で示した**部分になる。仕様文の引用＋自分の fixture の両方を貼る |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:（`npx --yes pnpm@<version> ...` の形でコピペできる形。実行ディレクトリも）
- 出たエラー（全文）:（要約しない。`ERR_PNPM_*` のコード行を含めてそのまま）
- 終了コード:（`echo "exit=$?"` の値。pnpm 10 と 11 で違う可能性を意識して毎回残す）
- 解決された実際の版:（`node_modules/<pkg>/package.json` の `version` と、その publish 時刻）
- 効いた解決方法 / 試したこと:（効かなかった対処も残す。特に `.npmrc` 経由）
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（pnpm 10 / npm 12）と比べて感じた違い:
- 実行環境ブロック:（OS / Node.js / npm / pnpm各版 / 検証日時 / 対象パッケージと版）
- 記事に書きたい気づき:

> スクリーンショットは撮らない（すべて CLI 出力のため）。代わりに**ターミナル出力をコードブロックとして全文保存**する。

## 記事への写像（タスク → 見出し）

出典レポート「候補2」の記事構成案に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | フェーズ1の予測3つ / その当否表（フェーズ5） | 「昨日出た版は入らないはず」と思って始めたら違った、という入り。`npm view pnpm dist-tags` で latest が 11.20.0 だと気づいた話 |
| 2. pnpm 11 で変わった既定値 | フェーズ1の設定表 | `minimumReleaseAge` 1440分 / `minimumReleaseAgeStrict` の条件付き既定 / `blockExoticSubdeps` / Node 22.13+ / **設定の置き場所が `pnpm-workspace.yaml` に移った**こと |
| 3. 検証環境 | フェーズ2の環境ブロックと版ゲート | OS・Node・npm・pnpm各版・検証日時。`npx pnpm@<version>` で版を固定した理由（グローバル版と混ざらないため） |
| 4. 「新しすぎるバージョン」を入れようとした結果 | ケースA（exact）/ ケースA'（pnpm 10 対比） | registry API での版の探し方、エラー全文、終了コード、pnpm 10 との同一コマンド対比 |
| 5. エラーにならないケースがあった（本題） | ケースB / ケースB' | range 指定では**黙って古い版に落ちる**こと。解決された版と publish 時刻。`minimumReleaseAgeStrict: true` で挙動が変わる before/after |
| 6. 設定で緩める方法と、その置き場所 | ケースC | `.npmrc` に書いて効かなかったログ → `pnpm-workspace.yaml` で効いたログ。緩めることのリスク（24h の待機が何を守っているか）も併記 |
| 7. blockExoticSubdeps を踏む | ケースD | 直接依存はOK・推移依存はNGという線引きを fixture で実証。エラー全文と `false` にして通る確認 |
| 8. SQLiteストアでinstall時間はどうなったか | フェーズ4の計測 | `index.db` のパスとサイズ、コールド/ウォーム各3回の実測と平均。回線差の断り書き |
| 9. CIで気をつけたいこと | フェーズ4の Issue 突き合わせ / ケースB | ロックがあると効かない・fresh install で挙動が変わる等、実測できた範囲だけ。Dependabot 等の一般論は「未検証」と切り分ける |
| 10. まとめ | フェーズ5の当否表・対応表 | 「入らない」より「黙って古いのが入る」ほうが実務の落とし穴。設定はどこに書くか。未検証項目の列挙 |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない（依存1個の極小 fixture であることを冒頭で書く）
- **予測を先に書いて、外れたことを書く**。この検証は「外れる」ことがほぼ確実に主題になる
- うまくいった点だけでなく、`.npmrc` に書いて効かなかったような**空振りの過程**を残す
- 実行ログは要約せず全文コードブロックで貼る（エラーコード `ERR_PNPM_*` は検索で辿り着く人がいるので特に）
- 公式ドキュメントへのリンクを入れる（リリースブログと settings ページの両方）
- 手順の再現性（pnpm 版・Node 版・OS・検証日時・対象パッケージと publish 時刻）を明記する
- 実在パッケージを「危険な例」として扱わない。選定条件は**公開日時のみ**であることを本文に書く

## 参考リンク

- 公式ドキュメント:
  - [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0)（2026-04-28）
  - [pnpm Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution)（`minimumReleaseAge` 系 / `blockExoticSubdeps` の一次情報）
  - [pnpm Settings 一覧](https://pnpm.io/settings)（ビルド設定 `allowBuilds` / `strictDepBuilds` / `verifyDepsBeforeRun`）
- 関連記事・既知の詰まりポイント:
  - [pnpm/pnpm#11982](https://github.com/pnpm/pnpm/issues/11982) ロックファイル無しの fresh install で固定版指定が latest タグを見る
  - [pnpm/pnpm#10438](https://github.com/pnpm/pnpm/issues/10438) ロックに既にある依存には `minimumReleaseAge` が効かない
  - [pnpm/pnpm#10100](https://github.com/pnpm/pnpm/issues/10100) 新しい major が出たときフォールバックしない
  - [npm 12 が install scripts を既定無効化（The Hacker News）](https://thehackernews.com/2026/07/npm-12-disables-install-scripts-by.html) — 同じ潮流の比較対象
- 自リポジトリの関連記事（重複回避と参照用）:
  - `articles/npm12-allowscripts-local-fixture.md`（同じ流儀・別ツール別設定。冒頭で差分を明示する）

## 想定リスク・注意点

- **コスト**: すべて無料。ネットワーク越しの取得は pnpm 本体と依存パッケージのみ
- **ライセンス / 規約**: npm public registry の read のみ。レジストリへの publish は一切しない
- **セキュリティ**: APIキー・トークンを一切使わない。`.npmrc` を作るのは検証ディレクトリ内だけで、**`~/.npmrc` は触らない**。`corepack enable` でグローバル shim を張らない
- **環境汚染**: グローバルの pnpm（10.13.1）を書き換えない。作業は `mktemp -d` 配下で行い、終了後に削除する（削除前に `logs/` をリポジトリへコピー）
- **記事化上の注意**: 特定パッケージを「危険」と示唆しない。設定を緩める方法を書くときは、24時間の待機が何を防いでいるのかを必ず併記する
- **撤退ライン**:
  - 24時間以内公開の版が30分探しても見つからない → `minimumReleaseAge` を大きい値（例: 10080＝7日）に設定して「境界のすぐ外」の版で踏む方式に切り替える
  - ケースD（`blockExoticSubdeps`）が90分で再現できない → 未検証として切り離し、ケースA〜Cだけで記事化する（無理に成功させない）
  - コールド計測がネットワーク要因で3回とも大きくブレる → 数値を出さず「ブレたため測定できず」と書く

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` に渡す）
- [ ] 記録テンプレを埋めながら進める。特に**フェーズ1の予測3つは検証前に固定**する
- [ ] 完了条件8項目を満たしたら「記事への写像」に沿って `/draft-article` へ展開する
- [ ] 出典レポートの候補1（TypeScript 7 移行）は公開済み記事と重複するため、次回以降のテーマ選定では候補3（Baseline × Browserslist）を優先候補として扱う
