# Claude Code Bash sandbox egress to a same-host loopback listener: practice plan

## Source and reader decision

- Source report: `research/agent/agent-knowhow-claude-sandbox-loopback-egress-20260820-1106.md`
- Reader problem: a backend developer wants `sandbox.enabled: true` so Claude Code stops prompting for `npm test`, `pytest`, and `curl`, but those tests talk to a dev server or containerized dependency on `127.0.0.1`. After enabling the sandbox the tests start failing, and neither the official network-isolation section nor its Troubleshooting list mentions loopback, so the developer cannot separate a bad `allowedDomains` entry, an IPv6 notation problem, a listener bind-address problem, and a sandbox that simply does not pass loopback traffic.
- Promised decision: whether loopback-dependent local tests can run with the Bash sandbox enabled by listing loopback in `sandbox.network.allowedDomains`, or whether the only workable route is to keep those commands out of the sandbox (for example through `excludedCommands`) or move the dependency out of the sandboxed process — plus the exact failure text a reader can match against their own error.
- Likely article type: `failure` (a reproducible failure boundary), with a secondary configuration-harness character.
- Mode: `boundary`. Same provider, one control and two treatments.
- Provider: Claude only. The claim is about Claude Code's own OS-enforced Bash sandbox; a Codex arm would add cases without adding reader evidence, and the report already excluded product comparison.

## Claim and pre-registered outcomes

The falsifiable claim is that on Claude Code `2.1.236` / macOS 26.5 (25F71) arm64, three otherwise identical non-interactive runs of the fixed command `node probe.mjs` diverge only as follows: with the Bash sandbox disabled the fixture's loopback listener records exactly one request and the probe reads the served marker, while with the sandbox enabled the listener records no request at all — both when `sandbox.network.allowedDomains` is empty and when it lists `127.0.0.1`, `localhost`, and `[::1]`.

The primary oracle is the listener's own request record, which is a side effect independent of anything the model says. The secondary oracles are the probe's recorded transport error (`error_code`, `error_syscall`, message) and the classified denial pattern. The final assistant prose is never an oracle.

Registered per-case observations:

- `control-nosandbox`: only `connected`. Anything else means the fixture or oracle is broken, the verifier fails, and no conclusion is drawn from the run.
- `sandbox-deny-empty` and `sandbox-allow-loopback`: `blocked`, `intercepted`, `probe-absent`, or `connected`.

Pre-registered readings, decided at the later analysis stage:

- Expected outcome: `connected` / `blocked` / `blocked`. This supports the claim and the recommendation that loopback-dependent tests are not fixable through `allowedDomains`; because `allowUnsandboxedCommands` is `false` in both sandboxed cases, the documented `dangerouslyDisableSandbox` retry cannot rescue such a job, so the operational answer is to list those commands in `excludedCommands` or to move the dependency out of the sandboxed process.
- Decisive competing outcome: `connected` / `blocked` / `connected`. The claim is refuted, loopback *is* openable through the allowlist, and the article instead publishes the working notation together with the fact that the empty-allowlist case proves the entry was what mattered.
- Sandbox-not-engaged outcome: `connected` / `connected` / `connected`. The controlled launch failed to put the command under network isolation, so the run says nothing about loopback. This is reported as a harness finding, not as a verdict on the claim.
- `intercepted` (probe completed but the listener saw nothing) would show a proxy answering in place of the listener, and would change the article's mechanism explanation from "socket refused" to "request answered by the allowlist proxy".
- `probe-absent` (the command produced no record) keeps only the tool-result text as evidence; the article may then report the observed error text but must not claim a socket-level verdict.

Any other shape — absent or altered Bash request, more than one tool use, unmatched tool result, missing final result, version drift, authentication or service failure, malformed stream, cost above the cap, or unexpected workspace files — is inconclusive and fails without retry. The per-case markers only mean the case reached a registered evidence boundary; they do not themselves decide the claim.

## Fixture and practical mapping

No existing fixture under `fixtures/agent-practice/` fits. The Codex fixtures test a different product; `claude-max-turns-subagent-boundary`, `claude-dontask-allow-rule-boundary`, and `claude-subprocess-scrub-home-stubs` each own an unrelated claim (turn budget, permission-rule matching, subprocess environment scrubbing) and none can host a loopback listener or inject sandbox settings without distorting its own claim. Bending a shared fixture was rejected. A new minimal fixture is created at `fixtures/agent-practice/claude-sandbox-loopback-egress/`:

- `claude-sandbox-loopback-wrapper.mjs` — executable launch adapter selected by all three cases. It validates the stock runner arguments, pins the CLI version, hosts the loopback listener outside the sandbox, writes the target descriptor, injects exactly one inline sandbox profile through the CLI `--settings` source, runs one non-interactive case, forwards the raw stream to runner evidence, and writes normalized observations to `case-result.json`.
- `preflight-claude.mjs` — executable offline fake CLI. It imports no network module and makes no provider, authentication, model, or paid request.
- `probe.mjs` — the sandboxed command under test: one HTTP GET pinned to the `127.0.0.1` literal, no name resolution, no proxy use, and a hard refusal of any non-loopback target. It always exits 0 so a refusal is recorded rather than retried.
- `verify.mjs` — dependency-free deterministic verifier with an objective exit status and a case-specific completion marker.
- `README.md` — the fixture's own boundary description.

The fixture needs only the Node.js runtime already present in this repository environment and an already-authenticated Claude CLI. It installs nothing and contains no secret, symlink, user data, daemon, browser flow, production state, or stored run output. The live cases necessarily use existing Claude authentication and the Claude model endpoint; the fixture never reads, copies, lists, hashes, prints, or relocates credential material, and missing authentication is a stop condition rather than permission to log in.

Practical mapping: the fixture's listener stands in for the reader's `vite dev` port, Dockerized Postgres on 5432, or LocalStack on 4566. What is measured is not HTTP semantics but whether a sandboxed child process can complete a TCP connection to the same host over loopback, which is an OS-enforced boundary independent of the listener's implementation — so the result transfers across ports and protocols. The listener is started by the adapter, outside the sandbox, so the experiment never depends on `allowLocalBinding`, which governs bind rather than connect. The fixture says nothing about external-domain allowlist correctness, TLS inspection, or exfiltration resistance.

## Authoritative cases and controlled launch

The version 2 manifest at `practice/agent/agent-practice-claude-sandbox-loopback-egress-20260820-1115.json` is authoritative. It holds three cases, the fewest that can falsify the claim: a treatment, the allowlist-empty baseline that proves the sandbox was engaged, and the sandbox-disabled control that proves the fixture and oracle work.

1. `control-nosandbox` — sandbox settings `{"enabled": false}`.
2. `sandbox-deny-empty` — `{"enabled": true, "allowUnsandboxedCommands": false, "filesystem": {"disabled": true}, "network": {"allowedDomains": [], "strictAllowlist": true}}`.
3. `sandbox-allow-loopback` — identical to case 2 except `allowedDomains` becomes `["127.0.0.1", "localhost", "[::1]"]`. This single field is the decisive controlled difference.

Every case declares `execution.mode: fixture-wrapper`, executable wrapper `claude-sandbox-loopback-wrapper.mjs`, executable offline fake preflight CLI `preflight-claude.mjs`, and `environment: inherit`. The adapter is essential, not decorative: the stock runner launches Claude with `bypassPermissions`, `--setting-sources project`, four tools, and no `--settings` flag at all, and the official documentation states that `strictAllowlist` is honored only from user, managed, or CLI `--settings` sources — so a `direct`/`inherit` case cannot deliver a sandbox profile and cannot falsify this claim. No launch override is described only in prose; every control is implemented in the manifest-selected executable adapter and re-asserted by the fake CLI and the verifier.

Permission handling is held constant across all three cases so that sandbox configuration is the only varying factor: each child runs with `--permission-mode dontAsk` and the single exact allow rule `Bash(node probe.mjs)`. This deliberately differs from the reader's likely setup, where enabling the sandbox is what auto-allows Bash; holding permission constant is required to keep the contrast single-variable, and it is recorded as a limitation. `filesystem.disabled` is set in both sandboxed cases for the same reason: only the network layer may differ.

The exact prompt, identical for all cases, is:

> Use the Bash tool exactly once to run exactly `node probe.mjs`. Do not read, edit, create, or delete any file yourself, do not run another command, use another tool, contact any network resource, retry, or substitute an alternative, and do not disable or weaken any sandbox. After the tool result, stop.

For each case the adapter replaces the stock arguments with `--permission-mode dontAsk`, `--tools Bash`, empty `--setting-sources`, the inline `--settings` profile, `--strict-mcp-config` with an empty MCP configuration, disabled slash commands and Chrome, no session persistence, `--output-format stream-json --verbose`, `--max-turns 4`, and — for live cases only — `--max-budget-usd 0.20`, `--model sonnet`, `--effort low`. It requires `2.1.236 (Claude Code)` before proceeding. Each child runs from a normalized sibling workspace named `.loopback-probe-workspace`, so the model-visible working directory never reveals the case ID; only the inline sandbox JSON differs between cases.

## Offline preflight and environment boundary

Before any authenticated model call, the runner rehearses every case against `preflight-claude.mjs` with its minimal environment. Both the adapter and the fake CLI inspect environment **names** only; values of unclassified names are never read or printed. Both reject credential-bearing names (token, secret, password, credential, cookie, API/access/private/session key, generic auth, SSH agent socket, GPG agent, Google application credentials) and both explicitly tolerate harmless variables the platform runtime injects on its own — including macOS `__CF_USER_TEXT_ENCODING`, other `__CF*` names, `MallocNanoZone`, `XPC_*`, `OS_ACTIVITY_MODE`, `COMMAND_MODE`, `SHLVL`, `_`, and locale names — so a legitimate platform injection cannot fail the rehearsal while a credential-bearing variable still does.

The fake CLI additionally requires `AGENT_PRACTICE_PREFLIGHT=1`, a disposable absolute `HOME` that is the `.preflight-home` child of the normalized workspace, and the absence of `--model`, `--effort`, and `--max-budget-usd`; it verifies the injected allow rule and sandbox profile against the registered set, then rehearses the `connected` branch by running the fixture probe itself. That rehearsal's only transport is a TCP connection to the adapter's own `127.0.0.1` ephemeral-port listener inside the disposable case tree: the probe refuses any non-loopback target and performs no name resolution, so no external host, DNS lookup, credential, model call, or paid request is possible during preflight. The rehearsal exercises the adapter, the probe, the changed-path boundary, and the verifier end to end, and a preflight failure stops the runner before any live case. The runner's separate local authentication-status check happens outside the fixture and is not experiment evidence.

## Verification and changed-path boundary

Run `node verify.mjs` from each disposable case root. It checks case and profile identity, the exact sandbox JSON for that profile, input digests, that the settings arrived through the CLI settings source, the implemented launch controls, zero forwarded credential-bearing environment names, the preflight classification, the loopback-only transport scope with zero external hosts contacted and no name resolution, an empty unexpected-workspace list, clean process exit with no timeout/signal/stream overflow, no authentication or service failure, exactly one `dontAsk` init event exposing only Bash, exactly one Bash request carrying the exact command, one matched tool result, one non-error final result, the cost cap, internally consistent listener counters, and membership in that case's pre-registered observation set. It then applies the branch-specific assertions: `connected` requires status 200, the served body marker, no transport error, and exactly one recorded listener request; `blocked` requires a recorded refusal with a transport error code, zero listener requests, and a classified denial pattern; `intercepted` requires a completed probe with zero listener requests and no served marker; `probe-absent` requires no probe record plus real failure evidence in the tool result. Only then does it write the case marker.

Protected paths are exactly `claude-sandbox-loopback-wrapper.mjs`, `preflight-claude.mjs`, `probe.mjs`, `verify.mjs`, and `README.md`, which includes both the declared wrapper and the declared preflight CLI. Allowed changes are exactly `case-result.json` and `verification.txt`. The normalized sibling workspace — with `target.json`, `probe.json`, and the disposable preflight home — is removed before the runner diffs the case tree, so any other changed path, or any change to a protected path, fails the case.

## Run count, safety, cost, and limitations

- Run count: three offline fake rehearsals, then exactly one live request per case; three live model requests total, no retry.
- Timeout: 300 seconds per runner case, 180 seconds per child, 30 seconds for the version check, 4 seconds for the probe request.
- Network: manifest `network: false` configures only Codex `sandbox_workspace_write.network_access`. All three cases are Claude cases that the runner launches on the host, so this field enforces nothing here and must not be presented as an all-case security boundary. The isolation being measured is the Claude CLI's own sandbox — it is the object of study, not a harness guarantee. All fixture traffic is confined to a `127.0.0.1` ephemeral-port listener inside the disposable case tree; no external host is contacted in any phase.
- Credentials: use only already-established Claude authentication. Credential-bearing environment names are removed from both fake and live children, and are never read, copied, hashed, printed, or logged. If normal authentication cannot work after that filtering, stop inconclusively without logging in or relocating credentials.
- Cost: USD 0.20 per live case, USD 0.60 maximum; preflight involves no model or paid request.
- Isolation and stop conditions: fresh disposable runner copies, empty setting sources, strict empty MCP configuration, Bash-only tools, one fixed command, no dependency installation, Git operation, browser, external service, production state, or publish action. Stop without a verdict if the control case does not connect, if repeated runs of the same case disagree, if the model does not issue the fixed command after one prompt clarification, if a sandbox escape or privilege escalation would be required, or if a global CLI update would be needed (the version boundary is pinned to `2.1.236`).
- Redaction: retain settings and prompt digests, the sandbox profile JSON, structured tool facts, listener counters, transport error codes and classified denial patterns, a sanitized length-capped tool-result excerpt with workspace paths replaced by placeholders, costs, versions, and exit facts. Never retain environment values, credential material, home-directory inventory, or private absolute paths.
- Cleanup: the runner removes its temporary root and preserves redacted evidence under ignored `logs/agent/`; the adapter removes only its own normalized sibling workspace and disposable preflight home. Git state is untouched.

The later runner command needs no launch override:

```sh
node scripts/agent-practice/run-experiment.mjs practice/agent/agent-practice-claude-sandbox-loopback-egress-20260820-1115.json
```

Limitations: the result cannot generalize beyond Claude Code `2.1.236` on the recorded macOS arm64 host; it cannot speak for Linux or WSL2 bubblewrap enforcement, for `allowLocalBinding` (a bind-side setting), for Unix-domain sockets, for proxy-aware clients such as `curl` or Go tooling that read `HTTP_PROXY` (the probe deliberately does not, though it records which proxy variable names were present), for the auto-allow permission path that enabling the sandbox normally triggers, for external-domain allowlist correctness, or for any security guarantee. It makes no latency, quality, or price claim. Its expected article value is the narrow operational decision the official documentation currently leaves open: whether a loopback-dependent local test suite can stay inside the Bash sandbox, and what the failure looks like when it cannot.
