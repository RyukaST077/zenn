# Claude Code `--max-turns` at the subagent boundary: parent-loop cap or whole-tree budget?

## Research contract

- Research date: 2026-08-18 (Asia/Tokyo)
- Requested scope: current, practical Claude Code or OpenAI Codex know-how, configuration, workflow, harness, model or CLI feature, or reproducible failure boundary not already covered by this repository
- Selected provider: Anthropic Claude Code only
- Proposed mode: `boundary`
- Likely article type: `configuration-harness`
- Selected local version boundary: Claude Code `2.1.227` on macOS 26.5 arm64
- Comparison: one-provider control/treatment boundary only. A Claude/Codex comparison would not help the reader choose the correct Claude Code guardrail.
- Practice execution: not performed in this search stage.
- Git operations, publishing, credential inspection, production access, external-system mutation, and CLI updates: not performed.

## Explicit constraints

- Select exactly one article-worthy, falsifiable practice claim.
- Exclude topics already covered by `articles/*.md` and `research/agent/*.md`.
- Prefer current official primary sources; treat community material only as hypothesis-generating context.
- Require a bounded local verification with the authenticated CLI and deterministic machine-readable evidence.
- Do not expose credentials, inspect credential values, modify production systems, execute the practice, create a practice plan, or draft an article.
- Create exactly one research report.

## Existing repository exclusions

The repository has 44 article files. The agent-related published/draft coverage is:

- `articles/project-root-agent-instructions.md`: matched Claude Code `CLAUDE.md` and Codex `AGENTS.md` project-root instruction-loading harness.
- `articles/codex-pretooluse-dispatch-preflight.md`: Codex `PreToolUse` dispatch and deny/fail-open behavior.
- `articles/codex-resume-ephemeral-rollout-gate.md`: Codex resumed-session persistence despite `--ephemeral`.
- `articles/codex-ignore-flags-user-skill-boundary.md`: Codex isolation flags versus ambient user-skill discovery.
- `articles/codex-gpt-5-6-model-guide.md`: Codex GPT-5.6 model and effort selection.
- `articles/agent-plugins-spec-claude-code-half-load.md`: Claude Code interoperability with the Agent Plugins specification.

The six prior `research/agent/` reports select these claims:

- project-root `CLAUDE.md` / `AGENTS.md` loading;
- a Claude subprocess environment-scrub startup-file side effect;
- Codex `PreToolUse` output semantics;
- Codex JSONL progress messages versus the final artifact;
- Codex `resume --ephemeral` persistence;
- Codex isolation flags versus user skills.

None studies Claude Code's top-level turn limit, per-subagent turn limit, result accounting, or whole-tree spend guardrail. The selected topic does not duplicate the instruction, hook, persistence, skill-isolation, plugin-compatibility, or model-selection claims above.

## Searched queries

Live searches performed on 2026-08-18 included:

- `site:docs.anthropic.com/en/docs/claude-code "--bare" "safe-mode"`
- `site:docs.anthropic.com/en/docs/claude-code "silently ignored" settings print mode`
- `site:docs.anthropic.com/en/docs/claude-code background agents --bg worktree`
- `site:code.claude.com/docs "max-turns" subagent`
- `site:platform.claude.com/docs "max_turns" subagent Claude Agent SDK`
- `Claude Code --max-turns subagent turns budget`
- `site:github.com/anthropics/claude-code/issues "max-turns" subagent`
- `site:github.com/anthropics/claude-code/issues "max turns" "subagents"`
- `site:github.com/anthropics/claude-agent-sdk-typescript "maxTurns" subagent`
- `site:github.com/anthropics/claude-code/releases/tag/v2.1.227`
- `site:code.claude.com/docs "v2.1.217" max budget subagents`
- `site:code.claude.com/docs "modelUsage" "whole-tree"`

Representative strong coverage was the current official CLI/Agent SDK documentation and Anthropic's release feed. Searches did not find a current first-party example that runs a top-level `--max-turns` limit across a deliberately invoked custom subagent and compares the parent-only and whole-tree accounting fields in one reproducible fixture.

## Official and primary sources

Every external fact below records the access date. Where a live documentation page exposes no publication or update date, that absence is stated rather than guessed.

### 1. Claude Code CLI reference

- URL: https://code.claude.com/docs/en/cli-reference
- Publication/update date: not stated on the page
- Accessed: 2026-08-18
- Current official facts, paraphrased:
  - `--max-turns` limits agentic turns in print mode and returns an error when the limit is reached.
  - `--max-budget-usd` limits spend in print mode; subagent spend counts, new subagent spawns fail after the cap, and still-running background subagents are stopped. Those enforcement behaviors require v2.1.217 or later.
  - `--forward-subagent-text` with verbose stream JSON exposes subagent text/thinking with `parent_tool_use_id`, allowing a consumer to distinguish parent and child messages.
  - `--agents` can define a custom subagent inline for one session.

### 2. Agent SDK: how the agent loop works

- URL: https://code.claude.com/docs/en/agent-sdk/agent-loop
- Publication/update date: not stated on the page
- Accessed: 2026-08-18
- Current official facts, paraphrased:
  - `max_turns` / `maxTurns` counts tool-use round trips in one agent loop.
  - A subagent starts a fresh conversation and returns only its final response to the parent as a tool result.
  - The budget cap covers subagent spend.
  - The final result's `usage` covers only the main agent loop, while `modelUsage` / `model_usage` is the documented whole-tree token and cost view.
  - Error results still carry `total_cost_usd`, usage data, `num_turns`, and session ID.

The page documents the ingredients separately, but it does not show whether a parent `--max-turns 1` invocation can still complete child inference after the parent's single Agent tool-use round trip, nor does it give a parser assertion that demonstrates the accounting difference.

### 3. Create custom subagents

- URL: https://code.claude.com/docs/en/sub-agents
- Publication/update date: not stated on the page
- Accessed: 2026-08-18
- Current official facts, paraphrased:
  - Each subagent runs in its own context.
  - CLI-defined agents are session-scoped and accepted through `--agents` JSON.
  - `maxTurns` is a field on an individual subagent definition and independently limits that subagent's agentic turns.
  - `effort` and `model` can also be set per subagent.

This per-subagent field is the strongest first-party reason to test rather than assume that the top-level flag is inherited as one global turn counter.

### 4. Programmatic usage

- URL: https://code.claude.com/docs/en/headless
- Publication/update date: not stated on the page
- Accessed: 2026-08-18
- Current official facts, paraphrased:
  - `claude -p` is the non-interactive automation surface and exits nonzero on failed runs.
  - The final stream line is a result object with final response and usage metadata.
  - Forwarded subagent messages are keyed by the Agent tool call's `parent_tool_use_id`.
  - The documentation recommends explicit automation controls and machine-readable stream handling.

### 5. Anthropic Claude Code release feed

- URL: https://raw.githubusercontent.com/anthropics/claude-code/main/feed.xml
- Feed update date: 2026-08-14T22:20:50Z
- Accessed: 2026-08-18
- Primary release facts:
  - Claude Code v2.1.217 was released/updated 2026-07-21T21:35:04Z and fixed `--max-budget-usd` so reaching the cap denies new subagent spawns and halts running background subagents.
  - The locally installed v2.1.227 was released/updated 2026-08-10T22:56:45Z, so it includes the v2.1.217 budget-enforcement boundary.
  - The latest feed entry at research time is v2.1.233, released/updated 2026-08-14T22:20:50Z. The selected claim is therefore explicitly version-pinned to the installed v2.1.227, while the current docs still describe the same distinct turn and whole-tree budget controls.

## Community guidance used only as hypotheses

### Claude Code issue #4277

- URL: https://github.com/anthropics/claude-code/issues/4277
- Published: 2025-07-24
- Accessed: 2026-08-18
- Status at access: closed as not planned
- Hypothesis only: the reporter treats `--max-turns` as a coarse safeguard against runaway tool loops and argues that it can still permit waste inside the allowed turns. This supports the reader problem—automation authors may overread a turn cap as a sufficient spend guard—but it does not establish current subagent accounting or the selected claim.

No community observation is used as proof of current Claude Code behavior.

## Competing guidance and interpretation

- A common operational shorthand is “set `--max-turns` to prevent runaway automation.” That is valid for bounding tool-use round trips in the parent loop, but the official docs separately expose per-subagent `maxTurns`, a whole-tree budget cap, and whole-tree accounting. The shorthand leaves the subagent boundary unresolved.
- Official guidance says a budget is a good production default and explicitly states that budget enforcement covers subagents. This weighs against presenting the selected claim as a product bug; the likely article value is a decision rule and verification harness.
- `--max-turns` may still be useful for progress control, latency, and terminating a parent that keeps calling tools. The proposed article must not say it is useless or that it promises a cost ceiling.
- A subscription usage quota, rate limit, and `--max-budget-usd` are different controls. The experiment concerns the local CLI's reported estimated cost and stop behavior, not billing reconciliation or account-wide quota.

## Candidate assessment

### Selected: top-level turn limit versus a child agent's independent loop and cost

This candidate connects four separately documented facts: the parent loop has a turn limit, each custom subagent can have its own `maxTurns`, `usage` is parent-only, and budget enforcement is whole-tree. A one-agent fixture can determine the operational boundary with objective evidence: parent result subtype, Agent tool-use event, forwarded child event carrying `parent_tool_use_id`, parent `usage`, whole-tree `modelUsage`, and total cost.

The result maps directly to unattended review, migration, and test-fixing scripts that delegate work. Those users need to decide whether a top-level turn cap alone is a cost guard, whether each custom subagent also needs `maxTurns`, and which result field to monitor.

### Excluded candidates

- Claude Code `--bare` for hermetic CI: the current official programmatic-usage page already recommends it and enumerates skipped discovery, credentials, retained tools, and explicit opt-ins. It is also adjacent to this repository's project-instruction and Codex ambient-skill isolation coverage. The local OAuth-backed installation cannot verify bare mode without adding a separate API-key mechanism.
- `--safe-mode` versus `--bare`: the current CLI reference directly contrasts their customization and authentication behavior. A marker matrix would mainly restate documentation and again overlap existing hidden-context coverage.
- Invalid `--mcp-config` in headless mode: the current programmatic-usage page already supplies the exact `mcp_server_errors` CI gate and explains the clean-exit/stderr boundary. No honest article gap remained.
- `--forward-subagent-text` stream reconstruction: current official documentation already explains `parent_tool_use_id`, nested forwarding, and the final result event. A generic parser article would also be substantively adjacent to the repository's Codex JSONL final-artifact boundary.
- Background-agent daemon lifecycle: current docs cover management commands and failure recovery, but a useful local check would require broader asynchronous state and cleanup than the selected one-subagent fixture and would not resolve as sharp a reader decision.
- Cross-provider maximum-turn comparison: rejected because provider internals and “turn” definitions differ, while the concrete reader only needs the correct guardrails for a Claude Code headless run.

## Selected falsifiable practice claim

> With the locally installed Claude Code 2.1.227, a non-interactive run limited by top-level `--max-turns 1` can execute one explicitly requested inline custom subagent and incur that child's model usage before the parent ends at its turn limit: the stream contains an Agent tool-use event plus at least one forwarded child message with that Agent call's `parent_tool_use_id`, the final result is `error_max_turns`, parent-only `usage` excludes the child's tokens, and whole-tree `modelUsage` includes them. Therefore `--max-turns` is a parent-loop progress bound, not a whole-tree spend ceiling; unattended subagent workflows should set per-subagent `maxTurns`, use `--max-budget-usd` for a total-cost stop, and read `modelUsage` for whole-tree accounting.

This is one conjunctive configuration-boundary claim. It is false if v2.1.227 prevents the named subagent from starting before the top-level limit, charges the child's work against the same top-level turn counter so no child response completes, reports child usage inside the parent-only `usage` field, omits child usage from `modelUsage`, or returns normal success rather than the documented max-turn error. It is inconclusive if the main model does not issue the explicitly requested Agent call, the requested model is unavailable, authentication or service availability fails, ambient configuration changes the tool surface, the stream is incomplete, or the CLI version differs.

## Target reader and practical uncertainty

The concrete reader is an engineer wrapping `claude -p` in CI or a local automation script that delegates a bounded analysis task to one or more custom subagents.

Their current problem is that `--max-turns N` looks like a simple global runaway/cost control, while the docs distribute the relevant semantics across parent-loop, subagent, budget, and accounting pages. A script can stop with `error_max_turns` and still have performed child inference that is not visible in the parent-only `usage` object.

After reading the eventual article, the reader should be able to:

1. use top-level `--max-turns` to bound parent tool-use progress rather than promise a total spend ceiling;
2. set `maxTurns` on each CLI-defined custom subagent when child-loop depth also needs a bound;
3. use `--max-budget-usd` as the documented whole-tree spend stop on v2.1.217+;
4. gate result handling on the final subtype and monitor `modelUsage`, not only `usage`, for whole-tree accounting.

## What official documentation already answers

Official documentation already answers that:

- turns mean tool-use round trips;
- top-level and per-subagent turn controls exist;
- budget enforcement covers subagents on v2.1.217+;
- forwarded stream events can identify subagent messages;
- `usage` is main-loop-only and `modelUsage` is whole-tree.

The article must cite those facts rather than rediscover or rephrase them as novel findings.

## Precise remaining coverage gap

The missing reader-facing evidence is the interaction test: in one current, version-pinned headless invocation, does the child actually run after the parent's sole allowed Agent tool-use round trip, what terminal subtype results, and do the two accounting views diverge exactly as the separate contracts imply?

The proposed fixture adds value beyond a feature summary by producing an executable assertion and a concrete CI decision table from that interaction:

- parent progress guard: top-level `--max-turns`;
- child progress guard: subagent `maxTurns`;
- whole-tree spend guard: `--max-budget-usd`;
- whole-tree observation: `modelUsage`.

## Local feasibility

Read-only preflight on 2026-08-18 established:

- `claude --version` -> `2.1.227 (Claude Code)`;
- `claude auth status` -> exit code 0, with all command output discarded so no account metadata or credential material was recorded;
- platform -> macOS 26.5 arm64.

The later test needs no package installation, browser, CAPTCHA, Git history change, production service, MCP server, external repository, secret fixture, or credential output. It requires a small number of authenticated model requests, so it is bounded but not offline in the literal network-disconnected sense; the fixture and oracle are fully local and dependency-free. If “offline fixture” is interpreted as “no network at all,” any authenticated Claude model behavior test is impossible; here it means no external data/service dependency beyond Claude Code's normal authenticated model call.

## Minimal verification idea

In a later plan/run stage, create a fresh temporary non-Git directory containing only one small inert text file and a dependency-free JSONL verifier. Do not use repository content, user data, environment dumps, hooks, MCP, plugins, skills, background agents, file writes by the model, or production endpoints.

Run a matched control and treatment with:

- the exact recorded Claude Code version;
- `claude -p`;
- `--max-turns 1`;
- `--output-format stream-json --verbose --forward-subagent-text`;
- `--setting-sources project` from the empty fixture so project configuration is explicit and user settings are not loaded;
- a low fixed effort supported by the selected model;
- a finite wall-clock timeout and a conservative `--max-budget-usd` that still permits the expected two short model responses;
- no session resume and no persistence requirement in the oracle;
- sanitized stdout/stderr and no environment capture.

For the treatment, pass one inline `--agents` definition named `one-shot-probe` with a narrow prompt, `maxTurns: 1`, low effort, no task requiring tools, and an instruction to return one fixed harmless marker. Restrict the parent tool surface to the Agent tool and prompt it to invoke exactly that named agent once with the marker task. Set `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` for the child catalog so only the fixture-defined custom agent is eligible; record that non-secret variable explicitly.

Use the control to verify the same top-level one-turn termination without invoking a subagent, for example one parent Read call against the inert file under the same model/effort/budget. If exact tool-surface constraints cannot make both requested tool calls occur, classify the relevant case inconclusive rather than reprompting without bound.

The verifier should assert for the treatment:

1. exactly one parent Agent tool-use event names `one-shot-probe`;
2. at least one forwarded child message has `parent_tool_use_id` equal to that Agent call ID and contains the harmless marker;
3. the final result subtype is `error_max_turns`, with a nonzero process exit;
4. the documented whole-tree `modelUsage` totals include strictly more model work than parent-only `usage` in at least one token/cost dimension attributable to the observed child event;
5. total cost stays below the predeclared cap;
6. neither case modifies the fixture.

Retain the exact commands with credentials absent, CLI version, platform, exit codes, sanitized JSONL, verifier output, elapsed time, and before/after file inventories. Do not infer behavior from model narration when event identity and accounting fields provide the oracle.

## Expected evidence and practical mapping

- Agent tool-use ID -> a real orchestrator dispatching one delegated CI subtask.
- Forwarded child message -> proof that child inference completed, independent of the parent's final prose.
- `error_max_turns` -> the parent progress limit firing after its allowed tool-use round trip.
- Parent-only `usage` -> what a naive automation may undercount.
- Whole-tree `modelUsage` -> what the automation should aggregate for delegated work.
- Per-agent `maxTurns` -> the child-loop guard that must be configured separately.
- `--max-budget-usd` -> the documented whole-tree stop, not a claim about exact provider billing.

The article should not generalize from one tiny marker task to subagent quality, latency, ideal turn counts, or universal cost savings. The fixture proves guardrail scope, not model performance.

## Safety, cost, and stop conditions

- Use an empty disposable directory and inert read-only fixture; do not let the model edit files or call Bash, web, MCP, Git, package managers, or external applications.
- Never print environment variables, auth status details, keychain data, tokens, account identifiers, or raw configuration outside the explicit fixture.
- Set both a strict wall-clock timeout and a low dollar cap. Stop after the declared control and treatment; no retries for statistical confidence are needed for the binary interaction unless a predeclared transient-service retry policy is part of the later plan.
- Stop before model execution if authentication status is nonzero, the CLI version differs, the expected flags are unavailable, the temporary path cannot be validated, or ambient processes could mix output.
- Abort the case as inconclusive if the named Agent call does not occur exactly once, the child marker is missing, the stream truncates, a fallback changes the selected model without a recorded rule, the budget stops the run before the boundary is observed, or service availability fails.
- Do not update Claude Code during the run. If a later stage deliberately targets v2.1.233 or newer, refresh the official sources and rewrite the version-pinned claim before execution.
- Do not interpret estimated `total_cost_usd` as invoice truth; the target is relative scope and stop behavior within one CLI result.

## Editorial recommendation

Proceed to a separate planning stage with this single version-pinned boundary claim. The likely Zenn article should be a `configuration-harness` piece for headless subagent users, centered on the decision rule “turn caps bound loops; budget caps bound the tree.” Drafting is not justified until the control/treatment stream and accounting assertions have been executed and recorded.
