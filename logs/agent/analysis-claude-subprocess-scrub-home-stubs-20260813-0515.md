# Claude subprocess scrub fake-HOME startup boundary: evidence analysis and editorial brief

verdict: inconclusive
action: rerun

## Evidence analysis

### Claim, conditions, and case matrix

The pre-registered claim cannot be evaluated from this run. The plan required the runner to invoke the fixture wrapper through an empty four-name environment, make one sandboxed offline Claude Code startup per case, and retain `case-result.json` with the fake-HOME inventory and login-shell observations. Neither case produced `case-result.json`; both instead recorded a successful model response and nonzero API cost. Those observations violate the plan's offline-boundary, no-model-response, and zero-spend prerequisites, which the plan explicitly classifies as inconclusive rather than as the competing product outcome. Evidence: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md`; `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/{scrub-unset-control,scrub-enabled-treatment}/{events.jsonl,result.txt,verify.log,metrics.json}`.

The recorded scope was Claude Code 2.1.227 on the macOS 26.5 arm64 host, one fresh runner workspace per case, a shared prompt, no model or effort override, and a manifest network request of `false`. The execution log also warns that the runner's network setting is not enforced for Claude host processes. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/execution-log.md`; both case `metrics.json` files; `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json`.

All relative case evidence paths in the following table are under `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/`.

| Case | Pre-registered product observation | Agent / verifier exit | Raw run observation | Diff | Analysis result |
|---|---|---:|---|---|---|
| `scrub-unset-control` | `.bash_profile` absent, `.profile` unchanged, login marker visible | 0 / 1 | successful Claude response; `case-result.json` absent; marker null | empty | control boundary not measured |
| `scrub-enabled-treatment` | zero-byte `.bash_profile`, `.profile` unchanged, login marker hidden | 0 / 1 | successful Claude response; `case-result.json` absent; marker null | empty | treatment boundary not measured |

Evidence for each row: the case's `metrics.json`, `verify.log`, `events.jsonl`, `result.txt`, and `diff.patch`; expected observations: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md` and `.json`.

### Deterministic results

- `scrub-unset-control` recorded agent exit 0, no timeout, 4,512 ms duration, verifier exit 1, null observed marker, zero changed paths, zero protected-path changes, zero unexpected changes, and `passed: false`. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-unset-control/metrics.json`.
- Its verifier failed because `case-result.json` did not exist, so none of the fake-HOME, profile-integrity, sandbox, environment-allowlist, offline-failure, or login-marker assertions could run. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-unset-control/verify.log`; assertion sequence: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/verify.mjs`.
- Its event stream records a Claude Code 2.1.227 initialization, an assistant message, and a successful result with `total_cost_usd` 0.036478800000000006. The corresponding final text says the assistant would not use tools or respond to the probe. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-unset-control/events.jsonl`; final text: the same case's `result.txt`.
- Its empty `diff.patch` and `metrics.json` establish that no case-workspace path changed under the runner's diff oracle. They do not establish the planned fake-HOME state because the structured fake-HOME result is absent. Evidence: the same case's `diff.patch`, `metrics.json`, and `verify.log`.
- `scrub-enabled-treatment` recorded agent exit 0, no timeout, 4,399 ms duration, verifier exit 1, null observed marker, zero changed paths, zero protected-path changes, zero unexpected changes, and `passed: false`. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-enabled-treatment/metrics.json`.
- Its verifier failed at the identical missing-`case-result.json` boundary, before any treatment-specific file or shell assertion. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-enabled-treatment/verify.log`; assertion sequence: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/verify.mjs`.
- Its event stream records a Claude Code 2.1.227 initialization, an assistant message, and a successful result with `total_cost_usd` 0.036229800000000006. The corresponding final text says no action was taken. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-enabled-treatment/events.jsonl`; final text: the same case's `result.txt`.
- Its empty `diff.patch` and zero changed paths likewise do not prove that treatment preserved `.profile` or left `.bash_profile` absent; the fixture's home inventory and before/after shell oracle were never retained. Evidence: the same case's `diff.patch`, `metrics.json`, and `verify.log`; required retained fields: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/probe-wrapper.mjs`.
- Both `stderr.log` files are empty. This supplies no offline connection diagnostic, sandbox diagnostic, wrapper error, login prompt, or verifier detail beyond the separate verifier logs. Evidence: both case `stderr.log` files.
- Both preserved workspaces contain only `probe-wrapper.mjs` and `verify.mjs`; neither contains `case-result.json` or `verification.txt`. Evidence: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/work/{scrub-unset-control,scrub-enabled-treatment}/`; corroboration: both case `verify.log` and `metrics.json` files.

### Observed facts and interpretation boundary

Observed facts:

- The runner-facing command record names `claude` and includes the ordinary agent arguments, while each raw event stream contains native Claude `system`, `assistant`, and `result` events. Evidence: both case `command.json` and `events.jsonl` files.
- The fixture wrapper's declared successful runner-facing output is instead one synthetic `result` event whose text is `offline startup probe evidence recorded`, after writing `case-result.json`. Neither recorded case has that text or file. Evidence: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/probe-wrapper.mjs`; both case `result.txt` and `verify.log` files.
- Both runs reached a model-backed success path and recorded token usage and cost. Evidence: both case `events.jsonl` files.
- The event streams redact `apiKeySource`; no credential value is present in the inspected case artifacts. Evidence: both case `events.jsonl` files. This is an artifact observation, not proof that no host credential source was used.

Interpretation:

- The evidence is consistent with the ordinary Claude runner path being used instead of the required `CLAUDE_BIN` wrapper launch. This is an inference from the native event stream, model response, nonzero cost, missing wrapper success text, and missing `case-result.json`; the run does not retain its outer shell invocation, so the exact orchestration mistake is not directly recorded. Evidence: both case `command.json`, `events.jsonl`, `result.txt`, and `verify.log` files; required launch: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md`.
- Because the fixture did not retain its before/after inventories, the identical empty diffs cannot be interpreted as a control/treatment non-reproduction. The diffs cover the runner workspace, whereas the planned semantic oracle was the structured result collected from a temporary fake HOME. Evidence: both case `diff.patch` and `verify.log` files; fixture oracle: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/{probe-wrapper.mjs,verify.mjs}`.
- The model replies do not answer the filesystem claim. The prompt explicitly instructed no tools or answer, and the plan required failure at an unavailable offline API boundary before any model response. Evidence: manifest prompt in `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json`; both case `events.jsonl`; plan deterministic assertion 4.

### External facts and citations

These are source claims recorded in the research report, not observations from this execution:

- Anthropic documents `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` as removing Anthropic and cloud-provider credentials from Bash tool, hook, and MCP stdio subprocess environments; the research report records Linux PID-namespace behavior separately. Evidence: `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`, citing [Anthropic environment variables documentation](https://code.claude.com/docs/en/env-vars), accessed 2026-08-13.
- Anthropic's changelog records introduction of the scrub flag in 2.1.83, Linux PID-namespace isolation in 2.1.98, and the tested local release 2.1.227 on 2026-08-10. Evidence: the research report, citing [Claude Code changelog](https://code.claude.com/docs/en/changelog), accessed 2026-08-13.
- GNU Bash documents that a login shell selects the first readable file among `~/.bash_profile`, `~/.bash_login`, and `~/.profile`; this explains why an empty higher-precedence file could shadow `.profile`. Evidence: the research report, citing [GNU Bash Startup Files](https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files), accessed 2026-08-13.
- A community issue reports a zero-byte `.bash_profile` side effect on Ubuntu/Debian with Claude Code 2.1.205 and Bubblewrap. It is the hypothesis source, not official confirmation and not evidence about macOS 26.5 or Claude Code 2.1.227. Evidence: the research report, citing [anthropics/claude-code issue #76236](https://github.com/anthropics/claude-code/issues/76236), accessed 2026-08-13.

### Alternative explanations

- The required `/usr/bin/env -i` launch and absolute `CLAUDE_BIN` / `REAL_CLAUDE_BIN` overrides may have been omitted or lost before the runner started. This is the leading inference because the plan explicitly warns that an ordinary runner Claude case authenticates and performs a model task, which matches the observed event streams. The outer invocation is not retained, so this cause is not proven. Evidence: plan section `Exact runner and CLI settings`; both case `events.jsonl` and `verify.log` files.
- The wrapper override could have resolved incorrectly or been ignored by orchestration outside the retained run. The runner source selects `process.env.CLAUDE_BIN || "claude"`, but the artifacts record only the normalized executable name rather than the parent process environment. Evidence: `scripts/agent-practice/run-experiment.mjs`; both case `command.json`; absence of an outer launch record in `execution-log.md`.
- A wrapper crash before `case-result.json` creation is theoretically compatible with the missing file, but it does not explain the native successful model event streams or wrapper-specific success text being absent as well as direct runner invocation does. This remains an alternative because no process-level wrapper trace was retained. Evidence: fixture wrapper; both case `events.jsonl`, `result.txt`, and `verify.log` files.
- The run cannot distinguish whether the scrubbed product path would reproduce the Linux report, because no valid control or treatment observation exists. Evidence: both case `verify.log` files and empty structured marker observations in both `metrics.json` files.

### Comparison with the pre-registered expectation

The plan expected the control to retain only `.profile` and keep its marker visible, and the treatment alone to add an exactly zero-byte `.bash_profile`, preserve `.profile`, and hide the marker. Both cases also had to exit nonzero at the unavailable API boundary, report no model response, and pass the verifier. Evidence: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md`, especially `Cases and controlled difference`, `Deterministic verification and strict paths`, and `Pre-registered outcomes and decision rule`.

Neither case reached that evidentiary boundary: both agent exits were 0, both event streams contained model responses, both verifiers failed because the fixture result was missing, and neither produced a marker. Evidence: both case `metrics.json`, `events.jsonl`, and `verify.log` files.

The plan explicitly says that a credential/login attempt, model response, missing offline diagnostic, sandbox/profile failure, or incomplete evidence is inconclusive and must not be counted as the competing product outcome. The `inconclusive` verdict follows that recorded rule; it is not a claim of surprise or a statement about the author's belief or emotion. Evidence: the plan's `Falsifiable claim`, `Pre-registered outcomes and decision rule`, and `Safety, cleanup, limitations, and expected article value` sections.

### Limitations

- There is one failed launch per declared case and no valid sample of either product condition. Evidence: manifest case list; `summary.json`; both case `passed: false` metrics.
- No `case-result.json` exists, so the run supplies no fake-HOME baseline, post-run inventory, `.profile` hash/mode/mtime comparison, `.bash_profile` state, login-marker result, child environment allowlist, sandbox status, binary digest, or offline-failure classification. Evidence: both case `verify.log`; required schema in the fixture wrapper and verifier.
- The outer `/usr/bin/env -i` command and its environment names were not retained, so the analysis cannot prove which launch component was omitted. Evidence: `execution-log.md`; both case `command.json`; plan's exact launch requirement.
- The model and effort overrides were null, and the raw events identify a resolved model but do not prove an immutable backend snapshot. Evidence: both case `metrics.json` and `events.jsonl`; execution-log limitations.
- The runner's manifest network request was not enforced for the host Claude processes in this run. The native successful API results demonstrate that the planned `sandbox-exec deny network*` boundary was not established by retained fixture evidence. Evidence: `execution-log.md`; both case `metrics.json` and `events.jsonl`.
- Empty workspace diffs are not host filesystem or fake-HOME security proofs. Evidence: execution-log limitations; both case `diff.patch`; missing `case-result.json` in both verifier logs.
- No conclusion is supported about Linux, other macOS or Claude versions, every shell, credential scrubbing efficacy, root cause, or whether the reported startup-file side effect is fixed. Evidence: research and plan limitations; absence of valid case results.

### Reusable recipe present in successful evidence

No reusable configuration is supported because neither case passed deterministic verification and the required wrapper path was not successfully recorded. In particular, the report must not present the scrub flag, wrapper launch, sandbox profile, or verifier as a copy-and-paste recipe proven by this run. Evidence: both case `metrics.json` and `verify.log`; `.agents/skills/zenn-agent-analyze-results/references/analysis-template.md`.

The only reusable audit principle supported by the failed run is procedural: before interpreting an A/B product result, require a retained outer-launch record plus the fixture's structured before/after result and verification marker. This is supported as a rerun requirement, not as a successful product configuration. Evidence: plan launch and deterministic-verification sections; both case `verify.log` and `events.jsonl`.

### Unsafe or unsupported variants

- Do not interpret the empty diffs as evidence that the treatment does not create `.bash_profile`; the fake-HOME oracle is missing. Evidence: both case `diff.patch` and `verify.log`.
- Do not claim the upstream Linux/2.1.205 report is reproduced, fixed, or contradicted on macOS/2.1.227. Evidence: research report scope; no valid treatment result.
- Do not publish or recommend the fixture launch as verified until a rerun records the wrapper's four-name runner environment, sandbox enforcement, offline failure, and both case markers. Evidence: fixture verifier assertions; both case failures.
- Do not reuse actual host authentication for the rerun. The plan requires a fixed invalid marker, unreachable loopback endpoint, network denial, and no credential inspection. Evidence: plan exact settings and safety sections.
- Do not expose the redacted authentication source or attempt to discover which host credential was used by the accidental model runs. Evidence: both case `events.jsonl` redact `apiKeySource`; plan credential restrictions.
- Do not infer root cause from the missing wrapper result alone; the outer launch environment was not retained. Evidence: `execution-log.md`; both case `command.json` and `verify.log`.
- Do not invent author surprise, frustration, prior rollout, production impact, or first-person experience. The observed mismatch is already classified by the pre-registered inconclusive rule. Evidence: plan decision rule.

### Article-safe facts

- Both declared cases ran under the recorded Claude Code 2.1.227 event stream, exited 0, and produced a successful model response. Evidence: both case `events.jsonl` and `metrics.json` files.
- Both verifiers exited 1 because `case-result.json` was absent; neither produced its expected marker. Evidence: both case `verify.log` and `metrics.json` files.
- Both workspace diffs were empty, but the structured fake-HOME evidence needed to interpret the product claim was missing. Evidence: both case `diff.patch`, `metrics.json`, and `verify.log` files.
- The run violated the pre-registered offline/no-model/no-spend boundary, so it supports neither confirmation nor non-reproduction of the `.bash_profile` claim. Evidence: plan decision rule; both case `events.jsonl` and `verify.log`.
- The supported next decision is to preserve this failed attempt and rerun only after the outer launch is recorded and proven to select the wrapper under the required empty environment. Evidence: plan instruction to preserve failed attempts and not retry automatically; failure evidence in both cases.

## Editorial brief

### One concrete reader and situation

A CI, self-hosted-runner, or local automation maintainer considering `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` on Claude Code 2.1.227/macOS and deciding whether it needs a disposable-HOME startup-file gate before rollout. Evidence for the named reader and situation: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md`; `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`.

### Reader problem

The maintainer needs a current platform/version-specific answer about silent `.bash_profile` creation and `.profile` shadowing, but this run exercised an authenticated model path instead of the planned offline fake-HOME probe, leaving that rollout decision unresolved. Evidence: plan reader problem; both case `events.jsonl` and `verify.log`.

### One-sentence article promise and takeaway

> A disposable-HOME A/B can decide whether the scrub control shadows `.profile` on the tested macOS/Claude version, but only after the harness proves it invoked the offline wrapper; this run did not, so rerun before drawing a rollout conclusion.

Evidence: plan promised decision and verification contract; both case `events.jsonl`, `verify.log`, and `diff.patch`.

### Coverage gap filled and article type

- Coverage gap to fill after a valid rerun: official documentation explains credential scrubbing and Bash documents startup precedence, while the repository lacks retained macOS/2.1.227 evidence connecting the flag to a before/after fake-HOME inventory and login-shell oracle. Evidence: research report sections `Official and primary sources`, `Existing repository exclusions`, and `What existing sources answer and the remaining coverage gap`.
- Current evidence gap: the run adds only a harness-launch failure and cannot yet fill the named reader's product-decision gap. Evidence: both case artifacts.
- Intended article type after valid evidence: `failure` if the side effect reproduces or the current boundary is a useful negative result; the present editorial brief classifies the evidence-led story as a `failure` report about an inconclusive preflight, but next action remains `rerun`. Evidence: plan likely article type; current failed verifier evidence.

### Why the result matters in real work

A false green or false negative at the harness layer could lead a maintainer either to miss a startup-file regression or to reject a useful credential-scrubbing control without evidence. The recorded run demonstrates that a successful agent exit is not a valid probe result when the structured filesystem oracle is absent and a model response occurred. Evidence: both case `metrics.json`, `events.jsonl`, and `verify.log`; plan decision rule.

### Practical decision rule and mapping

Decision rule:

> Do not decide whether to enable the scrub flag from agent exit status or an empty workspace diff. Require the recorded outer empty-environment launch, wrapper-specific result, `case-result.json`, verifier exit 0, and the expected control/treatment marker; otherwise classify the preflight as inconclusive and rerun after fixing orchestration.

Evidence: plan exact launch and deterministic assertions; both case failures.

| Fixture or run signal | Real-work decision signal |
|---|---|
| retained outer `/usr/bin/env -i` launch with absolute wrapper and real binary | the intended offline harness, not ordinary authenticated Claude, was selected |
| wrapper result text plus `case-result.json` | fake-HOME and process-boundary observations exist for audit |
| control marker with `.bash_profile` absent and login marker visible | baseline shell initialization remained intact |
| treatment marker with zero-byte `.bash_profile` and login marker hidden | gate rollout and investigate the shadowing side effect on the tested boundary |
| both cases reach the offline boundary but treatment lacks the conjunction | report narrow non-reproduction; do not claim a global fix |
| model response, missing structured result, or verifier exit 1 | stop interpretation and rerun the harness; no product verdict |

Evidence: manifest verification markers; plan practical mapping and pre-registered decision rule; both case `events.jsonl`, `verify.log`, and `metrics.json`.

### Evidence-led story arc

1. Open with the reader decision: whether the current macOS/Claude boundary may enable credential scrubbing without a startup-file preflight. Evidence: plan promised decision.
2. Explain the two-case oracle: disposable `.profile`, absent `.bash_profile`, exact file metadata, and a later `bash -lc` marker. Evidence: plan fixture and deterministic-verification sections.
3. State the recorded outcome immediately: both cases returned model-backed success, produced cost, and lacked `case-result.json`; both verifiers failed. Evidence: both case `events.jsonl`, `metrics.json`, and `verify.log`.
4. Show why agent exit 0 and empty diffs cannot answer the claim when the fake-HOME oracle is absent. Evidence: both case `diff.patch`, `metrics.json`, and `verify.log`; fixture wrapper result schema.
5. Contrast the observed path with the pre-registered offline/no-model boundary and classify it as inconclusive, without calling it surprising. Evidence: plan decision rule.
6. Give the rerun gate: retain the exact outer launch and require wrapper-specific result, structured evidence, and both verification markers before comparing product behavior. Evidence: plan exact command and fixture verifier.
7. Defer the product-facing article conclusion until the rerun yields valid control and treatment observations. Evidence: no valid case in current run.

### Body evidence

- The compact case matrix with agent/verifier exits, successful model response, missing `case-result.json`, marker null, and empty diff. Evidence: both case `metrics.json`, `events.jsonl`, `verify.log`, and `diff.patch`.
- The wrapper contract showing what the successful offline path would write, paired with the actual native model results. Evidence: fixture wrapper; both case `result.txt` and `events.jsonl`.
- The pre-registered rule that model response, credential path, missing offline diagnostic, or incomplete evidence is inconclusive. Evidence: plan falsifiable-claim and decision-rule sections.
- The practical rerun decision rule distinguishing harness evidence from product evidence. Evidence: exact runner settings and verifier assertions.

### Appendix evidence

- Manifest, plan, and research references: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.{json,md}` and `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`.
- Complete per-case metrics, commands, verifier output, diffs, result text, stderr, and sanitized event streams: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/{scrub-unset-control,scrub-enabled-treatment}/`.
- Run summary and execution limitations: `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/{summary.json,execution-log.md}`.
- Fixture source for audit only, explicitly labeled not validated by a successful case: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs/{probe-wrapper.mjs,verify.mjs}`.
- Full raw event streams belong in the appendix because token counts, model metadata, and redacted authentication-source fields are audit details that do not advance the startup-file decision. Evidence: both case `events.jsonl`.

### Candidate titles

1. `Claude Codeの環境変数スクラブを検証する前に：偽HOMEテストが別経路を走った記録`
2. `exit 0でも検証成功ではない：Claude Codeのオフライン起動プローブを監査する`
3. `CLAUDE_CODE_SUBPROCESS_ENV_SCRUBのA/B検証はなぜ判定不能になったか`

### Unsupported angles to avoid

- macOS 26.5 / Claude Code 2.1.227で空の `.bash_profile` が作られる、作られない、または修正済みと断定すること。Evidence: both case `verify.log`; no `case-result.json`.
- Linux/2.1.205のコミュニティ報告を再現・反証したと表現すること。Evidence: research report boundary; absent treatment evidence.
- 空のdiffを「HOMEが変更されなかった」証拠として使うこと。Evidence: both case `diff.patch`; missing fake-HOME result.
- 認証元、外側の起動ミス、wrapper不実行の原因を確定すること。いずれも直接記録されていない。Evidence: redacted `apiKeySource` in both event streams; no outer invocation in `execution-log.md`.
- 現在のfixture設定やsandbox profileを成功済みのコピー＆ペースト手順として掲載すること。Evidence: both case `passed: false`; missing structured results.
- セキュリティ機能を無効化する一般的な回避策を勧めること、実HOMEや実credentialで再試験すること、またはネットワーク制約を外すこと。Evidence: plan safety requirements.
- 記録されていない筆者の驚き、焦り、失敗談、導入経験、感情、動機を創作すること。Evidence: plan pre-registers inconclusive conditions.
- Codexとの比較、モデル品質・速度・コスト比較、全OS・全shell・将来バージョンへの一般化。Evidence: research exclusions and plan limitations.
