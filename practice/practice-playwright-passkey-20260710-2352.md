# 実践計画: Playwright 1.61 のパスキー API を 3 ブラウザで検証する

## 出典と対象

- 出典レポート: `research/search-topic-20260710-2347.md`
- 選定テーマ: Playwright 1.61 の `browserContext.credentials` で、ローカルのパスキー登録と別コンテキストでの再ログインを、CDP なしの同一 spec で Chromium / Firefox / WebKit に対して検証する。
- 限定比較: Chromium の最小 CDP fixture（`WebAuthn.enable` / `WebAuthn.addVirtualAuthenticator`）を 1 本だけ作り、可搬性、設定、ブラウザ分岐、コード行数を新 API と比較する。速度比較はしない。
- 対象外: 記事執筆、Git 操作、外部ログイン、実パスキー、OS 生体認証、DB、CI、conditional UI、attestation 詳細、アカウント復旧。

## 目的と仮説

ローカルの架空ユーザーとインメモリサーバーだけを使い、次を実行証拠で確認する。

1. `browserContext.credentials.install()` を使う同一 spec で、3 ブラウザの登録 ceremony を完了できる。
2. `credentials.get()` で取得した credential を別コンテキストへ `credentials.create()` / `install()` し、認証 ceremony を完了できる。
3. credential 未導入、RP ID または origin の不一致、challenge 再利用は決定的に拒否される。
4. CDP 方式より新 API のブラウザ固有コードと設定項目が少ない。

以上は検証前の仮説である。失敗時は成功を推測せず、ブラウザ、バージョン、終了コード、最小エラーを観測結果にする。

## 環境と前提条件

計画時にインストールを行わず確認した環境:

- macOS 26.5 / Darwin 25.5.0 / arm64
- Node.js v22.17.0（SimpleWebAuthn の Node.js 20 以上という条件を満たす）
- npm 10.9.2、`npx`、`curl`、`jq` が利用可能
- Docker 28.5.1 は利用可能だが通常経路では使わない

実行時は npm registry と Playwright の公式ブラウザ配布先への接続、約 3 GB の空き容量を前提とする。アカウント、API キー、OAuth、TLS 証明書、物理認証器は不要。

## 隔離ディレクトリ

全作業は未作成の `logs/run-playwright-passkey-20260710-2352/work/` 以下で行い、証拠は同 run directory の `evidence/` と `execution-log.md` に置く。リポジトリ直下の依存、`articles/`、`research/`、`practice/` は変更しない。Git コマンドは実行しない。

```sh
set -eu
umask 077
RUN_DIR="$PWD/logs/run-playwright-passkey-20260710-2352"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR/.secrets" "$WORK_DIR/app" "$WORK_DIR/tests" "$WORK_DIR/test-results" "$RUN_DIR/evidence"
chmod 700 "$WORK_DIR/.secrets"
touch "$RUN_DIR/execution-log.md"
```

`test ! -e` が失敗したら既存成果物を上書きせず abort する。別 timestamp への変更は、成果物パスを管理できる上位ステージだけが行う。

## 固定する実装条件

- Node.js 組み込み `node:http` で `127.0.0.1:4173` に単一サーバーを立てる。ブラウザ URL / origin は `http://localhost:4173`、RP ID は `localhost` に固定する。
- `playwright@1.61.0`、`@simplewebauthn/server@13.3.1`、`@simplewebauthn/browser@13.3.1` を exact install する。
- 架空ユーザー `user-001` のみを使い、challenge、credential public key、counter、credential ID はプロセス内 `Map` にだけ保持する。
- 登録 options、登録 response 検証、認証 options、認証 response 検証の 4 endpoint と `/healthz` だけを作る。challenge は目的とセッションに結び付け、検証を 1 回試みた時点で消費する。
- クライアントとサーバーは SimpleWebAuthn の公式 API で ceremony を往復する。`@simplewebauthn/browser` の npm package に含まれるローカル browser bundle をサーバーから配信し、テスト時に CDN へ接続しない。認証 ceremony のモック、`expectedOrigin` / `expectedRPID` 検証の省略は禁止する。認証成功時は counter を更新する。
- Playwright は 3 projects、headless、1 worker、各テスト 20 秒、line reporter とする。trace、video、screenshot は無効にする。
- ログへ出すのは結果、件数、ブラウザ名、エラー種別だけ。challenge、credential ID、cookie、鍵、registration / authentication response の生値は出さない。

## 順序付き手順とコマンド

各コマンドの開始・終了時刻、終了コード、stdout / stderr を `execution-log.md` または `evidence/*.log` に記録する。パイプ使用時は `set -o pipefail` を有効にする。すべて非対話コマンドとする。

### 1. 環境記録と依存導入（35 分）

生の環境変数一覧は取得しない。

```sh
cd "$WORK_DIR"
{
  date -u '+UTC=%Y-%m-%dT%H:%M:%SZ'
  node --version
  npm --version
  uname -srm
  sw_vers
} > "$RUN_DIR/evidence/environment.txt" 2>&1
npm init --yes > "$RUN_DIR/evidence/npm-init.log" 2>&1
npm install --save-exact playwright@1.61.0 @simplewebauthn/server@13.3.1 @simplewebauthn/browser@13.3.1 > "$RUN_DIR/evidence/npm-install.log" 2>&1
npx playwright install chromium firefox webkit > "$RUN_DIR/evidence/browser-install.log" 2>&1
npm ls --depth=0 > "$RUN_DIR/evidence/npm-ls.txt" 2>&1
npx playwright --version > "$RUN_DIR/evidence/playwright-version.txt" 2>&1
```

依存と browser の取得再試行は各 1 回まで。cache 削除、mirror 切替、管理者権限、システムへの追加インストールは行わない。package / browser の実バージョン、lockfile、終了コードを証拠にする。

### 2. 最小アプリと fixture の作成（75 分）

実行エージェントのパッチ機能で `$WORK_DIR` 内だけに次を作る。

```text
work/
├── package.json
├── package-lock.json
├── playwright.config.mjs
├── app/server.mjs
├── app/index.html
├── app/client.mjs
├── tests/new-api.spec.mjs
├── tests/failures.spec.mjs
└── tests/cdp-baseline.spec.mjs
```

- `server.mjs`: SimpleWebAuthn server API で 4 endpoint を実装し、challenge 再利用を HTTP 4xx と安定したエラーコードで拒否する。テスト専用 env で RP ID / origin 不一致を注入できるが、その値はログへ出さない。
- `index.html` / `client.mjs`: 登録、ログイン、ログアウト、状態表示のみ。SimpleWebAuthn browser API を使用し、生レスポンスを DOM / console に出さない。
- config: 3 project、上記 timeout / reporter / artifact 制限、`webServer`、base URL を設定する。
- `new-api.spec.mjs`: 登録成功、credential 件数 1、別 context への再作成・導入、ログイン成功を検証する。ファイル再利用用のケース名は `persisted credential` を含め、手順 6 の `--grep` で一意に選べるようにする。
- `failures.spec.mjs`: 未導入、RP ID / origin 不一致、同一 response 再送を、timeout ではなく UI 状態または HTTP 4xx で検証する。
- `cdp-baseline.spec.mjs`: Chromium だけで CDP を使い、登録成功までの最小 1 ケースを実装する。

構文と起動を確認する。

```sh
cd "$WORK_DIR"
node --check app/server.mjs
node --check app/client.mjs
node --check playwright.config.mjs
node --check tests/new-api.spec.mjs
node --check tests/failures.spec.mjs
node --check tests/cdp-baseline.spec.mjs
node app/server.mjs > "$RUN_DIR/evidence/server-smoke.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
i=0
until curl --fail --silent --show-error http://localhost:4173/healthz > "$RUN_DIR/evidence/healthz.json"; do
  i=$((i + 1))
  test "$i" -lt 20 || exit 1
  sleep 1
done
jq -e '.ok == true' "$RUN_DIR/evidence/healthz.json" > /dev/null
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
trap - EXIT INT TERM
```

アプリ作成開始から 90 分以内に Chromium の登録 options 生成へ到達できなければ、サーバー検証を簡略化せず停止する。

### 3. Chromium 正常系（45 分）

```sh
cd "$WORK_DIR"
set +e
npx playwright test tests/new-api.spec.mjs --project=chromium --reporter=line > "$RUN_DIR/evidence/new-api-chromium.log" 2>&1
STATUS=$?
set -e
printf '%s\n' "$STATUS" > "$RUN_DIR/evidence/new-api-chromium.exit"
test "$STATUS" -eq 0
```

登録 verification、credential 件数、別 context の認証 verification を assert する。証拠には `registered=true`、`credentialCount=1`、`authenticated=true` 相当の要約だけを残す。

### 4. 同一 spec の 3 ブラウザ実行（45 分）

```sh
cd "$WORK_DIR"
set +e
npx playwright test tests/new-api.spec.mjs --project=chromium --project=firefox --project=webkit --reporter=line > "$RUN_DIR/evidence/new-api-all-browsers.log" 2>&1
STATUS=$?
set -e
printf '%s\n' "$STATUS" > "$RUN_DIR/evidence/new-api-all-browsers.exit"
```

非 0 でも成功扱いせず、各 project の登録、別 context ログイン、終了コード、サニタイズした失敗段階を表にする。ブラウザ別の製品コード分岐は禁止。1 ブラウザだけの再現可能な失敗は観測として続行し、全ブラウザが初期化前に失敗して原因を切り分けられなければ停止する。

### 5. 失敗ケース（45 分）

```sh
cd "$WORK_DIR"
set +e
npx playwright test tests/failures.spec.mjs --project=chromium --reporter=line > "$RUN_DIR/evidence/failures-chromium.log" 2>&1
STATUS=$?
set -e
printf '%s\n' "$STATUS" > "$RUN_DIR/evidence/failures-chromium.exit"
test "$STATUS" -eq 0
```

テスト成功は意図した拒否を assert できたことを表す。未導入、RP ID / origin 不一致、challenge 再利用のうち最低 2 件を、想定した層と安定したエラーコードで拒否する。生値はエラーから伏せる。

### 6. 一時 credential ファイルの再利用（30 分）

setup で credential を stdout に出さず、`$WORK_DIR/.secrets/credential.json` に mode 600 で保存する。private key を含むものとして扱い、後続 context のログイン後に削除する。

```sh
cd "$WORK_DIR"
set +e
PASSKEY_CREDENTIAL_FILE="$WORK_DIR/.secrets/credential.json" npx playwright test tests/new-api.spec.mjs --project=chromium --grep='persisted credential' --reporter=line > "$RUN_DIR/evidence/credential-reuse.log" 2>&1
STATUS=$?
set -e
printf '%s\n' "$STATUS" > "$RUN_DIR/evidence/credential-reuse.exit"
test "$STATUS" -eq 0
test -f "$WORK_DIR/.secrets/credential.json"
test "$(stat -f '%Lp' "$WORK_DIR/.secrets/credential.json")" = 600
rm -f "$WORK_DIR/.secrets/credential.json"
test ! -e "$WORK_DIR/.secrets/credential.json"
```

ログには作成、permission、再利用成功、削除の真偽だけを残し、内容、サイズ、hash、識別子は記録しない。

### 7. Chromium CDP 最小比較（30 分）

```sh
cd "$WORK_DIR"
set +e
npx playwright test tests/cdp-baseline.spec.mjs --project=chromium --reporter=line > "$RUN_DIR/evidence/cdp-baseline.log" 2>&1
STATUS=$?
set -e
printf '%s\n' "$STATUS" > "$RUN_DIR/evidence/cdp-baseline.exit"
test "$STATUS" -eq 0
{
  printf 'new_api_lines='; awk 'NF && $1 !~ /^\/\//' tests/new-api.spec.mjs | wc -l | tr -d ' '
  printf 'cdp_lines='; awk 'NF && $1 !~ /^\/\//' tests/cdp-baseline.spec.mjs | wc -l | tr -d ' '
  printf 'new_api_browser_branches='; { rg -n 'chromium|firefox|webkit|browserName' tests/new-api.spec.mjs || true; } | wc -l | tr -d ' '
  printf 'cdp_protocol_calls='; { rg -n 'newCDPSession|WebAuthn\.' tests/cdp-baseline.spec.mjs || true; } | wc -l | tr -d ' '
} > "$RUN_DIR/evidence/api-comparison.txt"
```

対応ブラウザ、非空行数、ブラウザ分岐数、明示設定、credential 再利用を比較する。行数は保守性の代理に過ぎず、速度や品質へ一般化しない。

### 8. サニタイズ検査と整理（40 分）

秘密値そのものを検索語へ渡さず、危険な key 名と禁止ファイルを検査する。

```sh
cd "$RUN_DIR"
test ! -e "$WORK_DIR/.secrets/credential.json"
test -z "$(find "$RUN_DIR" -type f \( -name '*credential*.json' -o -name '*storageState*.json' -o -name '*.pem' -o -name '*.key' \) -print)"
set +e
rg -n -i 'privateKey|private_key|clientDataJSON|attestationObject|authenticatorData|signature|rawId|cookie:' execution-log.md evidence > "$RUN_DIR/evidence/sensitive-key-scan.txt"
SCAN_STATUS=$?
set -e
test "$SCAN_STATUS" -eq 1
find "$RUN_DIR" -maxdepth 3 -type f -print | LC_ALL=C sort > "$RUN_DIR/evidence/file-list.txt"
```

一致したら公開用成果物の作成を停止し、該当ログを削除または値を不可逆に伏せて再検査する。最後に `execution-log.md` へ、全コマンドと終了コード、固定 version、ブラウザ別結果、失敗ケース、API 比較、仮説ごとの supported / contradicted / inconclusive、未検証事項、仮想認証器と実ハードウェアの境界を記録する。

## 期待する証拠

- `environment.txt`、`npm-ls.txt`、`playwright-version.txt`、`package-lock.json`: 再現環境
- `healthz.json`: サーバー起動
- `new-api-*.log` / `.exit`: 正常系とブラウザ別結果
- `failures-chromium.log` / `.exit`: 意図した拒否
- `credential-reuse.log` / `.exit`: 秘密値を含まない保存再利用の成否
- `cdp-baseline.log`、`api-comparison.txt`: 限定比較
- `sensitive-key-scan.txt`、`file-list.txt`: 秘密ファイルが残っていないこと
- `execution-log.md`: 時系列の一次実行記録

スクリーンショット、trace、video は証拠にしない。

## 成功条件

1. 架空ユーザーの登録と別 context のログインが少なくとも Chromium で成功し、サーバー verification と UI 状態の両方で assert される。
2. 同一 spec を 3 projects で実行し、各成否、version、終了コードを記録する。3 ブラウザ全成功は仮説支持に必要。個別失敗も隠さない。
3. 未導入、RP ID / origin 不一致、challenge 再利用のうち 2 件以上を決定的に assert する。
4. CDP 方式を 1 ケース実行し、新 API と同じ基準で比較する。
5. credential 一時ファイルを mode 600 で扱って削除し、ログ / evidence に秘密鍵、credential ID、challenge、cookie、生 response が残らない。

Firefox / WebKit だけが再現可能に失敗した場合は部分成功になり得るが、「3 ブラウザで動いた」という仮説は不支持とする。

## 失敗・停止条件

- package または browser binary を 2 回以内に取得できない。
- 90 分以内に Chromium の登録 options 生成へ到達できず、サーバー検証の省略が必要になる。
- origin / RP ID 制約の無効化、TLS 緩和、実アカウントなど危険な回避が必要になる。
- 全ブラウザが同じ初期化段階で失敗し、原因を時間内に切り分けられない。
- private key、cookie、credential ID、challenge、生 response がログに出る。直ちに停止し、ローカル成果物を削除または完全伏字化する。
- 6.5 時間を超える。完了分と未完了分を記録して終了する。

## セキュリティと費用

- 費用上限 0 円。ローカル OSS と package / browser download だけを使う。
- 外部通信は依存取得だけ。テスト本体は loopback のみ。
- 実メール、実ユーザー、実パスキー、keychain、生体認証、外部 cookie / token、環境変数一覧を使わない。
- `.secrets` は mode 700、credential JSON は mode 600。値を stdout / stderr / DOM / screenshot / trace に出さない。
- run directory の `work/` は公開成果物ではない。記事へ渡せるのはサニタイズ済みの成否、設定、コードだけ。

## クリーンアップ

証拠整理後にプロセスと秘密ファイルだけを除去し、再現用ソース、lockfile、サニタイズ済み evidence、execution log は残す。

```sh
pkill -f "$WORK_DIR/app/server.mjs" 2>/dev/null || true
rm -f "$WORK_DIR/.secrets/credential.json"
test ! -e "$WORK_DIR/.secrets/credential.json"
test -z "$(find "$WORK_DIR/.secrets" -type f -print -quit)"
```

共有 npm cache / browser cache と run directory は削除しない。

## タイムボックス

合計 5 時間 45 分、絶対上限 6 時間 30 分。

| 作業 | 目安 |
|---|---:|
| 環境・依存 | 35 分 |
| アプリ・fixture | 75 分 |
| Chromium 正常系 | 45 分 |
| 3 ブラウザ | 45 分 |
| 失敗ケース | 45 分 |
| credential 再利用 | 30 分 |
| CDP 比較 | 30 分 |
| 検査・整理 | 40 分 |

## フォールバック

検証範囲の縮小だけを許し、危険な緩和や成功の推測はしない。

1. Firefox / WebKit だけが失敗: Chromium 正常系、失敗系、CDP 比較を完了し、失敗 browser の version と最小再現を残す。全ブラウザ対応は不支持。
2. ファイル再利用だけが失敗: メモリ上の別 context 再利用までを結果とし、保存再利用は未達とする。秘密値を debug 出力しない。
3. CDP が時間超過: 新 API 結果を優先し、CDP は未実測とする。行数や簡潔さを実測したとは書かない。
4. browser 取得不能: 取得済み browser だけで最小再現を残し、クロスブラウザ結論は inconclusive とする。同じ run で Docker / 別 OS へ切り替えない。

ceremony のモック、challenge 固定、RP ID / origin 検証無効化、外部認証サービスへの切替はフォールバックに含めない。

## 期待する記事上の持ち帰り

実行証拠が得られた範囲で、次を記事工程へ渡せる見込み。計画時点では断定しない。

- CDP 非依存の同一 spec を何ブラウザまで実行できたか。
- credential を別 context へ渡す最小パターンと、private key を含む保存ファイルの扱い。
- RP ID / origin、未導入、challenge 一回性がどの層で失敗したか。
- CDP と新 API の対応ブラウザ、設定、fixture 記述量の実測差。
- 仮想認証器 E2E は WebAuthn ceremony の確認であり、Touch ID、Windows Hello、YubiKey 固有挙動を保証しないという境界。

## 公式一次情報

- Playwright 1.61 release notes: https://playwright.dev/docs/release-notes#version-161
- Playwright Passkeys (WebAuthn): https://playwright.dev/docs/auth#passkeys-webauthn
- SimpleWebAuthn repository: https://github.com/MasterKale/SimpleWebAuthn
- SimpleWebAuthn server docs: https://simplewebauthn.dev/docs/packages/server
- Web Authentication Level 3: https://www.w3.org/TR/webauthn-3/
- MDN Web Authentication API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
- MDN Secure contexts: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
