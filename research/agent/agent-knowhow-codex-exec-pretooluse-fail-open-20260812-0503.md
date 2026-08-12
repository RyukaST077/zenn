# Codex exec `PreToolUse`: unsupported stop output versus an event-specific deny

## Research contract

- Research date: 2026-08-12 (JST)
- External-source access date: 2026-08-12
- Requested scope: current, practical Claude Code or OpenAI Codex know-how not already covered by this repository
- Selected provider: OpenAI Codex CLI only
- Proposed mode: `boundary`
- Likely article type: `failure`
- Performance comparison: excluded. The claim concerns hook dispatch and filesystem side effects, not speed, cost, or model quality.
- Practice execution: not performed in this search stage.
- Git, publishing, credential, production, and external-system mutations: not performed.

## Explicit constraints

- Select exactly one article-worthy, falsifiable practice claim.
- Exclude substantive duplicates in `articles/*.md` and `research/agent/*.md`.
- Prefer current official primary sources; treat community material only as a hypothesis or competing report.
- Keep a later check local, bounded, non-destructive, and independent of package installation or fixture network access.
- Do not inspect, copy, print, or modify credentials.
- Do not create a practice plan, run Codex against the fixture, draft an article, publish, or alter Git state in this stage.

## Existing repository exclusions

All 32 files under `articles/*.md` and the one prior report under `research/agent/*.md` were inspected by filename, title, and relevant content on 2026-08-12.

- `articles/project-root-agent-instructions.md` and `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md` already cover whether ordinary non-interactive Claude Code and Codex runs reflect root `CLAUDE.md` / `AGENTS.md` instructions. The selected topic does not test instruction discovery or compliance markers; it tests executable Codex hook decision output at the pre-tool boundary.
- `articles/codex-gpt-5-6-model-guide.md` already covers GPT-5.6 family and reasoning-level selection. Model selection, latency, cost, and output-quality comparison are excluded.
- No repository article or prior agent report covers Codex lifecycle hooks, `PreToolUse`, hook trust for `codex exec`, unsupported hook output, or fail-open hook behavior.
- The remaining articles concern Zenn publishing or non-agent engineering topics and are not substantive duplicates.

## Searched queries

Live web search was performed on 2026-08-12 with these representative queries:

1. `site:code.claude.com/docs/en Claude Code hooks worktree sandbox current official`
2. `site:code.claude.com/docs/en Claude Code "--worktree" OR "--safe-mode" OR "--bare"`
3. `site:developers.openai.com/codex codex CLI output schema exec JSONL official`
4. `site:developers.openai.com/codex codex CLI sandbox permissions hooks official`
5. `site:developers.openai.com/codex "output-schema" "codex exec"`
6. `site:developers.openai.com/codex "--ephemeral" codex exec`
7. `site:developers.openai.com/codex sandbox workspace-write writable roots CLI`
8. `site:developers.openai.com/codex/changelog Codex CLI hooks skills subagents 2026`
9. `Codex Hooks PreToolUse continue false permissionDecision deny tutorial`
10. `site:zenn.dev Codex hooks PreToolUse`
11. `site:dev.to OpenAI Codex hooks PreToolUse`
12. `site:github.com/openai/codex hooks PreToolUse permissionDecision`

The current official Codex Hooks, developer-command reference, and changelog pages were then opened directly. Search results for the Zenn-specific query did not surface a representative article that directly tests this boundary; this is a statement about the returned results, not a claim that no such Japanese article exists.

## Official primary sources

1. [Hooks](https://learn.chatgpt.com/docs/hooks)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-12.
   - Clearly marked paraphrase: Codex can load project hooks from `<repo>/.codex/hooks.json` or inline project config; non-managed command hooks require trust, while vetted automation can use `--dangerously-bypass-hook-trust` for one invocation.
   - Clearly marked paraphrase: `PreToolUse` covers model-generated Bash and unified exec calls, `apply_patch`, MCP calls, and most local function tools, although specialized paths may opt out, so hooks are a guardrail rather than a complete enforcement boundary.
   - Clearly marked paraphrase: for `PreToolUse`, top-level `continue`, `stopReason`, and `suppressOutput` are currently unsupported. Returning them makes the hook run fail and the tool call continue.
   - Clearly marked paraphrase: the documented current deny form is `hookSpecificOutput` with `hookEventName: "PreToolUse"`, `permissionDecision: "deny"`, and a non-empty `permissionDecisionReason`; exit code 2 plus a reason on stderr is also accepted.
   - Relevance: establishes the exact supported and unsupported outputs whose side effects the later fixture would distinguish.

2. [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-12.
   - Clearly marked paraphrase: `codex exec` is the stable non-interactive command for scripted or CI-style work. Its current flags include `--sandbox workspace-write`, `--ignore-user-config`, `--ephemeral`, JSONL output, and `--dangerously-bypass-hook-trust`; the last is intended only for automation that already vets hook sources.
   - Relevance: establishes the unattended entry point and bounded command-line controls for the proposed check.

3. [ChatGPT & Codex changelog](https://learn.chatgpt.com/docs/changelog)
   - Publisher: OpenAI, official product changelog.
   - Publication date of relevant entry: 2026-05-14.
   - Accessed: 2026-08-12.
   - Clearly marked paraphrase: the 2026-05-14 entry announced general availability of Codex Hooks.
   - Relevance: establishes that Hooks are a current released capability rather than an abandoned proposal, while not proving behavior in the locally installed CLI.

## Community and issue coverage used only as hypotheses

1. [codex exec still does not dispatch hooks with valid hooks.json shape, openai/codex issue #26452](https://github.com/openai/codex/issues/26452)
   - Author/source: community bug report in the OpenAI Codex repository; not official product guidance.
   - Opened: 2026-06-04; closed as a duplicate.
   - Accessed: 2026-08-12.
   - Reported observation: valid hooks with trust bypass did not dispatch under `codex exec` 0.137.0 or 0.138.0-alpha.2, and the harmless command still ran.
   - Use here: competing hypothesis. It motivates checking current local 0.147.0 instead of assuming that the current docs describe every older executable. The report is not treated as evidence for 0.147.0.

2. [File write operations do not fire PreToolUse/PostToolUse hooks, openai/codex issue #17794](https://github.com/openai/codex/issues/17794)
   - Author/source: community bug report in the OpenAI Codex repository; not official product guidance.
   - Opened: 2026-04-14; closed as a duplicate.
   - Accessed: 2026-08-12.
   - Reported observation: an earlier build did not route `apply_patch` writes through tool hooks.
   - Use here: historical competing report. It reinforces using an explicitly requested Bash tool path and recording the canonical `tool_name`, rather than generalizing from a marker alone.

3. [Codex CLI Hooks: Complete Guide to Events, Policy Engines and Production Patterns](https://codex.danielvaughan.com/2026/04/15/codex-cli-hooks-complete-guide-events-policy-patterns/)
   - Author/source: independent community article; not OpenAI documentation.
   - Published: 2026-04-15; updated: 2026-08-11.
   - Accessed: 2026-08-12.
   - Article guidance: it describes invalid or unsupported output as fail-open and identifies the event-specific deny output as the preferred `PreToolUse` form.
   - Use here: representative strong existing coverage. It already answers how the schema is intended to look, but does not resolve the version-specific `codex exec` dispatch contradiction on this local installation with a retained, harmless filesystem oracle.

No community recommendation is relabeled as an OpenAI recommendation.

## Candidate assessment

### Selected: current `codex exec` dispatch plus the unsupported-output fail-open boundary

This is useful because unattended hook users need to know two things at once: whether the current non-interactive CLI actually dispatches the project hook, and whether the chosen response shape actually blocks the attempted tool. A hook file that parses or appears in configuration is not evidence of either property. The proposed two-case marker check can falsify both assumptions without a destructive command.

### Excluded candidates

- Claude Code `--worktree` default base reference and `.worktreeinclude`: current official documentation directly explains that default worktrees start from `origin/HEAD`, can use local `HEAD` through `worktree.baseRef`, and omit untracked files unless included. A first article would mostly restate that decision table unless a separate unresolved failure were found.
- Claude Code hook exit code 1 versus 2: the official hook reference already states the boundary clearly. It remains useful, but the newly reported Codex non-interactive dispatch contradiction creates the more specific current reader uncertainty.
- Codex `--output-schema`: official documentation establishes the feature, but this search did not find a concrete, safety-relevant local uncertainty beyond a feature demonstration.
- Codex `--ephemeral`: verifying absence of persisted rollout files would be a narrow feature summary with weaker mapping than a policy-hook failure boundary.
- Nested `AGENTS.md` precedence or truncation: it is adjacent to the repository's existing instruction-loading report and article, which explicitly identify nested precedence as an untested follow-up. Selecting it now would be substantively too close to existing coverage.
- Cross-provider hook comparison: rejected because a comparison is not needed to decide whether a Codex CI policy hook blocks a Codex tool call.

## Selected falsifiable claim

> With the locally installed Codex CLI 0.147.0, `codex exec --sandbox workspace-write --ignore-user-config --dangerously-bypass-hook-trust` dispatches a vetted project-local `PreToolUse` command hook for the same harmless model-requested Bash marker command in both isolated cases: when the hook exits 0 with top-level `{"continue":false,"stopReason":"fixture block"}`, Codex records a failed hook and allows the command, so `effect.txt` contains the exact marker; when the hook instead exits 0 with the documented `hookSpecificOutput.permissionDecision: "deny"` and a non-empty reason, Codex records a blocked hook and the marker file is absent.

This is one conjunctive boundary claim. It is false if either hook is not dispatched, the canonical attempted tool is not `Bash`, the generic stop output blocks the command, the event-specific deny lets it run, or the retained events and filesystem state disagree. A trust/configuration warning that prevents the project hook from becoming active makes the intended two-case comparison inconclusive rather than support for the claim.

## Target reader and practical uncertainty

- Reader: a repository or CI maintainer adding project-local Codex Hooks to unattended `codex exec` jobs.
- Situation: the maintainer wants a deterministic policy script to reject selected model-generated commands before they execute.
- Current problem: the generic top-level stop fields look reusable across hook events, official docs say they are unsupported for `PreToolUse`, older bug reports say `codex exec` did not dispatch hooks at all, and a startup warning or accepted JSON file does not prove that a harmless operation was blocked.
- Decision after reading: whether the installed Codex CLI and exact hook response can be treated as an additional guardrail in that job, and which marker-based preflight must pass before enabling the workflow. The reader should also know not to treat the hook as the sole security boundary.

## Article promise

The article would let the reader build a two-case, version-pinned preflight that distinguishes “hook present,” “hook dispatched but failed open,” and “tool actually blocked.” It would give a concrete adoption rule: use the event-specific deny shape only after the current CLI produces both the hook event and the expected absence of the harmless marker; otherwise retain sandbox and external policy boundaries and stop rollout.

## What existing sources answer and the remaining coverage gap

Official documentation already answers:

- where project Codex hooks are configured and how hook trust works;
- which output shape currently denies a `PreToolUse` call;
- that generic `continue: false` is unsupported for `PreToolUse` and the tool continues after the hook failure;
- that `codex exec` is intended for non-interactive work and exposes a one-invocation hook-trust bypass for already-vetted automation;
- that tool hooks are guardrails, not complete enforcement boundaries.

Strong community coverage already provides a broad hook schema guide. Historical issue reports, however, claim that `codex exec` 0.137.0/0.138.0-alpha.2 did not dispatch valid hooks even with trust bypass, and that an earlier `apply_patch` path evaded hook events.

The precise remaining gap is a retained, version-specific local check on Codex CLI 0.147.0 that uses the documented non-interactive flags, proves dispatch from sanitized hook input/events, and ties each output shape to a deterministic filesystem side effect. The proposed article is not another Hooks overview; it resolves whether a current unattended invocation can reproduce the intended fail-open-versus-deny boundary before a maintainer relies on it.

## Practical mapping

| Offline fixture element | Real-work analogue |
| --- | --- |
| `node write-marker.mjs` | a model-generated build, migration, deployment, or repository command |
| `effect.txt` with an exact inert marker | the side effect a policy is supposed to prevent |
| generic `continue: false` case | a copied or cross-event hook response that looks blocking but is unsupported here |
| event-specific deny case | the reviewed production policy response |
| sanitized hook-input log and Codex JSONL events | CI audit evidence that the expected hook actually intercepted the expected tool path |
| unexpected-file check | verification that the model did not satisfy the prompt through an unobserved alternate path |

The fixture does not claim that blocking one marker command secures arbitrary execution. It provides a regression oracle for the exact configured event, matcher, CLI version, and response shape.

## Minimal verification idea

In a later planning and run stage, create one minimal local Git fixture containing:

- `write-marker.mjs`, which only writes `effect.txt` containing exactly `TOOL_RAN`;
- `.codex/hooks.json` with one `PreToolUse` command hook matching canonical `Bash`;
- a hook script that reads JSON from stdin, appends only sanitized fields (`hook_event_name`, `tool_name`, and whether `tool_input.command` equals `node write-marker.mjs`) to a local evidence file, and selects one of the two fixed outputs by fixture case;
- no dependencies, secrets, network calls, Git remotes, or production paths.

Make two fresh isolated copies. Use the same bounded prompt in each: request `node write-marker.mjs` exactly once and prohibit alternate tools or edits. Invoke the installed Codex once per case with `--sandbox workspace-write`, `--ignore-user-config`, `--ephemeral`, `--json`, and `--dangerously-bypass-hook-trust`; do not use `--dangerously-bypass-approvals-and-sandbox`. The project hook and trust-bypass use must be fully visible in the recorded command, while credentials remain untouched and unprinted.

Case A returns the unsupported top-level generic stop object. Case B returns the documented event-specific deny object. Retain redacted JSONL, stderr, exit code, CLI version, hook evidence, final file inventory, exact `effect.txt` state, and diff. Before interpreting the cases, verify that the project hook layer was active and that the captured attempted tool was canonical `Bash`. Do not automatically retry or substitute a different tool path.

## Local feasibility observed without running the practice

- Locally installed Codex CLI: `codex-cli 0.147.0` on `PATH`, observed 2026-08-12 with `codex --version`.
- Local runtime: Node.js `v22.17.0`, observed 2026-08-12 with `node --version`.
- `codex exec --help` locally exposes `--sandbox`, `--ignore-user-config`, `--ephemeral`, `--json`, and `--dangerously-bypass-hook-trust`.
- The repository already has an isolated agent-practice runner, manifest validation, evidence redaction, and unexpected-file/protected-path checks that can be extended in a later plan; no existing fixture was changed in this search stage.
- Authentication was not exercised, inspected, copied, or printed. A later run must treat authenticated Codex access as a prerequisite and stop cleanly if it is unavailable.
- The only unresolved feasibility point is activation of a fresh project `.codex` layer under non-interactive trust bypass. The later plan must verify this from sanitized events/warnings before interpreting side effects; it must not modify user-global hook configuration to force success.

## Expected evidence and decision rule

For each case, retain:

- `codex-cli 0.147.0` version output and the redacted exact invocation;
- at least one sanitized `PreToolUse` hook input with `tool_name: "Bash"` and an exact-command boolean of `true`;
- Codex JSONL/stderr sufficient to classify the hook as failed, blocked, skipped, absent, or malformed without retaining prompts or credentials beyond the inert fixture command;
- final file inventory and diff;
- `effect.txt` state: exact `TOOL_RAN` in Case A, absent in Case B;
- confirmation that the hook script, config, and writer script were unchanged and no unexpected path changed.

Support the claim only if both hook dispatches are proven, Case A is classified as failed and creates the exact marker, Case B is classified as blocked and has no marker, and no alternate tool or unexpected mutation occurred. Classify the result as not reproduced or inconclusive—never silently pass it—if dispatch is absent, the project layer is untrusted, the model does not attempt the exact command, evidence is inconsistent, or the CLI behavior cannot be separated from host configuration.

## Safety, cost, and stop conditions

- Run only in fresh temporary copies of the inert fixture. Never point the agent at the repository root or a production checkout as its writable workspace.
- Keep `workspace-write` sandboxing and fixture network access disabled. Use `--ignore-user-config` to avoid unrelated user config while preserving normal authentication behavior documented by the CLI. Do not enable web search, MCP servers, plugins, extra writable directories, or danger-full-access.
- The hook-trust bypass is acceptable only because the hook source is fixed, locally reviewed, and inert. It does not authorize bypassing approvals or the sandbox.
- Allow exactly two paid/model invocations, one per case, with a finite timeout and no automatic retries. Record usage if surfaced, but make no cost or performance claim.
- Do not inspect, copy, echo, relocate, or modify credential files. Record only sanitized authentication success/failure.
- Do not run Git network operations, install dependencies, publish, send messages, or touch external systems.
- Stop before agent execution if fixture hashes differ, the hook/config cannot be activated without changing global user state, authentication is unavailable, redaction cannot be guaranteed, or the sandbox/network constraints cannot be established.
- Stop a case on timeout, trust/config warnings, missing hook evidence, an unexpected tool, an unexpected file change, hook-script/config mutation, or any attempt to access outside the fixture. Preserve the failure as evidence and do not retry automatically.
