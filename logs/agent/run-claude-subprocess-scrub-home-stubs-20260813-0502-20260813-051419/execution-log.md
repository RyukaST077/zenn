# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json`
- Plan: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.md`
- Research: `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`
- Claim: With Claude Code 2.1.227 on macOS 26.5 arm64, one network-denied non-interactive startup with a fresh HOME containing a non-empty .profile creates an exactly empty .bash_profile only when CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 is present, preserving .profile but hiding its marker from a later bash -lc.
- Mode: `boundary`
- Started: 2026-08-12T20:14:19.851Z
- Finished: 2026-08-12T20:14:31.859Z

## Environment

- claude: `2.1.227 (Claude Code)`
- Authentication was checked through CLI status commands; credential files were not read.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Guidance | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---:|---:|---:|---|---|---|---|
| scrub-unset-control | claude | - | 0 | 4512 | 1 | - | none | none | no |
| scrub-enabled-treatment | claude | - | 0 | 4399 | 1 | - | none | none | no |

## Recorded observations

- `scrub-unset-control`: exit=0, verifier=1, marker=null, changed=0, passed=false.
- `scrub-enabled-treatment`: exit=0, verifier=1, marker=null, changed=0, passed=false.

## Evidence inventory

- `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-unset-control/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`
- `logs/agent/run-claude-subprocess-scrub-home-stubs-20260813-0502-20260813-051419/scrub-enabled-treatment/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`

## Deviations and failures

- `scrub-unset-control` did not satisfy all manifest assertions; see its metrics and raw evidence.
- `scrub-enabled-treatment` did not satisfy all manifest assertions; see its metrics and raw evidence.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `scrub-unset-control`, the recorded verifier exit code was 1 and the marker observation was null.
- In case `scrub-enabled-treatment`, the recorded verifier exit code was 1 and the marker observation was null.
