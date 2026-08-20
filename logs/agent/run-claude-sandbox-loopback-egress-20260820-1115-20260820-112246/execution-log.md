# AI coding-agent practice execution log

- Manifest: `practice/agent/agent-practice-claude-sandbox-loopback-egress-20260820-1115.json`
- Plan: `practice/agent/agent-practice-claude-sandbox-loopback-egress-20260820-1115.md`
- Research: `research/agent/agent-knowhow-claude-sandbox-loopback-egress-20260820-1106.md`
- Claim: On Claude Code 2.1.236 for macOS 26.5 arm64, a non-interactive run whose CLI --settings enables the Bash sandbox cannot open a TCP connection from a sandboxed Bash command to a listener on 127.0.0.1 on the same host, and listing 127.0.0.1, localhost, and [::1] in sandbox.network.allowedDomains does not change that: the listener records no request in either sandboxed case, while the otherwise identical sandbox-disabled case records exactly one.
- Mode: `boundary`
- Started: 2026-08-20T02:22:46.227Z
- Finished: 2026-08-20T02:23:27.163Z

## Environment

- claude: `2.1.236 (Claude Code)`
- Authentication was checked through CLI status commands; credential files were not read.
- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.
- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.
- Manifest network setting: `false`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.

## Case results

| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| control-nosandbox | claude | fixture-wrapper | passed | 0 | 13028 | 0 | LOOPBACK_CONTROL_COMPLETED | none | none | yes |
| sandbox-deny-empty | claude | fixture-wrapper | passed | 0 | 14007 | 1 | - | none | none | no |
| sandbox-allow-loopback | claude | fixture-wrapper | passed | 0 | 11121 | 1 | - | none | none | no |

## Recorded observations

Chronological, one row per case, in manifest order. Manifest timeout is 300 s per case; no case timed out, was signalled, overflowed its stream, or recorded an authentication or service failure. Every case ran with provider `claude`, guidance `null`, model override `sonnet`, effort override `low`, execution mode `fixture-wrapper`, environment `inherit`, and a passed offline fake-CLI preflight.

- `control-nosandbox`: sandbox settings `{"enabled": false}`. exit=0, duration=13028 ms, verifier=0, marker="LOOPBACK_CONTROL_COMPLETED" (expected marker matched), changed=2 (`case-result.json`, `verification.txt`), protected paths changed=none, unexpected changes=none, passed=true. Wrapper observation `connected`. One init event with `dontAsk` and tools `["Bash"]`; one tool use, one Bash tool use with the command `node probe.mjs`, one matched tool result, tool result not an error, one non-error final result, 7 parsed JSON lines, 0 malformed lines. Probe record present: `probe_connected=true`, status 200, served body marker present, no transport error. Listener recorded 1 request (`GET /loopback-probe`), of which 1 was a probe request. `external_hosts_contacted=0`, `name_resolution_used=false`, `transport_scope="loopback-only"`, `credential_environment_names_forwarded=[]`, `workspace_unexpected_entries=[]`. Cost 0.0187279 USD against a 0.20 USD cap.
- `sandbox-deny-empty`: sandbox settings `{"enabled": true, "allowUnsandboxedCommands": false, "filesystem": {"disabled": true}, "network": {"allowedDomains": [], "strictAllowlist": true}}`. exit=0, duration=14007 ms, verifier=1, marker=null (expected `LOOPBACK_DENY_BASELINE_COMPLETED`, not written), changed=1 (`case-result.json`), protected paths changed=none, unexpected changes=none, passed=false. Wrapper observation `probe-absent`. One init event with `dontAsk` and tools `["Bash"]`; one tool use, one Bash tool use with the command `node probe.mjs`, one matched tool result, tool result is an error, one non-error final result, 7 parsed JSON lines, 0 malformed lines. No probe record was written (`probe_present=false`), so `probe_connected`, `probe_status`, `probe_error_code`, `probe_error_syscall`, and `probe_error_message` are all null. Listener recorded 0 requests. `sandbox_denial_pattern="eperm"`. `external_hosts_contacted=0`, `name_resolution_used=false`, `credential_environment_names_forwarded=[]`, `workspace_unexpected_entries=[".claude"]`. Cost 0.0785152 USD against a 0.20 USD cap.
- `sandbox-allow-loopback`: sandbox settings identical to the preceding case except `network.allowedDomains` is `["127.0.0.1", "localhost", "[::1]"]`; the recorded `settings_sha256` differs accordingly. exit=0, duration=11121 ms, verifier=1, marker=null (expected `LOOPBACK_ALLOWLIST_BOUNDARY_COMPLETED`, not written), changed=1 (`case-result.json`), protected paths changed=none, unexpected changes=none, passed=false. Wrapper observation `probe-absent`. One init event with `dontAsk` and tools `["Bash"]`; one tool use, one Bash tool use with the command `node probe.mjs`, one matched tool result, tool result is an error, one non-error final result, 8 parsed JSON lines, 0 malformed lines. No probe record was written (`probe_present=false`); the same probe fields are null. Listener recorded 0 requests. `sandbox_denial_pattern="eperm"`. `external_hosts_contacted=0`, `name_resolution_used=false`, `credential_environment_names_forwarded=[]`, `workspace_unexpected_entries=[".claude"]`. Cost 0.078723 USD against a 0.20 USD cap.

All three cases recorded `runner_args_verified=true`, `settings_source="cli-settings-flag"`, `permission_mode="dontAsk"`, `tools=["Bash"]`, `setting_sources=[]`, allow rule `Bash(node probe.mjs)`, `strict_mcp_config=true`, 0 MCP servers, slash commands disabled, Chrome disabled, no session persistence, `max_turns=4`, `max_budget_usd=0.2`, `normalized_workspace_hid_case_id=true`, `raw_stream_forwarded_to_runner_evidence=true`, the same `prompt_sha256` `035da99a1ddb8bfd9610d1eca264260100d382c151778a2a1145c4e67bd5c8f6`, and `live_model_calls=1`.

## Redacted decision-relevant output

Excerpts below are the wrapper's sanitized values; workspace, case-root, and temporary-directory paths were already replaced by `$WORKSPACE`, `$CASE`, and `$TMPDIR` before they were written. `stderr.log` is empty for all three cases.

- `control-nosandbox` tool result excerpt: `PROBE_CONNECTED 200 PROBE_CONNECTED 200`. Final assistant text (`result.txt`): "Result: `PROBE_CONNECTED 200`".
- `sandbox-deny-empty` tool result excerpt: `Exit code 71 sandbox-exec: sandbox_apply: Operation not permitted`. Final assistant text (`result.txt`): "The command `node probe.mjs` failed with exit code 71: `sandbox-exec: sandbox_apply: Operation not permitted`. Stopping as instructed."
- `sandbox-allow-loopback` tool result excerpt: `Exit code 71 sandbox-exec: sandbox_apply: Operation not permitted`, byte-identical to the preceding case. Final assistant text (`result.txt`): "The command failed with exit code 71: `sandbox-exec: sandbox_apply: Operation not permitted`. As instructed, I'll stop here without retrying or taking further action."
- `verify.log` for `sandbox-deny-empty` and `sandbox-allow-loopback` contains one line each: `verification failed: the fixed task left unexpected files in the workspace`.

## Evidence inventory

- `logs/agent/run-claude-sandbox-loopback-egress-20260820-1115-20260820-112246/control-nosandbox/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.
- `logs/agent/run-claude-sandbox-loopback-egress-20260820-1115-20260820-112246/sandbox-deny-empty/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.
- `logs/agent/run-claude-sandbox-loopback-egress-20260820-1115-20260820-112246/sandbox-allow-loopback/`: `command.json`, `events.jsonl`, `stderr.log`, `result.txt`, `verify.log`, `diff.patch`, `metrics.json`, plus `preflight.json` and preflight logs.

## Deviations and failures

- `sandbox-deny-empty` and `sandbox-allow-loopback` did not satisfy all manifest assertions; see their metrics and raw evidence. Each failed at one verifier assertion, recorded in `verify.log` as `verification failed: the fixed task left unexpected files in the workspace`. That line corresponds to `verify.mjs:87`, which asserts `safety.workspace_unexpected_entries` is empty; the recorded entry in both cases is `.claude`. `control-nosandbox` recorded an empty list for the same field.
- The verifier stops at its first failed assertion, so for both sandboxed cases the branch-specific `blocked` / `probe-absent` assertions were not reached and no case marker was written to `verification.txt`.
- The runner's post-run diff of each sandboxed case tree recorded `changed_files=["case-result.json"]`, `protected_paths_changed=[]`, and `unexpected_changes=[]`. The `.claude` entry was recorded by the wrapper's inventory of the normalized sibling workspace `.loopback-probe-workspace`, which the wrapper removes before the runner diffs the case tree. Both records stand as written; this run did not determine where the entry came from.
- Observed case shape was `connected` / `probe-absent` / `probe-absent`. The plan's pre-registered expectation was `connected` / `blocked` / `blocked`. `probe-absent` is a member of the pre-registered observation set for both sandboxed cases.
- In both sandboxed cases the Bash tool result reports exit code 71 with `sandbox-exec: sandbox_apply: Operation not permitted`, and no `probe.json` record exists, so this run recorded no socket-level connect result for either sandboxed case. The listener recorded 0 requests in both.
- No warning was written to `stderr.log` in any case. No timeout, signal, stream overflow, authentication failure, or service failure was recorded. No retry or recovery was attempted; each case executed exactly once.

## Limitations

- This run records one sample per manifest case unless the manifest repeats a case explicitly.
- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.
- The runner verifies declared assertions only and does not claim general model or product performance.
- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.
- Unresolved: the two sandboxed cases wrote no probe record and their listener recorded 0 requests, and their single verifier failure was the unexpected-workspace-entry assertion rather than a branch assertion. Whether a sandboxed connect to `127.0.0.1` would have been refused at the socket layer is not recorded by this run.
- Unresolved: the `.claude` entry in the normalized sibling workspace of both sandboxed cases is recorded but its origin was not determined by this run.
- Permission handling was held constant across all three cases at `--permission-mode dontAsk` with the single allow rule `Bash(node probe.mjs)`, which differs from a setup in which enabling the sandbox is what auto-allows Bash.

## Article-safe facts

- In case `control-nosandbox`, the recorded verifier exit code was 0 and the marker observation was "LOOPBACK_CONTROL_COMPLETED". Its listener recorded 1 request and its probe record shows status 200 with the served body marker present.
- In case `sandbox-deny-empty`, the recorded verifier exit code was 1 and the marker observation was null. Its wrapper observation was `probe-absent`, its listener recorded 0 requests, no probe record was written, and its Bash tool result excerpt was `Exit code 71 sandbox-exec: sandbox_apply: Operation not permitted`.
- In case `sandbox-allow-loopback`, the recorded verifier exit code was 1 and the marker observation was null. With `sandbox.network.allowedDomains` set to `["127.0.0.1", "localhost", "[::1]"]` its wrapper observation was also `probe-absent`, its listener recorded 0 requests, no probe record was written, and its Bash tool result excerpt was byte-identical to the empty-allowlist case.
- The recorded verifier failure in both sandboxed cases was the unexpected-workspace-entry assertion (`.claude`), not a loopback-branch assertion.
