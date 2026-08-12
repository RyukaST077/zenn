# Codex exec PreToolUse fail-open boundary: evidence analysis and editorial brief

verdict: not-reproduced
action: draft

## Evidence analysis

### Claim, conditions, and case matrix

The pre-registered conjunctive claim was not reproduced. Under the recorded Codex CLI 0.147.0 invocation, neither isolated case produced the required `PreToolUse` hook evidence. The model-requested command nevertheless completed successfully in both cases and created `effect.txt` with exact content `TOOL_RAN`. Therefore the generic fail-open side effect occurred without proven hook dispatch, while the event-specific deny did not block the command and was not proven to have been evaluated.

Evidence:

- `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.json`
- `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.md`
- `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/execution-log.md`
- `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/{generic-stop-fail-open,specific-deny-block}/{metrics.json,verify.log,diff.patch,events.jsonl}`

The recorded conditions were one fresh isolated run per case, Codex CLI 0.147.0, no model or effort override, approval policy `never`, an ephemeral session, ignored user configuration and rules, hook-trust bypass, a workspace-write sandbox, and workspace-sandbox network access disabled. Both cases used the same prompt and requested `node write-marker.mjs` exactly once. Evidence: the manifest; both case `command.json` files; both case `metrics.json` files.

All relative case evidence paths in the following table are under `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/`.

| Case | Intended hook response | Agent / verifier exit | Hook evidence | Command event | Filesystem result | Result |
|---|---|---:|---|---|---|---|
| `generic-stop-fail-open` | unsupported top-level `continue: false` | 0 / 1 | absent | exact shell command completed with exit 0 | `effect.txt` added with `TOOL_RAN` | expected side effect observed, but dispatch and failed-hook classification not established |
| `specific-deny-block` | event-specific `permissionDecision: deny` | 0 / 1 | absent | exact shell command completed with exit 0 | `effect.txt` added with `TOOL_RAN` | expected block not reproduced; deny evaluation not established |

Evidence: each row's `metrics.json`, `verify.log`, `events.jsonl`, and `diff.patch`; intended responses are defined in `fixtures/agent-practice/codex-pretooluse-boundary/hook.mjs` and pre-registered in the manifest and plan.

### Deterministic results

- `generic-stop-fail-open` recorded agent exit 0, no timeout, verifier exit 1, no verification marker, no protected-path changes, only `effect.txt` as a changed path, no unexpected changes, and `passed: false`. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/generic-stop-fail-open/metrics.json`.
- Its verifier stopped at the first assertion because `hook-evidence.jsonl` did not exist. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/generic-stop-fail-open/verify.log`.
- Its Codex events show `/bin/zsh -lc 'node write-marker.mjs'` starting and completing with exit 0, but contain no recorded failed-hook or blocked-hook classification. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/generic-stop-fail-open/events.jsonl`.
- Its diff adds only `effect.txt` with exact content `TOOL_RAN`. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/generic-stop-fail-open/diff.patch`; changed-path confirmation: the corresponding `metrics.json`.
- `specific-deny-block` recorded agent exit 0, no timeout, verifier exit 1, no verification marker, no protected-path changes, only `effect.txt` as a changed path, no unexpected changes, and `passed: false`. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/specific-deny-block/metrics.json`.
- Its verifier stopped at the same missing-hook-evidence assertion. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/specific-deny-block/verify.log`.
- Its Codex events show `/bin/zsh -lc 'node write-marker.mjs'` starting and completing with exit 0, but contain no recorded failed-hook or blocked-hook classification. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/specific-deny-block/events.jsonl`.
- Its diff also adds only `effect.txt` with exact content `TOOL_RAN`. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/specific-deny-block/diff.patch`; changed-path confirmation: the corresponding `metrics.json`.
- Both stderr logs contain only `Reading additional input from stdin...`; neither records a hook error, denial, malformed output, or configuration rejection. Evidence: both case `stderr.log` files.
- Both event streams contain two notices that `--dangerously-bypass-hook-trust` was enabled. Those notices establish the flag state, not that a project hook was discovered or dispatched. Evidence: both case `events.jsonl` files and both case `command.json` files.

### Observed facts and interpretation boundary

Observed facts:

- Codex attempted the requested marker command exactly once per case through a command-execution event and reported exit 0. Evidence: both case `events.jsonl` and `result.txt` files.
- Both preserved workspaces contain `effect.txt`, retain `.codex/hooks.json` and `hook.mjs`, and lack `hook-evidence.jsonl`. Evidence: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/work/{generic-stop-fail-open,specific-deny-block}/`; both case `diff.patch` and `verify.log` files.
- The protected hook configuration and scripts were not changed during either run. Evidence: both case `metrics.json` files record an empty `protected_paths_changed` array; both case diffs omit the protected paths.

Interpretation:

- The required project-local hook dispatch was not observed in either case. Because the hook script writes its sanitized evidence before choosing either response, absence of that file is evidence against dispatch of this fixture hook, not evidence that one response branch ran silently. Evidence: `fixtures/agent-practice/codex-pretooluse-boundary/hook.mjs`; both case `verify.log` files; both preserved workspaces.
- The two outputs cannot be compared behaviorally in this run. The generic case's marker is compatible with the expected fail-open effect, but the missing evidence and missing failed-hook classification mean it does not support the claimed cause. The specific case shows that the command was not blocked under the complete recorded invocation, but it does not prove that Codex parsed and ignored a valid deny response because hook execution itself is unproven. Evidence: the plan's semantic assertions; both case `events.jsonl`, `verify.log`, and `diff.patch` files.
- The narrow operational result is still useful: a valid-looking project file plus a hook-trust-bypass notice did not establish interception, and relying on the intended deny under this exact preflight would have allowed the inert side effect. Evidence: both case `command.json`, `events.jsonl`, `verify.log`, and `diff.patch` files.

### External facts and citations

These are source claims recorded in the research report, not observations from the two execution cases:

- OpenAI's Hooks documentation says Codex can load project hooks from `<repo>/.codex/hooks.json`, says non-managed hooks require trust, and documents `--dangerously-bypass-hook-trust` for vetted automation. Evidence: `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md`, citing [OpenAI Hooks documentation](https://learn.chatgpt.com/docs/hooks), accessed 2026-08-12.
- The same documentation says top-level `continue`, `stopReason`, and `suppressOutput` are unsupported for `PreToolUse`, and documents `hookSpecificOutput` with `permissionDecision: deny` and a non-empty reason as a deny form. Evidence: the same research report and [OpenAI Hooks documentation](https://learn.chatgpt.com/docs/hooks), accessed 2026-08-12.
- OpenAI's developer-command documentation describes `codex exec` as the non-interactive entry point and records the relevant sandbox, ephemeral, ignored-user-config, JSONL, and hook-trust flags. Evidence: the research report, citing [OpenAI developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli), accessed 2026-08-12.
- The research report records an older community issue claiming that `codex exec` 0.137.0 and 0.138.0-alpha.2 did not dispatch hooks even with trust bypass. That report is a competing hypothesis, not evidence for 0.147.0. Evidence: the research report, citing [openai/codex issue #26452](https://github.com/openai/codex/issues/26452), accessed 2026-08-12.

### Alternative explanations

- The project hook layer may not have been discovered or activated under the recorded combination of `-C`, `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, and hook-trust bypass. The run does not isolate which flag, lookup rule, trust behavior, or CLI defect could explain the absence. Evidence: both case `command.json` files; missing evidence in both `verify.log` files.
- A mismatch may exist between the fixture's `.codex/hooks.json` shape or matcher and what this installed CLI actually accepts, even though the recorded research describes that path and event. The run contains no parser or validation diagnostic that distinguishes configuration rejection from non-discovery. Evidence: `fixtures/agent-practice/codex-pretooluse-boundary/.codex/hooks.json`; both case `stderr.log` and `events.jsonl` files.
- The canonical event representation may differ from the fixture's expected `tool_name: "Bash"`, but the hook script never recorded any input, so the evidence cannot distinguish a matcher miss from total hook non-dispatch. Evidence: `fixtures/agent-practice/codex-pretooluse-boundary/hook.mjs`; both case `verify.log` files.
- The identical outcome across the two case IDs is consistent with the response-selection branches never running. This is an inference from the shared absence of hook evidence, not direct observation of Codex internals. Evidence: `fixtures/agent-practice/codex-pretooluse-boundary/hook.mjs`; both case artifacts.

### Comparison with the pre-registered expectation

The plan expected both cases to record exactly one sanitized `PreToolUse` event for canonical `Bash` and the exact command. It then expected the generic case to be classified as a failed hook and create `effect.txt`, while the specific-deny case would be classified as blocked and leave `effect.txt` absent. Evidence: `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.md`.

The observed result differs in every hook-semantic assertion: neither case recorded hook evidence or a failed/blocked classification, and the specific-deny case created the forbidden marker. The generic filesystem effect matched its expected end state, but without the pre-registered dispatch and classification evidence it cannot confirm the proposed fail-open mechanism. Evidence: both case `verify.log`, `events.jsonl`, `diff.patch`, and `metrics.json` files.

The plan explicitly classified absent dispatch as a competing outcome that stops rollout for this CLI/configuration. Therefore this is a recorded expected-result contrast supporting `not-reproduced`; it should not be narrated as the author's surprise, changed belief, or personal failure. Evidence: the plan section `Pre-registered outcomes and decision rule`.

### Limitations

- There was one run per case and no retry, so the evidence does not estimate hook dispatch reliability or distinguish a deterministic configuration boundary from intermittent behavior. Evidence: the manifest, plan, and `summary.json`.
- The exact resolved backend model and effort are unknown because both overrides were null. Evidence: both case `metrics.json` files.
- The run did not perform a configuration-validation probe, a different matcher, a different project-config location, a user-config control, an interactive Codex control, or a flag ablation. It cannot identify the root cause of absent dispatch. Evidence: manifest and plan define only the two response-shape cases.
- The deny response itself was not exercised successfully, so this run cannot confirm or refute the documented deny schema in a context where a hook is known to dispatch. Evidence: missing hook evidence and absent blocked classification in `specific-deny-block/verify.log` and `events.jsonl`.
- Only the Bash marker path, Codex CLI 0.147.0, and the recorded non-interactive flags were tested. No claim is supported about other tools, versions, modes, platforms, or arbitrary-command security. Evidence: manifest, both case `command.json` files, and plan limitations.
- Network access was disabled through the Codex workspace sandbox rather than OS-level isolation, and the disposable workspace plus diff is an evidence boundary rather than a complete host security boundary. Evidence: both case `metrics.json` files and execution-log limitations.
- The hook-trust bypass notice proves only that the flag was enabled. It does not prove that the hook file was loaded, trusted, matched, or executed. Evidence: both case `events.jsonl` and `verify.log` files.

### Reusable recipe present in successful evidence

No reusable hook configuration is supported by a successful recorded case because both cases failed deterministic verification and neither proved hook dispatch. The article must not present the fixture's hook configuration or either response object as a verified copy-and-paste recipe. Evidence: both case `metrics.json` and `verify.log` files; template safety rule in `.agents/skills/zenn-agent-analyze-results/references/analysis-template.md`.

The reusable element is limited to the audit principle, not a configuration recipe: require a sanitized dispatch oracle and a harmless filesystem side-effect oracle before trusting a blocking hook. This principle is supported by the fixture design and the failure it exposed, but it does not establish how to make dispatch succeed. Evidence: manifest verification contract; both case `verify.log` and `diff.patch` files.

### Unsafe or unsupported variants

- Do not recommend the event-specific deny object as verified by this run; its hook branch was not observed. Evidence: `specific-deny-block/verify.log` and `events.jsonl`.
- Do not recommend `--dangerously-bypass-hook-trust` for unreviewed hooks. The recorded source limits it to vetted automation, and the run only shows the warning was emitted. Evidence: research report and both case `events.jsonl` files.
- Do not remove the workspace sandbox or use a harmful command to make the failure more visible. The inert marker already demonstrated the decision failure within the recorded write boundary. Evidence: both case `command.json` and `diff.patch` files; plan safety section.
- Do not generalize the result to all project hooks, all `PreToolUse` matchers, all Codex versions, or interactive Codex. Evidence: manifest scope and plan limitations.
- Do not claim that the deny schema itself failed open after being parsed. No hook input, output, or blocked/failed classification was recorded. Evidence: both case `verify.log`, `events.jsonl`, and `stderr.log` files.

### Article-safe facts

- In one run per case on recorded Codex CLI 0.147.0, the exact requested marker command completed with exit 0 and created exact `TOOL_RAN` in both isolated workspaces. Evidence: both case `events.jsonl`, `diff.patch`, and `metrics.json` files.
- Neither case produced `hook-evidence.jsonl`; both verifiers exited 1 at the missing-evidence assertion. Evidence: both case `verify.log` and `metrics.json` files.
- The specific-deny case did not block the command under the complete recorded invocation, but the evidence does not establish that its deny response was executed or parsed. Evidence: `specific-deny-block/events.jsonl`, `diff.patch`, and `verify.log`.
- A hook-trust-bypass notice and an unchanged `.codex/hooks.json` were insufficient proof of discovery, matching, dispatch, or denial in this run. Evidence: both case `events.jsonl`, `metrics.json`, and `verify.log` files.
- The operational decision supported by this result is to stop relying on this exact CLI/configuration for command blocking until a bounded preflight records both dispatch evidence and the absent harmless side effect. Evidence: plan decision rule and all case artifacts.

## Editorial brief

### One concrete reader and situation

A repository or CI maintainer preparing unattended `codex exec` jobs with a project-local `PreToolUse` policy hook and deciding whether it can be trusted as an additional guardrail for selected model-generated shell commands.

Evidence for the named reader and situation: `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.md`; `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md`.

### Reader problem

The maintainer can see a plausible `.codex/hooks.json` and a hook-trust-bypass notice yet still lacks proof that the hook was discovered, matched, dispatched, and able to block a side effect. In this run, assuming those earlier signals were sufficient would have misclassified the specific-deny case as protected. Evidence: both case `events.jsonl`, `verify.log`, and `diff.patch` files.

### One-sentence article promise and takeaway

> Before relying on a Codex `PreToolUse` deny in unattended work, require both a sanitized hook-dispatch record and absence of a harmless marker; under the recorded Codex CLI 0.147.0 invocation, the project hook produced no dispatch evidence and both commands ran.

Evidence: both case `verify.log`, `events.jsonl`, `diff.patch`, and `metrics.json` files.

### Coverage gap filled and article type

- Coverage gap: official documentation describes project-hook configuration, trust, and deny output, while broad community coverage describes intended schemas; this result adds a retained Codex CLI 0.147.0 non-interactive failure case showing that configuration presence and a trust-bypass notice did not prove dispatch, and that the response-shape comparison cannot begin until dispatch itself is observed. Evidence: research report; both case artifacts.
- Article type: `failure`.

### Why the result matters in real work

A policy hook is useful only if it intercepts the intended tool path before the side effect. The recorded specific-deny case demonstrates the practical cost of testing only configuration presence: the harmless analogue of a build, migration, deployment, or repository command completed while the dispatch oracle remained absent. This supports a preflight gate for adoption, not a general claim that production Codex hooks fail. Evidence: plan practical mapping; `specific-deny-block/events.jsonl`, `verify.log`, and `diff.patch`.

### Practical decision rule and mapping

Decision rule:

> Do not enable reliance on a project-local blocking hook for an unattended job unless the exact version-pinned invocation produces exactly one sanitized event for the intended tool and command, the deny case records a blocked classification, and the harmless side effect is absent. If any dispatch evidence is missing, treat the preflight as failed and retain sandbox and external policy boundaries.

Evidence: the plan's deterministic assertions and decision rule; observed failure in both case artifacts.

| Fixture signal | Real-work decision signal |
|---|---|
| `hook-evidence.jsonl` exists with one exact `PreToolUse`/`Bash`/command record | the configured policy actually saw the intended execution path |
| `events.jsonl` classifies the invocation as blocked | the agent runtime recognized a blocking outcome rather than merely loading configuration |
| `effect.txt` remains absent | the guarded build, migration, deployment, or repository side effect was prevented |
| `effect.txt` contains `TOOL_RAN` while hook evidence is absent | stop rollout; diagnose discovery, trust, matcher, or configuration before evaluating response schemas |
| protected paths unchanged and no unexpected paths | the preflight remained inside its declared audit boundary |

Evidence: manifest verification contract; plan practical mapping; both case `metrics.json`, `verify.log`, `events.jsonl`, and `diff.patch` files.

### Evidence-led story arc

1. Open with the concrete decision: whether an unattended Codex job may rely on a project-local deny hook as an additional guardrail. Evidence: plan reader problem and promised decision.
2. State the negative result immediately: in both Codex CLI 0.147.0 cases the exact command ran, the marker appeared, and no hook evidence was created. Evidence: both case `metrics.json`, `verify.log`, `events.jsonl`, and `diff.patch`.
3. Show the pre-registered two-case design and explain why it required dispatch evidence before comparing the unsupported generic stop with the event-specific deny. Evidence: manifest and plan.
4. Present the case matrix and a compact excerpt of each verifier failure and diff. Evidence: both case `verify.log` and `diff.patch`.
5. Separate what failed from what remains unknown: the exact invocation did not reproduce dispatch or denial, but the run did not isolate whether discovery, matching, trust, configuration validation, or a CLI defect caused it. Evidence: both case artifacts and manifest scope.
6. Convert the failure into the reader's gate: config presence and trust warnings are preliminary signals; only dispatch plus side-effect evidence permits adoption. Evidence: plan decision rule and recorded observations.
7. Put full flags, versions, fixture source, event logs, and alternate hypotheses in a reproducibility/audit section. Evidence: both case `command.json`, `metrics.json`, `events.jsonl`, and fixture files.
8. End at the supported boundary: stop rollout for this exact CLI/configuration pending a new bounded diagnosis; do not claim the documented deny schema was parsed and ignored. Evidence: plan competing outcome and specific-deny artifacts.

This contrast was pre-registered as a competing outcome, so the narrative must not call it surprising or invent author emotion, motivation, or prior reliance. Evidence: plan section `Pre-registered outcomes and decision rule`.

### Body evidence

- The one-row-per-case matrix using agent/verifier exit codes, missing hook evidence, command completion, and marker diff. Evidence: both case `metrics.json`, `verify.log`, `events.jsonl`, and `diff.patch`.
- The verifier's first failing assertion, `hook evidence must exist`, because it establishes why the generic marker alone is not confirmation and why the deny schema was not actually tested. Evidence: both case `verify.log` files.
- The exact command-execution events and filesystem diffs showing that both inert side effects occurred. Evidence: both case `events.jsonl` and `diff.patch` files.
- The practical decision rule and mapping from dispatch/classification/side-effect signals to CI rollout. Evidence: plan verification and decision sections plus recorded case outcomes.
- A concise boundary paragraph distinguishing `not-reproduced` from proof that the documented deny response itself is invalid. Evidence: missing hook evidence and absent semantic classification in both cases.

### Appendix evidence

- Exact redacted invocations and shared prompt: both case `command.json` files.
- Version, duration, timeout, network enforcement, null model/effort overrides, protected paths, and unexpected changes: both case `metrics.json` files and `summary.json`.
- Complete JSONL event streams, stderr, and final agent messages: both case `events.jsonl`, `stderr.log`, and `result.txt` files.
- Full fixture hook, writer, verifier, and project configuration for audit only, explicitly labeled unverified as a reusable configuration: `fixtures/agent-practice/codex-pretooluse-boundary/`.
- Official-source and historical-issue context: `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md`.

### Candidate titles

1. `Codex PreToolUseは動いた？denyを信じる前に副作用で確かめる`
2. `Codex CLI 0.147.0でPreToolUseのdispatchを再現できなかった記録`
3. `hooks.jsonがあるだけでは足りない：Codex execのブロックを検証する`

### Unsupported angles to avoid

- `permissionDecision: deny` が Codex CLI 0.147.0 で常に無効、または fail-open すると断定すること。フック実行自体が記録されていない。Evidence: `specific-deny-block/verify.log` and `events.jsonl`.
- Codex Hooks 全般、すべての `PreToolUse` matcher、対話モード、別バージョン、別OSへの一般化。Evidence: manifest and plan scope.
- 原因を `--ignore-user-config`、`-C`、trust、matcher、JSON形状、または製品バグのいずれかに確定すること。切り分けケースは実行されていない。Evidence: manifest defines only two response-shape cases.
- generic stop と specific deny の挙動比較が成立したと表現すること。どちらの response branch も実行証拠がない。Evidence: both case `verify.log` files.
- フックを唯一のセキュリティ境界として推奨すること、sandboxを外すこと、未レビューのhookでtrust bypassを使うこと。Evidence: research report and plan safety boundaries.
- 記録されていない筆者の驚き、困惑、失敗談、導入実績、感情、または事前の信頼を創作すること。Evidence: the plan pre-registered absent dispatch as a competing outcome.
- Claude Codeとの比較、性能・速度・コスト・モデル品質の比較。Evidence: research contract and plan exclusions.
