# Review: project-root-agent-instructions

verdict: fix
blockers: 1
warnings: 4

## Scope

- Article: `articles/project-root-agent-instructions.md`
- Analysis: `logs/agent/analysis-project-instruction-loading-20260811-1140.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Review time: 2026-08-11 11:48 JST

The supplied article, analysis, execution log, and manifest describe the same `project-instruction-loading-20260811-1133` four-case ablation. The deterministic article check passed:

```text
OK: articles/project-root-agent-instructions.md (slug=project-root-agent-instructions, published=false)
```

## Required fixes

### W1: The all-cases network-disabled claim is contradicted by the runner

The article says `ケース内ネットワーク: 無効` without a provider qualification (`articles/project-root-agent-instructions.md:54`). The manifest does set `network: false`, but the runner applies that value only to Codex through `sandbox_workspace_write.network_access=false` (`scripts/agent-practice/run-experiment.mjs:133-138`). The Claude branch has no corresponding network sandbox or environment restriction (`scripts/agent-practice/run-experiment.mjs:121-130`), and every spawned process inherits `process.env` (`scripts/agent-practice/run-experiment.mjs:40-48`). The recorded Claude `command.json` files likewise contain no network-isolation flag.

Action: state that task-tool network access was disabled for the Codex cases only. State explicitly that the recorded Claude cases did not enforce network isolation, even though their observed tool events contain no network command. Add this to the limitations and remove any wording that treats `network: false` as an implemented four-case boundary.

Evidence:

- `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- `scripts/agent-practice/run-experiment.mjs:40-48,121-148`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided,codex-baseline,codex-guided}/command.json`
- The Claude `events.jsonl` files show only local file/test commands, but absence of an observed network command is not evidence of enforced network isolation.

### B1: A temporary fixture copy is presented as a safety boundary for `bypassPermissions`

The article correctly warns that `bypassPermissions` should not be copied into a normal work directory, but then says the successful run was bounded by a disposable fixture and post-run diff inspection (`articles/project-root-agent-instructions.md:84,98,147,166`). Those controls limit intended evidence and make cleanup easier; they do not stop Claude's Bash/Read/Write/Edit tools from accessing the surrounding host. The runner invoked Claude directly on the host with `--permission-mode bypassPermissions`, inherited the full process environment, and supplied no filesystem or network sandbox (`scripts/agent-practice/run-experiment.mjs:40-48,121-148`). A post-run diff also cannot prevent or detect every out-of-fixture side effect.

Current Anthropic primary guidance says `bypassPermissions` disables permission prompts and safety checks and should be used only in an isolated container, VM, or dev container without internet access: <https://code.claude.com/docs/en/permission-modes> (verified 2026-08-11).

Action: distinguish the exact historical command from a recommended recipe. Say that the recorded Claude run was not OS-isolated and that the temporary copy/diff was not a security boundary. For reader-facing reproduction, require an actual container/VM/dev-container boundary with network disabled, or replace `bypassPermissions` with a safer permission configuration. Do not imply that changing the recommendation retroactively describes the recorded run.

Evidence:

- `articles/project-root-agent-instructions.md:84-98,143-148,166`
- `scripts/agent-practice/run-experiment.mjs:40-48,121-148`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided}/command.json`
- Anthropic, “Choose a permission mode”: <https://code.claude.com/docs/en/permission-modes>

### W3: The deterministic runtime version is omitted

The article records both agent CLI versions but omits Node.js, even though `node test.mjs` is the deterministic verifier and the article presents the setup as reproducible (`articles/project-root-agent-instructions.md:44-56,72-80`). The research report records Node.js `v22.17.0` under local feasibility.

Action: add `Node.js: v22.17.0` to the environment section and make clear that this version came from the recorded research/run environment rather than a manifest override.

Evidence:

- `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`, “Local feasibility”
- `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`, `verification.command`

### W4: Two recoverable Codex command failures are absent from the failure section

The article's failure section reports only the state-database warnings (`articles/project-root-agent-instructions.md:137-139`). In both Codex cases, an exploratory command that included `git status --short` exited 128 because the temporary fixture was not a Git repository. The agents recovered and the overall agent/verifier exits were 0, so this does not invalidate the behavioral claim, but it is a recorded failure and matters to readers reproducing the `--skip-git-repo-check` setup.

Action: add the two recoverable `git status` failures, explain that the fixture was intentionally/non-accidentally outside a Git repository, and retain the distinction between intermediate tool exit 128 and final agent/verifier exit 0.

Evidence:

- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-baseline/events.jsonl`, command item `item_2`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-guided/events.jsonl`, command item `item_1`
- Corresponding `metrics.json` files record final agent and verifier exit 0.

### W5: The advertised reproduction procedure does not identify an exact setup or runner invocation

The article provides the agent commands and a prose description of copying a fixture, but it does not give the exact fixture source path, the runner command, or the complete `test.mjs`/`package.json` setup (`articles/project-root-agent-instructions.md:58-116`). A reader cannot reproduce the exact four-case harness from the article alone, despite the summary calling the evidence reproducible (`articles/project-root-agent-instructions.md:164`). Existing evidence is sufficient to close this gap without a rerun.

Action: add either (a) the exact repository/fixture and runner invocation, or (b) the complete minimal fixture setup plus exact per-case preparation and post-run assertions. If using the repository harness, the recorded invocation should point to `scripts/agent-practice/run-experiment.mjs` and `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`. Also explain that `--skip-git-repo-check` is needed because these copied fixtures are not Git repositories.

Evidence:

- `fixtures/agent-practice/instruction-loading/{src/greet.js,test.mjs,package.json}`
- `fixtures/agent-practice/guidance/{claude/CLAUDE.md,codex/AGENTS.md}`
- `practice/agent/agent-practice-project-instruction-loading-20260811-1133.{md,json}`
- `scripts/agent-practice/run-experiment.mjs`

## Evidence trace that passes

- All four case `metrics.json` files record agent exit 0, no timeout, verifier exit 0, matching marker expectation, no protected changes, no unexpected changes, and `passed: true`.
- All four `verify.log` files contain `PASS: greet returns the required message`.
- All four `diff.patch` files change only `src/greet.js` in baselines and add `verification.txt` only in guided cases. Both guided markers are exactly `AGENT_RULE_APPLIED`; both baselines omit the marker.
- The displayed Claude and Codex commands match the recorded `command.json` arguments after replacing recorded paths and the prompt with placeholders.
- The article clearly limits the evidence to one run per case, CLI-default backend models, root-level guidance, behavioral observation rather than internal context inspection, and no performance comparison. No repeated-run reliability or provider-superiority claim is made.
- The Codex state-database warnings are accurately described as observed and uninvestigated; the article does not claim a general cause or harmlessness.

## Primary-source freshness

The externally attributed product facts were rechecked against current official pages on 2026-08-11:

- Anthropic documents launch-time loading of `CLAUDE.md` files at or above the working directory: <https://code.claude.com/docs/en/memory>.
- Anthropic documents `claude -p` as non-interactive and `--bare` as skipping `CLAUDE.md`: <https://code.claude.com/docs/en/headless>.
- Anthropic documents `--safe-mode` as disabling `CLAUDE.md`: <https://code.claude.com/docs/en/cli-reference>.
- OpenAI documents one instruction chain per run, starting at the project root and walking toward the working directory: <https://learn.chatgpt.com/docs/agent-configuration/agents-md>.
- OpenAI documents `codex exec` as the non-interactive entry point for scripts and CI: <https://learn.chatgpt.com/docs/non-interactive-mode>.

The article's corresponding paraphrases are supported and remain appropriately attributed as official product facts.

## Secret and publication checks

- `bash scripts/check-article.sh articles/project-root-agent-instructions.md --expect-published false` passed.
- `published: false` is intact, and the slug is `project-root-agent-instructions`.
- A targeted scan of the article, analysis, and supplied run directory found no OpenAI/Anthropic/GitHub token forms, private-key headers, bearer credentials, authorization headers, or populated OpenAI/Anthropic/Codex API-key assignments.
- No community guidance is presented as official. All five product references are current first-party documentation.
- The article was not edited, Git state was not changed, and nothing was published.

## Verdict rationale

The core behavior/result claim is supported, so a new experiment is not required if the article is revised to describe the recorded boundaries accurately. Publication is not ready because the all-cases network claim is false, the Claude safety boundary is materially overstated, and the reproducibility/failure record has correctable omissions. The safety blocker and all four warnings can be resolved from existing repository evidence and current primary documentation; therefore the verdict is `fix` rather than `rerun` or `blocker`.
