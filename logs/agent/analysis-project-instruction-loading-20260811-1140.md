# Project instruction loading result analysis

verdict: confirmed
action: draft

## Claim

For the single recorded four-case ablation, isolated non-interactive Claude Code and Codex CLI runs followed their product-native project-root guidance: the guided cases created `verification.txt` containing exactly `AGENT_RULE_APPLIED`, the matched baselines did not create the marker, and all four cases passed the implementation verifier without protected or unexpected changes. This confirms the manifest's narrowly bounded claim for the recorded CLI versions and settings; it does not estimate instruction-following reliability across repeated runs.

Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`; all four case `metrics.json`, `verify.log`, and `diff.patch` files listed below.

## Conditions

- Run window: 2026-08-11T02:37:14.900Z through 2026-08-11T02:38:46.787Z. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`.
- Claude Code version: `2.1.227 (Claude Code)`; Codex version: `codex-cli 0.147.0`. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json` and each case's `metrics.json`.
- Each provider had one baseline and one guided run; every case used CLI-default model and effort (`null` overrides), a fresh isolated fixture copy, a 300-second case timeout, and the same implementation prompt. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; each case's `command.json` and `metrics.json`.
- The implementation prompt did not mention `verification.txt` or `AGENT_RULE_APPLIED`; those requirements existed only in the guided `CLAUDE.md` and `AGENTS.md`. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; `fixtures/agent-practice/guidance/claude/CLAUDE.md`; `fixtures/agent-practice/guidance/codex/AGENTS.md`.
- Deterministic verification was `node test.mjs`; `test.mjs` and `package.json` were protected, while `src/greet.js` and `verification.txt` were the only allowed changes. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`.

## Case matrix

| Case | Guidance | Agent / verifier exit | Marker observed | Changed paths | Protected / unexpected | Result and evidence |
|---|---|---:|---|---|---|---|
| `claude-baseline` | none | 0 / 0 | absent | `src/greet.js` | none / none | passed — `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/claude-baseline/metrics.json`, `verify.log`, `diff.patch` |
| `claude-guided` | root `CLAUDE.md` | 0 / 0 | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | none / none | passed — `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/claude-guided/metrics.json`, `verify.log`, `diff.patch` |
| `codex-baseline` | none | 0 / 0 | absent | `src/greet.js` | none / none | passed — `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-baseline/metrics.json`, `verify.log`, `diff.patch` |
| `codex-guided` | root `AGENTS.md` | 0 / 0 | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | none / none | passed — `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-guided/metrics.json`, `verify.log`, `diff.patch` |

## Deterministic results

- Every raw verifier log contains `PASS: greet returns the required message`, and every `metrics.json` records verifier exit 0. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided,codex-baseline,codex-guided}/verify.log` and the corresponding `metrics.json` files.
- Every diff changes `src/greet.js` from throwing the fixture error to returning ``Hello, ${name}!``. Evidence: the four case `diff.patch` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.
- Only the guided diffs add `verification.txt`, and each added file contains exactly `AGENT_RULE_APPLIED`; neither baseline diff adds that file. Evidence: the four case `diff.patch` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.
- Every `metrics.json` records agent exit 0, no timeout, no protected-path changes, no unexpected changes, a matching marker expectation, and `passed: true`. Evidence: the four case `metrics.json` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.

## Observed facts

- The Claude baseline and guided commands used the same prompt and flags; the case guidance field was respectively `null` and `fixtures/agent-practice/guidance/claude/CLAUDE.md`. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/claude-baseline/command.json`, `claude-guided/command.json`, and their `metrics.json` files.
- The Codex baseline and guided commands used the same prompt and flags; the case guidance field was respectively `null` and `fixtures/agent-practice/guidance/codex/AGENTS.md`. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-baseline/command.json`, `codex-guided/command.json`, and their `metrics.json` files.
- The guided result summaries explicitly report creating `verification.txt`; the baseline summaries report only the implementation and passing test. Evidence: the four `result.txt` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.
- Both Codex stderr logs contain non-fatal rollout state-database discrepancy warnings, while the Claude stderr logs are empty; both Codex cases still recorded agent and verifier exit 0. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{codex-baseline,codex-guided}/stderr.log`, `{claude-baseline,claude-guided}/stderr.log`, and the four `metrics.json` files.

## External facts

These are source claims recorded by the research stage, not observations produced by this experiment:

- Anthropic's official documentation is recorded as saying that project instructions may live in root `CLAUDE.md`, are loaded at launch, and that `claude -p` is non-interactive; the same research notes that `--bare` and `--safe-mode` suppress `CLAUDE.md`. Evidence: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`, citing `https://code.claude.com/docs/en/memory`, `https://code.claude.com/docs/en/headless`, and `https://code.claude.com/docs/en/cli-reference`, accessed 2026-08-11.
- OpenAI's official documentation is recorded as saying that Codex builds a project instruction chain including `AGENTS.md` and that `codex exec` is the non-interactive entry point. Evidence: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`, citing `https://learn.chatgpt.com/docs/agent-configuration/agents-md` and `https://learn.chatgpt.com/docs/non-interactive-mode`, accessed 2026-08-11.

## Interpretation

The within-provider contrast matches the predeclared ablation exactly: adding the relevant root guidance file coincided with the exact extra marker output, while the shared unmentioned implementation task succeeded in both baseline and guided cases. Because all four conjunctive assertions passed and the diffs stayed inside the declared boundary, the recorded evidence confirms the claim for this fixture, these commands, these CLI versions, and these individual runs. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided,codex-baseline,codex-guided}/metrics.json`, `verify.log`, and `diff.patch`.

The result supports drafting a narrowly scoped how-to because it provides a reproducible positive ablation for both products with deterministic checks. It does not justify claims that instruction files are enforcement mechanisms or that either agent will comply on every run.

## Alternative explanations

- The marker is behavioral evidence of the guidance file's effect, not a direct trace of the products' internal instruction-injection mechanism. However, the marker was absent from the shared prompt, appeared only in both guided workspaces, and matched the supplied guidance text, making project-file processing the strongest explanation within the declared design. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; both guidance files under `fixtures/agent-practice/guidance/`; the four case `diff.patch` and `metrics.json` files.
- A stochastic agent could obey in these guided samples and fail later. One execution per case establishes this observed boundary but not a compliance rate. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`.
- The resolved backend models were CLI defaults and were not recorded as exact snapshots, so unrecorded backend variation may affect replication even with the same CLI versions. Evidence: all four case `metrics.json` files; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`.

## Limitations

- There was one sample per case; no instruction-following rate, variance, or comparative quality claim can be inferred. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`.
- Exact backend model snapshots and effort were not resolved because every manifest override was `null`. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; the four case `metrics.json` files.
- The evidence covers only root-level guidance, the recorded isolated fixture, ordinary `claude -p` without `--bare`/`--safe-mode`, the recorded `codex exec` flags, and the installed CLI versions. It does not test nested precedence, override files, fallback names, truncation, interactive mode, or other host configurations. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`; the four case `command.json` files.
- The test validates the marker and file boundaries, not internal context contents or an instruction-loading API trace. Evidence: the `verification` object in `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; the four case `metrics.json`, `verify.log`, and `diff.patch` files.
- The Codex state-database warnings were reproducible in both Codex cases but were not investigated because they did not cause a nonzero exit or verifier failure. Evidence: both Codex `stderr.log` and `metrics.json` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.

## Reusable recipe

Use this only as the successful recorded fixture recipe, not as a general safety template:

1. Create a fresh disposable copy of `fixtures/agent-practice/instruction-loading`. Evidence that fresh copies were the declared setup: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`.
2. For the guided Claude case, place the recorded `fixtures/agent-practice/guidance/claude/CLAUDE.md` at the case root; for the guided Codex case, place the recorded `fixtures/agent-practice/guidance/codex/AGENTS.md` at the case root. Both successful guidance files required changing only `src/greet.js`, running `node test.mjs`, then writing exactly `AGENT_RULE_APPLIED` to `verification.txt`. Evidence: the two guidance files and the guided `metrics.json` files.
3. Use the shared recorded prompt: `Implement src/greet.js so greet(name) returns exactly Hello, <name>! for the existing tests. Run node test.mjs and finish only after it passes.` Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json` and all four `command.json` files.
4. The successful Claude configuration used `claude -p`, stream JSON, verbose mode, no session persistence, project setting sources, bypass permissions, and only `Read,Edit,Write,Bash` tools. The successful Codex configuration used `codex -a never exec --ephemeral --ignore-user-config --ignore-rules --sandbox workspace-write --skip-git-repo-check`, the isolated case as `-C`, disabled workspace network access, JSON output, and no model or effort override. Evidence: the guided case `command.json` and `metrics.json` files.
5. Run `node test.mjs`, compare the final workspace with its post-setup input, require no protected or unexpected changes, and assert marker absence for baselines and exact marker presence for guided cases. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`; the four `verify.log`, `diff.patch`, and `metrics.json` files.

## Unsafe or unsupported variants

- Do not reuse Claude `--permission-mode bypassPermissions` outside a disposable, isolated, tightly scoped workspace; this run's safety depended on its bounded fixture and declared isolation. Evidence for the recorded flag and isolation: both Claude `command.json` files and `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`.
- `--bare`, `--safe-mode`, nested instruction precedence, `AGENTS.override.md`, fallback filenames, truncation, interactive sessions, repeated-run reliability, and user-level configuration interactions were not tested. Evidence: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`; `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`.
- Do not infer that a missing marker in another run proves the instruction file was never discovered; model noncompliance is an alternative. Evidence: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`.
- Do not compare provider speed, cost, quality, or reliability from the recorded durations or outputs; the design had one sample per case and was not a performance comparison. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; the four case `metrics.json` files.

## Article-safe facts

- In the recorded Claude Code 2.1.227 ablation, the baseline marker was absent and the root-`CLAUDE.md` guided case produced exactly `AGENT_RULE_APPLIED`; both agent and verifier exits were 0, and changes stayed within the allowed set. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided}/metrics.json`, `verify.log`, and `diff.patch`.
- In the recorded Codex CLI 0.147.0 ablation, the baseline marker was absent and the root-`AGENTS.md` guided case produced exactly `AGENT_RULE_APPLIED`; both agent and verifier exits were 0, and changes stayed within the allowed set. Evidence: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{codex-baseline,codex-guided}/metrics.json`, `verify.log`, and `diff.patch`.
- Across all four recorded cases, `node test.mjs` passed, protected files were unchanged, and no unexpected paths changed. Evidence: all four case `verify.log` and `metrics.json` files under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.
- The defensible conclusion is limited to a successful single-run project-root instruction-loading ablation under the recorded settings, not a reliability or performance guarantee. Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`.
