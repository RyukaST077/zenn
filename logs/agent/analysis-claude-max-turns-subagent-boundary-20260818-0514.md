# Claude Code top-level `--max-turns` at a subagent boundary: result analysis

verdict: inconclusive
action: rerun

## Evidence analysis

### Claim, conditions, and case matrix

The tested claim was that Claude Code 2.1.227, under top-level `--max-turns 1`, would dispatch one inline `one-shot-probe` subagent with its own `maxTurns: 1`, forward the child's `CHILD_LOOP_COMPLETED` marker, end the parent with `error_max_turns`, and report whole-tree output usage greater than parent-only output usage. The claim and its exact version, model, effort, budget, tool, and event conditions are pre-registered in `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md` and encoded in `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.json`.

| Case | Required product signal | Recorded signal | Determination | Evidence |
|---|---|---|---|---|
| `parent-one-turn-child-one-turn` | Exactly one parent Agent call to `one-shot-probe` | `parent_agent_call_count: 0`; requested agent `null` | Missing; the product boundary was not reached | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log` |
| `parent-one-turn-child-one-turn` | At least one forwarded child event containing `CHILD_LOOP_COMPLETED` | Child event count `0`; marker `false` | Missing | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| `parent-one-turn-child-one-turn` | One final `error_max_turns` result, `is_error: true`, `num_turns: 1` | Inner summary recorded subtype `success`, `is_error: true`, `num_turns: 1` | Required subtype absent; internally mixed terminal fields do not establish either planned outcome | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| `parent-one-turn-child-one-turn` | Positive cost and whole-tree output tokens greater than parent output tokens | Cost `0`; parent output `0`; whole-tree model count and output `0` | Accounting comparison unavailable | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| `parent-one-turn-child-one-turn` | Verifier marker `PARENT_CAP_CHILD_USAGE_OBSERVED` | Verifier exit `1`; marker `null` | Case failed | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log` |

The verdict is `inconclusive`, not `not-reproduced`, because the plan explicitly classifies a missing requested Agent dispatch or absent accounting fields as inconclusive. The recorded run never produced the interaction needed to distinguish the selected claim from its competing product outcome (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`).

### Deterministic results

- The offline fake-CLI preflight passed with wrapper exit `0`, verifier exit `0`, the expected marker, no protected-path changes, and no unexpected changes (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight-verify.log`). This validates the fixture's planned happy-path parsing and oracle, not authenticated Claude behavior.
- The authenticated wrapper completed with runner-facing exit `0`, while its redacted inner-process summary recorded exit `1`, no timeout, four parsed JSON lines, and no malformed nonempty lines (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`). The runner-facing exit only says the evidence wrapper completed; it is not a passing product result.
- The deterministic verifier exited `1` at its first product assertion, reporting `expected exactly one parent Agent call`; it did not create the marker file (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`).
- The diff contains only the new `case-result.json`; protected paths were unchanged and there were no unexpected changes (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`).

### Observed facts and evidence paths

- The resolved executable basename was `2.1.227`, and the launch summary recorded top-level turns `1`, child turns `1`, budget `0.2`, parent tool `Agent`, no child tools, model `sonnet`, effort `low`, project-only settings, no session persistence, forwarded child text, and disabled built-in agents (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- The inner process returned exit `1` after 4,050 ms without a timeout; the wrapper's limited stderr pattern checks did not flag authentication or service failure (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- No parent Agent call, child event, or child marker was observed (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- The summarized final event reported subtype `success`, `is_error: true`, and `num_turns: 1`, with zero total cost, zero parent token usage, and an empty whole-tree model-usage map (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- The retained outer `events.jsonl` contains only the wrapper's synthetic success result and therefore cannot substitute for the discarded inner stream (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/events.jsonl`; the distinction is defined by `fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`).

### External facts and citations

- The official CLI reference documents `--max-turns` as a print-mode agentic-turn limit, `--max-budget-usd` as a spend limit that covers subagents, `--forward-subagent-text` as a way to expose child events, and `--agents` as the inline custom-agent definition surface ([Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference), accessed 2026-08-18; source inventory: `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`).
- The official agent-loop documentation distinguishes main-loop `usage` from whole-tree `modelUsage` and says subagents start fresh conversations ([Agent SDK agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop), accessed 2026-08-18; source inventory: `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`).
- The official subagent documentation exposes per-agent `maxTurns` ([Create custom subagents](https://code.claude.com/docs/en/sub-agents), accessed 2026-08-18; source inventory: `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`).

These external contracts motivate the test but do not fill the missing authenticated interaction evidence.

### Interpretation and alternative explanations

The evidence supports only that this authenticated attempt did not reach the pre-registered Agent/subagent boundary. It does not show that top-level `--max-turns 1` blocks child execution, that the turn counter is whole-tree, or that the claim is false, because no Agent call occurred and there was no nonzero usage to compare (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).

Plausible but unproven explanations include an unclassified CLI/service failure, a terminal event shape the narrow failure detector did not classify, model/tool dispatch not occurring, or a parser mismatch. The inner stdout and stderr were intentionally not retained, so the recorded evidence cannot select among those explanations (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`).

### Comparison with the pre-registered expectation

The expected result required one Agent call, a forwarded child marker, final subtype `error_max_turns`, positive bounded cost, and whole-tree output greater than parent-only output. None of those decisive signals was recorded; only `num_turns: 1` and a nonzero inner exit aligned with part of the expected shape (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`). The plan pre-registered a missing Agent dispatch and absent accounting fields as inconclusive, so the result follows the stated stop rule rather than constituting a confirmed competing outcome (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`).

### Limitations

- There was one authenticated sample and no retry (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/execution-log.md`).
- The run pinned CLI 2.1.227 and selected `sonnet`/`low`, but it did not prove a resolved backend snapshot (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/execution-log.md`).
- Inner raw stdout and stderr were not retained, leaving the mixed final fields and zero-usage failure undiagnosable from this run (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`).
- The wrapper's authentication/service classifiers cover only specified stderr patterns, so `false` flags do not prove that every failure class was absent (`fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`).
- Manifest `network: false` was not enforced for the host Claude process (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`).

### Reusable recipe present in successful evidence

None. The fake preflight passed, but there was no successful authenticated case, so this analysis does not present the recorded launch configuration as a reusable working recipe (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`).

### Unsafe or unsupported variants

- Do not describe runner-facing exit `0` or outer subtype `success` as Claude successfully completing the requested work; those belong to the evidence wrapper (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/events.jsonl`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- Do not infer top-level-versus-child turn semantics, whole-tree spend behavior, or accounting inclusion from zero Agent calls and zero tokens (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- Do not generalize to other CLI versions, models, operating systems, nested/background agents, billing, quality, or latency (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/execution-log.md`; `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`).
- Do not rerun repeatedly without first changing the evidence contract to preserve a credential-safe structural failure code or sanitized terminal diagnostics; the current evidence cannot explain the first failure (`fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).

### Article-safe facts

- On the one recorded Claude Code 2.1.227 attempt, the fixture preflight passed but the authenticated verifier failed because no parent Agent call was observed (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log`).
- The attempt recorded no child event, no marker, zero cost, zero token usage, and no `modelUsage` entry, so it did not test the intended accounting comparison (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- The honest result is inconclusive under the plan's pre-registered decision rule, and another bounded run is needed after improving failure observability (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`; this analysis).

## Editorial brief

### One concrete reader and situation

An engineer who wraps `claude -p` in unattended CI and wants to delegate one bounded task to an inline custom subagent while controlling parent progress, child progress, and total spend.

### Reader problem

The official contracts expose separate turn, budget, and accounting controls, but this run did not establish what happens when the parent's only allowed turn is an Agent dispatch. The reader must know when a failed harness run is evidence about that boundary and when it is merely missing evidence.

### One-sentence article promise and takeaway

Show how to distinguish a real `--max-turns`/subagent boundary observation from an inconclusive zero-dispatch run: require the Agent call, linked child event, terminal subtype, and nonzero accounting before drawing a guardrail conclusion.

### Coverage gap filled

The official documentation describes the individual controls, while the research found no first-party interaction example joining one top-level turn, one custom child turn, linked stream events, and parent-versus-tree accounting (`research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`). This result adds a narrower editorial lesson: a preflight-valid harness can still yield no product-boundary evidence, and CI analysis must gate conclusions on structural signals rather than wrapper completion (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log`). Draft only after the rerun resolves the original interaction gap or records a diagnosable, reproducible failure.

### Article type

`configuration-harness`

### Why the result matters in real work

An unattended script can see a wrapper exit `0` while the inner agent run exited nonzero and performed no billable/model work. Treating wrapper completion or `num_turns: 1` alone as proof of turn-cap semantics would produce a false operational rule (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).

### Practical decision rule and practical mapping

Decision rule: classify the boundary only when all four layers are present—dispatch, child completion, parent terminal state, and accounting; if dispatch or accounting is absent, preserve a bounded diagnostic and rerun rather than inferring product semantics.

| Fixture signal | Real-task meaning | Decision in this run | Evidence |
|---|---|---|---|
| One top-level Agent tool-use ID | CI delegated one task | Absent; no delegation boundary was exercised | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| Child event linked by `parent_tool_use_id` and marker | Child inference completed | Absent; child progress is unknown | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| Inner exit plus final subtype and `num_turns` | Parent progress guard fired in a classified way | Mixed: exit `1` and turn `1`, but subtype `success`; do not classify | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| Positive parent `usage` and whole-tree `modelUsage` | Compare parent-only work with delegated-tree work | Absent; zero versus zero cannot answer the accounting question | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch` |
| Verifier marker | All pre-registered assertions held | Absent; rerun gate remains closed | `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json` |

### Evidence-led story arc

1. The research identifies a concrete CI ambiguity across separately documented parent-turn, child-turn, budget, and accounting controls (`research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`).
2. The plan pre-registers a single decisive interaction and explicitly labels missing Agent dispatch or accounting as inconclusive (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`).
3. The offline preflight proves the happy-path fixture and verifier agree (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`).
4. The authenticated attempt records no Agent call, no child event, zero usage, and a verifier failure (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log`).
5. The reader decision is to reject wrapper-level success as product evidence and rerun only after adding safe failure observability; no claim about the turn boundary is yet justified (this analysis).

### Body evidence

- The pre-registered success and inconclusive criteria (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`).
- The preflight pass versus authenticated verifier failure (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/verify.log`).
- The decisive missing dispatch, child, and accounting fields, plus the mixed terminal shape (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- The wrapper-versus-inner exit distinction (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).

### Reproducibility or audit details for a later section or appendix

- Exact manifest and recorded launch metadata (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/manifest.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/command.json`).
- CLI digest, minimal environment-name lists, duration, parsed-line count, and safety flags (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- Protected-path and allowed-change results (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- Fake-CLI event details and verifier implementation (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/preflight-events.jsonl`; `fixtures/agent-practice/claude-max-turns-subagent-boundary/verify.mjs`).

### Candidate titles

1. `Claude Code --max-turns の子エージェント境界を検証する前に確認すべき4つの証拠`
2. `Agent呼び出し0件を仕様と誤認しない：Claude Codeの境界テスト設計`
3. `wrapper終了0でも検証成功ではない：Claude Codeサブエージェント実験の判定ゲート`

### Unsupported angles, emotions, comparisons, and generalizations to avoid

- Avoid saying Claude Code 2.1.227 confirmed or disproved that the top-level cap is parent-only; the boundary was not exercised (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`).
- Avoid claiming the run was surprising, frustrating, or based on author experience; the record contains only a pre-registered expectation and machine evidence (`practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`; `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/execution-log.md`).
- Avoid comparisons with Codex, other Claude models, later CLI versions, background/nested agents, or billing systems; none were tested (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/execution-log.md`).
- Avoid presenting the launch settings as a proven reusable recipe; no authenticated case passed (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/metrics.json`).
- Avoid attributing the zero-usage outcome to authentication, service availability, parser behavior, or model refusal; the retained evidence cannot diagnose the cause (`logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/diff.patch`; `fixtures/agent-practice/claude-max-turns-subagent-boundary/claude-wrapper.mjs`).
