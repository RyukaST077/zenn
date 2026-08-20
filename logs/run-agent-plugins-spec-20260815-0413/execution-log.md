# 検証ログ: Agent Plugins 1.0.0 の仕様どおりにプラグインを作り、Claude Code で読めるか試す

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-agent-plugins-spec-20260815-0409.md`
- 出典レポート: `research/search-topic-20260815-0403.md`
- 対象技術: Agent Plugins Specification 1.0.0（`plugin.json` / `skills/<name>/SKILL.md` / `mcp.json`）と Claude Code のプラグイン実装
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-15 04:13〜04:26 JST / 見積もり 5h20m → 実測 約13分 <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5（Darwin 25.5.0, arm64）/ Node.js v22.17.0 / npx 10.9.2 / ajv-cli 5.0.0 / Claude Code 2.1.227
- 仕様リポジトリ commit: `bd383552095128f6effe895b9257cfd580a6d179`（2026-08-06）
- 採用した撤退ライン: 対象タスクの想定リスク欄をそのまま採用（1タスク30分で詰まったら記録してスキップ / `claude --plugin-dir` の入れ子実行が失敗したら静的検証に切替 / フェーズ3が2時間超ならフェーズ4を放棄）。**いずれも発動せず**
- 判断方針: 引数で渡されたのは対象タスクファイルのパスのみ。時間・撤退ライン・成果物置き場はすべてデフォルト前提（`logs/run-agent-plugins-spec-20260815-0413/workspace/`）
- Playwright の扱い: 対象タスクの宣言どおりブラウザUIを持たないテーマなので**完了条件の判定はCLI出力・終了コード・保存ログで行った**。ただし記事用の図として、取得済みログの中身を Playwright でターミナル風にレンダリングしてPNG化した（画像の文字列はすべて `logs/` の実出力。ホームパスは `~` に置換済み）

## 結果サマリー

- 完了条件の判定: **達成**（完了条件1〜5すべて。詳細は次節）
- 作ったもの: 同一内容のプラグインを7レイアウト（仕様準拠 / Claude Code 準拠 / 両方置き / 違反4種 / extensions / 再帰探索）で並置した検証用ディレクトリ ＋ 最小 stdio MCP サーバー。`workspace/agent-plugins-try/`
- スクショ: 7 枚（`screenshots/`）
- 詰まった点: 4 件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: なし（4件はいずれも対象タスクの「詰まりそうなポイント」表で予告済みか、その場で1手で解決したため、再利用価値のある新規トラブルではないと判断）
- 予想を外した点: 1件（`claude plugin validate` は仕様準拠レイアウトを「マニフェスト無しとして通す」と予想 → 実際は **exit 1 の error で落とす**）
- 想定外の発見: 1件（**`claude plugin init` の公式スキャフォールドが Agent Plugins 1.0.0 スキーマで invalid**）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `hello-plugin/plugin.json` と `mcp.json` が `npx ajv-cli validate --spec=draft2020` で valid になり、そのログが残っている | **達成** | `logs/03-ajv-plugin.log`（`hello-plugin/plugin.json valid` / exit=0）、`logs/05-ajv-mcp.log`（`hello-plugin/mcp.json valid` / exit=0） |
| 2 | `claude plugin validate ./hello-plugin` と `./hello-plugin-cc` の両方を実行し、終了コードと出力全文が残っている | **達成** | `logs/06-ccvalidate-spec.log`(exit=1) / `logs/07-ccvalidate-cc.log`(exit=0) / `logs/08-ccvalidate-spec-strict.log`(exit=1) / `logs/09-ccvalidate-cc-strict.log`(exit=1)、`screenshots/02-ccvalidate-asymmetry.png` |
| 3 | `claude --plugin-dir ./hello-plugin` でスキルが読めたか、読めた場合はどの名前空間になったかが判定でき、根拠のログが残っている | **達成** | 読めた。名前空間は**ディレクトリ名**。`logs/10-load-spec.debug.log` / `logs/10-load-spec.grep.log`（`Loaded 1 skills from plugin hello-plugin default directory`）、`logs/11-invoke-spec.log`（`SPEC_SKILL_LOADED`）、決定実験は `logs/10b-load-renamed.grep.log` / `logs/11b-invoke-renamed.log`、`screenshots/03-name-precedence.png` |
| 4 | 違反パターン3種＋(d) のエラーメッセージ全文が残っている | **達成** | `logs/14-violation-a.log` / `logs/15-violation-b.log` / `logs/16-violation-c.log`（ロード結果込み） / `logs/17-violation-d.log`、追加実験 `logs/17b-violation-e-bogus.log`、`screenshots/04-validator-asymmetry.png` |
| 5 | `RESULTS.md` に「仕様準拠 × 2バリデータ × 2レイアウト」のマトリクスが埋まっている | **達成** | `RESULTS.md`（11行 × 7列のマトリクス＋予想vs実測列＋mcp.jsonフィールド単位の表＋MCP設定3形式の差分表） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 40分 → 実測 約2分）

- [x] 検証用の作業ディレクトリを作り、環境バージョンを1ファイルに固定する（見積もり 10分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    mkdir -p agent-plugins-try/logs && cd agent-plugins-try
    { node -v; npx --version; claude --version; date; uname -a; } 2>&1 | tee logs/00-env.log
    ```
  - 出力（全文）:
    ```
    v22.17.0
    10.9.2
    2.1.227 (Claude Code)
    Sat Aug 15 04:13:57 JST 2026
    Darwin katayamaryuunosukes-MacBook-Pro.local 25.5.0 Darwin Kernel Version 25.5.0: Mon Apr 27 20:39:09 PDT 2026; root:xnu-12377.121.6~2/RELEASE_ARM64_T6020 arm64
    ```
  - 記事に書きたい気づき: 仕様は 1.0.0 でクライアント対応が流動的なので、この5行が記事の再現性の土台になる。特に **Claude Code のバージョン**は結論の有効期限そのもの

- [x] 仕様リポジトリからスキーマと仕様書を取得し、必須フィールドを自分の手で確認する（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    git clone --depth 1 https://github.com/agentplugins/agent-plugins-spec spec-repo 2>&1 | tee logs/01-clone.log
    ls spec-repo/schemas/1.0.0/
    node -e 'const s=require("./spec-repo/schemas/1.0.0/plugin.schema.json");
      console.log("$schema:", s.$schema); console.log("required:", s.required);
      console.log("properties:", Object.keys(s.properties));
      console.log("additionalProperties:", s.additionalProperties);
      console.log("name pattern:", s.properties.name.pattern)' 2>&1 | tee logs/02-schema-fields.log
    grep -n '"format"' spec-repo/schemas/1.0.0/*.json   # → 0ヒット
    git -C spec-repo log -1 --format='%H %ad %s'
    ```
  - 出力（全文）:
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
    ---mcp---
    $schema: https://json-schema.org/draft/2020-12/schema
    required: [ '$schema', 'mcpServers' ]
    properties: [ '$schema', 'mcpServers' ]
    additionalProperties: false
    ```
    ```
    bd383552095128f6effe895b9257cfd580a6d179 Thu Aug 6 10:26:00 2026 -0500 Merge pull request #38 from agentplugins/agent/clarify-standard-terminology
    ```
  - つまずいた理由・分かっていなかった前提: **「必須は2つだけ」は本当だった**が、その代わり `additionalProperties: false` で閉じられているので「書けるものが10個しかない」という制約が強い。必須が少ないことと自由度が高いことは別
  - 追加で確認したこと（あとで役に立った）: 両スキーマとも `format` キーワードを**1つも使っていない**。対象タスクが「要確認」としていた `ajv-formats` 依存の懸念は空振りだった
  - 記事に書きたい気づき: `$schema` は `const` で固定値チェックされる。つまり `$schema` は「取得先URL」ではなく**バージョン識別子**として機能している（仕様 §6.1.1 も「クライアントはプラグイン読み込み時にスキーマを取得してはならない (MUST NOT)」と明記）

- [x] Claude Code 側の期待レイアウトを確認し、仕様との差分を先に表にする（見積もり 15分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    { echo "=== claude plugin --help ==="; claude plugin --help;
      echo "=== claude plugin validate --help ==="; claude plugin validate --help; } 2>&1 | tee logs/02b-claude-plugin-help.log
    ```
  - 出力の要点（全文は `logs/02b-claude-plugin-help.log`）:
    ```
    validate [options] <path>            Validate a plugin or marketplace manifest
    Options:
      --strict    Treat warnings as errors (exit 1). Use in CI to fail on
                  unrecognized fields, missing metadata, and other issues that the
                  runtime tolerates.
    init|new [options] <name>            Scaffold a new plugin at
                                         ~/.claude/skills/<name>/ (auto-loads next
                                         session as <name>@skills-dir)
    ```
  - 効いた対処: 実測に入る前に `RESULTS.md` の「予想」列を7行ぶん埋めた。結果として**1行だけ外れ**、そこが記事の山場になった
  - 記事に書きたい気づき: `--strict` の説明文に "issues that the runtime tolerates" と書かれている。**「実行時は許すが CI では落とす」という二段構え**が Claude Code 側の設計思想

### フェーズ2: 環境構築（見積もり 40分 → 実測 約2分）

- [x] 仕様準拠プラグイン `hello-plugin/` の最小構成を作る（見積もり 15分 → 実測 <1分）
  - 作ったファイル（記事にそのまま貼れる形）:
    ```json
    // hello-plugin/plugin.json
    {
      "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      "name": "hello-plugin",
      "version": "1.0.0",
      "description": "Agent Plugins 1.0.0 spec conformance test plugin"
    }
    ```
    ```md
    <!-- hello-plugin/skills/hello/SKILL.md -->
    ---
    name: hello
    description: Print a fixed marker string SPEC_SKILL_LOADED. Use when the user asks to run the hello skill or to verify that this plugin's skill is loaded.
    ---

    # hello

    このスキルが読み込まれているかを確認するためだけのスキル。

    ## 手順

    1. 次の1行だけを出力する（他の文字は出力しない）:

    ```
    SPEC_SKILL_LOADED
    ```
    ```
  - 効いた工夫: SKILL.md に **`SPEC_SKILL_LOADED` という固定マーカー**を出力させた。「読み込まれたか」を文字列一致で機械判定できるので、以降のロード検証がすべて自動化できた
  - 記事に書きたい気づき: 検証用スキルは「マーカーを1行出すだけ」にすると、判定が主観にならない

- [x] `ajv-cli` で `plugin.json` をスキーマ検証する（見積もり 15分 → 実測 <1分。**詰まった点1**）
  - 実行したコマンド:
    ```bash
    # まず --spec を付けずに、わざと1回落とす
    npx --yes ajv-cli@5 validate \
      -s spec-repo/schemas/1.0.0/plugin.schema.json \
      -d hello-plugin/plugin.json --errors=text 2>&1 | tee logs/03-ajv-plugin.log

    # 付けて成功させる
    npx --yes ajv-cli@5 validate --spec=draft2020 \
      -s spec-repo/schemas/1.0.0/plugin.schema.json \
      -d hello-plugin/plugin.json --errors=text 2>&1 | tee -a logs/03-ajv-plugin.log
    ```
  - 出たエラー（全文）:
    ```
    npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
    npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
    schema spec-repo/schemas/1.0.0/plugin.schema.json is invalid
    error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
    npx --yes ajv-cli@5 validate -s spec-repo/schemas/1.0.0/plugin.schema.json -d  2.43s user 0.97s system 79% cpu 4.286 total
    exit=1
    ```
  - 付けた後の成功出力（全文）:
    ```
    hello-plugin/plugin.json valid
    npx --yes ajv-cli@5 validate --spec=draft2020 -s  -d hello-plugin/plugin.json  1.33s user 0.40s system 80% cpu 2.131 total
    exit=0
    ```
  - 効いた対処: `--spec=draft2020` を付けるだけ。所要 <1分
  - つまずいた理由・分かっていなかった前提: `error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` は一見「ネットワークに繋がらない」ように読めるが、実際は**ajv 本体が draft 2020-12 のメタスキーマを積んでいない**（既定は draft-07 相当）というだけ。取得の問題ではない
  - 実際に入ったバージョン: ajv-cli **5.0.0**（`npm view ajv-cli version` も 5.0.0）。`npx ajv-cli validate` が動くのは、パッケージ名 → 単一bin（`ajv`）の解決が効いているため
  - npx の初回ダウンロード: 実測 4.29s（deprecated 警告2本つき）。2回目以降は 2.13s
  - 記事に書きたい気づき: 「公式が JSON Schema を公開している＝すぐ検証できる」ではなかった。**バリデータ側が draft 2020-12 を明示的に要求される**のが、新人が最初に踏む壁
  - スクショ: なし（`04-validator-asymmetry.png` の中でエラー文の系統を示す）

- [x] Claude Code 準拠レイアウト `hello-plugin-cc/` を作る＋`claude plugin init` の雛形と比較（見積もり 10分 → 実測 約1分。**想定外の発見**）
  - 実行したコマンド:
    ```bash
    cp -r hello-plugin hello-plugin-cc
    mkdir -p hello-plugin-cc/.claude-plugin
    mv hello-plugin-cc/plugin.json hello-plugin-cc/.claude-plugin/plugin.json
    find hello-plugin hello-plugin-cc -type f | sort 2>&1 | tee logs/04a-layouts.log

    claude plugin init cc-reference 2>&1 | tee logs/04-plugin-init.log
    find ~/.claude/skills/cc-reference -type f | sort
    cat ~/.claude/skills/cc-reference/.claude-plugin/plugin.json
    ```
  - 出力（全文）:
    ```
    ✔ Created plugin "cc-reference" at ~/.claude/skills/cc-reference
      It will auto-load next session as cc-reference@skills-dir. Run /reload-plugins to load it now.
      Disable: claude plugin disable cc-reference@skills-dir. Remove: delete the directory.
    exit=0
    ~/.claude/skills/cc-reference/.claude-plugin/plugin.json
    ~/.claude/skills/cc-reference/SKILL.md
    ```
    ```json
    {
      "$schema": "https://anthropic.com/claude-code/plugin.schema.json",
      "name": "cc-reference",
      "version": "0.1.0",
      "description": "TODO: describe what this plugin provides",
      "author": {
        "name": "RyukaST077",
        "email": "<masked-email>"
      },
      "skills": [
        "./"
      ]
    }
    ```
  - 追加で試したこと（ここが想定外の発見）: 公式スキャフォールドが吐いた manifest を、そのまま Agent Plugins 1.0.0 スキーマに当てた
    ```bash
    npx --yes ajv-cli@5 validate --spec=draft2020 \
      -s spec-repo/schemas/1.0.0/plugin.schema.json \
      -d ~/.claude/skills/cc-reference/.claude-plugin/plugin.json \
      --errors=json --all-errors 2>&1 | tee logs/04b-ajv-ccinit.log
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
  - 既存技術と比べて感じた違い: `claude plugin init` は `$schema` を `https://anthropic.com/claude-code/plugin.schema.json`（別の標準）に向け、さらに `"skills": ["./"]` という**仕様に存在しないフィールド**を書く。**公式ツールが吐く雛形は Agent Plugins 1.0.0 準拠ではない**
  - 注意（環境汚染）: `claude plugin init` は `~/.claude/skills/<name>/` に作られ**次セッションから自動ロード**される。実測でも、以降の全ロード検証で `Found 2 plugins` の2つ目に `cc-reference` が居座り続けた。検証後に削除した（`logs/21-cleanup.log`）
  - **秘密情報の注意**: `claude plugin init` は git config から `author.name` / `author.email` を自動で埋める。ログに個人のメールアドレスが入ってしまったので `<masked-email>` にマスクした（`logs/22-secret-scan.log`）。**記事にスキャフォールド出力を貼るときは要注意**
  - スクショ: `screenshots/01-two-layouts.png`（2レイアウトのファイル一覧比較）
  - 記事に書きたい気づき: 標準と実装のズレは「ドキュメントの記述」レベルではなく**公式CLIが吐く雛形**のレベルで存在している

### フェーズ3: 実装・検証【本編】（見積もり 130分 → 実測 約5分）

- [x] `mcp.json`（仕様形式）とローカル stdio MCP サーバーを追加し、スキーマ検証する（見積もり 25分 → 実測 約2分）
  - 作ったファイル:
    ```json
    // hello-plugin/mcp.json
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
    `hello-plugin/bin/echo-server` は Node 製の最小 stdio MCP サーバー（`initialize` / `tools/list` / `tools/call` のみ。ネットワーク不要・認証不要）。**起動されたら `PLUGIN_ROOT` / `CLAUDE_PLUGIN_ROOT` / `PLUGIN_DATA` / `cwd` を痕跡ファイルに追記する**ようにした（全文は `workspace/agent-plugins-try/hello-plugin/bin/echo-server`）
  - 実行したコマンド:
    ```bash
    chmod +x hello-plugin/bin/echo-server
    printf '%s\n%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
                      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
      | ./hello-plugin/bin/echo-server 2>&1 | tee logs/05a-echo-server-smoke.log

    npx --yes ajv-cli@5 validate --spec=draft2020 \
      -s spec-repo/schemas/1.0.0/mcp.schema.json \
      -d hello-plugin/mcp.json --errors=text 2>&1 | tee logs/05-ajv-mcp.log
    ```
  - 出力（全文）:
    ```
    {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"local-echo","version":"1.0.0"}}}
    {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo","description":"Echo back the given text. Used only to prove the MCP server was registered.","inputSchema":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}}]}}
    exit=0
    ```
    ```
    ### 1) 仕様準拠 mcp.json
    hello-plugin/mcp.json valid
    exit=0
    ```
  - **わざと踏んだ違反3種の結果（全文は `logs/05-ajv-mcp.log`）**:
    - `command: "bin/echo-server"`（`./` 付け忘れ） → **`valid` / exit=0**。仕様文は「`./` 始まり MUST」なのに**スキーマは通す**（`command` の制約は `minLength: 1` だけ）
    - `cwd: "../bin"`（プラグインルート脱出） → `invalid` / exit=1。ただし `oneOf` の全分岐が失敗して**10個のエラー**が出る:
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
    - `args: ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]`（Claude Code 流の書き方） → **`valid` / exit=0**。`args` は opaque string なのでスキーマは通る。仕様 §10 は「他のプレースホルダ展開を行ってはならない」なので、仕様準拠クライアントでは**リテラル文字列のまま渡って壊れる**
  - つまずいた理由・分かっていなかった前提: **「ajv が通った＝仕様準拠」ではない**。仕様の MUST のうち、パス containment・`./` 必須・プレースホルダ展開規則などは**スキーマに落ちていない**（スキーマ自身が「The Agent Plugins specification defines additional semantic and operational requirements.」と description に書いている）
  - 記事に書きたい気づき: `oneOf` のエラーは初心者に最悪。本当の原因は `cwd` のパターン違反1件だけなのに、"must have required property 'url'" のような**無関係な誤誘導が9件混ざる**。エラー文だけ見て原因に辿り着くのは難しかった

- [x] Claude Code 用に `.mcp.json` を作り、2つのMCP設定形式の差分を確定させる（見積もり 20分 → 実測 <1分）
  - 作ったファイル:
    ```json
    // hello-plugin-cc/.mcp.json
    {
      "mcpServers": {
        "local-echo": {
          "command": "node",
          "args": ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]
        }
      }
    }
    ```
  - 逆向きの検証（`.mcp.json` を仕様スキーマに当てる。`logs/25-ajv-matrix-fill.log`）:
    ```
    hello-plugin-cc/.mcp.json invalid
    data must have required property '$schema', data/mcpServers/local-echo must have required property 'type', data/mcpServers/local-echo must have required property 'type', data/mcpServers/local-echo must have required property 'url', data/mcpServers/local-echo must NOT have additional properties, data/mcpServers/local-echo must NOT have additional properties, data/mcpServers/local-echo must have required property 'type', data/mcpServers/local-echo must have required property 'url', data/mcpServers/local-echo must NOT have additional properties, data/mcpServers/local-echo must NOT have additional properties, data/mcpServers/local-echo must match exactly one schema in oneOf
    exit=1
    ```
  - 確定した差分（記事の表1本ぶん / 詳細は `RESULTS.md`）: 同じ1台のMCPサーバーを登録するのに **ファイル名（`mcp.json` / `.mcp.json`）・`$schema` の有無・`type` の有無・パス変数（`${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}`）・バンドル実行ファイルの指定方法（`command: "./bin/..."` / `command: "node"` + `args`）の5つが違う**
  - 記事に書きたい気づき: 差分が「ドット1つ」だけだと思っていたが、実際は書き方がほぼ全部違う。片方をもう片方に機械変換するのは無理ではないが自明でもない

- [x] `claude plugin validate` を両レイアウトに当て、終了コードまで記録する（見積もり 20分 → 実測 約1分。**予想を外した点**）
  - 実行したコマンド:
    ```bash
    claude plugin validate ./hello-plugin          > logs/06-ccvalidate-spec.log 2>&1; echo "exit=$?" >> logs/06-ccvalidate-spec.log
    claude plugin validate ./hello-plugin-cc       > logs/07-ccvalidate-cc.log 2>&1; echo "exit=$?" >> logs/07-ccvalidate-cc.log
    claude plugin validate ./hello-plugin --strict    > logs/08-ccvalidate-spec-strict.log 2>&1; echo "exit=$?" >> logs/08-ccvalidate-spec-strict.log
    claude plugin validate ./hello-plugin-cc --strict > logs/09-ccvalidate-cc-strict.log 2>&1; echo "exit=$?" >> logs/09-ccvalidate-cc-strict.log
    ```
  - 出力（全文・4本）:
    ```
    Validating plugin manifest: ~/.../agent-plugins-try/hello-plugin

    ✘ Found 1 error:

      ❯ directory: No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json

    ✘ Validation failed
    exit=1
    ```
    ```
    Validating plugin manifest: ~/.../agent-plugins-try/hello-plugin-cc/.claude-plugin/plugin.json

    ⚠ Found 1 warning:

      ❯ author: No author information provided. Consider adding author details for plugin attribution

    ✔ Validation passed with warnings
    exit=0
    ```
    `--strict` 版: 仕様準拠側は**同じ error で exit=1**（`--strict` の有無で結果は変わらない）。Claude Code 準拠側は同じ warning のまま `✘ Validation failed (--strict treats warnings as errors)` で **exit=1**
  - **予想を外した点**: 「Claude Code は root の `plugin.json` を『マニフェスト無し』とみなして、ディレクトリ名から名前を推定して**通す**」と予想していた。実際は `claude plugin validate` は**明示的に error を出して exit 1**。つまり**バリデータとローダーの寛容さが違う**（後述のロード検証では同じレイアウトが普通に読めた）
  - 記事に書きたい気づき: `claude plugin validate` が落ちても `claude --plugin-dir` は動く。**「バリデータが落ちた＝使えない」でもなかった**というのが一番意外だった
  - スクショ: `screenshots/02-ccvalidate-asymmetry.png`

- [x] `claude --plugin-dir` で仕様準拠プラグインを実際にロードし、読み込み結果を採る（見積もり 25分 → 実測 約2分。**この検証の中心**）
  - 実行したコマンド（`--debug` だけでは `-p` の標準出力にデバッグ行が出なかったので `--debug-file` に切替。**詰まった点2**）:
    ```bash
    # NG: -p と組み合わせるとデバッグ出力が stdout に来ない（logs/10-load-spec.log は2行だけ）
    claude --debug -p "reply with the single word OK" --plugin-dir ./hello-plugin > logs/10-load-spec.log 2>&1

    # OK: --debug-file でファイルに書かせる（201行取れた）
    claude --debug-file "$PWD/logs/10-load-spec.debug.log" \
      -p "reply with the single word OK" --plugin-dir ./hello-plugin > logs/10-load-spec.stdout.log 2>&1
    grep -i -e plugin -e skill -e mcp logs/10-load-spec.debug.log | tee logs/10-load-spec.grep.log
    ```
  - `--debug` 版の出力（全文。これが2行しかなかった）:
    ```
    OK
    exit=0
    ```
  - `--debug-file` から抜いた決定的な行（全文は `logs/10-load-spec.grep.log`）:
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
  - スキル呼び出し（`logs/11-invoke-spec.log`）:
    ```
    SPEC_SKILL_LOADED
    exit=0
    ```
  - **決定的な実験（`name` をディレクトリ名と違う値にする）**:
    ```bash
    cp -r hello-plugin hello-plugin-renamed
    # root plugin.json の name を "renamed-plugin" に変更（ディレクトリ名は hello-plugin-renamed）
    claude --debug-file "$PWD/logs/10b-load-renamed.debug.log" \
      -p "reply with the single word OK" --plugin-dir ./hello-plugin-renamed > logs/10b-load-renamed.stdout.log 2>&1
    claude -p "/renamed-plugin:hello"       --plugin-dir ./hello-plugin-renamed
    claude -p "/hello-plugin-renamed:hello" --plugin-dir ./hello-plugin-renamed
    ```
    結果（全文は `logs/10b-load-renamed.grep.log` / `logs/11b-invoke-renamed.log`）:
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
    → **仕様どおり root に置いた `plugin.json` の `name` は完全に破棄され、ディレクトリ名が採用される**。決着。
  - **対照（マニフェストが正しい位置にある場合は `name` が勝つ）**: `hello-plugin-cc/`（ディレクトリ名は `hello-plugin-cc`、manifest の `name` は `hello-plugin`）では `/hello-plugin:hello` が成功し `/hello-plugin-cc:hello` が `Unknown command`（`logs/13-invoke-cc.log`）。**同じ `name` フィールドが、置き場所次第で「採用」と「破棄」に分かれる**
  - MCP の結果（仮説3の検証。`logs/10c-mcp-check-spec.log`）:
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
    → `mcp.json` は**読まれた形跡が一切ない**。エラーも警告も出ない。サブプロセスも起動していない
  - 記事に書きたい気づき: **これが「静かに無視される」の実物**。`name` も MCP も、エラーどころか警告すら1行も出ないまま消える。`--debug-file` を取って grep するまで気づけない

- [x] 同じ手順を Claude Code 準拠レイアウトにも当て、対照実験にする（見積もり 20分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    claude --debug-file "$PWD/logs/12-load-cc.debug.log" \
      -p "reply with the single word OK" --plugin-dir ./hello-plugin-cc > logs/12-load-cc.stdout.log 2>&1
    grep -i -e "local-echo" -e "mcp" logs/12-load-cc.debug.log
    cat hello-plugin-cc/echo-server-started.txt
    claude -p "/hello-plugin:hello"    --plugin-dir ./hello-plugin-cc
    claude -p "/hello-plugin-cc:hello" --plugin-dir ./hello-plugin-cc
    ```
  - MCP 関連の出力（全文は `logs/12-load-cc.grep.log`）:
    ```
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": Starting connection with timeout of 30000ms
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": Successfully connected (transport: stdio) in 539ms
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": Connection established with capabilities: {"hasTools":true,"hasPrompts":false,"hasResources":false,"hasResourceSubscribe":false,"serverVersion":{"name":"local-echo","version":"1.0.0"}}
    [DEBUG] [MCP] Server "plugin:hello-plugin:local-echo" connected with subscribe=false
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": Sending SIGINT to MCP server process
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": UNKNOWN connection closed after 2s (cleanly)
    [DEBUG] MCP server "plugin:hello-plugin:local-echo": MCP server process exited cleanly
    ```
  - MCP サブプロセスに渡された環境変数（`logs/12b-mcp-env.log`。**仕様との追加のズレを実測**）:
    ```
    started pid=75236 PLUGIN_ROOT= CLAUDE_PLUGIN_ROOT=~/.../hello-plugin-cc PLUGIN_DATA= cwd=~/.../agent-plugins-try
    ```
    → 仕様 §9 は `PLUGIN_ROOT` と `PLUGIN_DATA` を MUST で渡すと定めているが**両方とも空**。仕様 §7.2.2 の「`cwd` 省略時はプラグインルート」も満たしておらず、`claude` を起動した cwd になっている
  - スキル呼び出しの対照（`logs/13-invoke-cc.log`）:
    ```
    ### A) manifest の name で呼ぶ: /hello-plugin:hello（ディレクトリ名は hello-plugin-cc）
    SPEC_SKILL_LOADED
    exit=0

    ### B) ディレクトリ名で呼ぶ: /hello-plugin-cc:hello
    Unknown command: /hello-plugin-cc:hello
    exit=0
    ```
  - 差分のまとめ: 仕様準拠版と Claude Code 準拠版で **スキルは両方読める / 名前の決まり方が逆 / MCP は Claude Code 準拠版だけ動く**。片方だけ動くのではなく**「半分だけ読める」**が結論
  - スクショ: `screenshots/06-mcp-contrast.png`
  - 記事に書きたい気づき: 仕様準拠プラグインを配ると「スキルは動くのに MCP だけ静かに欠ける」プラグインができる。**壊れ方が中途半端なのが一番厄介**

- [x] 違反パターン4種＋追加1種を作ってエラーメッセージ全文を収集する（見積もり 25分 → 実測 約2分）
  - 実行したコマンド（各パターンに ajv → `claude plugin validate` → `--strict` の3本を当てる）:
    ```bash
    # (a) name 欠落 / (b) name = "Hello--Plugin" / (c) skills/ を .claude-plugin/ 配下へ / (d) displayName 追加
    for d in v-a-noname v-b-badname v-c-nested-skills v-d-displayname; do
      npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/plugin.schema.json \
        -d $d/.claude-plugin/plugin.json --errors=text --all-errors
      claude plugin validate ./$d
      claude plugin validate ./$d --strict
    done
    ```
  - **(a) `name` 欠落**（`logs/14-violation-a.log`）:
    ```
    --- 1) ajv ---
    v-a-noname/.claude-plugin/plugin.json invalid
    data must have required property 'name'
    ajv exit=1
    --- 2) claude plugin validate ---
      ❯ name: Invalid input: expected string, received undefined
    ✘ Validation failed
    cc exit=1
    --- 3) --strict ---（同じ error）cc --strict exit=1
    ```
    → 両バリデータが一致して落とす。**唯一きれいに一致したケース**
  - **(b) `name` = `Hello--Plugin`**（`logs/15-violation-b.log`）:
    ```
    --- 1) ajv ---
    v-b-badname/.claude-plugin/plugin.json invalid
    data/name must match pattern "^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$"
    ajv exit=1
    --- 2) claude plugin validate ---
    ⚠ Found 2 warnings:
      ❯ name: Plugin name "Hello--Plugin" is not kebab-case. Claude Code accepts it, but the Claude.ai marketplace sync requires kebab-case (lowercase letters, digits, and hyphens only, e.g., "my-plugin").
      ❯ author: No author information provided. Consider adding author details for plugin attribution
    ✔ Validation passed with warnings
    cc exit=0
    --- 3) --strict ---
    ✘ Validation failed (--strict treats warnings as errors)
    cc --strict exit=1
    ```
    → ajv は fatal、Claude Code は **"Claude Code accepts it" と明言して通す**。厳しさの方向が逆
  - **(c) `skills/` を `.claude-plugin/` 配下に置く**（`logs/16-violation-c.log`。**両バリデータが揃って見逃した**）:
    ```
    --- 1) ajv ---
    v-c-nested-skills/.claude-plugin/plugin.json valid
    ajv exit=0
    --- 2) claude plugin validate ---
    ⚠ Found 1 warning:
      ❯ author: No author information provided. Consider adding author details for plugin attribution
    ✔ Validation passed with warnings
    cc exit=0
    --- ロードすると ---
    [DEBUG] Loaded inline plugin from path: hello-plugin
    [DEBUG] Checking plugin hello-plugin: skillsPath=none, skillsPaths=0 paths
    [DEBUG] Total plugin skills loaded: 0 (0 duplicate/user-owned entries skipped)
    --- スキル呼び出し ---
    Unknown command: /hello-plugin:hello
    ```
    → **どちらのバリデータも「配置ミス」を1文字も指摘しない**のに、スキルは0件になって消える。公式docsが "Common mistake" と呼ぶ踏み方なのに、検証ツールでは検出できない
  - **(d) `displayName` を追加**（`logs/17-violation-d.log`。**非対称の中心**）:
    ```
    --- 1) ajv ---
    v-d-displayname/.claude-plugin/plugin.json invalid
    data must NOT have additional properties
    ajv exit=1
    --- 2) claude plugin validate ---
    ⚠ Found 1 warning:
      ❯ author: No author information provided. Consider adding author details for plugin attribution
    ✔ Validation passed with warnings
    cc exit=0
    ```
    → `displayName` への言及が**ゼロ**。つまり Claude Code にとって `displayName` は**未知フィールドですらない正規フィールド**。一方 Agent Plugins の閉じたスキーマでは fatal
  - **(e) 追加実験: 本当に未知のフィールドなら何と言うか**（`logs/17b-violation-e-bogus.log`）:
    ```
    "author": { "name": "tester" }, "totallyBogusField": "x"
    --- claude plugin validate ---
    ⚠ Found 1 warning:
      ❯ totallyBogusField: Unknown field 'totallyBogusField'. Claude Code ignores it at load time.
    ✔ Validation passed with warnings
    cc exit=0
    --- --strict ---
    ✘ Validation failed (--strict treats warnings as errors)
    cc --strict exit=1
    ```
    → この対照で **(d) の `displayName` が「Claude Code の正規フィールド」だと確定**できた。(d) だけ見ていたら「未知フィールドを黙って無視した」と誤読していた
  - 効いた対処 / 試したこと: (d) の結果が「警告ゼロ」だったので、**わざと意味のない `totallyBogusField` を入れて対照を取った**。1手で解釈が確定した
  - スクショ: `screenshots/04-validator-asymmetry.png`
  - 記事に書きたい気づき: 「標準に厳しく寄せると実装で無視され、実装に寄せると標準で落ちる」。しかも**(c) のように両方が見逃す穴もある**。バリデータを2本通しても安心できない

### フェーズ4: 深掘り・比較（見積もり 70分 → 実測 約2分）

- [x] 仕様が用意した逃げ道 `extensions` が実際に効くか試す（見積もり 25分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    # ext-plugin/.claude-plugin/plugin.json に
    #   "extensions": { "com.anthropic.claude-code": { "displayName": "Hello From Extensions" } }
    npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/plugin.schema.json \
      -d ext-plugin/.claude-plugin/plugin.json --errors=text --all-errors
    claude plugin validate ./ext-plugin
    claude plugin validate ./ext-plugin --strict
    claude --debug-file "$PWD/logs/18b-ext-load.debug.log" -p "reply with the single word OK" --plugin-dir ./ext-plugin
    grep -i -e "extensions" -e "displayName" -e "Hello From" logs/18b-ext-load.debug.log
    ```
  - 出力（全文は `logs/18-extensions.log`）:
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
  - 結論（条件付き）: **2026-08-15 時点の Claude Code 2.1.227 では、`extensions` は「Unknown field」として明示的に無視される**。ロード時のデバッグログにも痕跡なし。しかも `--strict` を使うと**仕様推奨の書き方が CI を落とす**
  - 記事に書きたい気づき: 標準側は互換の逃げ道を用意したが、クライアントはまだ読んでいない。「標準に沿って `extensions` に寄せる」と `claude plugin validate --strict` が通らなくなるので、**移行期は逃げ道が逆に足を引っ張る**

- [x] 「1ファイルだけ動かせば両対応になるのか」を確かめる（見積もり 20分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    # hello-plugin-both/ = root plugin.json (name: spec-side-name) + .claude-plugin/plugin.json (name: cc-side-name)
    #                      + mcp.json + .mcp.json + skills/ + bin/
    npx --yes ajv-cli@5 validate --spec=draft2020 -s .../plugin.schema.json -d hello-plugin-both/plugin.json
    npx --yes ajv-cli@5 validate --spec=draft2020 -s .../mcp.schema.json    -d hello-plugin-both/mcp.json
    claude plugin validate ./hello-plugin-both
    claude --debug-file "$PWD/logs/19b-both-load.debug.log" -p "reply with the single word OK" --plugin-dir ./hello-plugin-both
    claude -p "/cc-side-name:hello"   --plugin-dir ./hello-plugin-both
    claude -p "/spec-side-name:hello" --plugin-dir ./hello-plugin-both
    ```
  - 出力（全文は `logs/19-both-manifests.log`）:
    ```
    hello-plugin-both/plugin.json valid           (ajv exit=0)
    hello-plugin-both/mcp.json valid              (ajv exit=0)
    ✔ Validation passed with warnings             (cc exit=0, warning は author のみ)
    [DEBUG] Loaded inline plugin from path: cc-side-name
    [DEBUG] Loaded 1 skills from plugin cc-side-name default directory
    [DEBUG] MCP server "plugin:cc-side-name:local-echo": Successfully connected (transport: stdio) in 127ms
    --- 6) /cc-side-name:hello ---   SPEC_SKILL_LOADED
    --- 7) /spec-side-name:hello --- Unknown command: /spec-side-name:hello
    ```
  - 分かったこと: **両方置きは実務的に動く**（ajv も `claude plugin validate` も通り、スキルもMCPも読める）。採用されるのは `.claude-plugin/` 側の `name`
  - ギャップ: 仕様 §6 は「他のいかなるファイルも root `plugin.json` のコアフィールドを置き換え・補完・上書きできない」と定めている。この両方置きは**その原則にグレーに触れる**が、**ajv は `.claude-plugin/` の存在を検出できない**（スキーマ検証はファイル1本を見るだけなので、配置の問題は原理的に見えない）
  - 記事に書きたい気づき: 「ajv が通ったから仕様準拠」とは言えない。**機械検証が見ているのは JSON 1本の中身だけで、仕様の MUST の大半（配置・containment・唯一性）はそこに落ちていない**

- [x] `skills/` の再帰探索禁止ルールを踏んで挙動差を見る（見積もり 25分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    # nested-plugin/skills/hello/SKILL.md（直下・仕様OK）と
    # nested-plugin/skills/nested/deeper/SKILL.md（深い階層・仕様は MUST NOT）を並置
    claude --debug-file "$PWD/logs/20b-nested.debug.log" -p "reply with the single word OK" --plugin-dir ./nested-plugin
    claude -p "/nested-plugin:hello"  --plugin-dir ./nested-plugin
    claude -p "/nested-plugin:deeper" --plugin-dir ./nested-plugin
    claude -p "/nested-plugin:nested" --plugin-dir ./nested-plugin
    ```
  - 出力（全文は `logs/20-nested-skills.log`）:
    ```
    [DEBUG] Loaded inline plugin from path: nested-plugin
    [DEBUG] Checking plugin nested-plugin: skillsPath=exists, skillsPaths=0 paths
    [DEBUG] Loaded 1 skills from plugin nested-plugin default directory
    [DEBUG] Total plugin skills loaded: 1 (0 duplicate/user-owned entries skipped)
    --- 3) /nested-plugin:hello（直下・仕様OK）---   SPEC_SKILL_LOADED
    --- 4) /nested-plugin:deeper（深い階層・仕様は探索禁止）--- Unknown command: /nested-plugin:deeper
    --- 5) /nested-plugin:nested ---                Unknown command: /nested-plugin:nested
    ```
  - 結論: **仕様 §7.1 の MUST NOT（`skills/` より深い階層を再帰探索してはならない）を Claude Code は守っている**。読み込まれたのは `hello` の1件だけ
  - ただし: 仕様 §7.1 は「不正なスキルは SHOULD report」とも書いているが、`skills/nested/` が SKILL.md を持たないディレクトリであることについて**警告は1行も出なかった**（SHOULD なので違反ではない）
  - 副作用として記録: この実行だけ `Warning: no stdin data received in 3s, proceeding without it.` が出た。ヒアドキュメントで SKILL.md を書いた直後だったため stdin が繋がったままだったのが原因。`< /dev/null` を足せば消える
  - スクショ: `screenshots/07-nested-skills.png`
  - 記事に書きたい気づき: 「標準に書いてある禁止事項を実装が守っているか」を確かめると、**守っているところと守っていないところが並んで見える**。Claude Code は §7.1（再帰禁止）は守り、§6.1（マニフェスト位置）と §7.2（MCP設定位置）と §9（サブプロセス env）は守っていない

### フェーズ5: 振り返り・記事化準備（見積もり 40分 → 実測 約4分）

- [x] `RESULTS.md` のマトリクスを埋め、「予想 vs 実測」を確定させる（見積もり 20分 → 実測 約3分）
  - 成果物: `RESULTS.md`（run ディレクトリ直下にもコピー）。11行 × 7列のマトリクス、予想vs実測の8行表、`mcp.json` フィールド単位の4行表、MCP設定3形式の差分表、結論
  - 予想の的中率: 7項目のうち **的中5 / 半分外れ1 / 想定外の新発見1**
  - 外れたセル: `claude plugin validate ./hello-plugin`。「マニフェスト無しとして通る」→ 実際は `✘ Found 1 error: directory: No manifest found in directory` で exit 1
  - 補完のため追加で回したコマンド: `logs/25-ajv-matrix-fill.log`（各レイアウトのマニフェスト／`.mcp.json` を仕様スキーマに当ててマトリクスの空セルを埋めた）

- [x] 片付けと秘密情報チェック（見積もり — → 実測 <1分）
  - 実行したコマンド:
    ```bash
    rm -rf ~/.claude/skills/cc-reference   # claude plugin init の後片付け（自動ロード対象なので必須）
    grep -ril -e "/Users/" logs/
    grep -ri -o -E "[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}" logs/ | sort -u
    grep -ri -e "sk-ant" -e "API_KEY" -e "Bearer " logs/
    ```
  - 結果（`logs/21-cleanup.log` / `logs/22-secret-scan.log`）:
    - `cc-reference` 削除確認: `removed OK`
    - APIキーらしい文字列: **0件**
    - メールアドレス: 2件ヒット。`i@izs.me`（npm の deprecated 警告に含まれる公開情報）と、**`claude plugin init` が git config から自動で埋めた個人のメールアドレス**。後者は `<masked-email>` に置換した
    - ホームパス: 25ファイルに含まれる → 記事に貼るときは `~` に置換が必要（スクショ生成スクリプトでは自動で `~` にマスクしている）
  - 記事に書きたい気づき: `claude plugin init` が `author.email` を勝手に埋めるので、**雛形をそのまま記事やリポジトリに貼ると自分のメールが載る**。地味だが実害がある

- [x] 記事用のターミナル図を7枚作る（見積もり — → 実測 約1分）
  - 実行したコマンド:
    ```bash
    NODE_PATH=<repo>/node_modules node shot.mjs ../../screenshots
    ```
  - 方法: `logs/*.log` の**実際の中身**を読み込み、ターミナル風HTMLに流し込んで Playwright（1.61.1, chromium, deviceScaleFactor 2）でPNG化。ホームパスは `~` に自動置換。文字列の捏造・加工はしていない（スクリプト全文は `workspace/agent-plugins-try/shot.mjs`）
  - 注意: 初回は viewport height 800 のまま `fullPage: true` にしたため下半分が余白になった。height を 200 にして再生成した

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `npx ajv-cli validate` が `error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` で落ちる（**予告どおり**） | 仕様スキーマは draft 2020-12。ajv-cli 5 の既定は draft-07 相当でメタスキーマを積んでいない | `--spec=draft2020` を付ける | <1分 | 解決 | 4章「環境構築」の1本目。エラー文が「取得できない」ように読めるのに、実は同梱メタスキーマの話だという誤読ポイント込みで書く |
| 2 | `claude --debug -p "..."` にしてもデバッグ行が1行も取れない（ログが `OK` の2行だけ） | `-p`（headless）では `--debug` の出力が stdout に流れてこない | `--debug-file <path>` に切り替える（201行取れた） | <1分 | 解決 | 7章「詰まった点」。**「読み込み状況を見る手段がない」と諦めかけたところ**。`--debug` と `--debug-file` は別物 |
| 3 | `cwd: "../bin"` の ajv エラーが10件出て、本当の原因（`cwd` のパターン違反1件）が埋もれる | `mcp.json` の server が `oneOf`（stdio / streamable-http / sse）。1つ外すと全分岐のエラーが合流する | `--errors=json --all-errors` で `schemaPath` を見て、`#/$defs/stdioServer/...` の行だけ拾う | 約2分 | 解決 | 6章「スキーマ検証で分かったこと」。"must have required property 'url'" という**無関係な誤誘導**が混ざる話 |
| 4 | 違反(d) `displayName` で `claude plugin validate` の警告がゼロ。「未知フィールドを黙って無視した」のか「正規フィールドなのか」判別できない | Claude Code は未知フィールドには専用の warning を出すが、`displayName` は正規フィールドなので何も言わない | わざと `totallyBogusField` を入れた対照実験を1本足す → `Unknown field 'totallyBogusField'` が出て、`displayName` は正規フィールドと確定 | 約1分 | 解決 | 6章。**「警告が出ない」ことの意味を確定させるには対照実験が必要**という、検証そのものの話として書ける |

### 予測（詰まりポイント表）と実際の差分

| 予告 # | 予告内容 | 実際 |
|---|---|---|
| 1 | ajv が draft 2020-12 で落ちる | **的中**（詰まった点1）。ただし懸念されていた `unknown format` → `-c ajv-formats` は**不要だった**（スキーマに `format` が0件） |
| 2 | 仕様どおり root に置いたのにプラグイン名が違う | **的中**（`name` は破棄されディレクトリ名になる）。ただし予告は「`claude plugin validate` は通る可能性」としていたが、実際は**落ちた** |
| 3 | MCPサーバーが登録されない | **的中**。`--debug-file` に `mcp.json` / `local-echo` が1行も出ない。追加で `PLUGIN_ROOT` / `PLUGIN_DATA` も渡されないことが判明 |
| 4 | ajv は通るのに `--strict` が落ちる（またはその逆） | **的中**。しかも違反(c) のように**両方が見逃す**第3のケースがあった |
| 5 | `claude --plugin-dir` の入れ子実行が失敗する / 対話待ちになる | **空振り**。`-p` 付きの入れ子実行は7レイアウト×複数回すべて成功。撤退ラインは発動せず（1回だけ stdin 警告が出たが実行は完走） |
| 6 | `claude plugin init` の雛形が次セッションから勝手に読み込まれる | **的中**。以降の全ロード検証で `Found 2 plugins` の2つ目に居座った。検証後に削除（`logs/21-cleanup.log`） |
| 7 | `agent-plugins.org` のスキーマURLにアクセスできない | **空振り**（そもそもアクセスしていない）。代わりに `$schema` が `const` でバージョン識別子として使われていることを確認できた |

## スクリーンショット一覧

すべて `logs/*.log` の実出力をターミナル風にレンダリングしたもの（文字列は加工なし。ホームパスのみ `~` に置換）。

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-two-layouts.png` | 2レイアウトのファイル一覧＋`mcp.json` / `.mcp.json` の中身 | 4. 環境構築 |
| `screenshots/02-ccvalidate-asymmetry.png` | 仕様準拠が exit 1（"No manifest found"）、Claude Code 準拠が exit 0 | 6. スキーマ検証で分かったこと（＋7章の導入） |
| `screenshots/03-name-precedence.png` | `name=renamed-plugin` にしてもディレクトリ名が採用される決定実験 | 7. 詰まった点（山場） |
| `screenshots/04-validator-asymmetry.png` | 違反(b)(d) で ajv が fatal・Claude Code が警告どまり | 6. スキーマ検証で分かったこと |
| `screenshots/05-extensions-ignored.png` | `⚠ extensions: Unknown field 'extensions'. Claude Code ignores it at load time.` | 8. 「標準」と「クライアント独自形式」の現在地 |
| `screenshots/06-mcp-contrast.png` | 仕様形式の `mcp.json` は言及ゼロ / `.mcp.json` は接続成功 | 7. 詰まった点 |
| `screenshots/07-nested-skills.png` | `skills/nested/deeper/SKILL.md` が拾われない（仕様の MUST NOT を遵守） | 8. 「標準」と「クライアント独自形式」の現在地 |

## 記事への写像（実績で埋める）

対象タスクの「記事への写像」を引き継ぎ、実際の記録を紐づけた。※ここでは素材を指し示すだけ。本文は書かない。

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（8月に6社が出した標準の話） | `logs/00-env.log`、`logs/01-clone.log`（spec commit `bd38355` / 2026-08-06） | 2026-08-06 の発表。**検証日 2026-08-15 と Claude Code 2.1.227 / Node v22.17.0 / ajv-cli 5.0.0 を冒頭に置く**（結論の有効期限を明示） |
| 2. なぜこの仕様を試すのか（設定の持ち回り問題） | 前提・動機 | 「自分の書いたスキルは他のエージェントでも使えるのか」。過去記事 `articles/project-root-agent-instructions.md` との切り分けを1段落で明示 → **あちらは「指示ファイル」（CLAUDE.md / AGENTS.md）、こちらは「配布パッケージ仕様」** |
| 3. 事前に調べたこと（仕様の最小構成と JSON Schema） | `logs/02-schema-fields.log`、`RESULTS.md` の差分表＋予想列 | 必須は `$schema` と `name` の2つだけ／`additionalProperties: false`／`name` のパターン制約／`$schema` は `const`＝**取得先URLではなくバージョン識別子**（仕様 §6.1.1 の「読み込み時にスキーマを取得してはならない」も引く）／予想を先に書いた話 |
| 4. 環境構築（ファイルを置くだけ） | `logs/03-ajv-plugin.log`、`logs/04-plugin-init.log`、`logs/04b-ajv-ccinit.log`、`screenshots/01-two-layouts.png` | `plugin.json` / `SKILL.md` 全文（フェーズ2に転記済み）／2レイアウトの比較図／**`--spec=draft2020` で詰まった話**（詰まった点1、エラー全文あり）／**`claude plugin init` の雛形が Agent Plugins スキーマで invalid** という想定外の発見 |
| 5. 実際に作った最小プラグイン | `logs/05a-echo-server-smoke.log`、`logs/05-ajv-mcp.log`、`logs/04c-layouts-with-mcp.log`、`RESULTS.md` の「3つのMCP設定形式の差分」表 | `mcp.json` 全文＋最小 stdio MCP サーバーのコード抜粋（`bin/echo-server`。マーカー `MCP_ECHO:` と env 痕跡の仕込み）／`mcp.json` と `.mcp.json` で**5点違う**という表 |
| 6. スキーマ検証で分かったこと | `logs/06`〜`09`（`claude plugin validate` 4本）、`logs/14`〜`17b`（違反a〜e）、`logs/05-ajv-mcp.log`、`screenshots/02` / `04` | 2つのバリデータの厳しさが**逆方向**という表（(b) は ajv fatal / CC は "accepts it"、(d) は ajv fatal / CC は無言）／**(c) は両方が見逃す第3のケース**／`oneOf` の10件エラー（詰まった点3）／(e) の対照実験で解釈を確定させた話（詰まった点4） |
| 7. 詰まった点（クライアント実装との配置のズレ／エラーメッセージ） | `logs/10`〜`13`、`logs/10b`／`11b`（決定実験）、`logs/10c`（MCP言及ゼロ）、`logs/12b`（env）、`screenshots/03` / `06` | **山場**。root `plugin.json` の `name` が無言で破棄され `renamed-plugin` → `Unknown command`、ディレクトリ名だけが通る決定実験／`mcp.json` はログに1行も出ない／`PLUGIN_ROOT` / `PLUGIN_DATA` が空／`--debug` では取れず `--debug-file` が必要だった話（詰まった点2）／**「エラーも警告も出ずに静かに無視される」**を主題に |
| 8. 「標準」と「クライアント独自形式」の現在地 | `logs/18-extensions.log`、`logs/19-both-manifests.log`、`logs/20-nested-skills.log`、`screenshots/05` / `07` | `extensions` は `Unknown field` で無視され、しかも `--strict` を落とす（＝**仕様推奨の書き方が CI を壊す**）／両方置きは動くが仕様 §6「唯一のマニフェスト」にグレー、ajv は検出できない＝**「ajv が通った＝仕様準拠」ではない**／再帰探索禁止（§7.1）は守られていた＝守っている MUST と守っていない MUST が並ぶ／**必ず「2026-08-15 時点・Claude Code 2.1.227 での観測」と条件を付ける** |
| 9. どんな人に向いていそうか | `RESULTS.md` の結論、レイアウトC（`logs/19-both-manifests.log`） | 今スキルを書いている人が今日できること＝**root `plugin.json` と `.claude-plugin/plugin.json`、`mcp.json` と `.mcp.json` を併置**（両バリデータが通り、スキルもMCPも読める）。ただし移行期の回避策と断る／範囲外を明示（マーケットプレイス配布、VS Code / Cursor 検証） |
| 10. まとめ | `RESULTS.md` のマトリクス（11行×7列）＋予想vs実測表 | 結論は**「半分だけ読める」**（スキルは読める / 名前は捨てられる / MCPは登録されない / さらに `claude plugin validate` は落ちる）。予想7項目のうち的中5・半分外れ1・想定外1／次回は VS Code / Cursor での読み込み検証 |

## 未達・撤退した項目

なし。対象タスクのフェーズ1〜5のチェックボックス全16項目を実行し、完了条件1〜5をすべて満たした。撤退ライン（30分ルール / 入れ子実行の失敗 / フェーズ4放棄）はいずれも発動していない。

**意図的に範囲外にしたもの**（対象タスクの宣言どおり）:
- マーケットプレイス公開・配布側の検証（`claude plugin marketplace` / `install`）
- VS Code / Cursor など他クライアントでの読み込み検証
- MCP ツールを実際に LLM から呼ぶところ（`tools/call`）。接続確立とツール一覧の登録までで判定した
- 違反(a)(b)(d)(e) のロード検証（バリデータの結果で目的が達成できたため。(c) だけはロードしないと「静かに消える」が示せないので実行した）

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン: macOS 26.5（Darwin 25.5.0, arm64）/ Node.js v22.17.0 / npx 10.9.2 / ajv-cli 5.0.0 / Claude Code 2.1.227 / Playwright 1.61.1（図の生成のみ）/ agent-plugins-spec commit `bd383552095128f6effe895b9257cfd580a6d179`
- 実行コマンドの並び（最短の再現手順）:
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
- 注意点（ポート・OS差・バージョン依存・ハマりどころ）:
  - **`--spec=draft2020` は必須**。付けないと `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` で落ちる。`ajv-formats` は不要（両スキーマに `format` が無い）
  - **`--debug` は `-p` と組み合わせても stdout にデバッグ行が来ない。`--debug-file <path>` を使う**
  - **`claude plugin init` は `~/.claude/skills/<name>/` に作られ、次セッションから自動ロードされる**。比較用に作ったら必ず削除する。さらに `author.email` を git config から自動で埋めるので、雛形出力を公開する前にマスクする
  - `claude plugin validate` の結果とロードの結果は一致しない。**validate が exit 1 でもロードは通る**ことがある
  - ヒアドキュメントでファイルを作った直後に `claude -p` を回すと `Warning: no stdin data received in 3s` が出る。`< /dev/null` を足すと消える
  - `--debug-file` を使うと `logs/latest` シンボリックリンクが作られる（今回は削除した）
  - 結論は**クライアントのバージョンに強く依存する**。Claude Code 2.1.227 での観測であることを必ず添える

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/<slug>/` へ移し、`![説明](/images/<slug>/01-two-layouts.png)` の形で参照する
- [ ] 完了条件・詰まった点（4件）・予想vs実測（7項目）・2バリデータの非対称を本文に落とす
- [ ] 記事に貼るログはホームパスを `~` に置換する（`logs/22-secret-scan.log` の対象25ファイル）。`claude plugin init` の出力を貼る場合は `author.email` をマスクする
- [ ] 記事タイトル候補（対象タスクの案がそのまま使える）: 「Agent Plugins 1.0.0 の仕様どおりにプラグインを作って、Claude Code に読ませたら『半分だけ』読めた」
