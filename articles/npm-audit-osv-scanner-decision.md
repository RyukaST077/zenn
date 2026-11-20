---
title: "Node.jsの依存脆弱性検査をnpm audit・OSV-Scannerから選ぶ"
emoji: "🔐"
type: "tech"
topics: ["security", "nodejs", "npm", "cli", "supplychain"]
published: false
---

Node.jsプロジェクトの依存脆弱性検査をCIへ入れるとき、`npm audit`だけでよいのか、OSV-Scannerを使うのか、両方を動かすのかは悩みどころです。

そこで、固定した脆弱版・修正版のlockfileをnpm 12.2.3とOSV-Scanner 2.7.1で走査しました。npm、pnpm、Yarnのlockfile対応、JSONのfinding、終了コード、壊れた入力や通信失敗も比較しています。

先に結論を書くと、選択の起点は次の3つです。

| 条件 | 選択候補 | 今回の実測に基づく理由 |
|---|---|---|
| npmの`package-lock.json`を使い、severity thresholdをCIの終了条件にしたい | `npm audit` | npmだけでJSONとthreshold別の終了コードを取得できた |
| `pnpm-lock.yaml`や`yarn.lock`も同じCLIで走査したい | OSV-Scanner | OSV-Scannerは試した3形式すべてでfindingを返した。npm auditはpnpm/Yarnだけのディレクトリで明示的に失敗した |
| advisory sourceの差も観測したい | 併用 | 別々の出力をpackageとadvisory aliasで正規化できる。ただし運用コストが増える |

ただし、今回の同一`package-lock.json`では正規化後の30件がすべて両者共通で、片方だけのfindingは0件でした。併用すれば常に追加の脆弱性が見つかる、という結果ではありません。

## 検証条件

実行日時は2026-11-20、環境はDarwin arm64です。使用したバージョンは次のとおりです。

| 項目 | バージョン |
|---|---|
| Node.js | v26.13.1 |
| npm | 12.2.3 |
| pnpm | 11.10.0 |
| Yarn | 1.22.22 |
| OSV-Scanner | 2.7.1 |

Node.jsの公式archive、npmのregistry tarball、OSV-Scannerの公式release assetは、それぞれ公式のchecksumまたはSRIと照合しました。依存のinstall scriptは無効にし、ツール、キャッシュ、設定、fixtureは隔離した作業ディレクトリへ置いています。

主なfixtureは次の2つです。

```json:脆弱版package.json
{
  "name": "vulnerable",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "lodash": "4.17.20",
    "minimist": "0.2.0",
    "axios": "0.21.1"
  }
}
```

```json:修正版候補package.json
{
  "name": "clean",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "lodash": "4.18.1",
    "minimist": "1.2.8",
    "axios": "1.21.1"
  }
}
```

後者を事前に「安全」と決めたのではなく、両scannerで0件かつ終了コード0になったことを確認して、この記事ではclean controlと呼んでいます。

`npm audit`はregistryへ依存情報を送り、既知の脆弱性レポートを得る仕組みです。また、`--audit-level`はレポートの表示内容を絞るのではなく、失敗させるseverityの下限を変えます。詳細は[npm audit公式ドキュメント](https://docs.npmjs.com/cli/audit/)にあります。

OSV-ScannerはOSV databaseを利用するscannerです。v2のlockfile指定は`scan -L ... --format json`で、対応形式には`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`などが明記されています。詳細は[OSV-Scannerのusage](https://google.github.io/osv-scanner/usage/)と[対応lockfile一覧](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)を参照してください。

## 同じpackage-lock.jsonでは両者のadvisoryが重なった

脆弱版の同じ`package-lock.json`に対し、次の2コマンドを実行しました。

```bash
npm audit --json
osv-scanner scan -L package-lock.json --format json
```

観測結果は次のとおりです。

| scanner | 終了コード | 生の集計単位 |
|---|---:|---:|
| npm audit | 1 | 脆弱なpackage 3件 |
| OSV-Scanner | 1 | vulnerability record 30件 |

この2つの件数は、そのまま比較できません。npm側はpackageを単位にした出力を含み、OSV側はvulnerability recordを返すためです。そこで、packageごとにGHSA、CVE、OSVのalias集合を大文字へ正規化して照合しました。

正規化後は次の結果でした。

| 分類 | 件数 |
|---|---:|
| 両者共通 | 30 |
| npmのみ | 0 |
| OSVのみ | 0 |
| version range外 | 0 |
| alias未解決 | 0 |

このsnapshotでは完全に重なりました。ただし、advisory databaseは更新されます。今回の一致から、2つのdatabaseが恒常的に同じ、または一方が不要だとは判断できません。件数の多さも製品の優劣や安全性の順位には使えません。

## pnpmとYarnのlockfileを扱うならOSV-Scannerが選択肢になる

同じdirect dependencyとして`lodash@4.17.20`を指定し、npm、pnpm、Yarnでそれぞれlockfileを生成しました。各ディレクトリに両scannerを実行した結果です。

| lockfile | npm audit | OSV-Scanner |
|---|---|---|
| `package-lock.json` | findingあり、exit 1 | 4 findings、exit 1 |
| `pnpm-lock.yaml` | 明示的失敗、exit 1 | 4 findings、exit 1 |
| `yarn.lock` | 明示的失敗、exit 1 | 4 findings、exit 1 |

pnpm/Yarnのディレクトリでnpm auditを実行しても、`package-lock.json`は新たに作られませんでした。

したがって、npmだけのrepositoryではnpm auditが短い経路になります。一方、pnpm/Yarnのlockfile自体を走査したい場合、今回の条件ではOSV-Scannerがそのまま使えました。monorepoなどでnpm lockfileも併存するなら、lockfileごとにどのscannerへ渡すかを明示する必要があります。

## findingと終了コードを別々に保存する

脆弱版とclean controlに対し、npmは`low`、`moderate`、`high`、`critical`の4 threshold、OSV-Scannerは既定条件で実行しました。

| fixture | tool / threshold | findings | exit |
|---|---|---:|---:|
| 脆弱版 | npm low | 3 package | 1 |
| 脆弱版 | npm moderate | 3 package | 1 |
| 脆弱版 | npm high | 3 package | 1 |
| 脆弱版 | npm critical | 3 package | 1 |
| 脆弱版 | OSV-Scanner | 30 records | 1 |
| clean control | npm low〜critical | 0 | 0 |
| clean control | OSV-Scanner | 0 | 0 |

今回の脆弱版はすべてのthresholdを超えたため、threshold間で終了コードが切り替わる境界は観測できませんでした。一方、npmのJSONに現れたfinding集合は4条件で同じでした。CIでは、JSONのfindingとプロセス終了コードを別フィールドとして保存すると、この2つを混同せずに済みます。

## 非0をすべて「脆弱性あり」にしない

CIで重要なのは、findingあり、clean、scan失敗の3状態を分けることです。入力異常と通信失敗も試しました。

| ケース | exit | 観測した診断 |
|---|---:|---|
| npmのschema-invalid lockfile | 1 | validなerror JSON |
| npmの途中で切れた`package-lock.json` | 1 | `ENOLOCK`。JSON parserの診断ではなかった |
| OSVの途中で切れた`package-lock.json` | 127 | extractor選択後に`unexpected end of JSON input` |
| OSVのunsupported text | 127 | suitable extractorなし |
| npmの閉じたlocalhost port | 1 | `ECONNREFUSED 127.0.0.1:9`とaudit endpoint error |

OSV-Scannerの2つの失敗は、どちらもexit 127でした。ただし、実行記録にはchecksum確認済み実行ファイルの絶対path、argv、cwd、開始・終了時刻、`launchError: null`があり、プロセスが起動したことを確認しています。したがって、127だけからcommand not foundとも入力原因とも推測せず、stderrと起動記録を組み合わせて`scan-error`へ分類しました。

npmのnetwork errorはvalid JSONを返しましたが、`error`を含みexit 1です。JSONとしてparseできることと、scan成功は同義ではありません。

最低限、CIの分類は次の考え方にします。

```text
finding > 0                         => finding
exit == 0 && JSON valid && no error => clean
それ以外                            => scan-error
```

## 本文だけで再現する

以下は検証で実際に空ディレクトリから実行し、脆弱版、clean、malformed、unsupported、network errorの分類を再現した手順です。Node.js、npm、OSV-Scannerを固定し、checksumも確認します。

前提はDarwin/Linuxの対応architecture、公開HTTPSへの接続、`curl`、`shasum`、`tar`、Python 3、および継承された`ASTRO_TELEMETRY_DISABLED=1`です。引数には**存在しないか、空である専用ディレクトリ**を指定してください。`HOME`と`CODEX_HOME`は変更しません。

```bash:inline-repro.sh
#!/bin/bash
set -Eeuo pipefail
TARGET=${1:?pass an empty target directory}
mkdir -p "$TARGET"
TARGET=$(cd "$TARGET" && pwd -P)
test -z "$(find "$TARGET" -mindepth 1 -maxdepth 1 -print -quit)"
test "${ASTRO_TELEMETRY_DISABLED:-}" = 1
ORIGINAL_HOME=${HOME:?}; ORIGINAL_CODEX_HOME=${CODEX_HOME-}
mkdir -p "$TARGET"/{bin,cache,config,data,downloads,fixtures/vulnerable,fixtures/clean,fixtures/malformed,fixtures/unsupported,raw,tmp,tools}
export npm_config_cache="$TARGET/cache/npm" npm_config_userconfig="$TARGET/config/npmrc" npm_config_update_notifier=false npm_config_fund=false NO_UPDATE_NOTIFIER=1
export XDG_CACHE_HOME="$TARGET/cache" XDG_CONFIG_HOME="$TARGET/config" XDG_DATA_HOME="$TARGET/data" TMPDIR="$TARGET/tmp"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) NODE_PLATFORM=darwin-arm64; OSV_PLATFORM=darwin_arm64;;
  Darwin-x86_64) NODE_PLATFORM=darwin-x64; OSV_PLATFORM=darwin_amd64;;
  Linux-x86_64) NODE_PLATFORM=linux-x64; OSV_PLATFORM=linux_amd64;;
  Linux-aarch64|Linux-arm64) NODE_PLATFORM=linux-arm64; OSV_PLATFORM=linux_arm64;;
  *) exit 20;;
esac
NODE_VERSION=v26.13.1; NODE_ARCHIVE="node-$NODE_VERSION-$NODE_PLATFORM.tar.gz"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE" -o "$TARGET/downloads/$NODE_ARCHIVE"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TARGET/downloads/SHASUMS256.txt"
grep "  $NODE_ARCHIVE\$" "$TARGET/downloads/SHASUMS256.txt" >"$TARGET/downloads/node-check.txt"
(cd "$TARGET/downloads" && shasum -a 256 -c node-check.txt) >"$TARGET/raw/node-checksum.txt"
mkdir -p "$TARGET/tools/node"; tar -xzf "$TARGET/downloads/$NODE_ARCHIVE" --strip-components=1 -C "$TARGET/tools/node"
NODE="$TARGET/tools/node/bin/node"; test "$("$NODE" --version)" = v26.13.1; export PATH="$TARGET/tools/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://registry.npmjs.org/npm/12.2.3 -o "$TARGET/downloads/npm.json"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://registry.npmjs.org/npm/-/npm-12.2.3.tgz -o "$TARGET/downloads/npm.tgz"
"$NODE" --input-type=module - "$TARGET/downloads/npm.json" "$TARGET/downloads/npm.tgz" >"$TARGET/raw/npm-checksum.txt" <<'JS'
import fs from'node:fs';import crypto from'node:crypto';const[m,t]=process.argv.slice(2),j=JSON.parse(fs.readFileSync(m)),e='sha512-ovmNRRe76Jvcp1E6iOePQ6H9Zr4XMOrqgfaeGNhtRvP3XSl2Lo/a9C1N5/jRlLLrsqCem/omgGdZHpZ5a6yn1Q==',a='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(t)).digest('base64');if(j.version!=='12.2.3'||j.dist.integrity!==e||a!==e)throw Error('npm integrity mismatch');console.log(a);
JS
mkdir -p "$TARGET/tools/npm"; tar -xzf "$TARGET/downloads/npm.tgz" --strip-components=1 -C "$TARGET/tools/npm"
printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$NODE" "$TARGET/tools/npm/bin/npm-cli.js" >"$TARGET/bin/npm"; chmod 700 "$TARGET/bin/npm"; NPM="$TARGET/bin/npm"; test "$("$NPM" --version)" = 12.2.3
OSV_NAME="osv-scanner_$OSV_PLATFORM"; curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://github.com/google/osv-scanner/releases/download/v2.7.1/$OSV_NAME" -o "$TARGET/downloads/$OSV_NAME"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://github.com/google/osv-scanner/releases/download/v2.7.1/osv-scanner_SHA256SUMS -o "$TARGET/downloads/osv-scanner_SHA256SUMS"
"$NODE" --input-type=module - "$TARGET/downloads/osv-scanner_SHA256SUMS" "$TARGET/downloads/$OSV_NAME" "$OSV_NAME" >"$TARGET/raw/osv-checksum.txt" <<'JS'
import fs from'node:fs';import crypto from'node:crypto';const[s,b,n]=process.argv.slice(2),h=fs.readFileSync(s,'utf8').split(/\r?\n/).map(x=>x.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/)).filter(x=>x&&x[2]===n),a=crypto.createHash('sha256').update(fs.readFileSync(b)).digest('hex');if(h.length!==1||a!==h[0][1].toLowerCase())throw Error('OSV checksum mismatch');console.log(a);
JS
mkdir -p "$TARGET/tools/osv"; cp "$TARGET/downloads/$OSV_NAME" "$TARGET/tools/osv/osv-scanner"; chmod 700 "$TARGET/tools/osv/osv-scanner"; OSV="$TARGET/tools/osv/osv-scanner"; "$OSV" --version >"$TARGET/raw/osv-version.txt"; grep -F 2.7.1 "$TARGET/raw/osv-version.txt" >/dev/null
printf '%s\n' '{"name":"vulnerable","version":"1.0.0","private":true,"dependencies":{"lodash":"4.17.20","minimist":"0.2.0","axios":"0.21.1"}}' >"$TARGET/fixtures/vulnerable/package.json"
printf '%s\n' '{"name":"clean","version":"1.0.0","private":true,"dependencies":{"lodash":"4.18.1","minimist":"1.2.8","axios":"1.21.1"}}' >"$TARGET/fixtures/clean/package.json"
printf '%s\n' '{"name":"malformed","version":"1.0.0","private":true}' >"$TARGET/fixtures/malformed/package.json"; printf '%s\n' '{"lockfileVersion":3,"packages":' >"$TARGET/fixtures/malformed/package-lock.json"
printf '%s\n' 'not a supported lockfile' >"$TARGET/fixtures/unsupported/unsupported.txt"
(cd "$TARGET/fixtures/vulnerable" && "$NPM" install --package-lock-only --ignore-scripts --no-audit --no-fund)
(cd "$TARGET/fixtures/clean" && "$NPM" install --package-lock-only --ignore-scripts --no-audit --no-fund)
"$NODE" --input-type=module - "$TARGET" <<'JS'
import fs from'node:fs';import path from'node:path';const r=process.argv[2];for(const [d,e]of [['vulnerable',{lodash:'4.17.20',minimist:'0.2.0',axios:'0.21.1'}],['clean',{lodash:'4.18.1',minimist:'1.2.8',axios:'1.21.1'}]]){const p=JSON.parse(fs.readFileSync(path.join(r,'fixtures',d,'package.json'))),l=JSON.parse(fs.readFileSync(path.join(r,'fixtures',d,'package-lock.json')));if(p.scripts)throw Error('scripts forbidden');for(const[n,v]of Object.entries(e))if(p.dependencies[n]!==v||l.packages[`node_modules/${n}`].version!==v)throw Error('version mismatch');}
JS
printf '%s\n' 'import datetime,json,pathlib,subprocess,sys' 'root=pathlib.Path(sys.argv[1]).resolve(strict=True);label=sys.argv[2];cwd=pathlib.Path(sys.argv[3]).resolve(strict=True);argv=sys.argv[4:];exe=pathlib.Path(argv[0]).resolve(strict=True)' 'assert cwd.is_relative_to(root) and exe.is_relative_to(root) and exe.is_file();argv[0]=str(exe);p=root/"raw"/label;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();r={"argv":argv,"cwd":str(cwd),"startedAt":now(),"launchError":None,"returncode":None}' 'with p.with_suffix(".json").open("wb") as o,p.with_suffix(".stderr").open("wb") as e:' ' try:r["returncode"]=subprocess.run(argv,cwd=cwd,stdout=o,stderr=e,timeout=90,check=False).returncode' ' except (OSError,subprocess.TimeoutExpired) as x:r["launchError"]=type(x).__name__+": "+str(x)' 'r["endedAt"]=now();p.with_suffix(".command.json").write_text(json.dumps(r,indent=2)+"\n");p.with_suffix(".exit").write_text(str(r["returncode"])+"\n")' 'if r["launchError"] or r["returncode"] is None or r["returncode"]<0 or r["returncode"]==126:raise SystemExit("runner failure")' >"$TARGET/capture.py"
capture(){ python3 "$TARGET/capture.py" "$TARGET" "$@"; }
capture vulnerable-npm "$TARGET/fixtures/vulnerable" "$NPM" audit --json
capture vulnerable-osv "$TARGET/fixtures/vulnerable" "$OSV" scan -L package-lock.json --format json
capture clean-npm "$TARGET/fixtures/clean" "$NPM" audit --json
capture clean-osv "$TARGET/fixtures/clean" "$OSV" scan -L package-lock.json --format json
capture malformed-osv "$TARGET/fixtures/malformed" "$OSV" scan -L package-lock.json --format json
capture unsupported-osv "$TARGET/fixtures/unsupported" "$OSV" scan -L unsupported.txt --format json
capture network-npm "$TARGET/fixtures/vulnerable" "$NPM" audit --json --fetch-timeout=1000 --fetch-retries=0 --registry=http://127.0.0.1:9
"$NODE" --input-type=module - "$TARGET" >"$TARGET/raw/normalized.json" <<'JS'
import fs from'node:fs';import path from'node:path';const r=process.argv[2],read=n=>fs.readFileSync(path.join(r,'raw',n),'utf8'),parse=n=>{try{return JSON.parse(read(n+'.json'))}catch{return null}},exit=n=>Number(read(n+'.exit').trim()),nc=o=>o?.metadata?.vulnerabilities?.total??Object.keys(o?.vulnerabilities??{}).length,oc=o=>(o?.results??[]).flatMap(x=>x.packages??[]).flatMap(x=>x.vulnerabilities??[]).length;const out={};for(const[n,t]of[['vulnerable-npm','npm'],['vulnerable-osv','osv'],['clean-npm','npm'],['clean-osv','osv'],['malformed-osv','osv'],['unsupported-osv','osv'],['network-npm','npm']]){const j=parse(n),e=exit(n),c=t==='npm'?nc(j):oc(j);out[n]={exit:e,jsonValid:!!j,findings:c,status:c>0?'finding':e===0&&j&&!j.error?'clean':'scan-error'};}console.log(JSON.stringify(out,null,2));if(out['clean-npm'].status!=='clean'||out['clean-osv'].status!=='clean'||out['malformed-osv'].status!=='scan-error'||out['unsupported-osv'].status!=='scan-error'||out['network-npm'].status!=='scan-error')process.exit(1);
JS
rm -rf "$TARGET/cache" "$TARGET/config" "$TARGET/data" "$TARGET/downloads" "$TARGET/tmp" "$TARGET/tools" "$TARGET/bin"
test "$HOME" = "$ORIGINAL_HOME"; test "${CODEX_HOME-}" = "$ORIGINAL_CODEX_HOME"; test "$ASTRO_TELEMETRY_DISABLED" = 1
printf 'inline reproduction completed; transient tools/downloads/caches removed; raw evidence retained\n' >"$TARGET/cleanup.txt"
```

例えば、保存名を`inline-repro.sh`とし、空の`./inline-check`を使う場合は次のように実行します。

```bash
bash inline-repro.sh ./inline-check
cat ./inline-check/raw/normalized.json
```

検証時の正規化結果は次のとおりでした。

```json
{
  "vulnerable-npm": { "exit": 1, "jsonValid": true, "findings": 3, "status": "finding" },
  "vulnerable-osv": { "exit": 1, "jsonValid": true, "findings": 30, "status": "finding" },
  "clean-npm": { "exit": 0, "jsonValid": true, "findings": 0, "status": "clean" },
  "clean-osv": { "exit": 0, "jsonValid": true, "findings": 0, "status": "clean" },
  "malformed-osv": { "exit": 127, "jsonValid": false, "findings": 0, "status": "scan-error" },
  "unsupported-osv": { "exit": 127, "jsonValid": false, "findings": 0, "status": "scan-error" },
  "network-npm": { "exit": 1, "jsonValid": true, "findings": 0, "status": "scan-error" }
}
```

この手順はtransientなツール、download、cache、設定、temp directoryを最後に削除し、raw evidenceは残します。検証では`HOME` / `CODEX_HOME`の値が変わっていないこと、列挙した外部cache/config pathのmetadataが前後で一致することも確認しました。ただし、列挙したpath以外も含めた外部書き込みの完全な不在を証明するものではありません。

## 選び方を運用へ落とす

### npm auditだけにする

次の条件なら、まずnpm auditだけで始める判断ができます。

- 入力はnpmの`package-lock.json`だけ
- npm組み込みのJSONとseverity gateを使いたい
- advisory aliasを突き合わせる運用コストを増やしたくない

ただし、CIではstdoutのJSON、stderr、終了コードを別々に保存し、network errorなどをcleanにしない分類が必要です。

### OSV-Scannerだけにする

pnpmやYarnのlockfileを直接走査したい場合、今回の実測ではOSV-Scannerが選びやすい結果でした。対応形式は将来変わり得るため、導入時には公式の[対応lockfile一覧](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)と、固定したCLI versionのhelpを確認します。

こちらも、非0をfindingと決め打ちしてはいけません。今回のexit 127はmalformedとunsupportedの両方で現れたため、stderrと起動記録が分類に必要でした。

### 併用する

併用は、advisory sourceの差を観測対象にしたい場合の選択肢です。ただし、今回のsnapshotでは正規化後の片側findingは0件でした。併用するなら、少なくとも次のコストを受け入れる必要があります。

- package名とadvisory alias集合による重複除去
- 2つのJSON schemaへの追従
- finding、clean、scan-errorを両方で分類する処理
- database更新により件数が変わることを前提にした記録

「2つ動かせば安全」ではなく、異なるsourceの差を継続観測する目的があるかで決めるのが現実的です。

## この検証で分からないこと

今回確認したのは、固定した少数の公開依存とlockfileを既知advisory databaseへ照合した結果です。次のことは確認していません。

- 未知の脆弱性やmalwareの検出
- 脆弱なコードへのruntime到達性
- application code自体の脆弱性
- npmとOSVの検出率やfalse-negative rate
- finding件数から見た製品の優劣
- npm thresholdを変えたときにexitが切り替わる境界

また、advisory databaseとregistry responseは時間で変わります。同じlockfileと同じtool versionでも、再実行時のadvisory件数やmetadataが一致するとは限りません。

## まとめ

固定lockfileでの結果から、選択基準は次のように整理できます。

- npmの`package-lock.json`とseverity gateを短く導入するなら`npm audit`
- pnpm/Yarnのlockfileを同じCLIで走査するならOSV-Scanner
- advisory sourceの差を観測し、正規化コストを負担できるなら併用

どの方式でも、finding数だけではなく終了コード、JSON parse結果、error field、stderr、起動成否を保存し、`finding`、`clean`、`scan-error`を分けることが重要です。0件という数字は、scanが成功したと確認できて初めてclean controlとして扱えます。

## 参考資料

- [npm audit公式ドキュメント](https://docs.npmjs.com/cli/audit/)
- [OSV-Scanner公式サイト](https://google.github.io/osv-scanner/)
- [OSV-Scanner usage](https://google.github.io/osv-scanner/usage/)
- [OSV-Scannerの対応言語・lockfile](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
- [OSV-Scanner v2.7.1 release](https://github.com/google/osv-scanner/releases/tag/v2.7.1)
- [Node.js v26.13.1配布物](https://nodejs.org/dist/v26.13.1/)
- [npm 12.2.3 registry metadata](https://registry.npmjs.org/npm/12.2.3)
