# Codex ephemeral resume persistence boundary plan

## Contract

- Source report: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`
- Reader problem: a CI, batch-runner, or local-harness maintainer sees `--ephemeral` accepted by `codex exec resume` but cannot infer from command success whether the resumed turn was appended to the existing rollout.
- Promised decision: for locally installed Codex CLI `0.147.0`, decide whether a harness may rely on `--ephemeral` at the resume boundary or must fail a file-level conformance gate and avoid that command combination until a pinned-version retest passes.
- Claim: with Codex CLI `0.147.0`, one successful `codex exec resume <session-id> --ephemeral` appends the harmless resumed turn to the exact pre-existing rollout; its SHA-256 and byte size change, its line count does not decrease, the original bytes remain an unchanged prefix, and the resume marker appears only in appended bytes.
- Likely article type: `failure`.
- Mode: `boundary`.
- Provider: Codex only. Claude, model-quality comparison, server-retention behavior, and fresh-ephemeral behavior are excluded.

## Minimal fixture and practical mapping

Create `fixtures/agent-practice/codex-ephemeral-resume-persistence/`; no existing fixture can create a persisted baseline, recover the exact emitted session ID, resolve its rollout, and perform a resume. Reusing the JSONL final-artifact fixture would distort both its one-turn oracle and this claim's two-invocation lifecycle boundary.

- `markers.json`: two fixed, inert, non-secret strings forming the bounded input.
- `codex-resume-wrapper.mjs`: the required runner adapter. The generic runner can issue only one fresh ephemeral turn, so this executable validates all runner controls, pins `codex-cli 0.147.0`, performs exactly one persisted baseline and one ephemeral resume, resolves only the rollout named by the emitted full session ID, and records measurements without retaining raw rollout or child output.
- `preflight-codex.mjs`: executable offline fake CLI. It simulates a persisted baseline and an appending resume entirely below a case-local fake `CODEX_HOME`.
- `verify.mjs`: dependency-free deterministic verifier with objective exit status. It accepts only the pre-registered claim-supported or byte-identical not-reproduced outcomes and writes the declared marker.

The fixture is self-contained, deterministic, and uses only the installed Node.js runtime. It needs no dependency installation, secret, browser login, daemon, symlink, user data, production state, or external service. Its fake-CLI preflight performs no network, credential, model, or paid request. The later live product case necessarily uses the already-authenticated Codex CLI for two model requests; it must not solicit, inspect, print, copy, or relocate credentials, and it must stop if existing CLI authentication is unavailable.

| Fixture signal | Real-work analogue |
| --- | --- |
| persisted baseline with inert marker | resumable automation job with prior context |
| full ID from `thread.started` | stored resume handle |
| exactly one rollout filename containing that ID | transcript object governed by the persistence promise |
| before/after SHA-256, bytes, lines, and literal counts | file-level conformance gate |
| unchanged prefix plus resume marker in appended bytes | attribution of growth to the resumed turn |
| byte-identical target with no resume marker | effective non-persistence on this pinned version |

## One case and exact execution

Case `codex-0147-ephemeral-resume` uses provider `codex`, no guidance, no model override, no effort override, and fixture-wrapper execution with inherited provider environment. The machine manifest—not a shell launch override—selects `codex-resume-wrapper.mjs`, `preflight-codex.mjs`, and `environment: inherit`. The runner always forces a minimal environment for the fake preflight; the wrapper narrows its fake child's environment to exactly `PATH`, `TMPDIR`, a case-local `CODEX_HOME`, and `AGENT_PRACTICE_PREFLIGHT=1`.

The manifest prompt is exactly:

> Run the fixture's bounded Codex resume-persistence probe exactly once. Do not perform any additional task.

The wrapper rejects any different prompt or runner launch without approval `never`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--skip-git-repo-check`, JSONL, the disposable case root, `sandbox_workspace_write.network_access=false`, and no model override. It converts the two product invocations to `read-only` and makes these finite calls without retry:

1. Persisted baseline: `codex -a never exec --json --sandbox read-only --ignore-user-config --ignore-rules --skip-git-repo-check -C <case> -c sandbox_workspace_write.network_access=false -o <case-temp>/baseline-final.txt <baseline-prompt>`.
2. Tested resume: `codex -a never exec --ephemeral --json --sandbox read-only --ignore-user-config --ignore-rules --skip-git-repo-check -C <case> -c sandbox_workspace_write.network_access=false -o <case-temp>/resume-final.txt resume <exact-session-id> <resume-prompt>`.

Each prompt asks for one exact inert marker and forbids tools, commands, web search, MCP, and edits. Both calls must exit zero, avoid timeout or signal, emit exactly one successful terminal event, emit the same single session ID, and contain no command, MCP, web, or file-change tool event. The baseline must resolve to exactly one regular non-symlink rollout and contain the baseline marker but not the resume marker before the second call.

## Deterministic verification and boundaries

Authoritative verification command: `node verify.mjs` from the isolated case root. The case passes only when the process and parser gates pass and one of these two registered observations is measured:

- Expected, claim supported: SHA-256 changes; bytes increase; lines do not decrease; all prior bytes are an unchanged prefix; and the resume marker occurs in appended bytes.
- Competing, claim not reproduced: SHA-256, bytes, and lines are identical and the resume marker remains absent. This removes the workaround recommendation for `0.147.0` and supports using the flag only within this recorded boundary, while retaining the version-pinned conformance gate.

Any other mutation shape, missing marker, ambiguous rollout, ID mismatch, malformed JSONL, nonzero/fatal/timeout result, tool event, version mismatch, unavailable auth, or symlink is inconclusive and must fail without retry. The case marker is `RESUME_PERSISTENCE_BOUNDARY_OBSERVED`, meaning the boundary produced a decisive registered result; it does not itself encode which competing result occurred. The structured `probe-result.json` retains that distinction.

Protected case paths are exactly `markers.json`, `codex-resume-wrapper.mjs`, `preflight-codex.mjs`, and `verify.mjs`. The complete allowed case-workspace change set is `probe-result.json` and `verification.txt`; the adapter's case-local runtime directory is removed before runner diffing. Any additional case path or any protected-path digest change fails. Outside the disposable case, the selected oracle is the one newly created rollout resolved from the experiment's exact session ID. It is preserved rather than deleted or rewritten; unrelated session contents and credential/configuration files must not be opened or printed.

## Run, safety, cost, and evidence limits

- Run count: one provider, one case, one fake preflight rehearsal, then exactly two live model invocations. No automatic retry.
- Timeout: 300 seconds for the wrapper case; each live child is capped at 120 seconds and version checking at 30 seconds.
- Network: manifest `network: false` is Codex workspace-sandbox enforcement for tool access, not a block on the CLI's required provider transport. The fake preflight is entirely offline. No Claude host branch exists.
- Credentials: use only already-established Codex authentication through normal CLI behavior. Do not request login, expose environment values, or read authentication files. Authentication failure is a stop condition.
- Cost: at most two live model requests, no explicit model selection, no benchmark or price claim, and no retries. The fake preflight has zero model requests.
- State: use one fresh temporary non-Git case and one harmless new persisted Codex session. Do not touch production state, Git state, MCP, plugins, browsers, package registries, or external services other than the standard Codex endpoint required by the two live calls.
- Redaction: retain only version, generated session ID, Codex-home-relative target path, hashes, counts, deltas, control booleans, status facts, and the two inert markers. Do not retain raw target JSONL, child stderr/stdout, absolute home paths, environment values, credentials, or unrelated rollout names/content.
- Cleanup: the runner removes its temporary root and preserves redacted evidence under ignored `logs/agent/`. The wrapper removes only its explicitly named case-local runtime directory. It must not delete or rewrite the harmless target session because that file is primary evidence.

Execute later with the runner directly, with no launch override:

```sh
node scripts/agent-practice/run-experiment.mjs practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json
```

The expected article value is a narrow current-version decision rule backed by a file oracle rather than model recollection. The result cannot establish server-side retention, encryption, all ephemeral operations, other Codex versions, other platforms, or general security impact.
