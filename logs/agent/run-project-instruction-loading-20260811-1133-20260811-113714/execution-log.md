# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Plan: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.md`
- Research: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`
- Claim: On isolated copies of the instruction-loading fixture, ordinary non-interactive Claude and Codex runs load their supplied product-native project-root guidance and create verification.txt with AGENT_RULE_APPLIED only in the guided cases, while matched baselines leave the marker absent.
- Mode: `ablation`
- Started: 2026-08-11T02:37:14.900Z
- Finished: 2026-08-11T02:38:46.787Z

## Environment

- claude: `2.1.227 (Claude Code)`
- codex: `codex-cli 0.147.0`
- Authentication was checked through CLI status commands; credential files were not read.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.

## Case results

| Case | Provider | Guidance | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---:|---:|---:|---|---|---|---|
| claude-baseline | claude | - | 0 | 19862 | 0 | - | none | none | yes |
| claude-guided | claude | fixtures/agent-practice/guidance/claude/CLAUDE.md | 0 | 18430 | 0 | AGENT_RULE_APPLIED | none | none | yes |
| codex-baseline | codex | - | 0 | 24339 | 0 | - | none | none | yes |
| codex-guided | codex | fixtures/agent-practice/guidance/codex/AGENTS.md | 0 | 27697 | 0 | AGENT_RULE_APPLIED | none | none | yes |

## Recorded observations

- `claude-baseline`: exit=0, verifier=0, marker=null, changed=1, passed=true.
- `claude-guided`: exit=0, verifier=0, marker="AGENT_RULE_APPLIED", changed=2, passed=true.
- `codex-baseline`: exit=0, verifier=0, marker=null, changed=1, passed=true.
- `codex-guided`: exit=0, verifier=0, marker="AGENT_RULE_APPLIED", changed=2, passed=true.

## Evidence inventory

- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/claude-baseline/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/claude-guided/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-baseline/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`
- `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/codex-guided/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`

## Deviations and failures

- None recorded by the deterministic runner.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.

## Article-safe facts

- In case `claude-baseline`, the recorded verifier exit code was 0 and the marker observation was null.
- In case `claude-guided`, the recorded verifier exit code was 0 and the marker observation was "AGENT_RULE_APPLIED".
- In case `codex-baseline`, the recorded verifier exit code was 0 and the marker observation was null.
- In case `codex-guided`, the recorded verifier exit code was 0 and the marker observation was "AGENT_RULE_APPLIED".
