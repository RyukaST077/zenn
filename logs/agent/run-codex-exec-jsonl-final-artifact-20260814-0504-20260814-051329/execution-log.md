# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`
- Plan: `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`
- Research: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`
- Claim: With locally installed Codex CLI 0.147.0, one successful schema-constrained turn with two ordered harmless reads emits schema-valid progress agent messages before its final agent message, while -o equals only that last message, so accepting the first schema-valid JSONL agent_message is premature.
- Mode: `boundary`
- Started: 2026-08-13T20:13:29.663Z
- Finished: 2026-08-13T20:13:44.240Z

## Environment

- codex: `codex-cli 0.147.0`
- Authentication was checked through CLI status commands; credential files were not read.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Guidance | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---:|---:|---:|---|---|---|---|
| two-read-finality-boundary | codex | - | 0 | 13808 | 1 | - | none | none | no |

## Recorded observations

- `two-read-finality-boundary`: exit=0, verifier=1, marker=null, changed=0, passed=false.

## Evidence inventory

- `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`

## Deviations and failures

- `two-read-finality-boundary` did not satisfy all manifest assertions; see its metrics and raw evidence.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `two-read-finality-boundary`, the recorded verifier exit code was 1 and the marker observation was null.
