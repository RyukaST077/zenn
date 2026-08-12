# Project instruction loading: evidence analysis and editorial brief

verdict: confirmed
action: draft

## Evidence analysis

### Claim and conditions

The recorded four-case ablation confirmed its narrow behavioral claim: in one non-interactive run per case, adding the product-native project-root instruction file caused the guided Claude Code and Codex cases to create `verification.txt` containing exactly `AGENT_RULE_APPLIED`, while the matched baselines did not create the file. All four implementation verifiers passed, protected paths were unchanged, and no unexpected paths changed.

Evidence:

- `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided,codex-baseline,codex-guided}/metrics.json`
- the four corresponding `verify.log` and `diff.patch` files

The recorded environment was Claude Code `2.1.227 (Claude Code)` and Codex CLI `0.147.0`. Model and effort overrides were `null`, so the exact resolved backend model snapshots were not recorded. Each case ran once in a fresh fixture copy with a 300-second timeout and the same implementation prompt.

Evidence:

- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`
- `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- the four case `command.json` and `metrics.json` files

### Case matrix

| Case | Root guidance | Agent / verifier exit | Marker | Changed paths | Protected / unexpected | Evidence |
|---|---|---:|---|---|---|---|
| `claude-baseline` | none | 0 / 0 | absent | `src/greet.js` | none / none | `claude-baseline/metrics.json`, `verify.log`, `diff.patch` |
| `claude-guided` | `CLAUDE.md` | 0 / 0 | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | none / none | `claude-guided/metrics.json`, `verify.log`, `diff.patch` |
| `codex-baseline` | none | 0 / 0 | absent | `src/greet.js` | none / none | `codex-baseline/metrics.json`, `verify.log`, `diff.patch` |
| `codex-guided` | `AGENTS.md` | 0 / 0 | `AGENT_RULE_APPLIED` | `src/greet.js`, `verification.txt` | none / none | `codex-guided/metrics.json`, `verify.log`, `diff.patch` |

All relative evidence paths in this table are under `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/`.

### Deterministic results and observed facts

- Every `verify.log` contains `PASS: greet returns the required message`; every `metrics.json` records verifier exit `0` and `passed: true`. Evidence: the four case `verify.log` and `metrics.json` files.
- Every diff changes `src/greet.js` from throwing the fixture error to returning ``Hello, ${name}!``. Evidence: the four case `diff.patch` files.
- Only the two guided diffs add `verification.txt`, and both contain exactly `AGENT_RULE_APPLIED`. Evidence: `claude-guided/diff.patch` and `codex-guided/diff.patch`; both guided `metrics.json` files.
- The shared prompt mentions neither `verification.txt` nor `AGENT_RULE_APPLIED`; those requirements exist in the two guidance files. Evidence: the manifest, all four `command.json` files, `fixtures/agent-practice/guidance/claude/CLAUDE.md`, and `fixtures/agent-practice/guidance/codex/AGENTS.md`.
- The within-provider command arguments are the same between baseline and guided cases; the controlled difference is the guidance overlay copied before execution. Evidence: the four `command.json` files and their corresponding `metrics.json` guidance fields.
- Both Codex stderr logs contain state-database discrepancy warnings, but both processes and verifiers exited `0`. The warnings' general cause or harmlessness was not established. Evidence: `codex-baseline/stderr.log`, `codex-guided/stderr.log`, and both Codex `metrics.json` files.

### External facts

These are recorded source claims, not experimental observations:

- Anthropic documents project `CLAUDE.md` locations and launch-time loading at or above the working directory. It documents `claude -p` as non-interactive and says `--bare` and `--safe-mode` suppress `CLAUDE.md`. Evidence: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`, citing official Anthropic documentation accessed 2026-08-11.
- OpenAI documents construction of a project instruction chain including root `AGENTS.md` and describes `codex exec` as a non-interactive entry point. Evidence: the same research report, citing official OpenAI documentation accessed 2026-08-11.
- Anthropic documents `bypassPermissions` as disabling permission prompts and safety checks and recommends strong external isolation when it is used. Evidence: the 2026-08-11 source recheck recorded in `logs/agent/review-project-root-agent-instructions-20260811-1157.md`, citing `https://code.claude.com/docs/en/permission-modes`.

### Interpretation and alternative explanations

The strongest explanation within this ablation is that each product processed its project-root instruction file: the exact extra marker was absent from the common prompt and both baselines, present in both guidance files, and created only by both guided cases. This is behavioral evidence, not direct observation of an internal context or instruction-loading API.

Evidence: the manifest; the two guidance files; all four `command.json`, `metrics.json`, and `diff.patch` files.

A future missing marker would not by itself prove that the file was undiscovered because instruction following is stochastic and the files are guidance rather than an enforcement boundary. One sample per case also cannot estimate a compliance rate or compare provider quality.

Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`; `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/summary.json`.

### Comparison with the pre-registered expectation

The plan expected absent markers in both baselines, exact markers in both guided cases, passing tests, and no protected or unexpected changes. All of those expected observations occurred. There is therefore no evidence-backed surprise or changed prior belief to narrate. The article may describe the confirmed contrast and the practical verification method, but it must not claim the result was unexpected.

Evidence: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`; the four case `metrics.json`, `verify.log`, and `diff.patch` files.

### Limitations

- One run per case does not establish instruction-following reliability, variance, or provider superiority. Evidence: plan and `summary.json`.
- Exact backend model snapshots and effort were not resolved. Evidence: manifest and the four `metrics.json` files.
- Only root-level guidance in ordinary non-interactive mode was tested. Nested precedence, override files, fallback names, truncation, interactive mode, Claude `--bare`/`--safe-mode`, and repeated runs were not tested. Evidence: research report and plan.
- The test observes files and verifier outcomes, not internal context assembly. Evidence: manifest verification contract and case artifacts.
- The Claude commands used `bypassPermissions` on the host and did not enforce OS-level filesystem or network isolation. A disposable fixture and post-run diff are not a security boundary. Evidence: both Claude `command.json` files and the safety correction in `logs/agent/review-project-root-agent-instructions-20260811-1157.md`.
- The manifest's `network: false` setting was enforced by the recorded Codex sandbox configuration, not by an equivalent Claude host boundary. Evidence: both Codex and Claude `command.json` files; `scripts/agent-practice/run-experiment.mjs`.

### Reusable recipe present in the evidence

1. Keep the implementation prompt identical and omit the behavior used to detect project guidance.
2. Run a no-guidance baseline and a guided case in fresh fixture copies.
3. Put the detection requirement only in root `CLAUDE.md` or `AGENTS.md`.
4. Verify the normal task, marker presence or absence, protected paths, and unexpected changes.
5. Interpret the result as evidence for that run, not as enforcement or a reliability estimate.

Evidence: manifest, plan, both guidance files, and all four case artifacts.

The exact recorded Claude command is not a safe copyable default because it includes `bypassPermissions` without an OS-level isolation boundary. The article may show it only as a clearly labeled historical condition or move it to an audit section; it must not recommend it as the main recipe.

### Article-safe facts

- Under the recorded versions and settings, both guided cases created the exact marker and both matched baselines did not.
- All four cases passed `node test.mjs`, preserved protected files, and stayed within the allowed change set.
- The common prompt omitted the marker requirement, so the guided-only file change is useful behavioral evidence of the root instruction file's effect.
- The result is a single-run configuration-harness case study, not a performance, reliability, or direct internal-loading proof.

## Editorial brief

### Reader and problem

- Reader: an engineer running Claude Code or Codex non-interactively in CI, a script, or a local harness and placing repository-specific completion rules in `CLAUDE.md` or `AGENTS.md`.
- Problem: the file can exist and the task can finish, yet the engineer has no objective evidence that the project-specific rule affected the run. Official discovery documentation does not itself prove the behavior of a particular invocation.

### Article promise and takeaway

One-sentence promise:

> A matched baseline, a guidance-only observable condition, and changed-path checks let you verify whether `CLAUDE.md` or `AGENTS.md` affected a non-interactive run instead of trusting that the file was merely present.

One-sentence takeaway:

> Treat project instruction files as guidance to test behaviorally, not as an enforcement boundary.

### Coverage gap and article type

- Coverage gap filled: official sources describe where instructions are discovered; this run demonstrates a reproducible behavioral check and its interpretation boundary under recorded CLI conditions.
- Article type: `configuration-harness`.

### Why it matters in real work

A CI job can pass its main test while silently skipping a project-only completion step. The useful operational question is not just whether an instruction file exists, but whether a detectable requirement unique to that file appears without expanding the allowed change set.

This is an evidence-backed inference from the fixture design and observed results. It is not a claim that either product commonly skips instructions.

### Practical decision rule and mapping

Use this pattern when a project-specific agent rule has an objectively observable completion condition. Do not use the presence of `CLAUDE.md` or `AGENTS.md` alone as proof of compliance, and do not use the instruction file as a security control.

Map the fixture to real work as follows:

| Fixture signal | Real-work equivalent |
|---|---|
| `verification.txt` marker | generated artifact, migration, updated documentation, lint output, or another requirement unique to project guidance |
| `node test.mjs` | project test, build, type check, or deterministic verifier |
| protected paths | tests, policy files, lockfiles, or other files the agent must not rewrite |
| allowed changed paths | task-specific write scope |
| no-guidance baseline | the same task and CLI settings without the project instruction overlay |

### Evidence-led story arc

1. Open with the practical ambiguity: the main task can pass even when the project-only step is not observable.
2. Give the conclusion immediately: verify instruction files through behavior, not presence.
3. Show the minimal four-case design and explain why the common prompt omits the marker.
4. Show the result table and one compact baseline-versus-guided diff.
5. Explain what the evidence supports and what it cannot prove.
6. Convert the marker fixture into a small adoption pattern for real CI or harness work.
7. Put versions, exact recorded commands, safety boundaries, and untested variants in a later reproducibility section.
8. End with the decision rule: instruction file plus deterministic verifier and write boundary, never instruction file alone.

### Body evidence

- Common prompt and guidance-only marker requirement.
- Four-case result table from `execution-log.md` and case metrics.
- One representative baseline/guided diff showing marker absence versus presence.
- Protected and unexpected change results.
- Practical mapping table.
- One-run and behavioral-evidence interpretation boundaries.

### Later reproducibility or audit detail

- Full Claude and Codex flags.
- Exact versions, timeout, unresolved backend models, and run count.
- Claude `bypassPermissions` historical safety warning.
- Codex state-database warnings and intermediate non-Git exploration failure, if retained at all.
- Complete list of untested instruction-discovery variants.

### Candidate titles

1. `CLAUDE.mdとAGENTS.mdを「置いただけ」で終わらせない検証ハーネス`
2. `非対話CLIでCLAUDE.md / AGENTS.mdの効き目を行動で確かめる`
3. `AIエージェントの指示ファイルは効いた？baseline付きで検証する`

### Unsupported angles to avoid

- Claude CodeとCodexの性能、速度、コスト、品質、信頼性の比較。
- 毎回指示に従う、または指示ファイルが強制機構になるという主張。
- 内部コンテキストを直接観測したという主張。
- 正確なバックエンドモデルの再現性。
- 記録されていない筆者の驚き、困った体験、感情、導入実績。
- 記録したClaudeコマンドが安全な推奨テンプレートだという表現。
