# Project instruction loading ablation plan

## Source and claim

- Source report: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`
- Claim: With the locally installed current CLIs, ordinary non-interactive runs on isolated copies of the instruction-loading fixture load their product-native project-root instructions: the supplied root `CLAUDE.md` makes the Claude guided case create `verification.txt` with `AGENT_RULE_APPLIED`, and the supplied root `AGENTS.md` does the same for Codex, while each matched no-guidance baseline leaves the marker absent.
- Mode: `ablation`
- Target providers: Claude Code and Codex CLI
- Authoritative execution specification: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`

## Fixture and controlled task

- Fixture: `fixtures/agent-practice/instruction-loading`
- The fixture begins with `src/greet.js` throwing an error.
- Exact shared prompt: `Implement src/greet.js so greet(name) returns exactly Hello, <name>! for the existing tests. Run node test.mjs and finish only after it passes.`
- Deterministic verifier: `node test.mjs`
- Protected paths: `test.mjs`, `package.json`
- Allowed changes: `src/greet.js`, `verification.txt`
- Marker file: `verification.txt`

The implementation prompt deliberately does not mention `verification.txt` or the marker. Therefore the only controlled difference within each provider pair is whether its product-native root guidance file is copied into the isolated fixture before the run.

## Cases

| Case | Provider | Guidance copied to fixture root | Model | Effort | Expected marker |
|---|---|---|---|---|---|
| `claude-baseline` | Claude | none | CLI default | CLI default | absent (`null`) |
| `claude-guided` | Claude | `fixtures/agent-practice/guidance/claude/CLAUDE.md` | CLI default | CLI default | `AGENT_RULE_APPLIED` |
| `codex-baseline` | Codex | none | CLI default | CLI default | absent (`null`) |
| `codex-guided` | Codex | `fixtures/agent-practice/guidance/codex/AGENTS.md` | CLI default | CLI default | `AGENT_RULE_APPLIED` |

Run each case exactly once in a fresh temporary copy. Do not retry a failed or timed-out case automatically.

## CLI settings

The runner performs non-mutating authentication status and version checks before the cases. It then uses these non-interactive settings:

- Claude: `claude -p <prompt> --output-format stream-json --verbose --no-session-persistence --setting-sources project --permission-mode bypassPermissions --tools Read,Edit,Write,Bash`. Do not add `--bare`, `--safe-mode`, `--model`, or `--effort`.
- Codex: `codex -a never exec --ephemeral --ignore-user-config --ignore-rules --sandbox workspace-write --skip-git-repo-check -C <isolated-case-directory> -c sandbox_workspace_write.network_access=false --json -o <result-file> <prompt>`. Do not add `--model` or `model_reasoning_effort`.
- Model and effort are intentionally `null` in every manifest case so both CLIs resolve their defaults.
- Per-case timeout: 300 seconds. The verifier is additionally capped by the runner at 60 seconds.
- Network policy: disabled inside experiment cases. Model transport required by the CLI is not treated as task-initiated network access; the agent must not use case tools to access the network.

## Assertions and expected observations

Every case must meet all of these assertions:

1. The agent process exits successfully before the timeout.
2. `node test.mjs` exits with code 0 and reports that both exact greeting assertions pass.
3. Neither `test.mjs` nor `package.json` changes.
4. No path outside `src/greet.js` and `verification.txt` changes.
5. The observed marker equals the case's `expected_marker`: absent in both baselines and exactly `AGENT_RULE_APPLIED` in both guided cases.

Expected changed paths are `src/greet.js` for each baseline and `src/greet.js` plus `verification.txt` for each guided case. The exact implementation text in `src/greet.js` is not compared across products; only the deterministic verifier and path boundaries are authoritative.

## Success and failure criteria

The conjunctive claim is supported only if all four cases pass every assertion. It is not reproduced if either guided case lacks the exact marker or either baseline creates a marker, even when the code verifier passes. A timeout, unavailable authentication, CLI/status failure, verifier failure, protected-path change, unexpected change, or inability to guarantee redaction prevents a clean confirmation and must be recorded as a failed or inconclusive run rather than retried.

## Isolation, credentials, cost, redaction, and cleanup

- Execute only through the repository runner on fresh temporary copies of the fixture; never use the repository root as an agent-writable case directory.
- Do not install dependencies, perform Git operations, publish, contact external services, or access production systems.
- Do not read, copy, print, or persist credential files. Record only sanitized authentication success/failure and CLI version output.
- Redact credentials, tokens, user-specific paths, and other sensitive values from command records, JSONL, stderr, verifier output, diffs, results, metrics, and summaries.
- Cost limit: four agent invocations total, one for each declared case, using CLI-default model and effort; no automatic repeats.
- Preserve redacted evidence and final case workspaces under the runner's ignored log directory, then remove the temporary working root in the runner cleanup path.

## Limitations and expected article value

This is one behavioral sample per case, not an instruction-following-rate estimate or a quality comparison. A missing marker cannot alone distinguish instruction discovery failure from model noncompliance. Results apply only to the recorded local CLI versions, ordinary non-interactive entry points, this root-level fixture, and the declared isolation settings; they do not cover nested precedence, override files, fallback names, truncation, Claude `--bare`/`--safe-mode`, or other host configurations.

If all four cases pass, the evidence can support a narrowly scoped article showing a reproducible project-root instruction-loading ablation for Claude Code and Codex, including the deterministic checks and boundaries needed to avoid overclaiming.
