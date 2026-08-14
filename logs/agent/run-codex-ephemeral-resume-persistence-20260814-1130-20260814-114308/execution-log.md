# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`
- Plan: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`
- Research: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`
- Claim: With locally installed Codex CLI 0.147.0, one successful codex exec resume of an exact persisted session with --ephemeral appends the harmless resumed turn to that session's existing rollout: its SHA-256 and byte size change, its line count does not decrease, its prior bytes remain an unchanged prefix, and the unique resume marker appears in appended bytes.
- Mode: `boundary`
- Started: 2026-08-14T02:43:08.662Z
- Finished: 2026-08-14T02:43:22.257Z

## Environment

- codex: `codex-cli 0.147.0`
- Authentication was checked through CLI status commands; credential files were not read.
- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| codex-0147-ephemeral-resume | codex | fixture-wrapper | passed | 0 | 13018 | 0 | RESUME_PERSISTENCE_BOUNDARY_OBSERVED | none | none | yes |

## Recorded observations

- `codex-0147-ephemeral-resume`: exit=0, verifier=0, marker="RESUME_PERSISTENCE_BOUNDARY_OBSERVED", changed=2, passed=true.

## Evidence inventory

- `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.

## Deviations and failures

- None recorded by the deterministic runner.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `codex-0147-ephemeral-resume`, the recorded verifier exit code was 0 and the marker observation was "RESUME_PERSISTENCE_BOUNDARY_OBSERVED".
