# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.json`
- Plan: `practice/agent/agent-practice-codex-pretooluse-fail-open-20260812-0503.md`
- Research: `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md`
- Claim: With locally installed Codex CLI 0.147.0, the same exact model-requested Bash marker command dispatches a project-local PreToolUse hook in two isolated codex exec cases: unsupported top-level continue false permits exact effect.txt content TOOL_RAN, while hookSpecificOutput permissionDecision deny prevents effect.txt from being created.
- Mode: `boundary`
- Started: 2026-08-11T20:10:00.509Z
- Finished: 2026-08-11T20:10:22.795Z

## Environment

- codex: `codex-cli 0.147.0`
- Authentication was checked through CLI status commands; credential files were not read.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Guidance | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---:|---:|---:|---|---|---|---|
| generic-stop-fail-open | codex | - | 0 | 11427 | 1 | - | none | none | no |
| specific-deny-block | codex | - | 0 | 9987 | 1 | - | none | none | no |

## Recorded observations

- `generic-stop-fail-open`: exit=0, verifier=1, marker=null, changed=1, passed=false.
- `specific-deny-block`: exit=0, verifier=1, marker=null, changed=1, passed=false.

## Evidence inventory

- `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/generic-stop-fail-open/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`
- `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/specific-deny-block/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`

## Deviations and failures

- `generic-stop-fail-open` did not satisfy all manifest assertions; see its metrics and raw evidence.
- `specific-deny-block` did not satisfy all manifest assertions; see its metrics and raw evidence.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `generic-stop-fail-open`, the recorded verifier exit code was 1 and the marker observation was null.
- In case `specific-deny-block`, the recorded verifier exit code was 1 and the marker observation was null.
