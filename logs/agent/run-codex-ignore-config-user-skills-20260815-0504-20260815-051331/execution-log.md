# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-codex-ignore-config-user-skills-20260815-0504.json`
- Plan: `practice/agent/agent-practice-codex-ignore-config-user-skills-20260815-0504.md`
- Research: `research/agent/agent-knowhow-codex-ignore-config-user-skills-20260815-0504.md`
- Claim: With Codex CLI 0.147.0, an exec run using both --ignore-user-config and --ignore-rules still discovers and explicitly invokes an instruction-only skill placed only under a disposable HOME at .agents/skills, returning its hidden marker while a matched empty-home control returns no marker; therefore the two flags alone are not a skill-hermetic boundary.
- Mode: `boundary`
- Started: 2026-08-14T20:13:31.021Z
- Finished: 2026-08-14T20:13:46.287Z

## Environment

- codex: `codex-cli 0.147.0`
- Authentication was checked through CLI status commands; credential files were not read.
- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| matched-home-skill-boundary | codex | fixture-wrapper | passed | 0 | 13548 | 0 | AMBIENT_USER_SKILL_BOUNDARY_OBSERVED | none | none | yes |

## Recorded observations

- `matched-home-skill-boundary`: exit=0, verifier=0, marker="AMBIENT_USER_SKILL_BOUNDARY_OBSERVED", changed=6, passed=true.

## Evidence inventory

- `logs/agent/run-codex-ignore-config-user-skills-20260815-0504-20260815-051331/matched-home-skill-boundary/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.

## Deviations and failures

- None recorded by the deterministic runner.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.

## Article-safe facts

- In case `matched-home-skill-boundary`, the recorded verifier exit code was 0 and the marker observation was "AMBIENT_USER_SKILL_BOUNDARY_OBSERVED".
