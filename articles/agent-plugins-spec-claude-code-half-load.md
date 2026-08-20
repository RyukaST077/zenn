---
title: "Agent Plugins 1.0.0の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた"
emoji: "🧩"
type: tech
topics: ["claudecode", "mcp", "aiagent", "jsonschema"]
published: false
---

## 対象読者

- 自分で書いたスキルやMCPサーバーを、複数のAIエージェントで使い回したい方
- Claude Codeのプラグイン（`.claude-plugin/plugin.json`）を書いたことがあり、ベンダー中立仕様との違いを知りたい方
- 「JSON Schemaが公開されているから検証すればOK」で済むのかを確かめたい方

## はじめに

2026年8月6日に、AIエージェント向けのプラグイン仕様 Agent Plugins 1.0.0 が公開されました。スキル（`SKILL.md`）とMCPサーバー設定を1つのディレクトリに詰めて配布する、クライアント非依存の仕様です。

- [agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec)
- [Agent Plugins: package your skills, tools, and more（Google Developers Blog）](https://developers.googleblog.com/agent-plugins-package-your-skills-tools-and-more/)
- [Introducing Agent Plugins（Vercel）](https://vercel.com/blog/introducing-agent-plugins)
- [AWS supports Agent Plugins](https://aws.amazon.com/blogs/opensource/aws-supports-agent-plugins-an-open-standard-for-portable-agent-extensions/)

気になったのは「では、この仕様どおりに書いたものを、手元のClaude Codeはそのまま読んでくれるのか」でした。Claude Codeのプラグインは[公式ドキュメント](https://code.claude.com/docs/en/plugins)を見るとマニフェストを `.claude-plugin/plugin.json` に置きますが、Agent Plugins 1.0.0はプラグインルート直下の `plugin.json` を要求しています。ドットで始まるディレクトリが1つあるかないか、程度の違いに見えました。

実際に最小プラグインを作って読ませたところ、結果は「半分だけ読めた」でした。スキルは読み込まれて呼び出せたのに、マニフェストに書いた `name` は無言で捨てられ、`mcp.json` に書いたMCPサーバーはログに1行も現れませんでした。しかも `claude plugin validate` は仕様準拠のレイアウトを exit 1 で落としました。

この記事では、その過程で得られた出力と、詰まった4か所を書きます。

:::message
筆者は新人で、Agent Plugins仕様を触るのは今回が初めてです。仕様は1.0.0でクライアント側の対応は動いている最中なので、以下はすべて**2026年8月15日・Claude Code 2.1.227での観測**です。バージョンが上がれば結論は変わります。
:::

なお、以前に `CLAUDE.md` / `AGENTS.md` を検証した話とは主題が別です。あちらはエージェントに読ませる「指示ファイル」の話で、今回は「配布パッケージの仕様」の話になります。

## 環境

| 項目 | 検証値 |
|---|---|
| OS | macOS 26.5（Darwin 25.5.0, arm64） |
| Node.js | v22.17.0 |
| npx | 10.9.2 |
| ajv-cli | 5.0.0 |
| Claude Code | 2.1.227 |
| agent-plugins-spec | commit `bd383552095128f6effe895b9257cfd580a6d179`（2026-08-06） |

最初に環境を1ファイルに固定しました。仕様が新しいので、この5行が再現性の土台になります。特にClaude Codeのバージョンは、この記事の結論の有効期限そのものです。

```bash
mkdir -p agent-plugins-try/logs && cd agent-plugins-try
{ node -v; npx --version; claude --version; date; uname -a; } 2>&1 | tee logs/00-env.log
```

```
v22.17.0
10.9.2
2.1.227 (Claude Code)
Sat Aug 15 04:13:57 JST 2026
Darwin ... 25.5.0 Darwin Kernel Version 25.5.0: Mon Apr 27 20:39:09 PDT 2026; root:xnu-12377.121.6~2/RELEASE_ARM64_T6020 arm64
```

確かめたいことは5つに絞りました。仕様スキーマでのバリデーションが通るか、`claude plugin validate` が通るか、`claude --plugin-dir` でスキルが読めてどの名前空間になるか、仕様違反を踏んだときにどんなエラーが出るか、そして同じプラグインが「仕様準拠レイアウト」と「Claude Code準拠レイアウト」でどう挙動が変わるか、です。

## 事前に調べたこと：仕様の最小構成とJSON Schema

仕様リポジトリを浅くcloneして、スキーマの必須フィールドを自分の手で確認しました。

```bash
git clone --depth 1 https://github.com/agentplugins/agent-plugins-spec spec-repo
node -e 'const s=require("./spec-repo/schemas/1.0.0/plugin.schema.json");
  console.log("$schema:", s.$schema); console.log("required:", s.required);
  console.log("properties:", Object.keys(s.properties));
  console.log("additionalProperties:", s.additionalProperties);
  console.log("name pattern:", s.properties.name.pattern)'
```

```
$schema: https://json-schema.org/draft/2020-12/schema
required: [ '$schema', 'name' ]
properties: [
  '$schema',    'name',
  'version',    'description',
  'author',     'homepage',
  'repository', 'license',
  'keywords',   'extensions'
]
additionalProperties: false
name pattern: ^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$
```

`mcp.schema.json` のほうは `required` が `["$schema","mcpServers"]` で、こちらも `additionalProperties: false` でした。

「必須は2つだけ」というのは本当でした。ただ、その代わり `additionalProperties: false` で閉じられているので、書けるフィールドが10個しかありません。必須が少ないことと自由度が高いことは別だと分かりました。

もう1つ、`$schema` は `const` で固定値チェックされています。つまり `$schema` は取得先URLというより、バージョン識別子として機能しているようです。仕様 §6.1.1 にも「クライアントはプラグイン読み込み時にスキーマを取得してはならない（MUST NOT）」と書かれていました。

Claude Code側のCLIヘルプも先に見ておきました。

```bash
claude plugin --help
claude plugin validate --help
```

```
validate [options] <path>            Validate a plugin or marketplace manifest
Options:
  --strict    Treat warnings as errors (exit 1). Use in CI to fail on
              unrecognized fields, missing metadata, and other issues that the
              runtime tolerates.
```

`--strict` の説明にある "issues that the runtime tolerates" が引っかかりました。実行時は許すけれどCIでは落とす、という二段構えになっているようです。この文はあとで結果を読むときに何度も戻って読み返すことになりました。

ここで、結果を見る前に「たぶんこうなるだろう」という予想を7項目ぶん書き出して残しておきました。結果は的中が6、半分外したのが1で、それとは別に、まったく予想していなかった発見が1つありました。

## 環境構築：ファイルを置くだけ

仕様準拠のプラグインは、ファイルを2つ置くだけで成立します。

```json:hello-plugin/plugin.json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "hello-plugin",
  "version": "1.0.0",
  "description": "Agent Plugins 1.0.0 spec conformance test plugin"
}
```

```md:hello-plugin/skills/hello/SKILL.md
---
name: hello
description: Print a fixed marker string SPEC_SKILL_LOADED. Use when the user asks to run the hello skill or to verify that this plugin's skill is loaded.
---

# hello

このスキルが読み込まれているかを確認するためだけのスキル。

## 手順

1. 次の1行だけを出力する（他の文字は出力しない）:

SPEC_SKILL_LOADED
```

スキルの中身は `SPEC_SKILL_LOADED` という固定マーカーを1行出させるだけにしました。「読み込まれたか」を文字列一致で判定できるので、以降の確認が主観になりません。あとから振り返ると、ここを最初にやっておいたのがいちばん効きました。

### ajvが動かなかった

公開されているスキーマがあるので `ajv-cli` に投げれば終わり、と思っていたら落ちました。

```bash
npx --yes ajv-cli@5 validate \
  -s spec-repo/schemas/1.0.0/plugin.schema.json \
  -d hello-plugin/plugin.json --errors=text
```

```
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
schema spec-repo/schemas/1.0.0/plugin.schema.json is invalid
error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
exit=1
```

`no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` を最初に見たとき、URLが出ているのでネットワークかプロキシの問題だと思いました。実際は違って、ajv本体がdraft 2020-12のメタスキーマを積んでいない（既定はdraft-07相当）というだけでした。取得の問題ではありません。`--spec=draft2020` を足したら通りました。

```bash
npx --yes ajv-cli@5 validate --spec=draft2020 \
  -s spec-repo/schemas/1.0.0/plugin.schema.json \
  -d hello-plugin/plugin.json --errors=text
```

```
hello-plugin/plugin.json valid
exit=0
```

入ったのは ajv-cli 5.0.0 です。初回のnpxダウンロードは4.29秒（deprecated警告2本つき）、2回目以降は2.13秒でした。

なお、事前に「`unknown format` で怒られたら `ajv-formats` が必要かも」と心配していたのですが、これは空振りでした。両スキーマを `grep '"format"'` しても0ヒットで、`format` キーワードは1つも使われていませんでした。

### Claude Code準拠レイアウトも作って並べる

比較用に、同じ中身のままマニフェストの置き場だけ変えたディレクトリを作りました。

```bash
cp -r hello-plugin hello-plugin-cc
mkdir -p hello-plugin-cc/.claude-plugin
mv hello-plugin-cc/plugin.json hello-plugin-cc/.claude-plugin/plugin.json
find hello-plugin hello-plugin-cc -type f | sort
```

![仕様準拠レイアウトとClaude Code準拠レイアウトのファイル一覧比較](/images/agent-plugins-spec-claude-code-half-load/01-two-layouts.png)

### 公式の雛形が仕様スキーマで落ちた

ついでに、Claude Code公式のスキャフォールドが何を吐くのかも見ました。

```bash
claude plugin init cc-reference
cat ~/.claude/skills/cc-reference/.claude-plugin/plugin.json
```

```json
{
  "$schema": "https://anthropic.com/claude-code/plugin.schema.json",
  "name": "cc-reference",
  "version": "0.1.0",
  "description": "TODO: describe what this plugin provides",
  "author": {
    "name": "<masked-name>",
    "email": "<masked-email>"
  },
  "skills": [
    "./"
  ]
}
```

これをそのままAgent Plugins 1.0.0のスキーマに当ててみました。

```bash
npx --yes ajv-cli@5 validate --spec=draft2020 \
  -s spec-repo/schemas/1.0.0/plugin.schema.json \
  -d ~/.claude/skills/cc-reference/.claude-plugin/plugin.json \
  --errors=json --all-errors
```

```
~/.claude/skills/cc-reference/.claude-plugin/plugin.json invalid
[
  {
    "instancePath": "",
    "schemaPath": "#/additionalProperties",
    "keyword": "additionalProperties",
    "params": { "additionalProperty": "skills" },
    "message": "must NOT have additional properties"
  },
  {
    "instancePath": "/$schema",
    "schemaPath": "#/properties/%24schema/const",
    "keyword": "const",
    "params": { "allowedValue": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" },
    "message": "must be equal to constant"
  }
]
exit=1
```

これは予想していませんでした。`claude plugin init` は `$schema` を別の標準（`https://anthropic.com/claude-code/plugin.schema.json`）に向けていて、さらに `"skills": ["./"]` という、Agent Plugins側には存在しないフィールドを書きます。標準と実装のズレは、ドキュメントの記述レベルではなく、公式CLIが吐く雛形のレベルで存在していました。

:::message alert
`claude plugin init` を比較用に叩くときは2点注意が必要でした。1つは `~/.claude/skills/<name>/` に作られて次のセッションから自動ロードされること。実際、以降のロード検証すべてで `Found 2 plugins` の2つ目に `cc-reference` が居座り続けたので、検証後に `rm -rf` しました。もう1つは、`author.name` / `author.email` がgit configから自動で埋まることです。雛形の出力をそのまま記事やリポジトリに貼ると自分の名前とメールアドレスが載ります（上のJSONはどちらも伏せてあります）。地味ですが実害があります。
:::

## 実際に作った最小プラグイン

MCPサーバーの登録も確かめたかったので、仕様形式の `mcp.json` を足しました。

```json:hello-plugin/mcp.json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "local-echo": {
      "type": "stdio",
      "command": "./bin/echo-server",
      "cwd": "${PLUGIN_ROOT}"
    }
  }
}
```

中身は `initialize` / `tools/list` / `tools/call` にだけ応答する最小のstdio MCPサーバーです。起動されたかどうかを確実に知りたかったので、起動時に環境変数を痕跡ファイルへ追記させました。

```js:hello-plugin/bin/echo-server
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const traceDir = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
try {
  fs.appendFileSync(
    path.join(traceDir, 'echo-server-started.txt'),
    `started pid=${process.pid} PLUGIN_ROOT=${process.env.PLUGIN_ROOT || ''} CLAUDE_PLUGIN_ROOT=${process.env.CLAUDE_PLUGIN_ROOT || ''} PLUGIN_DATA=${process.env.PLUGIN_DATA || ''} cwd=${process.cwd()}\n`
  );
} catch (e) {
  process.stderr.write(`echo-server: trace write failed: ${e.message}\n`);
}

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo back the given text. Used only to prove the MCP server was registered.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
];
// 以下、1行1JSONを読んで initialize / tools/list / tools/call に応答する
```

単体で叩くと動きました。

```bash
chmod +x hello-plugin/bin/echo-server
printf '%s\n%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
                  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | ./hello-plugin/bin/echo-server
```

```
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"local-echo","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo","description":"Echo back the given text. Used only to prove the MCP server was registered.","inputSchema":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}}]}}
exit=0
```

Claude Code側には同じサーバーを別の書き方で登録します。

```json:hello-plugin-cc/.mcp.json
{
  "mcpServers": {
    "local-echo": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]
    }
  }
}
```

同じ1台のサーバーを登録するだけなのに、書き方はほとんど全部違いました。ファイル名の先頭ドットだけの差だと思っていたので、ここは予想外でした。

| | Agent Plugins 1.0.0 | Claude Code 2.1.227 |
|---|---|---|
| ファイル名 | `mcp.json`（プラグインルート直下） | `.mcp.json`（先頭ドット） |
| `$schema` | 必須（固定値） | 不要（書いても可） |
| `type` | 必須（`stdio` / `streamable-http` / `sse`） | 省略可 |
| パス変数 | `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` | `${CLAUDE_PLUGIN_ROOT}` |
| バンドル実行ファイル | `command: "./bin/echo-server"`（プラグイン相対） | `command: "node"` + `args: ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]` |
| サブプロセスのenv | `PLUGIN_ROOT` / `PLUGIN_DATA` をMUSTで提供 | `CLAUDE_PLUGIN_ROOT` のみ |

逆向きも試しました。Claude Code形式の `.mcp.json` を仕様スキーマに当てると、当然ですが落ちます。

```
hello-plugin-cc/.mcp.json invalid
data must have required property '$schema', data/mcpServers/local-echo must have required property 'type', ... data/mcpServers/local-echo must match exactly one schema in oneOf
exit=1
```

片方をもう片方に機械変換するのは、無理ではないけれど自明でもないな、という感触でした。

## スキーマ検証で分かったこと

### ajvが通っても仕様準拠とは言えない

`mcp.json` について、仕様文のMUSTをわざと踏んだパターンを3つ作って当ててみました。

`command: "bin/echo-server"`（`./` の付け忘れ）は valid / exit=0 でした。仕様文には「`./` 始まりMUST」と書かれているのに、スキーマ側の `command` の制約は `minLength: 1` だけなので通ってしまいます。

`args: ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]`（Claude Code流の書き方）も valid / exit=0 でした。`args` の中身はopaqueな文字列として扱われるのでスキーマは通りますが、仕様 §10 は「他のプレースホルダ展開を行ってはならない」なので、仕様準拠クライアントではリテラル文字列のまま渡って壊れるはずです。

`cwd: "../bin"`（プラグインルートからの脱出）は invalid になりましたが、エラーが10件出ました。

:::details cwdパターン違反のエラー全文（抜粋）
```
[
  { "instancePath": "/mcpServers/local-echo/cwd", "schemaPath": "#/$defs/stdioServer/properties/cwd/pattern", "keyword": "pattern",
    "params": { "pattern": "^(?:\\./|\\$\\{PLUGIN_ROOT\\}(?:/|$)|\\$\\{PLUGIN_DATA\\}(?:/|$))" },
    "message": "must match pattern \"^(?:\\./|\\$\\{PLUGIN_ROOT\\}(?:/|$)|\\$\\{PLUGIN_DATA\\}(?:/|$))\"" },
  { "instancePath": "/mcpServers/local-echo", "schemaPath": "#/required", "keyword": "required",
    "params": { "missingProperty": "url" }, "message": "must have required property 'url'" },
  { "instancePath": "/mcpServers/local-echo", "schemaPath": "#/additionalProperties", "keyword": "additionalProperties",
    "params": { "additionalProperty": "command" }, "message": "must NOT have additional properties" },
  { "instancePath": "/mcpServers/local-echo", "schemaPath": "#/additionalProperties", "keyword": "additionalProperties",
    "params": { "additionalProperty": "cwd" }, "message": "must NOT have additional properties" },
  { "instancePath": "/mcpServers/local-echo/type", "schemaPath": "#/properties/type/const", "keyword": "const",
    "params": { "allowedValue": "streamable-http" }, "message": "must be equal to constant" },
  ... (sse variant についても同じ4件) ...
  { "instancePath": "/mcpServers/local-echo", "schemaPath": "#/oneOf", "keyword": "oneOf",
    "params": { "passingSchemas": null }, "message": "must match exactly one schema in oneOf" }
]
exit=1
```
:::

本当の原因は `cwd` のパターン違反1件だけです。ところがserverの定義が `oneOf`（stdio / streamable-http / sse）になっているので、1つ外すと全分岐のエラーが合流してきます。`must have required property 'url'` と言われて、URLなんて書いていないのにと数分悩みました。`--errors=json --all-errors` にして `schemaPath` が `#/$defs/stdioServer/...` の行だけ拾えば、原因の1件に辿り着けます。エラー文の日本語訳をいくら丁寧に読んでも駄目で、`schemaPath` を見るのが早道でした。

ここまでで分かったのは、ajvが通ったことは仕様準拠の証明にならないということです。パスのcontainment、`./` 必須、プレースホルダ展開の規則といった仕様のMUSTは、スキーマに落ちていません。スキーマ自身のdescriptionにも「The Agent Plugins specification defines additional semantic and operational requirements.」と書いてありました。

### 2つのバリデータの厳しさが逆方向

次に、`claude plugin validate` を両レイアウトに当てました。ここで予想を外しました。

```bash
claude plugin validate ./hello-plugin;             echo "exit=$?"
claude plugin validate ./hello-plugin-cc;          echo "exit=$?"
claude plugin validate ./hello-plugin --strict;    echo "exit=$?"
claude plugin validate ./hello-plugin-cc --strict; echo "exit=$?"
```

仕様準拠レイアウト（root `plugin.json`）:

```
Validating plugin manifest: ~/.../agent-plugins-try/hello-plugin

✘ Found 1 error:

  ❯ directory: No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json

✘ Validation failed
exit=1
```

Claude Code準拠レイアウト:

```
Validating plugin manifest: ~/.../agent-plugins-try/hello-plugin-cc/.claude-plugin/plugin.json

⚠ Found 1 warning:

  ❯ author: No author information provided. Consider adding author details for plugin attribution

✔ Validation passed with warnings
exit=0
```

![仕様準拠がexit 1、Claude Code準拠がexit 0](/images/agent-plugins-spec-claude-code-half-load/02-ccvalidate-asymmetry.png)

予想では「Claude Codeはrootの `plugin.json` を『マニフェスト無し』とみなして、ディレクトリ名から名前を推定して通す」と書いていました。ロードのほうは後述のとおりまさにそうなるのですが、`claude plugin validate` は明示的にerrorを出して exit 1 で落ちました。`--strict` を付けても結果は変わりません（同じerror）。Claude Code準拠側は逆に、`--strict` を付けるとauthorのwarningがerror扱いになって exit 1 になりました。

さらに、マニフェストの書き方で仕様違反を4種類（＋対照実験1種）作って、ajvとClaude Codeの両方に当てました。

#### (a) `name` を書かない

```
--- ajv ---
v-a-noname/.claude-plugin/plugin.json invalid
data must have required property 'name'
ajv exit=1
--- claude plugin validate ---
  ❯ name: Invalid input: expected string, received undefined
✘ Validation failed
cc exit=1
```

両方が一致して落ちました。今回唯一きれいに一致したケースです。

#### (b) `name` を `Hello--Plugin` にする

```
--- ajv ---
data/name must match pattern "^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$"
ajv exit=1
--- claude plugin validate ---
⚠ Found 2 warnings:
  ❯ name: Plugin name "Hello--Plugin" is not kebab-case. Claude Code accepts it, but the Claude.ai marketplace sync requires kebab-case (lowercase letters, digits, and hyphens only, e.g., "my-plugin").
  ❯ author: No author information provided. Consider adding author details for plugin attribution
✔ Validation passed with warnings
cc exit=0
```

ajvはfatal、Claude Codeは "Claude Code accepts it" と明言して通します。

#### (c) `skills/` を `.claude-plugin/` の下に置く

```
--- ajv ---
v-c-nested-skills/.claude-plugin/plugin.json valid
ajv exit=0
--- claude plugin validate ---
⚠ Found 1 warning:
  ❯ author: No author information provided. Consider adding author details for plugin attribution
✔ Validation passed with warnings
cc exit=0
--- ロードすると ---
[DEBUG] Checking plugin hello-plugin: skillsPath=none, skillsPaths=0 paths
[DEBUG] Total plugin skills loaded: 0 (0 duplicate/user-owned entries skipped)
--- スキル呼び出し ---
Unknown command: /hello-plugin:hello
```

これが個人的にいちばん怖かったケースです。両方のバリデータが配置ミスを1文字も指摘しないのに、ロードするとスキルが0件になって消えます。公式ドキュメントが "Common mistake" と呼んでいる踏み方なのに、検証ツールでは検出できませんでした。バリデータを2本通しても安心はできません。

#### (d) `displayName` を足す

```
--- ajv ---
v-d-displayname/.claude-plugin/plugin.json invalid
data must NOT have additional properties
ajv exit=1
--- claude plugin validate ---
⚠ Found 1 warning:
  ❯ author: No author information provided. Consider adding author details for plugin attribution
✔ Validation passed with warnings
cc exit=0
```

`displayName` への言及がゼロでした。ここで手が止まりました。黙って無視されたのか、Claude Codeにとっては正規のフィールドだから何も言わないのか、この出力だけでは区別がつきません。

そこで、意味のないフィールド `totallyBogusField` を入れた対照を1本足しました。

```
"author": { "name": "tester" }, "totallyBogusField": "x"
--- claude plugin validate ---
⚠ Found 1 warning:
  ❯ totallyBogusField: Unknown field 'totallyBogusField'. Claude Code ignores it at load time.
✔ Validation passed with warnings
cc exit=0
```

未知のフィールドには専用のwarningが出ます。つまり `displayName` は「未知フィールドですらない正規フィールド」でした。(d) だけを見て「未知フィールドを黙って無視した」と書いていたら間違っていたことになります。「警告が出ない」ことの意味を確定させるには対照実験が必要でした。

![違反(b)(d)でajvがfatal、Claude Codeが警告どまり](/images/agent-plugins-spec-claude-code-half-load/04-validator-asymmetry.png)

まとめると、標準に厳しく寄せると実装側で無視され、実装に寄せると標準側で落ちる、という向きになっていました。しかも (c) のように両方が見逃す穴もあります。

## 詰まった点：`name` が消え、MCPが静かに欠ける

いよいよ実際にロードします。ここでもう1つ詰まりました。

```bash
claude --debug -p "reply with the single word OK" --plugin-dir ./hello-plugin
```

```
OK
exit=0
```

`--debug` を付けたのに2行しか出ません。読み込み状況を見る手段がないのかと思って一度諦めかけたのですが、`--debug-file` に切り替えたら201行取れました。`-p`（headless）だと `--debug` の出力がstdoutに流れてこないようです。別物でした。

```bash
claude --debug-file "$PWD/logs/10-load-spec.debug.log" \
  -p "reply with the single word OK" --plugin-dir ./hello-plugin > logs/10-load-spec.stdout.log 2>&1
grep -i -e plugin -e skill -e mcp logs/10-load-spec.debug.log
```

```
[DEBUG] clearPluginCache: invalidating loadAllPlugins cache (preAction: --plugin-dir inline plugins)
[DEBUG] Loaded inline plugin from path: hello-plugin
[DEBUG] Loaded 1 session-only plugins from --plugin-dir
[DEBUG] Found 2 plugins (2 enabled, 0 disabled)
[DEBUG] Checking plugin hello-plugin: skillsPath=exists, skillsPaths=0 paths
[DEBUG] Attempting to load skills from plugin hello-plugin default skillsPath: ~/.../hello-plugin/skills
[DEBUG] Loaded 1 skills from plugin hello-plugin default directory
[DEBUG] Total plugin skills loaded: 1 (0 duplicate/user-owned entries skipped)
```

スキルは読めていて、呼び出しも成功しました。

```
SPEC_SKILL_LOADED
exit=0
```

`claude plugin validate` が exit 1 で落ちたレイアウトが、普通にロードできています。バリデータが落ちたから使えない、でもありませんでした。

### プラグイン名はディレクトリ名になる

ログに出ている `hello-plugin` は、マニフェストの `name` なのかディレクトリ名なのか、この時点では区別がつきません（両方 `hello-plugin` なので）。決着をつけるために、ディレクトリ名と `name` をずらしたコピーを作りました。

```bash
cp -r hello-plugin hello-plugin-renamed
# root plugin.json の name を "renamed-plugin" に変更（ディレクトリ名は hello-plugin-renamed）
claude --debug-file "$PWD/logs/10b-load-renamed.debug.log" \
  -p "reply with the single word OK" --plugin-dir ./hello-plugin-renamed
claude -p "/renamed-plugin:hello"       --plugin-dir ./hello-plugin-renamed
claude -p "/hello-plugin-renamed:hello" --plugin-dir ./hello-plugin-renamed
```

```
[DEBUG] Loaded inline plugin from path: hello-plugin-renamed
[DEBUG] Checking plugin hello-plugin-renamed: skillsPath=exists, skillsPaths=0 paths
[DEBUG] Loaded 1 skills from plugin hello-plugin-renamed default directory
```

```
### A) 仕様 manifest の name で呼ぶ: /renamed-plugin:hello
Unknown command: /renamed-plugin:hello
exit=0
### B) ディレクトリ名で呼ぶ: /hello-plugin-renamed:hello
SPEC_SKILL_LOADED
exit=0
```

![nameを変えてもディレクトリ名が採用される決定実験](/images/agent-plugins-spec-claude-code-half-load/03-name-precedence.png)

仕様どおりrootに置いた `plugin.json` の `name` は完全に破棄され、ディレクトリ名が名前空間になっていました。

対照として、マニフェストが `.claude-plugin/` にある場合（ディレクトリ名 `hello-plugin-cc`、`name` は `hello-plugin`）を試すと、`/hello-plugin:hello` が成功して `/hello-plugin-cc:hello` が `Unknown command` になります。同じ `name` フィールドが、置き場所次第で採用と破棄に分かれていました。

### `mcp.json` はログに1行も出ない

MCPのほうも確認しました。仕様準拠レイアウトのデバッグログを `local-echo` や `mcp.json` でgrepすると、ヒットが0件です。

```
=== local-echo / mcp.json への言及（仕様レイアウト）===
grep-exit=1          ← 1行もヒットしない
=== MCP 関連行すべて ===
[DEBUG] [STARTUP] Loading MCP configs...
[DEBUG] [claudeai-mcp] Fetching from https://api.anthropic.com/v1/mcp_servers?limit=1000
[DEBUG] mcp runtime arm: v1 (source: default)
[DEBUG] [STARTUP] MCP configs resolved in 294ms (awaited at +353ms)
[DEBUG] [MCP] --mcp-config servers running fully async (nonblocking)
[DEBUG] [MCP] claude.ai connectors running fully async (nonblocking)
[DEBUG] [claudeai-mcp] Fetched 1 servers
[DEBUG] [mcp-registry] Loaded 294 official MCP URLs (legacy)
=== echo-server の起動痕跡ファイル ===
（なし）
```

エラーも警告も出ません。サブプロセスも起動していません。痕跡ファイルも作られていません。ファイルを置いた側からすると、無視されたことに気づく手がかりがどこにもない状態です。

同じ手順をClaude Code準拠レイアウトに当てると、こちらは接続します。

```
[DEBUG] MCP server "plugin:hello-plugin:local-echo": Starting connection with timeout of 30000ms
[DEBUG] MCP server "plugin:hello-plugin:local-echo": Successfully connected (transport: stdio) in 539ms
[DEBUG] MCP server "plugin:hello-plugin:local-echo": Connection established with capabilities: {"hasTools":true,"hasPrompts":false,"hasResources":false,"hasResourceSubscribe":false,"serverVersion":{"name":"local-echo","version":"1.0.0"}}
[DEBUG] [MCP] Server "plugin:hello-plugin:local-echo" connected with subscribe=false
[DEBUG] MCP server "plugin:hello-plugin:local-echo": Sending SIGINT to MCP server process
[DEBUG] MCP server "plugin:hello-plugin:local-echo": UNKNOWN connection closed after 2s (cleanly)
[DEBUG] MCP server "plugin:hello-plugin:local-echo": MCP server process exited cleanly
```

![仕様形式のmcp.jsonは言及ゼロ、.mcp.jsonは接続成功](/images/agent-plugins-spec-claude-code-half-load/06-mcp-contrast.png)

痕跡ファイルを仕込んでおいたので、サブプロセスに渡された環境変数も読めました。

```
started pid=75236 PLUGIN_ROOT= CLAUDE_PLUGIN_ROOT=~/.../hello-plugin-cc PLUGIN_DATA= cwd=~/.../agent-plugins-try
```

仕様 §9 は `PLUGIN_ROOT` と `PLUGIN_DATA` をMUSTで渡すと定めていますが、両方とも空でした。`cwd` も、仕様 §7.2.2 の「省略時はプラグインルート」ではなく、`claude` を起動したディレクトリになっていました。ここは事前に予想していなかった追加のズレです。

結果として、仕様準拠レイアウトとClaude Code準拠レイアウトの差はこうなりました。スキルは両方で読める。名前の決まり方は逆（一方はディレクトリ名、一方はマニフェストの `name`）。MCPはClaude Code準拠側だけ動く。片方が丸ごと動かないなら分かりやすいのですが、半分だけ読めるという壊れ方をします。仕様準拠プラグインを配ると「スキルは動くのにMCPだけ静かに欠ける」ものができるわけで、この中途半端さが一番厄介だと感じました。

## 「標準」と「クライアント独自形式」の現在地

仕様側には、クライアント固有のデータを持つための逃げ道 `extensions` が用意されています。逆ドメイン名をキーにする形式です。

```json
"extensions": {
  "com.anthropic.claude-code": { "displayName": "Hello From Extensions" }
}
```

これが効くのか試しました。

```
--- 1) ajv (Agent Plugins 1.0.0) ---
ext-plugin/.claude-plugin/plugin.json valid
ajv exit=0
--- 2) claude plugin validate ---
⚠ Found 2 warnings:
  ❯ extensions: Unknown field 'extensions'. Claude Code ignores it at load time.
  ❯ author: No author information provided. Consider adding author details for plugin attribution
✔ Validation passed with warnings
cc exit=0
--- 3) --strict ---
✘ Validation failed (--strict treats warnings as errors)
cc --strict exit=1
--- 4) ロードして displayName が使われるか ---
OK
exit=0
--- debug log 内の extensions / displayName / Hello From ---
grep exit=1          ← 1行もヒットしない
```

![extensionsがUnknown fieldとして無視される](/images/agent-plugins-spec-claude-code-half-load/05-extensions-ignored.png)

2026年8月15日時点のClaude Code 2.1.227では、`extensions` は「Unknown field」として明示的に無視されます。ロード時のデバッグログにも痕跡はありません。困るのはそこではなく、`--strict` を使うと exit 1 になる点でした。仕様が推奨する書き方が、Claude CodeのCIを落とします。標準側は互換の逃げ道を用意したけれど、クライアントはまだ読んでいない段階なので、移行期は逃げ道が逆に足を引っ張ります。

では「1ファイルだけ動かせば両対応になるのか」も試しました。rootに `plugin.json`（`name: spec-side-name`）、`.claude-plugin/` にも `plugin.json`（`name: cc-side-name`）、`mcp.json` と `.mcp.json` の両方、を置いたディレクトリです。

```
hello-plugin-both/plugin.json valid           (ajv exit=0)
hello-plugin-both/mcp.json valid              (ajv exit=0)
✔ Validation passed with warnings             (cc exit=0, warning は author のみ)
[DEBUG] Loaded inline plugin from path: cc-side-name
[DEBUG] Loaded 1 skills from plugin cc-side-name default directory
[DEBUG] MCP server "plugin:cc-side-name:local-echo": Successfully connected (transport: stdio) in 127ms
--- /cc-side-name:hello ---   SPEC_SKILL_LOADED
--- /spec-side-name:hello --- Unknown command: /spec-side-name:hello
```

実務的には動きました。ajvも `claude plugin validate` も通り、スキルもMCPも読めます。採用されるのは `.claude-plugin/` 側の `name` です。ただ、仕様 §6 は「他のいかなるファイルもroot `plugin.json` のコアフィールドを置き換え・補完・上書きできない」と定めているので、この両方置きはその原則にグレーに触れます。そしてajvは `.claude-plugin/` の存在を検出できません。スキーマ検証はJSONファイル1本の中身を見るだけなので、配置の問題は原理的に見えないわけです。

最後に、仕様 §7.1 の「`skills/` より深い階層を再帰探索してはならない（MUST NOT）」を踏んでみました。`skills/hello/SKILL.md`（直下・仕様OK）と `skills/nested/deeper/SKILL.md`（深い階層）を並べます。

```
[DEBUG] Loaded 1 skills from plugin nested-plugin default directory
[DEBUG] Total plugin skills loaded: 1 (0 duplicate/user-owned entries skipped)
--- /nested-plugin:hello（直下・仕様OK）---   SPEC_SKILL_LOADED
--- /nested-plugin:deeper（深い階層）---      Unknown command: /nested-plugin:deeper
--- /nested-plugin:nested ---                Unknown command: /nested-plugin:nested
```

![深い階層のSKILL.mdが拾われない](/images/agent-plugins-spec-claude-code-half-load/07-nested-skills.png)

こちらは仕様どおりでした。読み込まれたのは `hello` の1件だけです。ちなみに §7.1 は「不正なスキルはSHOULD report」とも書いていますが、`skills/nested/` がSKILL.mdを持たないディレクトリであることについて警告は1行も出ませんでした（SHOULDなので違反ではありません）。

つまりClaude Code 2.1.227は、§7.1（再帰禁止）は守っていて、§6.1（マニフェスト位置）・§7.2（MCP設定位置）・§9（サブプロセスのenv）は守っていない、という状態でした。守っているMUSTと守っていないMUSTが並んで見えるのが、この検証でいちばん面白かったところです。

## どんな人に向いていそうか

今スキルを書いていて、Claude Codeで使いつつ仕様にも寄せておきたいという人は、両方置き（root `plugin.json` と `.claude-plugin/plugin.json`、`mcp.json` と `.mcp.json` を併置）が現状の妥協点になりそうです。ajvも `claude plugin validate` も通り、スキルもMCPも読めます。ただし前述のとおり仕様 §6 の「唯一のマニフェスト」原則にグレーに触れるので、移行期の回避策と割り切る前提です。仕様側がこの状況をどう整理するのかは追えていません。

逆に、今すぐ「1つ書けばどのエージェントでも動く」を期待するのは早い印象でした。少なくともClaude Codeについては、仕様どおりに書くとMCPが欠けます。

今回範囲外にしたことも書いておきます。マーケットプレイスへの公開・配布（`claude plugin marketplace` / `install`）は試していません。VS CodeやCursorなど他クライアントでの読み込みも未検証で、[VS Code側のドキュメント](https://code.visualstudio.com/docs/agent-customization/agent-plugins)は存在しているので、ここは次に確かめたいところです。MCPについても接続確立とツール一覧の登録までで判定していて、LLMから実際に `tools/call` するところまではやっていません。

## まとめ

仕様準拠のプラグインをClaude Code 2.1.227に渡した結果は、「半分だけ読める」でした。

1. スキルは読める（`skills/<name>/SKILL.md` の位置が一致しているため）
2. プラグイン名は捨てられる（root `plugin.json` の `name` は無言で無視され、ディレクトリ名が採用される）
3. MCPは登録されない（`mcp.json` は読まれず、警告も出ない）
4. さらに `claude plugin validate` は仕様準拠レイアウトを exit 1 で落とす

4番目は予想を外しました。「マニフェスト無しとして通る」と思っていたので、バリデータとローダーで寛容さが違うというのは意外でした。事前に書いた7項目の予想のうち、的中6、半分外し1でした。それとは別に、まったく予想していなかった発見（`claude plugin init` の雛形が仕様スキーマでinvalid）が1つありました。

作業の中で効いたのは、スキルに固定マーカーを出させたことと、MCPサーバーに起動痕跡を書かせたことです。「読み込まれた気がする」を文字列一致に落とせたので、7レイアウトぶん並べても判断がぶれませんでした。逆に、`displayName` の件のように「警告が出ないこと」の意味を確定させるには、もう1本対照実験を足すしかありませんでした。この手の確認をどこまでやれば十分なのかは、正直まだ掴めていません。

### 手元で追いかけるときの最短手順

```bash
mkdir -p agent-plugins-try/logs && cd agent-plugins-try
{ node -v; npx --version; claude --version; date; uname -a; } | tee logs/00-env.log

git clone --depth 1 https://github.com/agentplugins/agent-plugins-spec spec-repo

# 1) 仕様準拠レイアウトを作る（root plugin.json + skills/hello/SKILL.md + mcp.json + bin/echo-server）
# 2) スキーマ検証（--spec=draft2020 が必須）
npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/plugin.schema.json -d hello-plugin/plugin.json --errors=text
npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/mcp.schema.json    -d hello-plugin/mcp.json    --errors=text

# 3) Claude Code のバリデータに当てる（終了コードまで見る）
claude plugin validate ./hello-plugin;    echo "exit=$?"
claude plugin validate ./hello-plugin-cc; echo "exit=$?"

# 4) 実際にロードして読み込み状況を採る（--debug ではなく --debug-file）
claude --debug-file "$PWD/logs/load.debug.log" -p "reply with the single word OK" --plugin-dir ./hello-plugin
grep -i -e plugin -e skill -e mcp logs/load.debug.log

# 5) スキルが呼べるか（名前空間はディレクトリ名 or manifest の name）
claude -p "/hello-plugin:hello" --plugin-dir ./hello-plugin
```

同じことをやる人向けのハマりどころ:

- `--spec=draft2020` は必須です。付けないと `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` で落ちます。`ajv-formats` は不要でした（両スキーマに `format` がありません）。
- `--debug` は `-p` と組み合わせてもstdoutにデバッグ行が来ません。`--debug-file <path>` を使います。
- `claude plugin init` は `~/.claude/skills/<name>/` に作られて次セッションから自動ロードされます。比較用に作ったら削除してください。`author.email` がgit configから自動で埋まるので、出力を公開する前にマスクも必要です。
- `claude plugin validate` の結果とロードの結果は一致しません。validateが exit 1 でもロードは通ることがあります。
- ヒアドキュメントでファイルを作った直後に `claude -p` を回すと `Warning: no stdin data received in 3s, proceeding without it.` が出ました。`< /dev/null` を足すと消えます。
- 結論はクライアントのバージョンに強く依存します。この記事はClaude Code 2.1.227での観測です。

## 参考リンク

- [agentplugins/agent-plugins-spec（仕様とJSON Schema）](https://github.com/agentplugins/agent-plugins-spec)
- [Claude Code Plugins（公式ドキュメント）](https://code.claude.com/docs/en/plugins)
- [Agent plugins in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [Agent Plugins: package your skills, tools, and more（Google Developers Blog）](https://developers.googleblog.com/agent-plugins-package-your-skills-tools-and-more/)
- [Introducing Agent Plugins（Vercel）](https://vercel.com/blog/introducing-agent-plugins)
- [AWS supports Agent Plugins](https://aws.amazon.com/blogs/opensource/aws-supports-agent-plugins-an-open-standard-for-portable-agent-extensions/)
