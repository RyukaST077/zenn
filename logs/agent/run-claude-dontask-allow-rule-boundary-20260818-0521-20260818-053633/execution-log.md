# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-claude-dontask-allow-rule-boundary-20260818-0521.json`
- Plan: `practice/agent/agent-practice-claude-dontask-allow-rule-boundary-20260818-0521.md`
- Research: `research/agent/agent-knowhow-claude-dontask-broad-allow-rule-drop-20260818-0521.md`
- Claim: On Claude Code 2.1.227 for macOS arm64, a fresh non-interactive dontAsk run executes the fixed Bash command when permissions.allow contains its exact rule, but silently denies the same command when the only controlled change is the syntactically valid broad rule Bash(python3:*).
- Mode: `ablation`
- Started: 2026-08-17T20:36:33.191Z
- Finished: 2026-08-17T20:36:52.080Z

## Environment

- claude: `2.1.227 (Claude Code)`
- Authentication was checked through CLI status commands; credential files were not read.
- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| exact-rule-control | claude | fixture-wrapper | passed | 0 | 4853 | 1 | - | none | none | no |
| broad-wildcard-treatment | claude | fixture-wrapper | passed | 0 | 4309 | 1 | - | none | none | no |

## Recorded observations

- `exact-rule-control`: exit=0, verifier=1, marker=null, changed=1, passed=false.
- `broad-wildcard-treatment`: exit=0, verifier=1, marker=null, changed=1, passed=false.

## Evidence inventory

- `logs/agent/run-claude-dontask-allow-rule-boundary-20260818-0521-20260818-053633/exact-rule-control/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.
- `logs/agent/run-claude-dontask-allow-rule-boundary-20260818-0521-20260818-053633/broad-wildcard-treatment/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.

## Deviations and failures

- `exact-rule-control` did not satisfy all manifest assertions; see its metrics and raw evidence.
- `broad-wildcard-treatment` did not satisfy all manifest assertions; see its metrics and raw evidence.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `exact-rule-control`, the recorded verifier exit code was 1 and the marker observation was null.
- In case `broad-wildcard-treatment`, the recorded verifier exit code was 1 and the marker observation was null.
