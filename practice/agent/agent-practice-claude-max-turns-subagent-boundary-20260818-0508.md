# Claude Code top-level `--max-turns` at one subagent boundary

## Source, reader problem, and promised decision

- Source report: `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`
- Authoritative execution manifest: `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.json`
- Likely article type: configuration harness
- Mode: `boundary`
- Target provider: Claude Code only, pinned to locally installed `2.1.227`

The reader wraps `claude -p` in unattended CI or local automation and delegates work to custom subagents. Their uncertainty is whether top-level `--max-turns 1` bounds only the parent loop or acts as a whole-tree turn and spend ceiling. The promised decision is which separate controls and result fields to use: top-level `--max-turns` for parent progress, per-agent `maxTurns` for child progress, `--max-budget-usd` for the documented whole-tree spend stop, and `modelUsage` for whole-tree accounting.

## Falsifiable claim and practical mapping

With Claude Code 2.1.227, one non-interactive parent run capped at `--max-turns 1` can invoke exactly one inline custom subagent whose own `maxTurns` is 1, receive a forwarded child marker, and then terminate with a nonzero `error_max_turns` result whose parent-only `usage.output_tokens` is smaller than the whole-tree `modelUsage` output-token total. Therefore the top-level turn cap is a parent-loop progress bound rather than a whole-tree spend ceiling.

The fixture signals map to real automation as follows:

- one parent `Agent` tool-use ID represents one delegated CI task;
- a child event with the same `parent_tool_use_id` and `CHILD_LOOP_COMPLETED` proves child inference completed before parent termination;
- `error_max_turns`, `num_turns: 1`, and a nonzero inner CLI exit show the parent progress guard firing;
- whole-tree output tokens strictly exceeding parent-only output tokens show why delegated automation must not monitor only `usage`;
- the inline agent's `maxTurns: 1` and the invocation's `$0.20` cap make the two distinct child-progress and whole-tree-spend controls explicit.

This mapping does not treat model narration as evidence and does not claim invoice-level billing accuracy.

## Fixture choice and offline boundary

No existing `fixtures/agent-practice/` fixture fits this claim without distortion. Existing fixtures exercise instruction loading, hook dispatch, resume persistence, JSONL finality, ambient skills, or subprocess environment scrubbing. The new fixture `fixtures/agent-practice/claude-max-turns-subagent-boundary/` is the smallest self-contained adapter needed because the shared runner's normal Claude arguments do not expose `--max-turns`, `--max-budget-usd`, `--forward-subagent-text`, `--agents`, or an Agent-only tool surface.

Fixture files:

- `claude-wrapper.mjs`: validates the runner arguments, defines the exact real launch in executable code, supplies a minimal named environment, captures only a redacted structural summary, translates the expected nonzero inner CLI status into a runner-compatible wrapper success, and stores `case-result.json`.
- `preflight-claude.mjs`: executable offline fake CLI that validates the exact launch and emits deterministic parent, child, and final result events without authentication, network, a model, or a paid request. It allowlists harmless runtime-injected environment names including macOS `__CF_USER_TEXT_ENCODING` and `MallocNanoZone`, while rejecting credential-bearing names.
- `verify.mjs`: deterministic oracle with an objective exit status; it creates `verification.txt` only after every safety and claim assertion passes.

The fixture needs only the repository's existing Node runtime. It installs nothing, contains no secret or user data, has no symlink, daemon, browser, external data source, production target, hook, plugin, MCP server, or generated run output. The fake preflight uses a case-local temporary HOME that the wrapper removes before returning. No credential-bearing environment name or value is passed to the fake CLI. The runner's global readiness check may locally query the installed CLI's authentication status before wrapper preflight; its output is discarded and it does not pass credential material to the fixture or fake CLI.

The authenticated experiment necessarily makes the one bounded Claude service request tree selected by the report. A missing existing login aborts before execution; the runner must not open a browser or initiate login. Manifest `network: false` does not isolate this host-run Claude process: the runner enforces that field only for Codex workspace sandboxes. The fixture and preflight are offline; the actual Claude behavior under test is not.

## Case and controlled settings

Use one provider and one case because the selected claim is falsified directly if any conjunct of this one boundary run fails. A no-subagent control would add cost without answering whether the observed child crosses the parent cap.

Case `parent-one-turn-child-one-turn`:

- provider: `claude`
- guidance overlay: none
- model: `sonnet`
- effort: `low`
- execution: `fixture-wrapper`, `claude-wrapper.mjs`, offline preflight `preflight-claude.mjs`, environment `minimal`
- run count: exactly one; no automatic retry
- wall timeout: 240 seconds at the runner, 180 seconds for the inner CLI
- parent tools: exactly `Agent`
- inline agent: exactly `one-shot-probe`, no tools, `model: sonnet`, `effort: low`, `maxTurns: 1`
- top-level progress cap: `--max-turns 1`
- whole-tree spend stop: `--max-budget-usd 0.20`
- settings: `--setting-sources project`, no guidance file, no session persistence
- child event evidence: verbose stream JSON plus `--forward-subagent-text`
- child catalog: `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`

Exact prompt:

> Use the Agent tool exactly once. Delegate only to the inline custom agent named `one-shot-probe` and ask it to return exactly `CHILD_LOOP_COMPLETED`. Do not answer directly, use any other agent, use any other tool, access files, or access external data.

The executable wrapper, rather than a prose-only override, launches the resolved 2.1.227 binary with this exact argument vector:

```text
-p <exact prompt>
--max-turns 1
--max-budget-usd 0.20
--output-format stream-json
--verbose
--forward-subagent-text
--no-session-persistence
--setting-sources project
--permission-mode bypassPermissions
--tools Agent
--model sonnet
--effort low
--agents {"one-shot-probe":{"description":"Return one fixed harmless marker without using tools.","prompt":"Return exactly CHILD_LOOP_COMPLETED and nothing else. Do not use tools or access external data.","tools":[],"model":"sonnet","effort":"low","maxTurns":1}}
```

The minimal child environment contains only fixed non-secret runtime/configuration names plus OS-derived HOME and username for the already-authenticated real CLI. It forwards no API key, token, password, cookie, or credential variable. During fake preflight, HOME is replaced with a disposable case-local directory and no credential or provider request is possible.

## Deterministic verification and strict paths

Verification command: `node verify.mjs`.

The verifier requires all of these assertions:

1. The real case resolves an executable whose basename is `2.1.227`; both real and fake cases record a SHA-256 executable digest.
2. The wrapper received exactly the runner's minimal environment names, allowing only documented harmless platform injections, and constructed no credential-bearing child environment name.
3. The executable launch records top-level turns 1, child turns 1, budget `$0.20`, `sonnet`/`low`, parent tool `Agent`, no child tools, project-only settings, no session persistence, forwarded subagent text, and disabled built-in agents.
4. The inner CLI neither times out nor reports authentication/service failure and exits nonzero.
5. The stream is entirely JSONL, contains exactly one top-level `Agent` call naming `one-shot-probe`, and contains at least one child event whose `parent_tool_use_id` equals that call ID and whose text contains `CHILD_LOOP_COMPLETED`.
6. Exactly one final result has subtype `error_max_turns`, `is_error: true`, and `num_turns: 1`.
7. `total_cost_usd` is positive and no more than `$0.20`; `modelUsage` is present and its aggregated output tokens strictly exceed parent-only `usage.output_tokens`.
8. The fixture retains no raw inner stdout, stderr, session ID, request ID, environment value, credential, host path, or model narration. It retains only structural counts, booleans, numeric usage/cost fields, and executable identity.
9. Protected files `claude-wrapper.mjs`, `preflight-claude.mjs`, and `verify.mjs` remain byte-identical. The only allowed case changes are `case-result.json` and `verification.txt`; every other changed path fails the runner.

The manifest marker is `PARENT_CAP_CHILD_USAGE_OBSERVED`. The runner's own redacted evidence stays outside the disposable case workspace.

## Pre-registered outcomes and decision rule

Expected outcome: the named child completes its marker under its independent one-turn limit, the parent then ends at its top-level one-turn cap with `error_max_turns`, and whole-tree output usage exceeds parent-only output usage while total cost remains within `$0.20`. If the single case satisfies every assertion, the evidence supports the decision rule that unattended subagent automation must configure and observe parent progress, child progress, and whole-tree spend/accounting separately.

Competing product outcome: 2.1.227 prevents the named child from starting at top-level max turns 1; the child is charged against the same counter and cannot emit its completion marker; the final result succeeds rather than reporting the max-turn boundary; parent-only usage already equals/includes the whole-tree output; or `modelUsage` does not include additional work. Any such structurally complete result changes the recommendation to avoid the parent-only boundary rule and report the observed whole-tree behavior instead.

Authentication failure, unavailable `sonnet`, service/rate failure, malformed or truncated JSONL, missing requested Agent dispatch, a budget stop before the interaction completes, timeout, version drift, wrapper/preflight mismatch, unexpected path mutation, or absent accounting fields is inconclusive rather than evidence for the competing product outcome. Preserve the first attempt and do not reprompt or retry; refresh the claim and sources before targeting a different CLI version.

Success requires the one declared case, fake-CLI preflight, verifier, marker, protected-path check, and allowed-change check all to pass. Any assertion failure makes the run unsuccessful; analysis must distinguish a complete competing outcome from an inconclusive harness or service failure.

## Safety, cost, cleanup, limitations, and article value

- Do not install dependencies, log in, open a browser, read credential files or values, dump environments, invoke web/MCP/Git/package tools, alter Git state, publish, or touch production state.
- Stop before the model request if the real CLI is not already authenticated, its resolved basename is not `2.1.227`, the wrapper/fake/verifier is non-executable or modified, preflight fails, or minimal-environment construction detects a credential-bearing name.
- Stop after exactly one authenticated case. The hard `$0.20` CLI cap and timeouts are safety bounds, not promises about invoice reconciliation.
- The wrapper removes only its exact case-local `.preflight-home`; the runner preserves redacted evidence under ignored `logs/agent/` and removes only its own generated temporary root.

One tiny marker delegation on macOS and one CLI/model selection does not prove future versions, other operating systems, background agents, nested subagents, quality, latency, ideal turn counts, universal cost savings, or exact billing. Its article value is a reproducible CI decision table grounded in one interaction: top-level turns bound the parent loop, per-agent turns bound the child loop, budget bounds the documented tree spend, and `modelUsage` observes the tree.

