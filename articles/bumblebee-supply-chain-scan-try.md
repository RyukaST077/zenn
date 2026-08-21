---
title: "Bumblebeeで自分のリポジトリのサプライチェーンを初めてスキャンしてみた"
emoji: "🐝"
type: "tech"
topics: ["security", "supplychain", "npm", "go", "cli"]
published: false
---

<!-- 前提: 出典ログ logs/run-bumblebee-20260822-0047/execution-log.md / 記事タイプ 試してみた・検証ログ / slug bumblebee-supply-chain-scan-try / published: false -->

## はじめに

最近サプライチェーン攻撃のニュースをよく見かけるようになり、npmパッケージだけでなくMCPサーバーやエージェントスキルまで対象にする棚卸しツールがあると知って気になっていました。今回試したのは Perplexity が公開している [Bumblebee](https://github.com/perplexityai/bumblebee) というGo製の単一バイナリで、読み取り専用のサプライチェーンスキャナです。

自分が普段さわっているリポジトリ（このZenn記事用のリポジトリ）に対して実際にスキャンをかけ、`npm audit` と挙動を比較してみました。結論から言うと、`selftest` と3プロファイルのスキャン、意図的に古い依存を混ぜての比較、`npm audit` との比較表作成まで一通り確認でき、目的は達成できました。ただし途中で何度かプロファイルの挙動を勘違いしたり、自作の設定ファイルのスキーマを間違えたりして詰まりました。

普段Goのツールをあまり触らない人向けに、詰まった過程も含めて書きます。

:::message
筆者は新人で、Bumblebeeを触るのは今回が初めてです。実行環境は macOS 26.5 (BuildVersion 25F71) / Go 1.27.0 (darwin/arm64) / bumblebee v0.1.2 / Node v22.17.0 / npm 10.9.2 です。
:::

## 使ったもの・環境

- [Bumblebee](https://github.com/perplexityai/bumblebee)（Go製の単一バイナリ、`go install`で導入したバージョンは v0.1.2）
- 対応エコシステムはnpm, PyPI, Go modules, RubyGems, Composer/Packagist, MCP, Agent skills, Editor extensions, Browser extensions, Homebrew の10種類
- 出力形式はNDJSON。`record_type` は `package` / `finding` / `scan_summary` の3種類
- 3つのスキャンプロファイル（baseline / project / deep）がある

READMEを読んだ時点で気になったのは、「脆弱性データベースを内蔵しない棚卸し専用ツール」だと明言されていたことです。`npm audit` のようにCVEを自動で教えてくれるわけではなく、あくまで「このマシンに何が入っているか」を洗い出すツールという位置づけのようでした。

対象リポジトリの `package.json` を見ると、直接の依存は `playwright` と `zenn-cli` の2つだけでした。

```json
{
  "name": "024_zenn",
  "devDependencies": {
    "playwright": "^1.49.0",
    "zenn-cli": "^0.5.2"
  }
}
```

このリポジトリには練習用の `fixtures/` 配下に複数のサブプロジェクトがあり、それぞれ別の `node_modules` を持っています。この時点ではその存在をあまり意識していませんでしたが、後でスキャン結果を見て「そういえばこんなにあったのか」と気づくことになりました。

## 環境構築

まず `go version` を叩いたら、そもそもGoが入っていませんでした。

```
(eval):1: command not found: go
exit=127
```

`brew install go` で導入したところ、11秒ほどでGo 1.27.0が入りました。READMEの必須条件はGo 1.25以上なので要件は満たしています。

```
==> Pouring go--1.27.0.arm64_tahoe.bottle.tar.gz
🍺  /opt/homebrew/Cellar/go/1.27.0: 15,575 files, 239.8MB
elapsed: 11s
```

続けて本体をインストールします。

```bash
go install github.com/perplexityai/bumblebee/cmd/bumblebee@latest
bumblebee --version
```

```
go: downloading github.com/perplexityai/bumblebee v0.1.2
exit=0
(実行完了後)
(eval):1: command not found: bumblebee
exit=127
```

ここで最初に詰まりました。`go install` は成功しているのに `bumblebee` コマンドが見つかりません。`go env GOPATH` で確認すると、`go install` が置いたバイナリの場所（`$GOPATH/bin`）がデフォルトのPATHに含まれていませんでした。

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
bumblebee --version
# => bumblebee v0.1.2 / commit: unknown / built: unknown / go: go1.27.0
```

`~/.zshrc` にも追記して恒久化しました。npmのCLIだと `npm install -g` のグローバルbinが最初からPATHに乗っていることが多いので、Goのこの挙動には少し戸惑いました。「`go install`したのに動かない」というのはGoを触り始めた人がよくハマるところだと思います。

インストール直後に気づいたのですが、`go install ...@latest` で入ったのは v0.1.2 でした。あとで分かるのですが、これがもう一つの詰まりポイントにつながります。

環境が整ったので、まず `selftest` で健全性を確認します。

```bash
bumblebee selftest
echo "exit=$?"
```

```
selftest OK (5 findings in 4ms)
exit=0
```

exit=0で完了しました。ただ、この「5 findings」というのが最初よく分かりませんでした。ヘルプやREADMEを見てもはっきり書かれておらず、おそらくselftest内部で用意されたテスト用の擬似データに対する内部整合性チェックの結果で、実際のリポジトリのスキャンとは無関係だろうと推測しています。実際のスキャン結果の「findings」と紛らわしい表現なので、ここは注意しておいた方がよさそうです。

## 実際に作ってみる（本編）

`bumblebee scan --help` でオプションを確認しました。

```
-profile string
    scan profile: baseline (bounded known package/tool roots), project
    (configured developer/project roots), or deep (incident-response
    exposure scan; may include user home roots) (default "baseline")
-root value
    directory to scan (repeatable or comma-separated; unrelated to running
    as root). Required for deep; optional for baseline/project.
-ecosystem value
    limit scanning to emitted ecosystem values (repeatable or
    comma-separated): npm,pypi,go,rubygems,packagist,mcp,editor-extension,
    browser-extension,homebrew,agent-skill
-exposure-catalog string
    path to a JSON exposure catalog file... v0.1 matches by exact
    (ecosystem, normalized_name, version). The catalog is package-presence
    criteria only; it is NOT an EDR IOC feed.
```

`-exposure-catalog` のヘルプ文言に「it is NOT an EDR IOC feed」とわざわざ書いてあるのが印象的でした。あくまで棚卸しツールであることをツール自身が念押ししている感じがします。

「自分のリポジトリをスキャンする」つもりで、まずは `--root` を付けずに baseline プロファイルを実行しました。

```bash
bumblebee scan --profile baseline --ecosystem npm --output file --output-file logs/bumblebee/baseline.ndjson
wc -l logs/bumblebee/baseline.ndjson
```

```
{"record_type":"diagnostic",...,"message":"default roots: 18 present, 86 candidate paths absent (use --root to override)"}
{"record_type":"diagnostic",...,"message":"scan complete: profile=baseline status=complete files_considered=304857 records=11472 findings=0 suppressed=0 duplicates=300 diagnostics=1 timed_out=false duration=3.969110125s"}
exit=0
11473 logs/bumblebee/baseline.ndjson  # record_type別: package=11472, scan_summary=1
```

`files_considered=304857` という数字を見て、これは1リポジトリの規模ではないと気づきました。baselineは「既知のパッケージ/ツールのグローバルルート」（`~/.npm` やHomebrewのformula、ブラウザ拡張ディレクトリなど）を対象にする設計で、カレントディレクトリを暗黙に対象にはしていませんでした。

念のため project プロファイルも試しましたが、こちらも同じでした。

```bash
bumblebee scan --profile project --ecosystem npm --output file --output-file logs/bumblebee/project.ndjson
wc -l logs/bumblebee/project.ndjson
```

```
{"record_type":"diagnostic",...,"message":"default roots: 1 present, 4 candidate paths absent (use --root to override)"}
{"record_type":"diagnostic",...,"message":"scan complete: profile=project status=complete files_considered=1207816 records=40890 findings=0 suppressed=0 duplicates=405 diagnostics=1 timed_out=false duration=13.187472167s"}
40891 logs/bumblebee/project.ndjson
```

件数はさらに増えて40,890件。projectも名前から「カレントプロジェクト」を想像していましたが、実際は「開発ディレクトリ配下の複数プロジェクトを横断的に見る」設計でした。

最終的に `--root .` を明示して deep プロファイルを使ったところ、ようやくリポジトリ配下だけを対象にできました。

```bash
bumblebee scan --profile deep --root . --ecosystem npm --output file --output-file logs/bumblebee/deep.ndjson
wc -l logs/bumblebee/deep.ndjson
```

```
{"record_type":"diagnostic",...,"message":"scan complete: profile=deep status=complete files_considered=80293 records=5620 findings=0 suppressed=0 duplicates=30 diagnostics=0 timed_out=false duration=1.279353709s"}
5621 logs/bumblebee/deep.ndjson
```

3プロファイルの結果をまとめるとこうなります。

| プロファイル | `--root` | files_considered | package件数 | 対象スコープ |
|---|---|---|---|---|
| baseline | 省略 | 304,857 | 11,472 | マシン全体のグローバルルート（`~/.npm`, Homebrew等） |
| project | 省略 | 1,207,816 | 40,890 | ホーム配下の開発ディレクトリ全体 |
| deep | `.` 明示 | 80,293 | 5,620 | このリポジトリ配下のみ（`fixtures/`の各node_modules含む） |

deepの80,293件でも思ったより多いなと感じましたが、これは `fixtures/` 配下の練習用サブプロジェクトそれぞれが独自の `node_modules` を持っているためでした。package.jsonの直接依存は2つでも、実際にインストール済みのファイルまで見るとこれだけの規模になるのは意外でした。

record_typeの内訳とconfidence分布も見てみます。

```bash
jq -r '.record_type' logs/bumblebee/deep.ndjson | sort | uniq -c
jq -r 'select(.record_type=="package") | .confidence // "null"' logs/bumblebee/deep.ndjson | sort | uniq -c
```

```
5620 package
   1 scan_summary
3777 high
1843 medium
```

サンプルレコードを見比べたところ、`confidence` は `npm-lockfile`（lockfileから直接得た情報で高confidence）と `npm-node_modules`（インストール済みパッケージのpackage.jsonから推測した中confidence）の2系統で決まっているようでした。`npm audit` には無い「検出根拠の確度」を明示する設計だと感じました。

なお package レコードには `endpoint.hostname` や `endpoint.username` のようなホスト名・実行ユーザー名の情報も含まれていました。この記事にコマンド出力を貼る際は、そのあたりをそのまま載せないよう注意しています。

## 詰まった点と解決（この記事の核）

### プロファイル名から想像した動作と実際の動作のギャップ

前段にも書いたとおり、baseline/projectともに「自分のリポジトリを対象にする」という期待とは違う挙動でした。`bumblebee scan --help` の `-root` の説明を読み直して、`--profile deep --root .` に切り替えることで解決しています。名前だけ見て動作を推測すると誤りやすいツールだと思います。

### 自作 exposure-catalog.json のスキーマを間違えた

Bumblebeeは内蔵のCVEデータベースを持たないので、自分で「危険な組み合わせ」を教えるための `exposure-catalog.json` を用意する必要があります。まず意図的に古い依存を追加しました。

```bash
npm install lodash@4.17.15 --save
bumblebee scan --profile deep --root . --ecosystem npm --output file \
  --output-file logs/bumblebee/deep-with-lodash-nocatalog.ndjson
jq -c 'select(.record_type=="finding")' logs/bumblebee/deep-with-lodash-nocatalog.ndjson
```

```
added 2 packages, and audited 17 packages in 603ms
1 high severity vulnerability
(npm installの時点でnpm自身は既に高深刻度の脆弱性を警告していた)

scan complete: profile=deep status=complete files_considered=81349 records=5624
  findings=0 suppressed=0 duplicates=30 diagnostics=0 timed_out=false duration=1.294148875s

(jqの出力は空 = findingレコードは0件)
```

`npm install` した瞬間にnpm自身が `1 high severity vulnerability` と警告してくるのに、Bumblebeeはpackageとしてlodashを検出しても`finding`は何も出しません。「スキャナを入れたのに何も言ってくれない」という驚きがありました。設計として「exposure-catalogに登録した内容と一致した時だけfindingを出す」仕組みなので、これは仕様どおりの挙動です。

そこで自作のexposure-catalogを用意することにしたのですが、最初はREADMEの説明文だけを頼りにフィールド名を憶測で決めてしまい、失敗しました。

```bash
# 誤ったスキーマで作成（正しいフィールド名を確認せず憶測で記述）
cat > exposure-catalog.json << 'EOF'
{ "entries": [ { "ecosystem": "npm", "normalized_name": "lodash",
  "version": "4.17.15", "id": "CVE-2020-8203", "severity": "high",
  "description": "..." } ] }
EOF
bumblebee scan --profile deep --root . --ecosystem npm \
  --exposure-catalog exposure-catalog.json --output file \
  --output-file logs/bumblebee/deep-with-lodash-catalog.ndjson
```

```
parse exposure catalog: missing required field 'schema_version'
exit=2
```

`record_type=package` で使われているフィールド名（`normalized_name` / `version`）をそのまま流用してしまったのが間違いでした。ヘルプやREADMEの説明文だけでは正確なJSONスキーマまでは分からなかったので、`go install` 済みのモジュールキャッシュの中にあるGoのソースコード（`$(go env GOPATH)/pkg/mod/github.com/perplexityai/bumblebee@v0.1.2/internal/exposure/exposure.go`）を直接読みました。`Entry` 構造体のjsonタグを見ると、実際は `id`, `name`, `ecosystem`, `package`（`normalized_name`ではない）, `versions`（配列、`version`単数ではない）, `severity` で、ルートJSONには `schema_version` と `entries` が両方必須でした。正しいスキーマで書き直すと通りました。

```json
{ "schema_version": "0.1.0", "entries": [ { "id": "CVE-2020-8203",
  "name": "lodash prototype pollution", "ecosystem": "npm",
  "package": "lodash", "versions": ["4.17.15"], "severity": "high" } ] }
```

```
scan complete: profile=deep status=complete files_considered=81351 records=5624
  findings=3 suppressed=0 duplicates=30 diagnostics=0 timed_out=false duration=1.367414166s
```

findingレコードが3件出てきて、いずれも `catalog_id":"CVE-2020-8203"`, `evidence":"exact name+version match (version=4.17.15)"` で一致していました（`node_modules/.package-lock.json` 由来、`node_modules/lodash/package.json` 由来、ルート `package-lock.json` 由来）。

ここでもう一つ気になったことがありました。GitHub上の最新READMEをWebFetchで確認すると、スキーマ例が `"schema_version": "0.2.0"` になっていたのです。試しにそのバージョン文字列でカタログを作って渡してみると、`go install ...@latest` で実際に入ったv0.1.2バイナリでは

```
unsupported exposure catalog schema_version "0.2.0" (supported: "0.1.0")
```

というエラーになりました。動くのは `"0.1.0"` だけでした。READMEの`@latest`前提の記述と、実際にインストールされたバイナリのバージョンがずれるのは、OSSの `@latest` 運用ではよくあることだと思いますが、実際に踏むとちょっと戸惑いました。

検証が終わったあとは、追加した依存を削除してリポジトリをクリーンな状態に戻しています。

```bash
npm uninstall lodash
git status --short -- package.json package-lock.json
git diff --stat -- package.json package-lock.json
```

```
removed 1 package, and audited 16 packages in 500ms
found 0 vulnerabilities
(git status / git diff は出力なし = 差分ゼロ、クリーンな状態に復帰)
```

作業前後で `git status --short` の差分がゼロであることを確認してから追加・削除する、というのは検証作業の後片付けとして地味に安心できるやり方だと感じました。

## 分かったこと・npm auditと比べて感じたこと

最後に `npm audit` の結果と並べてみます（lodash@4.17.15を追加した状態での実行結果）。

```bash
npm audit
```

```
# npm audit report

lodash  <=4.17.23
Severity: high
Command Injection in lodash - https://github.com/advisories/GHSA-35jh-r3h4-6jhm
Prototype Pollution in lodash - https://github.com/advisories/GHSA-p6mc-m468-83gw
Regular Expression Denial of Service (ReDoS) in lodash - https://github.com/advisories/GHSA-29mw-wpgm-hmr9
lodash vulnerable to Code Injection via `_.template` imports key names - https://github.com/advisories/GHSA-r5fr-rjxr-66jc
lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit` - https://github.com/advisories/GHSA-f23m-r3pf-42rh
Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions - https://github.com/advisories/GHSA-xxjr-mmjv-4gpg
fix available via `npm audit fix`
node_modules/lodash

1 high severity vulnerability
exit=1
```

| 項目 | npm audit | Bumblebee（exposure-catalogなし） | Bumblebee（自作catalogあり） |
|---|---|---|---|
| lodash 4.17.15 を検出 | ○（6件のアドバイザリを自動検出） | △（packageとしては検出するがfindingは出さない） | ○（自作catalogに登録した1件のみfinding） |
| 検出元 | npmの脆弱性DB（GitHub Advisory Database、オンライン） | ローカルのファイル走査のみ（ネットワークなし） | ローカルのファイル走査＋自作カタログとの一致 |
| 網羅性 | 高い（既知のCVE/GHSAを自動的に全件） | ゼロ（カタログ登録次第） | 自分が登録した分だけ（今回は1件のみ、npm auditが検出した6件中5件は非対応） |
| ネットワーク要否 | 要（オンラインDBに問い合わせ） | 不要（read-only、ローカル完結） | 不要 |
| 用途の違い | 「この依存は危険か」を即答するための脆弱性チェッカー | 「このマシン/リポジトリに何がインストールされているか」の棚卸し（インベントリ）＋自分で用意した既知の脅威との照合ツール | 同左 |

これを見て、BumblebeeとNpm auditは対立するものではなく、役割が違うんだなと理解しました。Bumblebeeは `npm audit` が対応していない領域（MCP、エージェントスキル、ブラウザ拡張など、npmエコシステム以外）の棚卸しと、自分で把握したい脅威情報との突き合わせに向いているツールだと感じています。逆に「既知のCVEを網羅的に検出したい」という用途では、`npm audit` のようなオンラインDBを使うツールの方が向いていそうです。

## まとめ

`selftest`、baseline/project/deepの3プロファイルスキャン、意図的な脆弱依存の追加とexposure-catalogあり/なしの比較、`npm audit` との比較表作成まで、当初決めていた確認項目はすべて確認できました。

途中で詰まったのは、`go install` 後のPATH設定、プロファイル名から想像した動作と実際のスコープのずれ、exposure-catalogのスキーマ憶測ミスとバージョンずれの3点でした。特にプロファイルのスコープの勘違いは、READMEやヘルプを読んだだけでは実感しづらく、実際にfiles_consideredの件数を見て初めて「ああ、そういうことか」と気づいた部分です。

今回はnpmエコシステムだけを対象にしましたが、次はGo modulesやMCPサーバーのスキャンも試してみたいと思っています。また `--output` にはfile以外の出力先もあるようなので、そのあたりの実運用寄りの使い方も気になっています。

## 参考リンク

- [Bumblebee (perplexityai/bumblebee) - GitHub](https://github.com/perplexityai/bumblebee)
- [npm audit - npm Docs](https://docs.npmjs.com/cli/v10/commands/npm-audit)
