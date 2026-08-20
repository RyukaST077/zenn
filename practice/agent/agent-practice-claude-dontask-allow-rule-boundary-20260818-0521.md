# Claude Code dontAsk exact versus broad Bash allow rules: practice plan

## Source and reader decision

- Source report: `research/agent/agent-knowhow-claude-dontask-broad-allow-rule-drop-20260818-0521.md`
- Reader problem: a maintainer using `claude -p --permission-mode dontAsk` in unattended CI needs one fixed Python helper to run and cannot safely infer effective permission from a broad rule merely being present in settings.
- Promised decision: determine whether Claude Code 2.1.227 on the recorded macOS arm64 environment honors `Bash(python3:*)` for the same fixed command as an exact allow rule, and whether a dropped broad rule emits a startup diagnostic.
- Likely article type: configuration-harness.
- Mode: `ablation`.
- Provider: Claude only. Codex and provider comparison cannot answer this Claude permission-boundary claim.

## Claim and pre-registered outcomes

The falsifiable claim is that two fresh non-interactive `dontAsk` runs, differing only in one `permissions.allow` string, diverge: `Bash(python3 -c "print('ALLOW_RULE_PROBE')")` produces one successful Bash tool result containing the execution marker, while `Bash(python3:*)` produces one permission denial without that marker and without a rule-validation warning.

The expected joint outcome is `exact-executed` plus `broad-denied-silent`; it supports the version-scoped recommendation to use a narrow exact rule and a behavioral preflight gate rather than treating broad interpreter syntax as proof of effective authorization. `exact-executed` plus `broad-denied-diagnostic` is conditional support: the execution boundary remains, but the article must remove “silent” and teach operators to gate on the observed diagnostic. The decisive competing outcome is `exact-executed` plus `broad-executed`; it does not reproduce the claim and changes the recommendation to report that this current version honored both rules under the controlled command. An exact denial, absent or altered Bash request, unmatched result, ambiguous marker, version drift, authentication/service failure, malformed stream, extra tool use, or any other shape is inconclusive and fails without retry.

The verifier accepts only those three registered treatment classifications after the exact control succeeds. The per-case completion markers mean the case reached a registered evidence boundary; they do not themselves claim that broad-rule dropping was reproduced. Cross-case verdicting belongs to the later analysis stage.

## Fixture and practical mapping

No existing fixture tests Claude permission rules or can replace the runner's default `bypassPermissions` launch without distorting its own claim. Create the smallest self-contained fixture at `fixtures/agent-practice/claude-dontask-allow-rule-boundary/`:

- `claude-dontask-wrapper.mjs`: executable adapter selected by both manifest cases; validates the stock runner arguments, chooses the case's single allow rule, launches the exact `dontAsk` command, forwards raw streams to runner evidence, and writes normalized observations.
- `preflight-claude.mjs`: executable offline fake CLI that rehearses exact success and silent broad denial without a model, credential, network, or paid request.
- `verify.mjs`: dependency-free deterministic verifier with objective exit status and case-specific completion marker.

The fixture needs only the existing Node.js runtime and installed Claude CLI. It installs nothing and contains no secret, symlink, user data, daemon, browser flow, production state, or generated run output. The live provider invocation necessarily uses existing Claude authentication and the Claude model endpoint; the fixture never reads, copies, lists, hashes, prints, or relocates credential material. Missing existing authentication is a stop condition, not permission to log in.

The fixed `python3 -c` stdout probe models a checked-in generator, migration verifier, or test helper. The exact rule models approval of one audited command; the broad rule models approval of an interpreter family. Looking for the marker only in the matched structured Bash tool result models a CI gate that proves the required command actually executed, rather than trusting final prose or searching inputs that already contain the marker.

## Authoritative cases and controlled launch

The version 2 manifest is authoritative and contains the minimum two cases:

1. `exact-rule-control`: Claude, no guidance overlay, model `sonnet`, effort `low`, allow rule `Bash(python3 -c "print('ALLOW_RULE_PROBE')")`.
2. `broad-wildcard-treatment`: the same provider, prompt, model, effort, tool, limits, environment, and adapter; only the allow rule becomes `Bash(python3:*)`.

Both cases declare `execution.mode: fixture-wrapper`, executable wrapper `claude-dontask-wrapper.mjs`, executable fake preflight CLI `preflight-claude.mjs`, and `environment: inherit`. The adapter is essential because the stock runner launches Claude with `bypassPermissions`, project settings, and four tools; direct/inherit cannot falsify a `dontAsk` allow-rule claim. No prose-only launch override is used. The adapter launches both sequential children from the same normalized sibling workspace path and requires it to remain empty, so the model-visible working directory does not reveal the case ID; only the inline allow-rule JSON differs.

The exact prompt is:

> Use the Bash tool exactly once to run exactly `python3 -c "print('ALLOW_RULE_PROBE')"`. Do not use another command, tool, file, network resource, or alternative. After the tool result, stop.

For each live child the adapter replaces the stock arguments with `--permission-mode dontAsk`, `--tools Bash`, empty `--setting-sources`, inline `--settings` containing one allow rule, strict empty MCP configuration, disabled slash commands and Chrome, no session persistence, stream JSON plus verbose output, two turns, a USD 0.20 cap, model `sonnet`, and effort `low`. The wrapper requires the exact recorded CLI version before the case. This launch is implemented by the manifest-selected executable adapter, not by operator instructions.

## Offline preflight and environment boundary

Before either authenticated model call, the runner invokes each wrapper against `preflight-claude.mjs`. The runner supplies its minimal preflight environment; the wrapper rejects credential-bearing names and unknown names, creates a case-local disposable `HOME`, and passes only fixed locale/path/terminal/telemetry-disable names to the fake. The allowlists explicitly tolerate harmless platform runtime injection including macOS `__CF_USER_TEXT_ENCODING`, `MallocNanoZone`, XPC names, and locale names while still rejecting token, secret, password, key, credential, cookie-equivalent auth, SSH-agent, and GPG-agent names.

Preflight omits `--model`, `--effort`, and `--max-budget-usd`; it invokes only the fixture fake for `--version` and the synthetic case stream. The fake imports no network module, accepts only the empty MCP config and fixed Bash surface, makes no provider/authentication/model call, and performs no paid request. A preflight failure stops the runner before live execution. The runner's separate local authentication-status prerequisite is outside fixture preflight and is not experiment evidence.

## Verification and changed-path boundary

Run `node verify.mjs` from each disposable case root. It checks the pinned version, case/rule identity, input digests, implemented launch controls, zero credential-bearing child environment names, preflight classification, timeout/auth/service flags, one `dontAsk` init event exposing only Bash, exactly one exact Bash request, one matched tool result, one final result, and the cost cap. The exact case must contain a successful execution marker and no denial. The broad case must be exactly one of silent denial, diagnosed denial, or successful execution; marker provenance and denial evidence must agree with that classification.

Protected paths are exactly `claude-dontask-wrapper.mjs`, `preflight-claude.mjs`, and `verify.mjs`. Allowed changes are exactly `case-result.json` and `verification.txt`. The temporary preflight home and normalized sibling workspace are removed before runner diffing. Any protected change, non-empty task workspace, or additional fixture-tree path fails. Raw JSONL and stderr are forwarded to the runner's redacted evidence directory; normalized fixture evidence contains no environment values or credential material.

## Run count, safety, cost, and limitations

- Run count: two offline fake rehearsals, then exactly one live request per case; two live model requests total, no retry.
- Timeout: 300 seconds per runner case, 180 seconds per child, and 30 seconds for the local version check.
- Network: manifest `network: false` only configures the Codex workspace sandbox and does not isolate the host-run Claude branch. These are Claude-only cases, so live provider transport remains available and must not be described as network-blocked. The fixed Bash task itself requests no network, and preflight is fully offline.
- Credentials: use only already-established Claude authentication; credential-bearing environment variables are removed from fake and live children. If normal home/keychain authentication cannot work after that filtering, stop inconclusively without copying credentials or logging in.
- Cost: USD 0.20 per live case and USD 0.40 total maximum; preflight has no model or paid request.
- Isolation: fresh disposable runner copies, empty setting sources, strict empty MCP config, Bash-only tools, one fixed stdout-only command, no file task, dependency installation, Git operation, browser, external task service, production state, or publish action.
- Redaction: retain rule/settings hashes, exact inert command, structured tool facts, diagnostics classification, costs, versions, exit facts, and redacted raw streams. Never retain environment values, credential files, tokens, unrelated home inventory, or private absolute paths.
- Cleanup: the runner removes its temporary root and preserves redacted evidence under ignored `logs/agent/`; the fixture removes only its case-local preflight home and named normalized sibling workspace. Git state is untouched.

The later runner command requires no launch override:

```sh
node scripts/agent-practice/run-experiment.mjs practice/agent/agent-practice-claude-dontask-allow-rule-boundary-20260818-0521.json
```

This experiment cannot generalize beyond Claude Code 2.1.227 and the recorded macOS arm64 environment, prove how `/permissions` renders rules, separate all managed-policy influences, test other interpreters or wildcard forms, establish a security guarantee, or make latency/price claims. Its expected article value is the narrower operational decision: whether a current unattended `dontAsk` job must replace a broad Python rule with exact commands and verify execution behavior rather than configuration presence.
