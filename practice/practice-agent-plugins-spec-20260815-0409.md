# 実践タスク: Agent Plugins 1.0.0 の仕様どおりにプラグインを作り、Claude Code で読めるか試す

## このタスクの前提

- 出典レポート: `research/search-topic-20260815-0403.md`
- 元テーマ: テーマ1「Agent Plugins 1.0.0 の仕様どおりにプラグインを作り、Claude Code / VS Code で読めるか試す」（レポートの「最初に試すべき1本」）
- 対象技術: Agent Plugins Specification 1.0.0（`plugin.json` / `skills/<name>/SKILL.md` / `mcp.json`）と Claude Code のプラグイン実装
- 記事の方向性（記事タイプ）: 試してみた ＋ 詰まった点まとめ（検証ログ）
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目（Claude Code・Cursor・VS Code のいずれかでスキルや設定を書いている人）
- 検証に使える想定時間: 半日〜1日（引数指定なしのためデフォルト前提を採用。本計画の合計は約5時間20分）
- 判断方針: 引数で渡されたのは対象レポートのパスのみ。テーマ・時間・スキルレベル・成果物はすべてデフォルト前提を採用した（テーマはレポートの推奨1本をそのまま使用）
- 実行環境の担保: **AIエージェント単独で完結できる**。作るものはテキストファイルのみで、検証は (a) `npx ajv-cli` によるローカルJSON Schema検証、(b) `claude plugin validate` / `claude --debug -p` によるCLI検証、の2系統だけ。課金APIキー・人手サインアップ・マーケットプレイス公開・手動デプロイは一切含まない（レポートの足切り①に従い、配布側の検証は範囲外としてローカル配置と読み込み検証に限定）。ブラウザUIを持たないテーマのため Playwright は使わず、**完了条件はCLIの標準出力・終了コード・保存したログファイルで判定する**

### 事前調査で裏取りした一次情報（2026-08-15 時点）

この計画は学習済み知識ではなく、以下を実際に取得して書いている。

| 確認した内容 | 出典 | 結果 |
|---|---|---|
| 仕様バージョンと最小構成 | [agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec) | 1.0.0。`{"$schema": "...", "name": "hello-plugin"}` だけで成立 |
| `plugin.json` の必須/任意フィールド | [spec/1.0.0.md](https://raw.githubusercontent.com/agentplugins/agent-plugins-spec/main/spec/1.0.0.md) | 必須は `$schema` と `name` の2つ。任意は `version` `description` `author` `homepage` `repository` `license` `keywords` `extensions` |
| スキーマの厳格さ | [plugin.schema.json](https://raw.githubusercontent.com/agentplugins/agent-plugins-spec/main/schemas/1.0.0/plugin.schema.json) | JSON Schema **draft 2020-12**、ルートは `"additionalProperties": false`（閉じたスキーマ） |
| `name` の制約 | spec/1.0.0.md | 1〜64文字、`a-z` `0-9` `-` `.` のみ、先頭末尾は英数、`--` と `..` は不可。パターン `^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$` |
| ファイル配置のMUST | spec/1.0.0.md | `plugin.json` は**プラグインルート直下MUST**。`mcp.json` も root MUST。skills は `skills/<name>/SKILL.md` で、クライアントは「それより深い階層を再帰探索してはならない（MUST NOT）」 |
| 「唯一のマニフェスト」原則 | spec/1.0.0.md | 「他のいかなるファイルも root `plugin.json` のコアフィールドを置き換え・補完・上書きできない」と明記 |
| `mcp.json` の形式 | spec/1.0.0.md | `{"$schema": "...mcp.schema.json", "mcpServers": {...}}` の2キーのみ。stdio は `type`/`command` 必須、`command` は裸の実行ファイル名か `./` 始まりのプラグイン相対パス。`${PLUGIN_ROOT}` / `${PLUGIN_DATA}` を展開 |
| Claude Code のマニフェスト位置 | [plugins-reference](https://code.claude.com/docs/en/plugins-reference) | **`.claude-plugin/plugin.json`**（プラグインルート直下ではない）。「All other directories must be at the plugin root, not inside `.claude-plugin/`」 |
| Claude Code のMCP設定 | plugins-reference | **`.mcp.json`**（先頭ドット付き）。`${CLAUDE_PLUGIN_ROOT}` を展開 |
| マニフェストが無いときの挙動 | plugins-reference | 「If omitted, Claude Code auto-discovers components in default locations and derives the plugin name from the directory name.」＝**ディレクトリ名からプラグイン名を推定して読み込む** |
| 未知フィールドの扱い | plugins-reference | 「Claude Code ignores top-level fields it does not recognize.」`claude plugin validate` は警告扱い、`--strict` でエラー化 |
| ローカル読み込み方法 | [plugins（Create plugins）](https://code.claude.com/docs/en/plugins) | `claude --plugin-dir ./my-plugin`。スキルは `/<plugin-name>:<skill-name>` で名前空間付き |
| 検証コマンド | plugins-reference ＋ 手元の `claude plugin validate --help` | `claude plugin validate <path>` / `--strict`。手元の Claude Code は **2.1.227** |
| ajv-cli のdraft指定 | [ajv-cli README](https://raw.githubusercontent.com/ajv-validator/ajv-cli/master/README.md) ＋ `npm view ajv-cli version` | **5.0.0**。draft 2020-12 は `--spec=draft2020` が必要。`-s`（スキーマ）`-d`（データ）`--errors=`（js/json/line/text）`--strict=` |
| 手元のランタイム | `node -v` / `npx --version` | Node.js v22.17.0 / npx 10.9.2 |

**この裏取りから立つ仮説（検証で確かめる本題）**

仕様準拠プラグイン（root `plugin.json` ＋ `skills/` ＋ `mcp.json`）を `claude --plugin-dir` に渡すと、

1. root の `plugin.json` は Claude Code から見て「マニフェスト無し」扱いになり、**`name`・`description`・`version` が捨てられてディレクトリ名がプラグイン名になる**（＝スキル呼び出し名が仕様の `name` と食い違う）
2. `skills/` はデフォルト位置なので**そのまま読める**
3. `mcp.json` は Claude Code が `.mcp.json` を見るため**MCPサーバーが登録されない**

つまり「全部読めない」でも「全部読める」でもなく、**部分的に読める**という結果が予想される。ここを実測で確定させるのがこの検証の中心。

## 完成イメージ（成果物）

- 作るもの: 同一内容のプラグインを**2レイアウトで並置した検証用リポジトリ**
  - `hello-plugin/` … Agent Plugins 1.0.0 準拠（root `plugin.json` ＋ `skills/hello/SKILL.md` ＋ `mcp.json` ＋ `bin/` のローカルstdio MCPサーバー）
  - `hello-plugin-cc/` … Claude Code 準拠（`.claude-plugin/plugin.json` ＋ `skills/hello/SKILL.md` ＋ `.mcp.json`）
  - `logs/` … 全コマンドの標準出力・終了コード・エラー全文
  - `RESULTS.md` … 「どのレイアウトが / どちらのバリデータで / どこまで通ったか」の対応表
- 「できた」と言える完了条件（すべて満たす）
  1. `hello-plugin/plugin.json` と `mcp.json` が **`npx ajv-cli validate --spec=draft2020` で valid** になり、そのログが `logs/` に残っている
  2. `claude plugin validate ./hello-plugin` と `./hello-plugin-cc` の**両方を実行し、終了コードと出力全文**が `logs/` に残っている
  3. `claude --plugin-dir ./hello-plugin` でスキルが**読めたか読めなかったか、読めた場合はどの名前空間になったか**が判定でき、根拠のログが残っている
  4. 違反パターン3種（`name` 欠落 / `name` に大文字・`--` / `skills/` を `.claude-plugin/` 配下に配置）の**エラーメッセージ全文**が `logs/` にある
  5. `RESULTS.md` に「仕様準拠 × 2バリデータ × 2レイアウト」のマトリクスが埋まっている
- 完了確認の方法: **CLIの標準出力・終了コード・保存ログ**（ブラウザUIが無いテーマのため Playwright は使用しない）。各コマンドは `2>&1 | tee logs/<名前>.log; echo "exit=$?"` の形で必ずファイルに残す
- 記事タイトル案（そのまま使える形）
  1. Agent Plugins 1.0.0 の仕様どおりにプラグインを作って、Claude Code に読ませたら「半分だけ」読めた
  2. 6社が決めたエージェントプラグイン標準を、新人が最小構成で作って2つのバリデータに通してみた
  3. `plugin.json` はルートか `.claude-plugin/` か — 標準と実装のズレを実測した

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。課金キー / サインアップ / マーケットプレイス公開は一切使わない（使うのはローカルCLIとnpm公開パッケージのみ）
- [ ] ローカル環境: Node.js v22.17.0（確認済み）/ npx 10.9.2（確認済み）/ Claude Code 2.1.227（確認済み）→ **検証開始時に3つとも再取得して記録する**
- [ ] インストールするもの: `ajv-cli@5.0.0`（`npx` で都度実行。グローバル導入はしない）。仕様スキーマは `agent-plugins-spec` リポジトリから取得
- [ ] 無料枠 / コストの確認: すべて無料。ネットワークアクセスは GitHub（スキーマ取得）と npm registry（ajv-cli）のみ
- [ ] 記録用の準備: 作業ディレクトリ直下に `logs/` を作り、**全コマンドを `tee` でログ化**。`RESULTS.md` の空テーブルを先に作っておく

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 40分）

- [ ] 検証用の作業ディレクトリを作り、環境バージョンを1ファイルに固定する（目安: 10分）
  - `mkdir -p agent-plugins-try/logs && cd agent-plugins-try`
  - `{ node -v; npx --version; claude --version; date; uname -a; } 2>&1 | tee logs/00-env.log`
  - 記録すること: Node / npx / Claude Code の各バージョン、検証日時、OS。**仕様は1.0.0でクライアント対応は流動的なので、この5行が記事の再現性の土台になる**（レポートの注意点1に対応）
- [ ] 仕様リポジトリからスキーマと仕様書を取得し、必須フィールドを自分の手で確認する（目安: 15分）
  - `git clone --depth 1 https://github.com/agentplugins/agent-plugins-spec spec-repo 2>&1 | tee logs/01-clone.log`
  - `ls spec-repo/schemas/1.0.0/` で `plugin.schema.json` / `mcp.schema.json` の存在を確認
  - `node -e 'const s=require("./spec-repo/schemas/1.0.0/plugin.schema.json"); console.log(s.$schema); console.log(s.required); console.log(Object.keys(s.properties)); console.log("additionalProperties:", s.additionalProperties)' 2>&1 | tee logs/02-schema-fields.log`
  - 記録すること: `required` の中身（`$schema` と `name` の2つだけだったか）、`properties` のキー一覧、`additionalProperties: false` であること、スキーマの draft バージョン。**「必須2つだけ」という驚きは記事の3章（事前に調べたこと）の核**
  - 補足: スキーマURL（`agent-plugins.org`）に**アクセスしないこと**。仕様自身が「クライアントはプラグイン読み込み時にスキーマを取得してはならない（MUST NOT retrieve a schema while loading a plugin）」と定めており、検証もリポジトリ同梱のスキーマで行う（レポートの注意点3に対応）
- [ ] Claude Code 側の期待レイアウトを公式docsで確認し、仕様との差分を先に表にする（目安: 15分）
  - 確認する4点: マニフェスト位置（`.claude-plugin/plugin.json`）/ MCP設定ファイル名（`.mcp.json`）/ マニフェスト省略時の名前推定 / 未知フィールドの扱い
  - `RESULTS.md` に「予想」列を先に埋めてから検証に入る（後で「予想 vs 実測」が書ける）
  - 記録すること: 差分表（仕様 / Claude Code / 予想される結果）。**先に予想を書いてから測ると、外れた場所がそのまま記事の山場になる**

### フェーズ2: 環境構築（目安: 40分）

- [ ] 仕様準拠プラグイン `hello-plugin/` の最小構成を作る（目安: 15分）
  - `mkdir -p hello-plugin/skills/hello`
  - `hello-plugin/plugin.json`:
    ```json
    {
      "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      "name": "hello-plugin",
      "version": "1.0.0",
      "description": "Agent Plugins 1.0.0 spec conformance test plugin"
    }
    ```
  - `hello-plugin/skills/hello/SKILL.md`（frontmatter に `description` を入れる。Claude Code 側は `description` を見てスキルを認識する）
  - 記録すること: 実際に書いたファイル全文（記事にそのまま貼る）、`$schema` の値をコピペする際に間違えやすかった点、`name` を `hello-plugin` にした理由（パターン制約）
- [ ] `ajv-cli` で `plugin.json` をスキーマ検証する（目安: 15分）
  - `npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/plugin.schema.json -d hello-plugin/plugin.json --errors=text 2>&1 | tee logs/03-ajv-plugin.log; echo "exit=$?" | tee -a logs/03-ajv-plugin.log`
  - **`--spec=draft2020` を付け忘れると失敗する**（スキーマが draft 2020-12 のため）。まず**わざと付けずに1回実行してエラーを記録**し、その後に付けて成功させる。この2回分のログが「詰まった点」の1本目になる
  - `npx ajv-cli` の実体のコマンド名は `ajv` である点も記録する（`npx ajv-cli validate ...` はパッケージ名→単一binの解決で動く）
  - 記録すること: `--spec` なしのエラー全文、付けた後の成功出力、`npx` の初回ダウンロード時間、ajv-cli の実際に入ったバージョン
  - **要確認**: スキーマが `format: "uri"` 等を使っている場合、ajv 8 系では別途 `ajv-formats` が必要になり「unknown format」で落ちる可能性がある。落ちたら `-c ajv-formats` を試し、その試行過程もログに残す（未検証のため断定しない）
- [ ] Claude Code 準拠レイアウト `hello-plugin-cc/` を作る（目安: 10分）
  - `cp -r hello-plugin hello-plugin-cc && mkdir -p hello-plugin-cc/.claude-plugin && mv hello-plugin-cc/plugin.json hello-plugin-cc/.claude-plugin/plugin.json`
  - 比較の基準として `claude plugin init` の雛形も別途生成し、公式が吐く形と自作が一致しているか見る（`claude plugin init cc-reference 2>&1 | tee logs/04-plugin-init.log`、生成先は `~/.claude/skills/cc-reference/`）
  - 記録すること: 2つのレイアウトの `tree` 出力（差分がひと目で分かる図。記事の図として最良）、`claude plugin init` が生成したファイル一覧と自作との違い
  - 注意: `claude plugin init` は `~/.claude/skills/` 配下に作られ**次セッションから自動ロードされる**ため、検証後に削除する（片付けもログに残す）

### フェーズ3: 実装・検証【本編】（目安: 130分）

- [ ] `mcp.json`（仕様形式）とローカルstdio MCPサーバーを追加し、スキーマ検証する（目安: 25分）
  - `hello-plugin/bin/echo-server`（実行権限付き。Node製のstdio MCPサーバーで十分。ネットワーク不要・認証不要）
  - `hello-plugin/mcp.json`:
    ```json
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
  - `npx --yes ajv-cli@5 validate --spec=draft2020 -s spec-repo/schemas/1.0.0/mcp.schema.json -d hello-plugin/mcp.json --errors=text 2>&1 | tee logs/05-ajv-mcp.log`
  - 記録すること: `mcp.json` 全文、検証結果、`command` に `./` を付けなかった場合／`../bin/...` にした場合のエラー（仕様は「プラグインルートを脱出するパスは拒否」と定めているので、**わざと踏んで**エラー文を採る）
- [ ] Claude Code 用に `.mcp.json` を作り、2つのMCP設定形式の差分を確定させる（目安: 20分）
  - `hello-plugin-cc/.mcp.json` は `mcpServers` のみ（`$schema` 不要）、パス変数は `${CLAUDE_PLUGIN_ROOT}`
  - 記録すること: **同じMCPサーバーを登録するのに、ファイル名（`mcp.json` / `.mcp.json`）・必須キー（`$schema` の有無）・パス変数（`${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}`）の3つが違う**という事実。ここは記事の表1本で価値が出る
- [ ] `claude plugin validate` を両レイアウトに当て、終了コードまで記録する（目安: 20分）
  - `claude plugin validate ./hello-plugin 2>&1 | tee logs/06-ccvalidate-spec.log; echo "exit=$?" | tee -a logs/06-ccvalidate-spec.log`
  - `claude plugin validate ./hello-plugin-cc 2>&1 | tee logs/07-ccvalidate-cc.log; echo "exit=$?" | tee -a logs/07-ccvalidate-cc.log`
  - 両方に `--strict` を付けた版も実行（`logs/08-*.log` / `logs/09-*.log`）
  - 記録すること: **仕様準拠レイアウトが Claude Code のバリデータで通るのか落ちるのか**（`plugin.json` がルートにあるのを「マニフェスト無し」と見なして通る可能性がある。予想と実測を必ず並べる）、`--strict` の有無で結果が変わったか、警告文の全文
- [ ] `claude --plugin-dir` で仕様準拠プラグインを実際にロードし、読み込み結果を採る（目安: 25分）
  - `claude --debug -p "reply with the single word OK" --plugin-dir ./hello-plugin 2>&1 | tee logs/10-load-spec.log`
  - ログから `plugin` を含む行を抽出して読み込み状況を確定: `grep -i -e plugin -e skill -e mcp logs/10-load-spec.log | tee logs/10-load-spec.grep.log`
  - スキルが実際に呼べるかを名前空間付きで試す: `claude -p "/hello-plugin:hello" --plugin-dir ./hello-plugin 2>&1 | tee logs/11-invoke-spec.log`
  - 記録すること: **プラグイン名が `plugin.json` の `name` になったのか、ディレクトリ名から推定されたのか**（今回は両方 `hello-plugin` で一致してしまうので、**`plugin.json` の `name` を `renamed-plugin` に一時変更して再実行し、どちらが採用されるか決着させる** ← これが仮説1の決定的な実験）、`skills/hello` が登録されたか、`mcp.json` の `local-echo` が登録されたか（仮説3の検証）
  - **要確認 / 撤退ライン**: run-practice は Claude Code 内から `claude` を起動する入れ子実行になる。認証や再帰防止で失敗する場合は**その失敗自体をログに残し**、以降は `claude plugin validate` と `claude plugin details` / `claude plugin list` ベースの静的検証に切り替える（記事では「ロード検証は入れ子実行の制約でここまで」と正直に書く）
- [ ] 同じ手順を Claude Code 準拠レイアウトにも当て、対照実験にする（目安: 20分）
  - `claude --debug -p "reply with the single word OK" --plugin-dir ./hello-plugin-cc 2>&1 | tee logs/12-load-cc.log`
  - `claude -p "/hello-plugin:hello" --plugin-dir ./hello-plugin-cc 2>&1 | tee logs/13-invoke-cc.log`
  - 記録すること: 仕様準拠版との**差分**（読めた／読めない、名前空間、MCP登録の有無）。片方だけ動くならそれが記事の結論になる
- [ ] 違反パターン3種を作ってエラーメッセージ全文を収集する（目安: 25分）
  - (a) `name` 欠落 → ajv と `claude plugin validate` の両方に当てる
  - (b) `name` に規約違反（`Hello--Plugin`）→ 大文字・連続ハイフンの2つの制約を同時に踏む。ajv のパターンエラー文を採る
  - (c) `skills/` を `.claude-plugin/` 配下に置く（公式docsが "Common mistake" と明記している踏み方）→ ロードして何が起きるか
  - (d) 追加: 仕様の閉じたスキーマに Claude Code 固有フィールド（`displayName`）を入れる → **ajv は `additionalProperties: false` でエラー、Claude Code は未知フィールドを無視**という**両者の非対称**を実測する
  - 各パターンを `logs/14-violation-a.log` 〜 `logs/17-violation-d.log` に保存
  - 記録すること: エラー全文（要約しない）、どちらのバリデータがどこまで教えてくれたか、エラー文だけ見て原因に辿り着けたか。**(d) の非対称は「標準に厳しく寄せると実装で無視され、実装に寄せると標準で落ちる」という記事の核心**

### フェーズ4: 深掘り・比較（目安: 70分）

- [ ] 仕様が用意した逃げ道 `extensions` が実際に効くか試す（目安: 25分）
  - `plugin.json` に `"extensions": { "com.anthropic.claude-code": { "displayName": "Hello" } }` を入れる（仕様は逆ドメイン名キーでクライアント固有データを持てると定義。逆に Claude Code の受け付けフィールド一覧に `extensions` は無い）
  - ajv で valid になることを確認 → Claude Code で読み込み、`extensions` の中身が使われるかを `--debug` ログで確認
  - 記録すること: **「標準側は互換の逃げ道を用意したが、クライアントがまだ読んでいない」のかどうか**（結果がどちらでも記事になる）。ここは未検証領域なので**断定せず「2026-08-15時点の手元の Claude Code 2.1.227 では」と条件を付けて書く**
- [ ] 「1ファイルだけ動かせば両対応になるのか」を確かめる（目安: 20分）
  - `hello-plugin/` に `.claude-plugin/plugin.json` を**追加**（root の `plugin.json` は残す）した第3のレイアウトを作り、両バリデータに当てる
  - 仕様の「唯一のマニフェスト」原則（他のファイルが root `plugin.json` を置き換え・補完・上書きしてはならない）に対して、この重複配置が仕様違反になるのか、スキーマ検証では検出できないのかを確認する
  - 記録すること: **スキーマ（機械検証）では通るが仕様文（人間が読む規範）では怪しい**というギャップ。「ajv が通ったから仕様準拠、とは言えない」という学びは新人読者に一番効く
- [ ] `skills/` の再帰探索禁止ルールを踏んで挙動差を見る（目安: 25分）
  - `skills/nested/deeper/SKILL.md` を置く（仕様は「`skills/` の直下サブディレクトリのみ。それより深い階層を再帰探索してはならない」と規定）
  - Claude Code が拾うか拾わないかを `--debug` ログで判定
  - 記録すること: 仕様の MUST NOT と実装の実挙動が一致したか。**「標準に書いてある禁止事項を実装が守っているかを確かめた」のは、単なる紹介記事にはない検証**

### フェーズ5: 振り返り・記事化準備（目安: 40分）

- [ ] `RESULTS.md` のマトリクスを埋め、「予想 vs 実測」を確定させる（目安: 20分）
  - 行 = レイアウト（仕様準拠 / Claude Code準拠 / 両方置き / 違反4種）、列 = `ajv` 結果 / `claude plugin validate` 結果 / `--strict` 結果 / ロード時のプラグイン名 / スキル登録 / MCP登録
  - フェーズ1で書いた「予想」列と突き合わせ、**外れたセルに印を付ける**（外れた場所が記事の山場）
  - 記録すること: 埋まったマトリクス全体、外れた予想とその理由、`logs/` のファイル一覧
- [ ] 記録テンプレを見返し、「記事への写像」に沿って本文の見出しに素材を割り当てる（目安: 20分）
  - 各見出しに対して「貼るログ / 貼るコード / 書く気づき」が1つ以上あるか点検し、空の見出しがあれば該当タスクのログを読み直す
  - 過去記事 `project-root-agent-instructions.md`（CLAUDE.md / AGENTS.md の話）との切り分け一文を用意する（**あちらは指示ファイル、こちらは配布パッケージ仕様**。レポートの注意点2に対応）
  - 記録すること: 見出しごとの素材の対応、素材が足りない見出し、次にやりたいこと（VS Code / Cursor での読み込み検証は今回範囲外＝次回のネタ）

> 目安時間の合計: 約 5時間20分（フェーズ1: 40分 / フェーズ2: 40分 / フェーズ3: 130分 / フェーズ4: 70分 / フェーズ5: 40分）。想定時間「半日〜1日」の範囲内。時間が足りない場合は**フェーズ4を丸ごと落とす**（フェーズ1〜3＋5＝210分＝3時間30分で、完了条件1〜5は満たせる設計にしてある）

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `npx ajv-cli validate` が「スキーマが読めない / 不明なキーワード」で落ちる | 仕様スキーマは **draft 2020-12** だが、ajv-cli 5 の既定は draft-07 相当 | `--spec=draft2020` を付ける。それでも `unknown format` が出るなら `-c ajv-formats` を追加（要確認） | 「公式がスキーマを公開している＝すぐ検証できる、ではなかった」。新人が一番最初に踏む壁として2章目に置く |
| 2 | 仕様どおり root に `plugin.json` を置いたのに、Claude Code でプラグイン名が違う | Claude Code はマニフェストを `.claude-plugin/plugin.json` から読み、**無ければディレクトリ名から名前を推定する**。root の `plugin.json` は未知ファイルとして無視される | `plugin.json` の `name` をディレクトリ名と**わざと違う値**にして再ロードし、どちらが採用されたか確定させる | この記事の山場。「エラーも出ずに静かに無視される」のが一番怖い、という形で書く |
| 3 | MCPサーバーが登録されない | 仕様は `mcp.json`、Claude Code は **`.mcp.json`**。さらにパス変数が `${PLUGIN_ROOT}` と `${CLAUDE_PLUGIN_ROOT}` で違う | `--debug` のログで MCP 初期化行を探す。`.mcp.json` にコピーして再実行し、差分を切り分ける | 「ファイル名がドット1つ違うだけで無言で無効になる」。表1本で伝わる、実用性の高い節 |
| 4 | ajv は通るのに `claude plugin validate --strict` が落ちる（またはその逆） | 仕様スキーマは `additionalProperties: false` の**閉じたスキーマ**、Claude Code は**未知フィールドを無視**して警告に留める。厳しさの方向が逆 | 両バリデータを必ず両レイアウトに当て、4通りの結果を表にする | 「どちらのバリデータを信じるか」という問い。標準と実装の非対称性を示す中心の節 |
| 5 | `claude --plugin-dir` の実行が入れ子で失敗する / 対話待ちになる | AIエージェント（Claude Code）の中から `claude` を起動しているため。対話UIを開くと headless で止まる | 必ず `-p "..."` を付けて非対話にする。それでも失敗するなら `claude plugin validate` / `claude plugin list` の静的検証に切り替え、失敗ログを残す | 「検証環境の制約でここまでしか踏み込めなかった」と範囲を正直に書く（新人記事の誠実さになる） |
| 6 | `claude plugin init` で作った雛形が次のセッションから勝手に読み込まれる | `claude plugin init` は `~/.claude/skills/<name>/` に作り、**自動ロード対象**になる | 比較用に作ったら検証後に必ず削除する。削除もログに残す | 「検証で環境を汚した／片付けた」記録。地味だが読者が同じ手順を踏むときに助かる |
| 7 | `agent-plugins.org` のスキーマURLにアクセスできない | ネットワーク制限、またはドメインがまだ公開途上 | **そもそも取得しない**。仕様自身が読み込み時のスキーマ取得を禁じているので、リポジトリ同梱の `spec-repo/schemas/1.0.0/` を使う | 「`$schema` のURLは識別子であって取得先ではない」という、JSON Schema の勘違いあるあるを解説できる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド: （`tee` 付きのフルコマンドをコピペできる形で。`logs/` のファイル名と対応させる）
- 出たエラー（全文）: （要約せず貼る。特に ajv のパターンエラーと `claude plugin validate` の警告文）
- 効いた解決方法 / 試したこと: （`--spec=draft2020`、`.mcp.json` へのリネーム、`-p` での非対話化 など）
- 所要時間（見積もり → 実測）: （フェーズごと。特にフェーズ3は見積もり130分に対してどうだったか）
- つまずいた理由・分かっていなかった前提: （`$schema` は取得先ではない / マニフェスト位置は仕様とクライアントで別 など）
- 既存技術と比べて感じた違い: （Claude Code 独自のプラグイン形式との差、CLAUDE.md/AGENTS.md（指示ファイル）との立ち位置の違い）
- スクショを撮った箇所: （ブラウザは使わないので**ターミナル出力のスクショ**。`tree` の2レイアウト比較、`claude plugin validate` の成功/失敗、`--debug` のプラグイン読み込み行、ajv のエラー全文）
- 記事に書きたい気づき: （特に「静かに無視される」系の挙動）

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（テーマ1）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに（8月に6社が出した標準の話） | 前提・出典レポートの調査結果 | 2026-08-06 に Amazon / Microsoft / OpenAI / Vercel / Cursor が発表、同日 Google がコアメンテナ参加。検証日と各バージョン（`logs/00-env.log`）を冒頭に置く |
| 2. なぜこの仕様を試すのか（設定の持ち回り問題） | 前提・動機 | 「自分の書いたスキルは他のエージェントでも使えるのか」。過去記事 `project-root-agent-instructions.md` との切り分け（指示ファイル vs 配布パッケージ仕様）を1段落で明示 |
| 3. 事前に調べたこと（仕様の最小構成と JSON Schema） | フェーズ1（`logs/02-schema-fields.log`）＋ フェーズ1の差分表 | 必須は `$schema` と `name` の2つだけ。`additionalProperties: false`。`name` のパターン制約。仕様とClaude Codeの配置差分表と「予想」 |
| 4. 環境構築（ファイルを置くだけ） | フェーズ2（`logs/03-ajv-plugin.log`, `logs/04-plugin-init.log`） | 作った `plugin.json` / `SKILL.md` 全文、2レイアウトの `tree`、**`--spec=draft2020` で詰まった話**（詰まりポイント1） |
| 5. 実際に作った最小プラグイン | フェーズ2＋フェーズ3前半（`logs/05-ajv-mcp.log`） | `mcp.json` 全文とローカルstdio MCPサーバー。`mcp.json` / `.mcp.json`、`${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` の比較表 |
| 6. スキーマ検証で分かったこと | フェーズ3の `claude plugin validate` 4本（`logs/06`〜`09`）＋ 違反(d)（`logs/17`） | 2つのバリデータの厳しさが逆方向だったこと。ajv は閉じたスキーマで落とし、Claude Code は未知フィールドを無視する非対称 |
| 7. 詰まった点（クライアント実装との配置のズレ／エラーメッセージ） | フェーズ3のロード検証（`logs/10`〜`13`）＋ 違反パターン（`logs/14`〜`16`）＋ 詰まりポイント表 | 山場。root `plugin.json` が無視され名前がディレクトリ名になったか、MCPが登録されなかったか。**エラーが出ずに静かに無視される**話。エラー文は全文で貼る |
| 8. 「標準」と「クライアント独自形式」の現在地 | フェーズ4（`extensions` / 両方置き / 再帰探索） | `extensions` という逃げ道が実際に使われているか。「ajv が通った＝仕様準拠」ではない話。**2026-08-15時点・Claude Code 2.1.227 での観測**と条件付きで書く |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | 今スキルを書いている人が今日やるべきこと（＝両レイアウトを併置しておく等）。範囲外（マーケットプレイス配布、VS Code / Cursor 検証）を明示 |
| 10. まとめ | `RESULTS.md` のマトリクス | 予想 vs 実測の表をそのまま結論に。次回やることを1行 |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない。仕様は 1.0.0 でクライアント対応は流動的なので、**必ず「2026-08-15時点 / Claude Code 2.1.227 / Node v22.17.0 での観測」と条件を書く**
- うまくいった点だけでなく、詰まった点と解決過程を書く。特に**エラーも出ずに無視される挙動**は「気づかなかった」過程込みで書く
- 実行ログ・ターミナルのスクリーンショット・コード全文（`plugin.json` / `SKILL.md` / `mcp.json`）を貼る
- 一次情報にリンクする（spec リポジトリ、Google / Vercel / AWS のアナウンス、Claude Code の plugins-reference）
- 「読めなかった」で終わらせず、**では今スキルを書いている人はどうすればいいか**（両レイアウト併置など）を1つ書く
- 範囲外を宣言する（配布・マーケットプレイス公開・VS Code / Cursor での検証は今回やらない）

## 参考リンク

- 公式ドキュメント（仕様）: https://github.com/agentplugins/agent-plugins-spec
  - 仕様本文: https://raw.githubusercontent.com/agentplugins/agent-plugins-spec/main/spec/1.0.0.md
  - スキーマ: `schemas/1.0.0/plugin.schema.json` / `schemas/1.0.0/mcp.schema.json`
- 公式ドキュメント（Claude Code 側）: https://code.claude.com/docs/en/plugins / https://code.claude.com/docs/en/plugins-reference
- 発表アナウンス: https://developers.googleblog.com/agent-plugins-package-your-skills-tools-and-more/ / https://vercel.com/blog/introducing-agent-plugins / https://aws.amazon.com/blogs/opensource/aws-supports-agent-plugins-an-open-standard-for-portable-agent-extensions/
- 他クライアント（今回は範囲外だが参照先として）: https://code.visualstudio.com/docs/agent-customization/agent-plugins
- 検証ツール: https://github.com/ajv-validator/ajv-cli （`ajv-cli@5.0.0`、draft 2020-12 は `--spec=draft2020`）
- 関連する自分の過去記事: `articles/project-root-agent-instructions.md`（CLAUDE.md / AGENTS.md。**指示ファイル vs 配布パッケージ仕様**として冒頭で切り分ける）

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: **なし**。使うのはローカルCLIと npm / GitHub からの取得のみ。課金APIキー・サインアップ・マーケットプレイス公開は一切行わない
- ライセンス / 規約: 仕様リポジトリのライセンスを確認してから、スキーマやサンプルを記事に引用する（引用は必要最小限＋出典リンク）
- セキュリティ（APIキーの扱い等）: 秘密情報を扱わない設計。ただし `claude --debug` のログには**環境変数やパスが出る可能性がある**ため、記事に貼る前に `logs/` をホームパス・ユーザー名で grep して伏せる（`grep -ri -e "$USER" -e "/Users/" logs/`）
- 環境汚染: `claude plugin init` は `~/.claude/skills/` に作られ自動ロードされるため、検証後に必ず削除する
- 撤退ライン:
  - `claude --plugin-dir` の入れ子実行が動かない場合 → ロード検証を諦め、**`ajv` ＋ `claude plugin validate` の静的検証だけで記事を成立させる**（完了条件1・2・4・5は満たせる。3は「実行できなかった理由」を記録して代替）
  - `ajv-cli` が draft 2020-12 でどうしても動かない場合 → `node` で `ajv/dist/2020` を直接呼ぶ小スクリプトに切り替える（`npx --yes -p ajv@8 -p ajv-formats node -e '...'`）。ここで30分以上溶けたら切り替える
  - フェーズ3の本編が2時間を超えたら、フェーズ4を放棄してフェーズ5に進む（記事は成立する）

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` で実行）
- [ ] 記録テンプレを埋めながら進める（全コマンドを `tee` で `logs/` に残す）
- [ ] 完了条件1〜5をすべて満たしたら「記事への写像」に沿って `/draft-article` で本文ドラフトへ展開する
