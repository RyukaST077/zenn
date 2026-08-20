# Claude Code Bash sandbox と loopback 宛て通信: `allowedDomains` に `127.0.0.1` を書けばローカル dev server に届くのか

## 調査条件

- 調査日時: 2026-08-20 11:06 JST
- 外部情報の参照日: 2026-08-20
- 依頼スコープ: 本リポジトリが未収録の、現行かつ実用的な Claude Code / OpenAI Codex の know-how、設定、workflow、harness、model / CLI 機能、または再現可能な失敗境界
- 選定 provider: Anthropic Claude Code のみ
- 提案 mode: `boundary`
- 想定記事タイプ: `failure`
- 選定バージョン境界: ローカル導入済みの Claude Code `2.1.236 (Claude Code)` / macOS 26.5 (build 25F71) arm64
- provider 比較: 除外。主張は Claude Code 固有の Bash sandbox の egress 境界であり、Codex と並べても読者の判断材料が増えない
- 実践の実行: この探索段階では未実施
- Git 操作、公開、credential の参照・出力、本番系への変更、外部システムへの副作用、CLI の更新: 未実施

## 明示的な制約

- 反証可能な実践主張をちょうど 1 件だけ選ぶ
- `articles/*.md` および `research/agent/*.md` と実質的に重複する題材を除外する
- 現行の公式一次情報を根拠とし、コミュニティ情報は再検証前提の仮説としてのみ扱う
- 後段の検証は、bounded / offline（loopback のみ）/ 決定的 / 一時ディレクトリ内に閉じたものとする
- credential を参照・複製・出力・ハッシュ化・レポート記録しない
- この段階では fixture 作成、実践計画、Claude Code の実行、記事執筆、公開、Git 状態変更を行わない
- 研究レポートはちょうど 1 件作成する

## ローカル観測（外部事実ではない）

- macOS 26.5 (25F71) arm64
- Claude Code `2.1.236 (Claude Code)`
- OpenAI Codex CLI `0.147.0`
- Node.js `v22.17.1`
- Python `3.14.6`
- `curl 8.7.1 (x86_64-apple-darwin25.0)` (`/usr/bin/curl`)

macOS の sandbox は Seatbelt 内蔵のため追加パッケージ不要であり、`bubblewrap` / `socat` の導入判断は本ホストでは発生しない（公式 sandboxing ページ、参照日 2026-08-20）。

## リポジトリ内の除外確認

`articles/*.md` 46 件（未追跡の下書きを含む）と `research/agent/*.md` 8 件を、ファイル名・見出し・エージェント関連本文で確認した。Git 状態は変更していない。さらに `sandbox`、`seatbelt`、`allowedDomains`、`loopback`、`127.0.0.1` を全文検索した。

- `articles/project-root-agent-instructions.md` / `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`: project-root `CLAUDE.md` / `AGENTS.md` の読み込み。sandbox の egress とは無関係。
- `articles/codex-pretooluse-dispatch-preflight.md` / 同名レポート: Codex の hook dispatch と deny。Codex の `--sandbox workspace-write` は harness 入力として登場するだけで、Claude Code の OS レベル network 分離は扱っていない。
- `articles/codex-resume-ephemeral-rollout-gate.md` / `articles/codex-ignore-flags-user-skill-boundary.md` と対応レポート: Codex の session 永続化、設定分離 flag と user skill。いずれも Codex 側の話で、`sandbox read-only` は入力条件としての言及のみ。
- `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`: `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` と shell startup file の副作用。credential 環境変数の除去であり、network 層でも `sandbox.network.*` でもない。
- `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`: `--max-turns` の subagent 境界。
- `research/agent/agent-knowhow-claude-dontask-broad-allow-rule-drop-20260818-0521.md`: `dontAsk` における Bash allow rule の exact / wildcard 境界。permission rule の評価であり、OS 強制の sandbox 境界とは層が異なる。
- `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`: Codex JSONL の最終成果物。
- `articles/agent-plugins-spec-claude-code-half-load.md`: Claude Code の plugin 読み込み境界。
- `articles/codex-gpt-5-6-model-guide.md`: model / reasoning effort 選択。品質・レイテンシ・コストは本件の対象外。
- `articles/chrome150-focusgroup-property-gate.md`、`articles/opentelemetry-js-collector-jaeger-first-trace.md`、`articles/hono-query-method-curl-fetch-browser.md` は `127.0.0.1` / `localhost` を含むが、いずれも非エージェント題材（ブラウザ検証、Collector、HTTP フレームワーク）であり、Claude Code の sandbox とは無関係。
- 残りの記事は Zenn 公開手順または非エージェントの工学題材で、実質的重複ではない。

`sandbox.enabled`、`sandbox.network`、`allowedDomains`、`strictAllowlist`、`allowUnsandboxedCommands`、`excludedCommands`、`dangerouslyDisableSandbox`、loopback 宛て egress を扱った記事・レポートは 1 件も存在しない。

## 検索範囲と代表的な既存カバレッジ

2026-08-20 に live web search を実施。代表的なクエリ:

1. `Claude Code changelog 2.1.23 new feature settings 2026`
2. `Claude Code headless stream-json init event mcp_server_errors mcp-config skipped`
3. `code.claude.com docs SDK headless "stream-json" system init event fields "mcp_servers" status`
4. `Claude Code "strictAllowlist" sandbox network allowlist localhost 2.1.219`
5. `Claude Code settings sandbox "allowLocalBinding" allowUnixSockets excludedCommands reference`

既存の強いカバレッジとして確認したもの:

- 公式 sandboxing ページは、network 分離が sandbox 外の proxy 経由であること、既定では事前許可ドメインが無いこと、`allowedDomains` / `deniedDomains` / `WebFetch(domain:...)` が allowlist を構成すること、`strictAllowlist` が prompt の代わりに拒否すること、domain list 内の IPv6 リテラルは角括弧表記で書くこと（`"[::1]"` は v2.1.229 以降）を明記している。
- 同ページの Troubleshooting は「host-not-allowed error」「Go 製 CLI の TLS 検証失敗」「`docker` 非互換」「`jest` / watchman」「Apple Events」を列挙している。**loopback / localhost の項目は存在しない。**
- コミュニティ記事（note.com の `strictAllowlist` 解説、claudecodecamp、penligent 等）は設定の要約と exfiltration リスクを述べるが、loopback 宛て接続の可否を検証していない。仮説源としてのみ扱う。

## 一次情報（すべて参照日 2026-08-20）

1. Claude Code 公式ドキュメント「Configure the sandboxed Bash tool」。network 分離、allowlist、`strictAllowlist`、escape hatch、IPv6 表記、Troubleshooting、Limitations を規定。ページ上に更新日表示は確認できなかった。URL: https://code.claude.com/docs/en/sandboxing
   - 逐語引用: 「**Domain restrictions**: no domains are pre-allowed by default. The first time a command needs a new domain, Claude Code prompts for approval」
   - 逐語引用: 「**Strict allowlist**: if you set `strictAllowlist` to `true` in user, managed, or CLI `--settings` settings, Claude Code denies sandboxed commands access to any host outside the allowlist instead of prompting. ... Requires Claude Code v2.1.219 or later.」
   - 逐語引用: 「To match an IPv6 address in any of them, write the literal in brackets: `"[::1]"` matches that address on every port ... The bracketed form requires Claude Code v2.1.229 or later.」
   - 逐語引用: 「when a command fails because of sandbox restrictions, Claude analyzes the failure and may retry the command with the `dangerouslyDisableSandbox` parameter.」
   - 逐語引用: 「You can disable this escape hatch by setting `"allowUnsandboxedCommands": false` in your sandbox settings.」
   - 逐語引用（Troubleshooting）: 「**Commands fail with a host-not-allowed error**: many CLI tools need to reach specific hosts.」
   - パラフレーズ（明示）: 同ページは macOS が Seatbelt、Linux / WSL2 が bubblewrap で強制すること、制限が子プロセスにも及ぶこと、subagent は親と同じ sandbox 設定を使うことを述べる。**loopback / `127.0.0.1` / `localhost` 宛ての outbound 接続がこの allowlist の対象になるかは、同ページのどこにも書かれていない。**
2. Claude Code 公式ドキュメント「Run Claude Code programmatically」。`-p`、`--settings <file-or-json>`、`--bare`、`--output-format`、`--allowedTools`、`--permission-mode` を規定。後段 harness の非対話実行条件の根拠。URL: https://code.claude.com/docs/en/headless
3. Claude Code 公式 CHANGELOG（GitHub raw、anthropics/claude-code、main ブランチ）。URL: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
   - v2.1.219 逐語相当: 「Added `sandbox.network.strictAllowlist` setting to deny non-allowlisted hosts for sandboxed commands」
   - v2.1.216 逐語相当: 「Added `sandbox.filesystem.disabled` setting to skip filesystem isolation」
4. Claude Code 公式ドキュメント「Connect Claude Code to tools via MCP」。候補却下の根拠として参照。URL: https://code.claude.com/docs/en/mcp
5. 公式 settings リファレンス。`sandbox` セクションの表本体は取得時に truncate され、`strictAllowlist` / `allowLocalBinding` の行を逐語確認できなかった。本レポートは代わりに sandboxing ページの記述を根拠にしている。URL: https://code.claude.com/docs/en/settings

## コミュニティ情報（仮説のみ、公式扱いしない）

- anthropics/claude-code Issue #28018「Sandbox: allow outbound connections to localhost」。2026-02-24 起票、参照日 2026-08-20 時点で **open**、メンテナ回答は確認できなかった。報告者は、`sandbox.network.allowedDomains` に `localhost` / `127.0.0.1` / `::1` を、さらに `allowLocalBinding: true` を設定してもなお sandbox 内からの loopback 宛て TCP 接続が `EPERM` で失敗し、回避策は毎回の `dangerouslyDisableSandbox: true` か `excludedCommands` しかない、と主張している。用途はローカル Docker サービス（`http://localhost:8000`）に対する統合テスト。URL: https://github.com/anthropics/claude-code/issues/28018
  - 扱い: **未検証の仮説**。起票は 2026-02、当時の CLI バージョンは不明で、その後 `strictAllowlist`(v2.1.219) と角括弧 IPv6 表記(v2.1.229) が追加されている。角括弧表記の追加は、非角括弧の `::1` が当時どう解釈されたかに影響しうるため、現行 `2.1.236` での再測定が必要。
- コミュニティ解説（note.com「Network Isolation Strengthened in Claude Code v2.1.219」、claudecodecamp、penligent、各種 settings まとめ）は `allowLocalBinding` を「localhost ポートへの bind を許可（macOS 限定、既定 false）」と説明する。bind（listen 側）と connect（outbound 側）を混同した記述も見られる。いずれも仮説扱い。

## 候補と却下理由

| 候補 | 内容 | 判定 |
| --- | --- | --- |
| A. sandbox の loopback egress 境界 | sandbox 有効時、`allowedDomains` に loopback を書いて sandboxed Bash から `127.0.0.1` の listener に届くか | **採用** |
| B. headless `mcp_server_errors` の CI gate | `--mcp-config` の検証失敗を `system/init` で検知 | 却下。`research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md` が既に同候補を検討し「公式の programmatic-usage ページが CI gate と clean-exit / stderr 境界をそのまま提供しており、記事にすべき差分が残らない」として却下済み。再確認したところ headless ページは `mcp_servers` / `mcp_server_errors` の各フィールド、skip カテゴリ、`mcp_servers` から消える挙動、stderr 警告の有無まで明記しており、判断は現在も妥当 |
| C. `sandbox.filesystem.disabled` (v2.1.216) | filesystem 層のみ無効化 | 却下。公式ページに「何が効かなくなり何が残るか」の対照表、設定ソース制限、`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` との相互作用まで詳述済みで、feature summary の再掲になる |
| D. subagent の入れ子深さ既定 3 (v2.1.219) | subagent が subagent を生む深さ | 却下。深さ・並列上限・spawn 上限は model の判断に依存し、offline fixture で決定的に再現しにくい。`--max-turns` の subagent 境界レポートとも隣接 |
| E. `DirectoryAdded` hook (v2.1.219) | `/add-dir` 後に発火 | 却下。対話操作前提で、非対話 fixture に落とせない |
| F. Codex `codex exec fork` (0.148.0, 2026-08-18) | session の fork | 却下。ローカル導入は `0.147.0` で当該機能を含まず、検証にはグローバル CLI 更新が必要。バージョン境界の主張が現環境で成立しない |
| G. hook condition の `dir/**` 単一セグメント一致 (v2.1.214) | path 一致境界 | 却下。`dontAsk` allow rule レポートと評価対象（rule の path 一致）が近接しすぎる |

## 選定した反証可能な主張

**対象 provider**: Anthropic Claude Code `2.1.236` / macOS 26.5 arm64。

**主張（反証可能な形）**:

> Claude Code の Bash sandbox を有効にした非対話 `claude -p` 実行において、`sandbox.network.allowedDomains` に `127.0.0.1` / `localhost` / `[::1]` を列挙しても、sandboxed Bash から同一ホスト loopback で待ち受けている listener への outbound TCP 接続は成立せず、listener 側のアクセスログにリクエストが 1 件も記録されない。sandbox を無効化した control arm では同じコマンドが成功し、同じ listener にリクエストが記録される。

反証条件は明快である。allowlist 記載ありの arm で listener のアクセスログに当該リクエストが記録されれば、主張は反証される。その場合の結論は「loopback は allowlist で開けられる」であり、これも読者にとって同等に有用な確定情報になる。control arm が失敗した場合は fixture 不良として結果を破棄する。

## 想定読者と、不確実性が効く場面

**読者**: 手元のリポジトリで Claude Code に `npm test` / `pytest` / `curl` を任せたいバックエンド開発者。テストは `127.0.0.1` の dev server やローカル Docker サービス（DB、モック API）に接続する。auto-allow で許可プロンプトを消したいので `sandbox.enabled: true` を入れたい。

**不確実性が効く瞬間**: sandbox を有効にした直後、これまで通っていた統合テストが接続エラーで落ち始める。読者はまず「外部ドメインの allowlist 不足だ」と考え、公式ドキュメント通りに `allowedDomains` へホストを追加する。ところが対象は `127.0.0.1` で、公式ドキュメントの network 分離の説明にも Troubleshooting にも loopback の記述がない。エラーは host-not-allowed 系にも見えれば、単なる「接続拒否」にも見える。ここで読者は、(1) `allowedDomains` の書き方が悪い、(2) IPv6 表記の問題、(3) dev server 側の bind アドレスの問題、(4) sandbox そのものが loopback を通さない、の 4 つを切り分けられない。

**読者の現在の問題**: sandbox を有効にしたままローカル統合テストを走らせられるのか、それとも `excludedCommands` などで穴を開けるしかないのかが判断できず、sandbox 導入そのものを止めてしまう。

**記事が可能にする判断・行動**: 検証結果に応じて、次のどちらかの決定ルールを、根拠となる観測ログ付きで受け取れる。

- 主張が支持された場合: 「loopback 宛てテストは `allowedDomains` では解決しない。sandbox を有効にするなら、当該テストコマンドを `excludedCommands` に限定列挙して sandbox 外で走らせるか、依存サービスを sandbox 対象外の別プロセスに寄せる」。あわせて、`allowUnsandboxedCommands` を `false` にしている環境では escape hatch も使えないため、CI で無言のリトライに救われることはない、という運用上の帰結も確定する。
- 主張が反証された場合: 「loopback は allowlist で開けられる。ただし正しい表記（IPv4 リテラルか、角括弧付き IPv6 か、`localhost` か）はこれ」という、公式ドキュメントに無い具体的な記法を提示する。

## 公式ドキュメント・既存記事が既に答えていること／残る差分

**既に答えていること**:

- sandbox の二層構造（filesystem / network）、既定で事前許可ドメインが無いこと、proxy が sandbox 外で allowlist を強制すること。
- `allowedDomains` / `deniedDomains` / `WebFetch(domain:...)` が allowlist を構成すること、`strictAllowlist` が prompt を拒否に置き換えること、および設定ソース制限（プロジェクト設定からは効かない）。
- domain list 内で IPv6 リテラルを角括弧で書くこと、曖昧な非角括弧表記の保守的な解釈、`/doctor` の警告。
- sandbox 制限で失敗したコマンドが `dangerouslyDisableSandbox` で再試行されうること、`allowUnsandboxedCommands: false` でそれを封じられること。
- host-not-allowed エラー、`docker` / `jest` / Go 製 CLI / Apple Events という既知の非互換とその回避策。

**残る差分（記事の価値）**:

1. 公式ドキュメントは、loopback（`127.0.0.1`、`localhost`、`::1`）宛ての outbound 接続が allowlist の対象なのか、それとも別扱いなのかを一切述べていない。Troubleshooting にも項目がない。
2. コミュニティの唯一の具体的主張は 2026-02 起票・現在も open の Issue #28018 のみで、メンテナ回答が無く、その後に `strictAllowlist` と角括弧 IPv6 表記という関連仕様が 2 度追加されている。**現行バージョンで成立するかは誰も確認していない。**
3. `allowLocalBinding` が bind（listen）側の設定であって connect（outbound）側ではない、という点がコミュニティ記事でしばしば混同されており、読者が誤った設定に時間を溶かす具体的な失敗経路が存在する。
4. 記事は、公式が持たない「決定的な観測ログ + 現行バージョンでの判定 + 実務での代替手段」を提供する。feature summary の再掲にはならない。

## 想定記事タイプ

`failure`（再現可能な失敗境界）。副次的に `configuration-harness` の性格を持つが、成果物の中心は「sandbox 有効化時に loopback 依存のローカルテストが落ちる境界と、その回避判断」である。

## ローカル実行可能性、mode、期待される証拠

**mode**: `boundary`（同一 provider の control / treatment 比較。provider 間比較ではない）。

**実行可能性**: 高い。macOS の sandbox は Seatbelt 内蔵で追加依存が無く、通信は loopback に閉じるため外部ネットワークを一切必要としない。認証済み `claude` CLI による短い非対話実行のみで足りる。

**fixture の骨子（この段階では作成しない）**:

- 一時ディレクトリ内に marker ファイル 1 つを置き、`python3 -m http.server` を `127.0.0.1` の ephemeral port に bind して起動する。listener は harness 側（sandbox 外）が起動するため、`allowLocalBinding` の可否には依存しない。
- 各 arm で `claude -p` を 1 回、短い prompt と小さい `--max-turns` で実行し、`--settings` に JSON を直接渡して sandbox 設定を与える（`--settings` は `strictAllowlist` を honor する 3 つのソースの 1 つ）。プロジェクト設定には sandbox 設定を置かない。
- arm 構成:
  - `control-nosandbox`: `sandbox.enabled: false`。loopback への取得が成功することを確認し、fixture と oracle の健全性を担保する。
  - `deny-empty`: `sandbox.enabled: true`、`allowedDomains: []`、`strictAllowlist: true`、`allowUnsandboxedCommands: false`。
  - `allow-loopback`: 上記に加え `allowedDomains: ["127.0.0.1", "localhost", "[::1]"]`。**これが主張の核**。
- oracle は 3 系統を併記する。(1) listener のアクセスログ（model の言い分から独立した決定的な副作用）、(2) sandboxed コマンドの終了コードとエラー文字列、(3) marker 文字列が最終出力に現れたか。判定は (1) を優先する。
- 各 arm の CLI バージョン、prompt hash、settings JSON、port、時刻、ログ行数を機械可読なメタデータとして残す。

**期待される証拠**:

- `control-nosandbox` で listener に 1 件のリクエストが記録され、marker が取得できること。
- `deny-empty` と `allow-loopback` それぞれで、listener にリクエストが記録されたか否か。`allow-loopback` の結果が主張の採否を決める。
- 拒否時に観測されるエラー文言（`EPERM` / `Operation not permitted` / host-not-allowed 系のいずれか）。文言そのものが、読者が自分の失敗を同定するための識別子になる。

**fixture から実務への対応付け**:

`python3 -m http.server` は、読者環境の dev server・Docker 上の DB・モック API サーバの代理である。検証しているのは HTTP の内容ではなく「sandboxed 子プロセスから同一ホスト loopback への TCP 接続が成立するか」という OS 強制の境界であり、この境界は listener の実装に依存しない。したがって、`vite dev`、`postgres` の 5432、`localstack` の 4566 など、ポートとプロトコルが変わっても同じ結論が適用できる。逆に、この fixture は外部ドメインの allowlist の正しさ、TLS 検査、exfiltration 耐性については何も述べない。

## 安全性、コスト、停止条件

**安全性**:

- 通信は loopback に限定し、外部ホストへは接続しない。外部システムへの副作用は無い。
- 一時ディレクトリと ephemeral port のみを使用し、実ホームディレクトリ、`~/.claude` 配下、リポジトリ追跡ファイルを変更しない。
- credential を参照・出力・複製・記録しない。`--settings` に渡す JSON にも秘密情報を含めない。
- `dangerouslyDisableSandbox` は arm 設計上むしろ封じる側（`allowUnsandboxedCommands: false`）で扱う。sandbox escape や権限昇格の検証は行わない。
- listener は harness が起動し、実行後に確実に停止する。ポート衝突を避けるため ephemeral port を使う。

**コスト**: 短い prompt の `claude -p` を arm あたり 1 回、計 3 回程度。`--max-turns` を小さく固定し、追加のモデル呼び出しや依存パッケージのインストールを行わない。

**停止条件**:

- `control-nosandbox` で listener にリクエストが届かない場合、fixture 不良として測定を破棄し、結論を出さない。
- 同一設定で arm の結果が再実行間で揺れる場合、決定的でないと判断して主張を取り下げる。
- モデルが指定コマンドを実行しない場合、prompt の明確化を 1 回だけ行い、それでも実行されなければ「モデル依存で境界を測れない」として中止する。
- 検証が sandbox の回避や権限昇格を要求する方向に進んだ時点で中止する。
- ローカル CLI のグローバル更新が必要になった時点で中止する（バージョン境界は `2.1.236` に固定する）。

## この段階で行っていないこと

fixture の作成、実践計画の作成、Claude Code の実行、記事の執筆、公開、Git 状態の変更、CLI の更新、credential の参照。
