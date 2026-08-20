# RESULTS: Agent Plugins 1.0.0 仕様準拠プラグイン × Claude Code 2.1.227

検証日: 2026-08-15 04:13〜04:25 JST / Node v22.17.0 / npx 10.9.2 / ajv-cli 5.0.0 / Claude Code 2.1.227 / macOS 26.5 (Darwin 25.5.0, arm64)
仕様リポジトリ commit: `bd383552095128f6effe895b9257cfd580a6d179`（2026-08-06）

## 差分表（仕様 / Claude Code）＋ 予想 vs 実測

| # | 論点 | Agent Plugins 1.0.0 | Claude Code 2.1.227 | 検証前の予想 | 実測 | 予想 |
|---|---|---|---|---|---|---|
| 1 | マニフェスト位置 | `plugin.json`（プラグインルート直下 MUST） | `.claude-plugin/plugin.json` | root の `plugin.json` は無視され「マニフェスト無し」扱い。プラグイン名はディレクトリ名から推定される | **ロード時は予想どおり**（無言でディレクトリ名を採用）。ただし `claude plugin validate` は「マニフェスト無し」で**exit 1 の error**になり、通らなかった | ⚠️ **半分外れ** |
| 2 | skills の位置 | `skills/<name>/SKILL.md`（再帰探索 MUST NOT） | `skills/<name>/SKILL.md` | 一致するのでそのまま読める | 予想どおり読めた。`/hello-plugin:hello` → `SPEC_SKILL_LOADED` | ✅ 的中 |
| 3 | MCP設定ファイル名 | `mcp.json`（root, `$schema` 必須） | `.mcp.json`（先頭ドット、`$schema` 不要） | 仕様形式の `mcp.json` は読まれず MCP サーバーが登録されない | 予想どおり。debug ログに `mcp.json` / `local-echo` の文字列が**1行も出ない**（警告すら無い） | ✅ 的中 |
| 4 | MCP パス変数 | `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` | `${CLAUDE_PLUGIN_ROOT}` | 名前が違うため相互に展開されない | 予想どおり。さらに実測で判明: Claude Code は MCP サブプロセスに `PLUGIN_ROOT` / `PLUGIN_DATA` を**渡さない**（仕様 §9 は MUST）。`cwd` も呼び出し元の cwd でプラグインルートではない | ✅ 的中＋追加発見 |
| 5 | 未知の top-level フィールド | 「報告して無視し、ロードは継続」MUST（§6.1） | 「認識しないフィールドは無視」。`validate --strict` で警告→エラー | 仕様も Claude Code も「無視」で方向は一致。ajv は `additionalProperties:false` で fatal | 予想どおり。Claude Code は `Unknown field 'X'. Claude Code ignores it at load time.` と**報告してから無視**（＝仕様 §6.1 の MUST を満たす挙動） | ✅ 的中 |
| 6 | `extensions` | 逆ドメイン名キーでクライアント固有データを持てる | 受け付けフィールド一覧に無い | Claude Code は未知フィールドとして無視（警告が出るかもしれない） | 予想どおり。`⚠ extensions: Unknown field 'extensions'. Claude Code ignores it at load time.` → **`--strict` だと exit 1**。仕様推奨の書き方が Claude Code の CI を落とす | ✅ 的中 |
| 7 | 両方置き（root + `.claude-plugin/`） | 「root `plugin.json` を他のファイルが置き換え・補完・上書きしてはならない」 | `.claude-plugin/plugin.json` を読む | ajv は通るが仕様文の「唯一のマニフェスト」原則に抵触しうる。機械検証では検出できない | 予想どおり。ajv は root 側を valid と判定し、`.claude-plugin/` の存在を検出できない。Claude Code は `.claude-plugin/` 側の `name` を採用（`cc-side-name` が勝ち、`spec-side-name` は Unknown command） | ✅ 的中 |
| 8 | （検証中に発見）`claude plugin init` の雛形 | — | `$schema` が `https://anthropic.com/claude-code/plugin.schema.json`、`"skills": ["./"]` フィールドあり | （予想していなかった） | **公式スキャフォールドは Agent Plugins 1.0.0 スキーマで invalid**（`skills` が additionalProperties 違反、`$schema` が const 不一致） | 🆕 想定外の発見 |

## 検証マトリクス（実測）

| レイアウト / パターン | ajv (plugin) | ajv (mcp) | `claude plugin validate` | `--strict` | ロード時のプラグイン名 | スキル登録 | MCP登録 |
|---|---|---|---|---|---|---|---|
| **A. 仕様準拠** `hello-plugin/`<br>root `plugin.json` + `skills/` + `mcp.json` | ✅ valid | ✅ valid | ❌ exit 1<br>"No manifest found in directory" | ❌ exit 1（同じ error） | `hello-plugin`＝**ディレクトリ名**<br>manifest の `name` は無言で破棄 | ✅ 1件（`/hello-plugin:hello` 成功） | ❌ 未登録（ログに一切出ない） |
| **A'. 仕様準拠・名前を変えた** `hello-plugin-renamed/`<br>root manifest の `name` = `renamed-plugin` | ✅ valid | ✅ valid | ❌ exit 1（同上） | ❌ exit 1 | `hello-plugin-renamed`＝**ディレクトリ名**<br>`/renamed-plugin:hello` → Unknown command | ✅ 1件（ディレクトリ名の名前空間でのみ呼べる） | ❌ 未登録 |
| **B. Claude Code 準拠** `hello-plugin-cc/`<br>`.claude-plugin/plugin.json` + `skills/` + `.mcp.json` | ✅ valid（中身は A と同じ） | ❌ `.mcp.json` は仕様スキーマで invalid（`$schema` / `type` が無い） | ✅ exit 0（warning 1件: author） | ❌ exit 1（warning→error） | `hello-plugin`＝**manifest の `name`**<br>ディレクトリ名 `hello-plugin-cc` では呼べない | ✅ 1件（`/hello-plugin:hello` 成功） | ✅ `plugin:hello-plugin:local-echo` 接続成功（539ms） |
| **C. 両方置き** `hello-plugin-both/`<br>root(`spec-side-name`) + `.claude-plugin/`(`cc-side-name`) + `mcp.json` + `.mcp.json` | ✅ valid（root / `.claude-plugin/` 両方） | ✅ valid（`mcp.json`） | ✅ exit 0（warning 1件: author） | ❌ exit 1（warning→error） | `cc-side-name`＝**`.claude-plugin/` 側が勝つ**<br>`/spec-side-name:hello` → Unknown command | ✅ 1件 | ✅ `plugin:cc-side-name:local-echo` 接続成功（127ms） |
| **D. 違反(a)** `name` 欠落 | ❌ `must have required property 'name'` | — | ❌ exit 1<br>`name: Invalid input: expected string, received undefined` | ❌ exit 1 | （ロード未実施） | — | — |
| **E. 違反(b)** `name` = `Hello--Plugin` | ❌ `must match pattern "^(?!.*(?:--\|\.\.))..."` | — | ✅ **exit 0**（warning: not kebab-case, "Claude Code accepts it"） | ❌ exit 1 | （ロード未実施） | — | — |
| **F. 違反(c)** `skills/` を `.claude-plugin/` 配下 | ✅ valid（配置はスキーマの管轄外） | — | ✅ **exit 0**（warning は author のみ。配置ミスの指摘なし） | ❌ exit 1（author warning が原因） | `hello-plugin` | ❌ **0件**（`skillsPath=none`。`/hello-plugin:hello` → Unknown command） | — |
| **G. 違反(d)** `displayName` 追加 | ❌ `must NOT have additional properties` | — | ✅ **exit 0**（`displayName` への言及なし＝Claude Code の**正規フィールド**） | ❌ exit 1（author warning が原因） | （ロード未実施） | — | — |
| **H. 追加(e)** `totallyBogusField` 追加（author も追加） | — | — | ✅ exit 0<br>`⚠ totallyBogusField: Unknown field 'totallyBogusField'. Claude Code ignores it at load time.` | ❌ exit 1（この warning が原因） | （ロード未実施） | — | — |
| **I. extensions** `ext-plugin/`<br>`extensions."com.anthropic.claude-code".displayName` | ✅ valid | — | ✅ exit 0<br>`⚠ extensions: Unknown field 'extensions'. Claude Code ignores it at load time.` | ❌ exit 1 | `ext-plugin` | ✅ 1件 | ✅（`.mcp.json` 由来） |
| **J. 再帰探索** `nested-plugin/`<br>`skills/hello/` + `skills/nested/deeper/` | ✅ valid | — | ✅ exit 0（warning: author） | ❌ exit 1 | `nested-plugin` | ✅ **1件のみ**（`hello` だけ。`deeper` / `nested` は Unknown command）＝仕様 §7.1 の MUST NOT を遵守 | ✅ |
| **K. `claude plugin init` の雛形** `~/.claude/skills/cc-reference/` | ❌ invalid（`skills` が additionalProperties 違反、`$schema` が const 不一致） | — | （未実施） | （未実施） | `cc-reference` | — | — |

### mcp.json のフィールド単位の検証（logs/05-ajv-mcp.log）

| パターン | ajv 判定 | 備考 |
|---|---|---|
| 仕様準拠（`command: "./bin/echo-server"`, `cwd: "${PLUGIN_ROOT}"`） | ✅ valid | — |
| `command: "bin/echo-server"`（`./` を付け忘れ） | ✅ **valid** | 仕様文は「`./` 始まり MUST」だが**スキーマには書かれていない**（`command` は `minLength:1` だけ）。**ajv が通っても仕様準拠とは言えない実例** |
| `cwd: "../bin"`（プラグインルートを脱出） | ❌ invalid | ただし `oneOf` の全分岐が失敗して**10個のエラー**が出る。うち "must have required property 'url'" のような無関係な誤誘導を含む |
| `args: ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]`（Claude Code 流） | ✅ **valid** | `args` は opaque string 扱いなのでスキーマは通る。仕様は「他のプレースホルダ展開を行ってはならない」ので、実行時は**リテラル文字列のまま**渡って壊れる |

## MCP サブプロセスに渡された環境変数（logs/12b-mcp-env.log）

```
started pid=75236 PLUGIN_ROOT= CLAUDE_PLUGIN_ROOT=<plugin root> PLUGIN_DATA= cwd=<呼び出し元の cwd>
```

- 仕様 §9: クライアントは stdio MCP サブプロセスに `PLUGIN_ROOT` と `PLUGIN_DATA` を**MUST** で渡す → Claude Code 2.1.227 は**両方とも空**
- 仕様 §7.2.2: `cwd` 省略時はプラグインルートを作業ディレクトリにする**MUST** → 実際は `claude` を起動した cwd

## 3つのMCP設定形式の差分（記事の表1本ぶん）

| | Agent Plugins 1.0.0 | Claude Code 2.1.227 |
|---|---|---|
| ファイル名 | `mcp.json`（プラグインルート直下） | `.mcp.json`（先頭ドット） |
| `$schema` | **必須**（`https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` 固定値） | 不要（書いても可） |
| `type` | **必須**（`stdio` / `streamable-http` / `sse`） | 省略可 |
| パス変数 | `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` | `${CLAUDE_PLUGIN_ROOT}` |
| バンドル実行ファイルの指定 | `command: "./bin/echo-server"`（プラグイン相対 MUST） | `command: "node"` + `args: ["${CLAUDE_PLUGIN_ROOT}/bin/echo-server"]` |
| サブプロセスの env | `PLUGIN_ROOT` / `PLUGIN_DATA` を MUST で提供 | `CLAUDE_PLUGIN_ROOT` のみ |

## スキーマから自分の手で確認した事実（logs/02-schema-fields.log）

- `plugin.schema.json`: `$schema` は `https://json-schema.org/draft/2020-12/schema`、`required` は `["$schema","name"]` の**2つだけ**、`additionalProperties: false`
- `properties` は `$schema, name, version, description, author, homepage, repository, license, keywords, extensions` の10個
- `name` パターン: `^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`
- `mcp.schema.json`: `required` は `["$schema","mcpServers"]`、`additionalProperties: false`。stdio variant は `type`/`command` 必須、`cwd` は `^(?:\./|\$\{PLUGIN_ROOT\}(?:/|$)|\$\{PLUGIN_DATA\}(?:/|$))` パターン
- 両スキーマとも `format` キーワードを使っていない（`grep '"format"'` が 0 ヒット）→ **ajv-formats は不要だった**（想定リスクは空振り）

## 結論（2026-08-15 時点・Claude Code 2.1.227 での観測）

仕様準拠プラグインを Claude Code に渡すと **「部分的に読める」** ——事前の仮説どおりだった。

1. **スキルは読める**（`skills/<name>/SKILL.md` の位置が一致しているため）
2. **プラグイン名は捨てられる**（root `plugin.json` の `name` は無言で無視され、ディレクトリ名が採用される。`--debug` ログにも警告が1行も出ない）
3. **MCPは登録されない**（`mcp.json` は読まれない。こちらも警告ゼロ）
4. さらに **`claude plugin validate` は仕様準拠レイアウトを exit 1 で落とす**（ここは予想を外した。「マニフェスト無しとして通る」と思っていた）

**今スキルを書いている人が今日できること**: レイアウト C（root `plugin.json` と `.claude-plugin/plugin.json` を併置、`mcp.json` と `.mcp.json` を併置）にすれば、ajv も `claude plugin validate` も通り、スキルもMCPも読める。ただし仕様 §6「唯一のマニフェスト」原則にグレーに触れるので、あくまで移行期の回避策。

**次回のネタ（今回範囲外）**: VS Code / Cursor での読み込み検証、マーケットプレイス配布、`extensions` を実装しているクライアントの探索。
