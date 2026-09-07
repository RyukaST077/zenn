# 未公開ドラフトの価値型インベントリ

生成: 2026-09-05 / 対象: `articles/*.md` のうち `published: false` の 33 本

`strategy/topic-selection-policy.json` の7型に分類したもの。**公開前の再設計の入力**であって、
契約（`analytics/contracts/<slug>.json`）ではない。実際に公開するときは `register-article.mjs` で
契約を登録し、そこが正となる。

分類方法は3種類ある。

| 印 | 意味 |
|---|---|
| `reviewed` | 本文を読んで分類した（タイトルのヒューリスティックが `unclassified` を返した17本） |
| `corrected` | ヒューリスティックの判定が誤りだったので、本文を読んで訂正した |
| `confirmed` | ヒューリスティックの判定を本文の見出し構成で確認し、妥当と判断した |

## 集計

| stage | 価値型 | 本数 | 公開の可否 |
|---|---|---:|---|
| provisional | `asset` | 2 | 実験群（`B-payload`）に入れられる |
| provisional | `migration` | 2 | 実験群（`B-payload`）に入れられる |
| candidate | `mental-model` | 3 | 探索枠（`exploration`）で公開できる |
| candidate | `decision` | 2 | 探索枠（`exploration`）で公開できる |
| deprecated | `boundary-verification` | 18 | **そのままでは公開しない** |
| deprecated | `incident-log` | 6 | **そのままでは公開しない** |

**deprecated が 24 / 33 本（73%）。**
これは公開済み57本の対照群とまったく同じ型で、`register-article.mjs` が契約登録を拒否する。
そのまま出すと実験の証拠にならず、5いいね以上が0本だった型の在庫を増やすだけになる。

## `asset`（provisional） — 2本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| `claude-automode-defaults-splice-check`<br>Claude Code auto modeの$defaults抜け、配布前にJSON diffで検出する | reviewed | 配布前の $defaults 抜けを defaults/config のセクション単位 diff で検出する手順。CI・pre-commit にスクリプト化できる形で提示している | — |
| `codex-agents-shared-byte-budget`<br>Codexのnested AGENTS.mdを共有バイト上限から守る検証gate | reviewed | nested AGENTS.md を共有バイト上限から守る 2-probe gate と、そのまま使える再検証 recipe | — |

## `migration`（provisional） — 2本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| `pnpm12-rc-five-diffs`<br>pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた | reviewed | 公式が挙げた差分5点を1つずつ踏み、どれが再現しどれがしないかを一覧化 | — |
| `vitest5-rc-breaking-changes`<br>Vitest 5 RC に上げてみたら、テストより先に npm が落ちた | reviewed | 破壊的変更24項目から8項目を選び、項目ごとの直し方まで書いている | — |

## `mental-model`（candidate） — 3本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| `claude-permission-prompts-deny-boundary`<br>Claude Codeの--permission-prompts noneは「何を拒否するか」ではなく「誰が拒否するか」を変える | reviewed | 「何を拒否するか」ではなく「誰が拒否するか」を変えるフラグ、という再定義。他フラグの読み方にも転用できる | — |
| `claude-sandbox-loopback-eperm-check`<br>Claude Code sandboxで127.0.0.1がEPERM、allowlistでは変わらなかった | reviewed | 中心は EPERM の事実ではなく「server 側の0件を拒否と読める条件」。証拠の読み方のモデル＋4段の判定順序 | — |
| `claude-sonnet-opus-delegation`<br>Sonnet 5だけAgent treeが増える理由――Claude Codeの4層で切り分ける | reviewed | Agent tree 増加を4層に切り分け、3つの増幅器から症状に応じて止めるものを選ばせる | — |

## `decision`（candidate） — 2本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| `claude-model-flag-overrides-settings-json`<br>claude --model はチーム共有のsettings.jsonに勝つか？ v2.1.248で検証 | reviewed | 共有 settings.json がある状態で --model を信頼してよいかに、条件付きで答えを出している | — |
| `claude-sandbox-credential-mask-extract-fallback`<br>Claude Codeのsandbox credential mask、extractが不一致だと平文が漏れる | reviewed | onExtractNoMatch の既定が fail-open。明示的に deny/error を設定せよという答えを出している | — |

## `boundary-verification`（deprecated） — 18本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| `agent-plugins-spec-claude-code-half-load`<br>Agent Plugins 1.0.0の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた | corrected | ヒューリスティックは「作った」で asset と誤判定。実体は仕様どおりのプラグインが読めるかの一点検証 | `migration`  → 束4 claude-plugin-visibility-kit に吸収済み（2.1.261 で再検証・結論が変化） |
| `astro72-incremental-build-boundaries`<br>Astro 7.2増分ビルドの失効境界を300ページで検証した | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → astro-incremental-build-blast-radius に再設計（quantified・7.3.1 で再検証）。元ファイルは削除 |
| `bun-markdown-marked-sanitize-boundary`<br>Bun 1.4のBun.markdownとmarkedを危険入力で比較した | corrected | ヒューリスティックは comparison（policy に存在しない語彙）。7入力の比較だが置換の可否に答えを出しておらず、網羅でもない | `migration`  → bun-markdown-marked-migration-verdict に再設計（migration・入力を7→15に拡張し Bun 1.4.2 で置換可否に答えを出した）。元ファイルは削除 |
| `claude-bypass-permissions-settings-drop`<br>Claude Code 2.1.257: .claude/settings.jsonのbypassPermissionsは効かない | reviewed | 設定ファイル経由の bypassPermissions が効くかの一点検証 | `asset`  → 束2 claude-ci-permission-preflight-kit に吸収済み（2.1.261 で再検証） |
| `claude-dangling-bash-operator-approval-boundary`<br>Claude Codeの&&末尾コマンド、allowルールでも本当に拒否される? | reviewed | && 末尾コマンドが allow ルールで拒否されるかの一点検証 | `asset`  → 束2 claude-ci-permission-preflight-kit に吸収済み（2.1.261 で再検証） |
| `claude-grep-glob-symlink-deny-still-blocks`<br>Claude Code 2.1.251前でもsymlink探索起点へのRead denyは効くか実測した | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） | → 束1 claude-deny-regression-kit に吸収済み（同上） |
| `claude-plugin-archive-loopback-block`<br>archiveソースのプラグインが127.0.0.1で弾かれる時、CLIは何と言うか | reviewed | エラー文言が loopback ブロックの証拠にならない、という否定結果。読者の持ち帰りが無い | `mental-model`  → 束4 claude-plugin-visibility-kit に吸収済み（2.1.261 で再検証・結論が変化） |
| `claude-read-deny-redirect-boundary`<br>Read()のdenyは許可リスト外コマンドへのリダイレクトも塞ぐか検証した | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） | → 束1 claude-deny-regression-kit に吸収済み（元ファイルは束の公開まで残す） |
| `claude-restricted-mode-drops-project-hooks`<br>Claude Codeの--restrictedはPreToolUseフックも無効化する | reviewed | --restricted が PreToolUse フックも無効化するかの一点検証 | `asset`  → 束2 claude-ci-permission-preflight-kit に吸収済み（2.1.261 で再検証） |
| `claude-settings-doctor-bash-wildcard-rule-check`<br>Claude Code 2.1.248: doctorは壊れたBash(...)権限ルールを検知するか検証した | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → 束2 claude-ci-permission-preflight-kit に吸収済み（2.1.261 で再検証） |
| `claude-subagent-model-force-precedence-gap`<br>CLAUDE_CODE_SUBAGENT_MODELだけではpin済みsubagentのモデルを変えられない | corrected | ヒューリスティックは「モデルを変えられない」の『モデル』で mental-model と誤判定。実体は優先順位の一点検証 | `mental-model`  → 束3 claude-env-effect-check-kit に吸収済み（2.1.261 で再検証） |
| `claude-tool-memory-limit-macos-gate`<br>CLAUDE_CODE_TOOL_MEMORY_LIMIT はmacOSでは効かず、--debugも無言だった | reviewed | 環境変数が macOS で効くかの一点検証（silent-gap） | `migration`  → 束3 claude-env-effect-check-kit に吸収済み（2.1.261 で再検証） |
| `claude-toolsearch-disabled-tool-boundary`<br>ToolSearchは「無効化されたツール」を救わない: Claude CodeのTodoWrite境界 | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → 束4 claude-plugin-visibility-kit に吸収済み（2.1.261 で再検証・結論が変化） |
| `claude-write-deny-rule-skip-read-verify`<br>Claude Code 2.1.228後もRead denyルールはWriteの上書きを防ぐか検証した | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） | → 束1 claude-deny-regression-kit に吸収済み（同上） |
| `codex-doctor-term-dumb-network-gate`<br>codex doctorのTERM=dumb直しではCIゲートの赤は消えない場合がある | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → 束5 codex-selfreport-preflight-kit に吸収済み（0.152.1 で再検証） |
| `codex-features-removed-stage-effective-true`<br>Codex CLIのstage: removedはeffective: falseを意味しない | reviewed | stage: removed でも effective: true があるという一点。監査ルールは付くが薄い | `asset`  → 束5 codex-selfreport-preflight-kit に吸収済み（0.152.1 で再検証） |
| `codex-rollout-budget-strict-config-reject`<br>codex features listがrollout_budgetを認識しても-cは通らなかった | reviewed | -c override が受理されない一点。本来検証したかった主張は判定できていない | `asset`  → 束5 codex-selfreport-preflight-kit に吸収済み（0.152.1 で再検証） |
| `css-tree-counting-sandbox-gate`<br>CSS tree counting検証は3エンジンの起動ゲートで止まった | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） | → 削除。claude-sandbox-loopback-eperm-check に吸収済み |

## `incident-log`（deprecated） — 6本

| 記事 | 分類 | 根拠 | 再設計先の候補 |
|---|---|---|---|
| ~~`bumblebee-supply-chain-scan-try`~~<br>**→ `bumblebee-catalog-preflight-kit` に作り直し済み（削除）** | ✅ 完了 | カタログが発火するか判定するキットへ。検証項目7件。Codex レビューで初版の陽性対照不足を修正 |
| `chrome151-soft-navigation-localhost-gate`<br>Chrome 151 Soft Navigation検証がlocalhost gateで止まった記録 | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） | → 削除。同上 |
| `claude-configdir-override-memory-path-gate`<br>Claude Code 2.1.248でCLAUDE_CONFIG_DIR上書きを試したらログインごと壊れた話 | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → 束3 claude-env-effect-check-kit に吸収済み（2.1.261 で再検証） |
| `claude-debug-api-cache-control-gap`<br>claude --debug apiでcache_controlが見えなかった話 | confirmed | タイトルの型が実体と一致（本文の見出し構成で確認） |  → 束3 claude-env-effect-check-kit に吸収済み（2.1.261 で再検証） |
| ~~`hono-query-method-curl-fetch-browser`~~<br>**→ `hono-query-vs-get-body-decision` に作り直し済み（削除）** | ✅ 完了 | 時系列を捨て 3経路×3メソッドの判断表へ。再検証で body ドロップの発生箇所（`@hono/node-server` の `Request` 変換）を特定 | `mental-model` |
| ~~`wrangler-local-explorer-tracing-try`~~<br>**→ `wrangler-trace-query-kit` に作り直し済み（削除）** | ✅ 完了 | トレースを正しく引くキットへ。検証項目7件。observability.enabled はローカル収集を止めないことも確認 |

## ヒューリスティックの精度について（2026-09-05 修正済み）

このインベントリを作る過程で `guessValueArchetype()` の誤判定が4件見つかった。

| slug | 誤 | 正 | 誤判定の理由 |
|---|---|---|---|
| `claude-subagent-model-force-precedence-gap` | `mental-model` | `boundary-verification` | 「**モデル**を変えられない」のモデル（ML）が `/モデル/` に一致 |
| `agent-plugins-spec-claude-code-half-load` | `asset` | `boundary-verification` | 「**作った**プラグインを読ませたら」の従属節が `/作った/` に一致 |
| `bumblebee-supply-chain-scan-try` | `intro-try` | `incident-log` | `intro-try` は policy の7型に無いラベル |
| `bun-markdown-marked-sanitize-boundary` | `comparison` | `boundary-verification` | `comparison` は policy の7型に無いラベル |

同じ関数は `build-topic-feedback.mjs` の節1で**市場上位記事の分類**にも使われる。
節1は policy が「市場の勝ち型」を学ぶ主駆動輪なので、ここを直した。

`fixtures/archetype-labels.json` に市場上位60本の手分類を置き、修正前後を実測した。

| | 修正前 | 修正後 |
|---|---:|---:|
| 正解 | 22 (37%) | **48 (80%)** |
| 誤判定 | 3 | **0** |
| 判定不能 | 35 (58%) | 12 (20%) |
| 精度（判定したもののうち） | 88% | **100%** |

市場側の主問題は誤判定ではなく**再現率**だった（6割が判定不能）。自分のドラフト側は逆で、
判定した16本のうち4本が誤りだった。分布が違うので、片方だけ見ていると原因を取り違える。

方針は「誤判定を出すくらいなら `unclassified` を返す」。誤ラベルは policy を静かに歪めるが、
`unclassified` はレポート上で見えて、LLMによる読み直し工程に回るため。
回帰は `scripts/test-analytics-loop.mjs` の3テストで固定した（誤判定0を必須、再現率70%を下限）。

`comparison` / `intro-try` / `news` は `OBSERVATION_ARCHETYPES` として明示的に分離した。
市場に実在するカテゴリなので観測では使うが、policy は扱いを決めていないので契約には書けない
（`register-article.mjs` が `unknown valueArchetype` で弾く）。

### 本文は良いがタイトルが検証寄りの3本

新ヒューリスティックが本文の実体と食い違ったのは次の3本で、いずれも**タイトルだけが
`boundary-verification`** だった。再設計では改題が必要になる。

| slug | 本文の型 | 現タイトル |
|---|---|---|
| `codex-agents-shared-byte-budget` | `asset` | Codexのnested AGENTS.mdを共有バイト上限から守る**検証gate** |
| `claude-model-flag-overrides-settings-json` | `decision` | claude --model はチーム共有のsettings.jsonに勝つか？ v2.1.248で**検証** |
| `chrome151-soft-navigation-localhost-gate` | `incident-log` | Chrome 151 Soft Navigation**検証**がlocalhost gateで止まった記録 |
