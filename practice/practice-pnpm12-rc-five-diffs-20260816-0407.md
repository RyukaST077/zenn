# 実践タスク: pnpm 12 RC（Rustリライト）に上げて、公式が挙げた「5つの差分」を実際に踏んでみた

## このタスクの前提

- 出典レポート: `research/search-topic-20260816-0403.md`
- 元テーマ: 候補表 #1 ／「最初に試すべき1本」に指定された推奨テーマ（引数でテーマ指定が無かったため、レポートの推奨1本をそのまま採用）
- 対象技術: pnpm 12（`next-12` タグ / v12.0.0-rc.x、Rustリライト）と pnpm 11 の比較
- 記事の方向性（記事タイプ）: 検証ログ（「上げたら何が変わるか／壊れるか」を自作fixtureで再現）
- 想定筆者 / 想定読者: Web系の新人エンジニア（pnpm 11 は使っているが12は未経験）／ pnpm 利用者・新人〜実務2年目
- 検証に使える想定時間: 1日（約6時間）※引数指定が無かったためデフォルト前提の上限側を採用
- 判断方針: 引数は「対象レポート」のみ。テーマ・時間・スキルレベル・成果物はすべてデフォルト前提を採用した
- 実行環境の担保: 全タスクが CLI（Docker / npm / pnpm / diff / sha256sum / jq）だけで完結する。**課金・APIキー・人手サインアップ・手動デプロイ・ブラウザ操作は一切不要**。テーマの置き換えは不要と判断した（完了確認はブラウザ表示ではなくCLI出力とファイル差分で行うため、Playwright は使わない）

### 裏取りした一次情報（Step 3）

| 確認先 | 確認できたこと |
|---|---|
| pnpm.io/blog/whats-different-in-pnpm-12 | 差分は5点：① project-aware global bins（`devEngines.runtime` / `globalShims` 設定で、global の node/deno/bun がプロジェクトのピン留めに従う）② Git依存の正規化（`kevva/is-positive` / `github:...` / `git+https://...` / `git+ssh://...` がすべて同一identityとして正規HTTPSに解決され、**SSH URLはlockfileに記録されない**。既存lockfileは `pnpm update <pkg>` で再解決）③ パッケージマネージャ名の実体化（`pnpm add -g yarn` が Yarn Classic ではなく現行Yarnを入れる／`pnpm add yarn` は `packageManager`・`devEngines.packageManager` に記録／`pnx yarn@4 install`・`pnpm shim add yarn`）④ 循環依存のlockfile決定化（IDで並べて固定点でサイクルを切る。workspace globやpackage.jsonの並び替え・再インストールで同一lockfileになる。**初回だけ一度きりのdiffが出る**）⑤ `pnpm install --resolution-only` 廃止（エラーで拒否／代替は `pnpm peers check`） |
| pnpm.io/blog/whats-different-in-pnpm-12 | コマンド・フラグ・設定・lockfile形式は11から据え置き。既存lockfileはfrozen installでは再解決なしに動く |
| pnpm.io/installation | pnpm 12 RC の導入は `pnpm self-update next-12`（pnpm 11.10.0+）／`npx get-pnpm next-12`／`curl -fsSL https://get.pnpm.io/install.sh \| env PNPM_VERSION=next-12 sh -`。npm経由のインストーラは Node.js 22.13+ が必要。Homebrew/winget/Scoop/Chocolatey には未提供 |
| pnpm.io/cli/peers | `pnpm peers check` は「lockfileを読んで未解決・不整合のpeer依存を報告する」コマンド。**追加されたのは 11.0.0**（＝11でも12でも使える）。フラグ・終了コードの記載は公式ドキュメントに無い → **要確認（手元の `--help` と `echo $?` で実測する）** |
| GitHub pnpm/pnpm issue #13018 | `corepack use pnpm@next-12` が `Error: Cannot find module '.../corepack/v1/pnpm/12.0.0-alpha.11/bin/pnpm.mjs'` で落ちる報告（Ubuntu / Node 24.18.0 / Corepack 0.35.0）。**Closed as not planned**。→ **corepack経由での導入は避け、公式が案内する導入手段を使う** |
| GitHub pnpm/pnpm issue #13320 | vercel/next.js をフル再解決すると11と12でlockfileが差分（余分な react@18.3.1、約600行のpeer bindings差）。→ 大きな実プロジェクトではdiffが素直に一致しないことがある前提で読む |

> 未確認事項（記事でも断定しないこと）: `pnpm peers check` の終了コード／`globalShims` 設定の既定値／RC の最新パッチ番号（実行時に `pnpm --version` の実出力で確定させる）。

## 完成イメージ（成果物）

- 作るもの: **pnpm 11 と pnpm 12 RC を同じfixtureに当てて差分5点を再現する、再現可能な検証キット一式**
  - `fixtures/pnpm12-five-diffs/` … ルート＋`packages/a`＋`packages/b` の pnpm ワークスペース。循環依存1組・Git依存3表記・`devEngines.runtime` を仕込む
  - `logs/pnpm12/` … 各コマンドの stdout/stderr 全文、11版/12版の `pnpm-lock.yaml`、その `diff`、`sha256sum` の結果
  - `logs/pnpm12/results.md` … 差分5点 × 「公式の記述／実行コマンド／11の実出力／12の実出力／判定（再現できた/できなかった）」の表
- 「できた」と言える完了条件:
  1. `pnpm --version` が 11系／12系の両方で記録されている（実出力をログに保存済み）
  2. 差分5点それぞれについて、11と12の実出力が `logs/pnpm12/` に全文で残っている
  3. 5点のうち **最低3点** について「再現できた／できなかった＋その根拠となる出力」が `results.md` の表に埋まっている（RCなので全点再現できない可能性を許容する）
  4. lockfile の 11版/12版 diff と、順序入れ替え再インストール時の `sha256sum` 比較結果がファイルとして残っている
- 完了確認の方法: **CLI出力とファイル**（`logs/pnpm12/results.md` が埋まっていること、`ls logs/pnpm12/` に各ログとlockfileが存在すること）。ブラウザ表示を伴わないため Playwright は使わない
- 記事タイトル案（そのまま使える形）:
  1. pnpm 12（Rustリライト）RCに上げて、公式が挙げた5つの差分を全部踏んでみた
  2. pnpm 11しか知らない新人がpnpm 12 RCを触って、実際に壊れたのはどれだったか
  3. `pnpm install --resolution-only` が消えた——pnpm 12の差分5点を手元のfixtureで確かめた記録

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。npm public registry と GitHub の公開リポジトリのみ使う（課金・サインアップ一切なし）
- [ ] ローカル環境: Docker が使えること（`docker --version`）。使えない場合は Node.js 22.13 以上（npm経由インストーラの要件）
- [ ] インストールするもの: `node:24` イメージ（または既存Node）、pnpm 11（`npm i -g pnpm@11`）、pnpm 12 RC（`next-12`）、`git`（Git依存の解決に必要）、`jq`（任意）
- [ ] 無料枠 / コストの確認: すべて無料・オフライン寄り（npm/GitHub からのダウンロードのみ）
- [ ] 記録用の準備: `fixtures/pnpm12-five-diffs/` と `logs/pnpm12/` を先に作る。全コマンドは `2>&1 | tee logs/pnpm12/<name>.log` で保存する
- [ ] **環境保護**: ホストの既存pnpmを壊さないため、Docker コンテナ内で完結させる（不可なら `PNPM_HOME=$PWD/.pnpm-home` を分ける）

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 45分）

- [ ] 公式ブログ「What's different in pnpm 12」を読み、差分5点を**チェックリスト形式のメモ**に落とす（目安: 20分）
  - 記録すること: 5点それぞれの「公式が何と書いているか」を引用として控える（後で実出力と並べる列になる）。読んで自分が意味を取れなかった用語（identity / globalShims / 固定点でサイクルを切る 等）をそのまま残す
- [ ] pnpm 12 RC の導入手段を公式 Installation ページで確定させる（`self-update next-12` / `npx get-pnpm next-12` / install.sh の3択のうちどれを使うか決める）（目安: 15分）
  - 記録すること: 選んだ導入手段と選んだ理由。**corepack を使わないと決めた根拠**（issue #13018 の存在）をメモしておく
- [ ] 検証環境のバージョンを先に記録する：`docker --version` / コンテナ内 `node --version` / `npm --version`（目安: 10分）
  - 記録すること: 実出力そのまま。検証日時（`date`）も一緒に残す（RC検証では必須）

### フェーズ2: 環境構築（目安: 60分）

- [ ] `docker run -it --rm -v "$PWD":/work -w /work node:24 bash` でコンテナに入り、`git --version` を確認する（目安: 10分）
  - 記録すること: 使ったdockerコマンド全文。`git` が無い場合の対処（`apt-get update && apt-get install -y git`）と所要時間
- [ ] fixture を作る：ルート `package.json`（`pnpm-workspace.yaml` に `packages/*`）＋ `packages/a` ＋ `packages/b`。**a→b→a の循環依存を1組**仕込む（目安: 25分）
  - 記録すること: 作った `package.json` / `pnpm-workspace.yaml` の全文（記事にそのまま貼る）。循環依存をどう表現したか
- [ ] fixture に **Git依存を3表記**追加する（`kevva/is-positive` / `github:kevva/is-positive` / `git+https://github.com/kevva/is-positive.git`）と `devEngines.runtime` の記述を入れる（目安: 15分）
  - 記録すること: 3表記をどのパッケージに分けて書いたか。`git+ssh://` は認証が要るため**あえて入れない**判断とその理由（公式は「SSHはlockfileに記録されない」と書いているので、記録形式の確認はHTTPS/短縮表記の3つで足りる）
- [ ] pnpm 11 を入れて `pnpm --version` を記録する（`npm i -g pnpm@11`）（目安: 10分）
  - 記録すること: インストールコマンドと `pnpm --version` の実出力。Node 22.13+ 要件に引っかからなかったか

### フェーズ3: 実装・検証【本編】（目安: 180分）

- [ ] **【基準取り】** pnpm 11 で `pnpm install` を実行し、`pnpm-lock.yaml` を `logs/pnpm12/lock-v11.yaml` に退避する（目安: 20分）
  - 記録すること: インストール所要時間（`time` 付きで）、警告全文、循環依存に関する出力の有無、lockfileの行数
- [ ] **【基準取り】** pnpm 11 で `pnpm install --resolution-only` と `pnpm peers check` を両方実行し、出力と終了コード（`echo $?`）を保存する（目安: 20分）
  - 記録すること: 11での `--resolution-only` の出力全文（**12で消えるので、ここで取らないと二度と取れない**）。`peers check` が11.0.0から存在することを実際に確認できたか
- [ ] pnpm 12 RC を導入し、`pnpm --version` を記録する（フェーズ1で決めた手段を使う。**corepackは使わない**）（目安: 25分）
  - 記録すること: 導入コマンドと出力全文、入ったRCのパッチ番号（例: `12.0.0-rc.x`）、導入に失敗した場合は別手段へ切り替えた経緯と所要時間
- [ ] **【差分⑤】** pnpm 12 で `pnpm install --resolution-only` を実行し、**拒否されるエラー文言**を確認。代替の `pnpm peers check` を実行して11の出力と並べる（目安: 25分）
  - 記録すること: 12でのエラー全文（要約せず貼る）、`peers check` の11出力 vs 12出力の差、終了コード。エラーメッセージが代替コマンドを案内してくれるかどうか
- [ ] **【差分④a】** pnpm 12 で `pnpm install` を実行し、`lock-v12.yaml` として保存。`diff lock-v11.yaml lock-v12.yaml` を取る（目安: 30分）
  - 記録すること: diffの行数と、**どの種類の行が変わったか**の分類（peer bindings / Git依存のURL / 順序）。公式が言う「初回の一度きりのdiff」に当たるかの自分の判断。lockfileサイズの増減
- [ ] **【差分②】** `lock-v11.yaml` と `lock-v12.yaml` で **Git依存3表記がどう記録されているか**を抜き出して並べる（`grep -n 'is-positive' lock-v*.yaml`）（目安: 30分）
  - 記録すること: 3表記が12で同一のエントリに正規化されたか、正規HTTPS URLの実際の文字列。11では別々に記録されていたか。想定と違った場合はその出力をそのまま残す
- [ ] **【差分④b】** `rm -rf node_modules pnpm-lock.yaml` → **package.json の依存の記述順を入れ替えて**再インストールし、`sha256sum pnpm-lock.yaml` を初回と比較する。同じ手順を pnpm 11 でも実施する（目安: 30分）
  - 記録すること: 11と12それぞれの2回分のハッシュ値（計4つ）を表にする。一致したか／しなかったか。しなかった場合は `diff` で何行違ったか

### フェーズ4: 深掘り・比較（目安: 60分）

- [ ] **【差分③】** pnpm 12 で `pnpm add -g yarn` を実行し、`yarn --version` が Yarn Classic(1.x) か現行Yarnかを確認する。同じことを pnpm 11 でも行い比べる（目安: 30分）
  - 記録すること: 両方の `yarn --version` 実出力。`pnpm add yarn`（ローカル）を試した場合、`package.json` の `packageManager` / `devEngines.packageManager` に何が書き込まれたか（変更前後のdiff）。`pnpm shim add yarn` が存在するか `--help` で確認した結果
- [ ] **【差分①】** `devEngines.runtime` を書いたfixture内で `node --version` を実行し、global の node がプロジェクト指定に切り替わるか確認する。fixture外（`cd /tmp`）でも実行して比較する（目安: 30分）
  - 記録すること: fixture内/外での `node --version` の差。切り替わらなかった場合は `globalShims` 設定を探して試した経緯（**この項目は要確認事項が多く、再現しない可能性が高い。落ちた記録こそ記事の価値**）

### フェーズ5: 振り返り・記事化準備（目安: 45分）

- [ ] `logs/pnpm12/results.md` に「差分5点 × 公式の記述／コマンド／11出力／12出力／判定」の表を埋める（目安: 25分）
  - 記録すること: 再現できた点／できなかった点の内訳（例: 5点中3点）。できなかった点は「自分の手順の問題か、RCの挙動か、公式記述の読み違いか」の自己判断を添える
- [ ] 記録テンプレを見返して詰まった点を棚卸しし、「記事への写像」に沿って見出しごとの素材を割り当てる（目安: 20分）
  - 記録すること: 見積もり時間と実測の差が大きかったタスク、最初に分かっていなかった前提、次に試したくなったこと

> 目安時間の合計: 約 6 時間 30 分（45+60+180+60+45 = 390分）。1日枠に収まる。半日で切り上げる場合は**フェーズ4を丸ごと落とし、フェーズ3の差分②・④a・⑤の3点だけで完了条件3を満たす**（完了条件は「最低3点」に設定済み）。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `corepack use pnpm@next-12` が `Cannot find module .../bin/pnpm.mjs` で落ちる | corepack のバージョン解決がRCのプレリリースタグに追随していない（pnpm/pnpm #13018、Closed as not planned） | corepack を使わず、`npx get-pnpm next-12` または `pnpm self-update next-12`（11.10.0+）に切り替える | 「公式Issueで not planned になっている既知の穴を踏んだ」記録。新人が最初に選びがちな導入手段が地雷という具体例になる |
| 2 | pnpm 12 のインストーラが Node.js のバージョンで弾かれる | npm経由のインストーラは **Node.js 22.13+** が必要（pnpm 11 自体は Node 22+） | `node --version` を確認し、`node:24` コンテナで実行する。標準スクリプト導入なら Node 非依存 | 「Rustネイティブなのに npm 経由だと Node 要件がある」という直感に反する前提を説明できる |
| 3 | ホストのグローバルpnpmが11から12に置き換わり、他プロジェクトが動かなくなる | `npm i -g` / `self-update` はグローバル環境を書き換える | 最初から Docker コンテナ内で完結させる。不可なら `PNPM_HOME` を fixture 配下に分ける | 「検証で環境を壊さないための隔離」は新人向けに実用性が高い。撤退可能な検証設計として書ける |
| 4 | lockfile の diff が大きすぎて何が変わったか読めない | 循環依存を含むと peer bindings の記述が大量に変わる（実プロジェクトでは約600行差の報告あり: #13320） | fixture の依存数を最小に保つ。diff を「Git依存URL / peer bindings / 順序」に分類してから読む | 「小さいfixtureで見るからこそ差分が読める」という検証設計そのものが記事の主張になる |
| 5 | `git+ssh://` 表記を試そうとして認証で止まる | SSH鍵が要る＝人手が必要。公式も「SSH URLはlockfileに記録されない」と書いている | SSH表記は検証対象から外し、短縮/`github:`/`git+https` の3表記に絞る | 「認証が要る部分は検証範囲外と最初に決めた」と明示するのは、再現性のある検証ログとして誠実 |
| 6 | `devEngines.runtime` による global node 切り替えが再現しない | `globalShims` 設定の既定値やRCでの実装状況が公式ドキュメントで確認できていない（要確認） | `pnpm config list` で `globalShims` を確認 → 明示的に有効化して再試行。それでも駄目なら「RC時点では未確認」として記録 | 5点のうち1点だけ落ちたなら、そのまま「壊れたのは1つだけだった話」というタイトル案②に直結する |
| 7 | Git依存の解決でネットワーク/`git` コマンド不足に当たる | `node:24` イメージに `git` はあるが、最小イメージでは無いことがある | `git --version` を先に確認し、無ければ `apt-get install -y git` | 環境構築フェーズの詰まりとして短く書ける（所要時間の実測も添える） |
| 8 | `pnpm peers check` の終了コードやフラグが分からない | 公式ドキュメントに記載が無い（要確認） | `pnpm peers check --help` と `echo $?` で実測し、断定せず「手元ではこうだった」と書く | 「ドキュメントに無いので実測した」は一次情報として価値が高い |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（pnpm 11）と比べて感じた違い:
- 保存したログ/lockfileのパス:
- 記事に書きたい気づき:

### 差分5点の結果表（`logs/pnpm12/results.md` にそのまま置く）

| # | 差分 | 公式の記述 | 実行コマンド | pnpm 11 の実出力 | pnpm 12 の実出力 | 判定 |
|---|---|---|---|---|---|---|
| 1 | project-aware global bins | | | | | 再現/未再現 |
| 2 | Git依存の正規化 | | | | | 再現/未再現 |
| 3 | パッケージマネージャ名の実体化 | | | | | 再現/未再現 |
| 4 | 循環依存lockfileの決定化 | | | | | 再現/未再現 |
| 5 | `--resolution-only` 廃止 | | | | | 再現/未再現 |

### lockfileハッシュ比較表

| ツール | 1回目の `sha256sum` | 依存順を入れ替えた2回目 | 一致したか |
|---|---|---|---|
| pnpm 11 | | | |
| pnpm 12 RC | | | |

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（10節）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに（pnpm 12 は「Rustになっただけ」なのか） | 前提・動機 | 冒頭で「速度は測らない、差分の再現に絞る」と宣言する。検証日と `pnpm --version` を最初に貼る |
| 2. なぜこの技術を試すのか | フェーズ1のメモ | RC段階でGA前に踏む意味。11しか知らない新人の視点 |
| 3. 事前に調べたこと（公式が挙げる差分5点） | フェーズ1のチェックリスト | 公式ブログの5点を引用し、そのまま検証項目になっていることを示す |
| 4. 環境構築（11と12 RCの同居、fixtureの構成） | フェーズ2 全部＋詰まり#1〜#3 | `node:24` コンテナで隔離した理由、fixtureの `package.json` 全文、corepack を避けた根拠（Issue #13018） |
| 5. 実際に試したこと（差分5点を1つずつ） | フェーズ3＋フェーズ4 | 差分5点の結果表をそのまま貼る。lockfileのdiffとGit依存3表記の抜粋、ハッシュ比較表を図として入れる |
| 6. 詰まった点 | 詰まりポイント表＋記録テンプレのエラー全文 | 落ちた項目を隠さず書く。特に差分①が再現しなかった場合はその出力を全文で |
| 7. 触ってみて分かったこと（lockfileの決定性は本当に効いたか） | フェーズ3の差分④a/④b | ハッシュが一致したか、初回の一度きりdiffが本当に一度きりだったか |
| 8. pnpm 11と比べて感じたこと | フェーズ3〜4の11 vs 12 の並び | コマンドは据え置きという公式の主張が体感と合っていたか |
| 9. どんな人に向いていそうか（移行を待つ判断材料） | フェーズ5の棚卸し | 「循環依存が多いworkspaceなら早めに試す価値」「Git依存をSSHで書いているなら要注意」など、自分のfixture基準で |
| 10. まとめ | フェーズ5 | 5点中いくつ再現できたか。RCなので断定しないことを明記 |

## 経験談として書くときのコツ

- 「新人が自作の小さなfixtureで試した範囲」と明示し、専門家として断定しない（**RC段階であることを冒頭で書く**）
- 速度比較に流れない。既出の `vite8-rolldown-build-benchmark-log` と同じ構図になるため、**目的は差分の再現**であると宣言する
- うまくいった点だけでなく、再現できなかった差分とその出力を残す
- 実行ログ・lockfileのdiff・ハッシュ表を貼る。バージョン（`pnpm --version` / `node --version`）と検証日を必ず明記する
- 公式ブログ・公式ドキュメント・参照したGitHub Issueへのリンクを入れる
- 既出記事 `pnpm11-minimum-release-age-ci-only-failure` とはバージョン・切り口が違う（あちらは11のセキュリティ既定値、こちらは11→12の移行差分）ことを、必要なら1行触れる

## 参考リンク

- 公式ブログ（差分5点の一次情報）: https://pnpm.io/blog/whats-different-in-pnpm-12
- 公式ドキュメント（RCの導入手段・Node要件）: https://pnpm.io/installation
- 公式ドキュメント（`pnpm peers check`、11.0.0で追加）: https://pnpm.io/cli/peers
- pnpm 11 リリースブログ（比較対象の基準）: https://pnpm.io/blog/releases/11.0
- 既知の詰まりポイント（corepack で MODULE_NOT_FOUND）: https://github.com/pnpm/pnpm/issues/13018
- 既知の詰まりポイント（実プロジェクトでのlockfile差分）: https://github.com/pnpm/pnpm/issues/13320
- リリース一覧（RCのパッチ番号確認用）: https://github.com/pnpm/pnpm/releases

## 想定リスク・注意点

- コスト: **なし**。npm public registry と GitHub 公開リポジトリのダウンロードのみ。課金トリガーは存在しない
- ライセンス / 規約: pnpm は MIT。fixture の依存は公開パッケージ（`kevva/is-positive` 等）のみを使い、社内・私有リポジトリは一切参照しない
- セキュリティ: APIキー・トークンを使わない。`git+ssh://` 表記は鍵が必要なため**検証対象から除外**する。ログを記事に貼る前に、絶対パスにユーザー名が含まれていないかを確認してマスクする
- 環境破壊リスク: グローバルpnpmを書き換えるため、**Dockerコンテナ内で完結させる**のが原則。ホストで実行する場合は `PNPM_HOME` を分け、検証後に `npm i -g pnpm@11` で戻す手順を先に控えておく
- RC特有のリスク: RCなので挙動が変わりうる。**検証日時と `pnpm --version` の実出力を必ず記録・掲載する**
- 撤退ライン:
  - pnpm 12 RC の導入が3手段（`get-pnpm` / `self-update` / `install.sh`）すべてで失敗したら、**「導入gateで止まった記録」として記事化**に切り替える（過去記事 `typescript7-tsc-bin-collision-log` と同じ書き方が使える）
  - 差分5点のうち再現できたものが2点以下なら、フェーズ4を打ち切り、「公式の記述と手元の挙動がどこでズレたか」に焦点を移す
  - 累計6時間を超えたらフェーズ4を捨て、フェーズ5（記録の整理）を必ず実施する

## 次のアクション

- [ ] フェーズ1から順に着手する（まず `logs/pnpm12/` と `fixtures/pnpm12-five-diffs/` を作る）
- [ ] pnpm 11 の基準出力（lockfile・`--resolution-only` の出力）を**12を入れる前に**必ず取る
- [ ] 記録テンプレと差分5点の結果表を埋めながら進める
- [ ] 完了条件（5点中最低3点＋lockfile diff＋ハッシュ比較）を満たしたら、`/run-practice` でこのタスクを実行し、`/draft-article` で本文ドラフトへ展開する
