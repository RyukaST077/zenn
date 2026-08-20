# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.json`
- Plan: `practice/agent/agent-practice-claude-max-turns-subagent-boundary-20260818-0508.md`
- Research: `research/agent/agent-knowhow-claude-max-turns-subagent-budget-boundary-20260818-0503.md`
- Claim: With Claude Code 2.1.227, a parent capped at --max-turns 1 can complete one explicitly requested inline custom subagent before ending with error_max_turns, while whole-tree modelUsage output tokens exceed parent-only usage output tokens, so the top-level turn cap is not a whole-tree spend ceiling.
- Mode: `boundary`
- Started: 2026-08-17T20:13:21.180Z
- Finished: 2026-08-17T20:13:30.112Z

## Environment

- claude: `2.1.227 (Claude Code)`
- Authentication was checked through CLI status commands; credential files were not read.
- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| parent-one-turn-child-one-turn | claude | fixture-wrapper | passed | 0 | 4451 | 1 | - | none | none | no |

## Recorded observations

- `parent-one-turn-child-one-turn`: exit=0, verifier=1, marker=null, changed=1, passed=false.

## Evidence inventory

- `logs/agent/run-claude-max-turns-subagent-boundary-20260818-0508-20260818-051321/parent-one-turn-child-one-turn/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.

## Deviations and failures

- `parent-one-turn-child-one-turn` did not satisfy all manifest assertions; see its metrics and raw evidence.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `parent-one-turn-child-one-turn`, the recorded verifier exit code was 1 and the marker observation was null.
