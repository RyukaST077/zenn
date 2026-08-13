# Claude subprocess scrub fake-HOME startup boundary plan

## Source, reader problem, and promised decision

- Source report: `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md`
- Reader: a CI, self-hosted-runner, or local automation maintainer considering `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`.
- Reader problem: official guidance describes credential scrubbing but does not say whether enabling it creates a higher-precedence shell startup file that silently shadows an existing `.profile`.
- Promised decision: decide whether Claude Code 2.1.227 on the tested macOS 26.5 arm64 host may enable the control without a disposable-HOME startup-file preflight, and which file/login-shell assertions must gate rollout if the boundary reproduces.
- Likely article type: `failure`
- Mode: `boundary`
- Target provider: Claude Code only. Codex is excluded because it cannot answer a Claude-specific environment-control claim.
- Authoritative execution specification: `practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json`

## Falsifiable claim

With the locally installed Claude Code 2.1.227 on macOS 26.5 arm64, one non-interactive startup in a network-denied sandbox with a fresh isolated `HOME`, a non-empty `.profile`, and no `.bash_profile` creates an exactly zero-byte `.bash_profile` only when `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` is present. The seeded `.profile` remains byte- and metadata-identical in both cases; `bash -lc` sees its marker before both runs and after the control, but not after the treatment.

The claim is false if the control creates `.bash_profile`, the treatment leaves it absent or non-empty, `.profile` changes, or the post-treatment login shell still sees the marker. A version mismatch, sandbox/profile failure, timeout, credential/login attempt, model response, missing offline-API diagnostic, non-minimal baseline, or any undeclared HOME file makes the result inconclusive and stops rollout rather than supporting the claim.

## Minimal fixture and practical mapping

- New fixture: `fixtures/agent-practice/claude-subprocess-scrub-home-stubs`
- Existing fixture decision: `instruction-loading` requires a paid model task and measures guidance behavior; `codex-pretooluse-boundary` measures Codex hooks. Neither can isolate Claude startup environment and fake-HOME effects without distortion.
- `probe-wrapper.mjs`: runner-compatible `CLAUDE_BIN` adapter. It short-circuits the runner's authentication/version probes without reading credentials, accepts only the manifest prompt and two declared case IDs, validates an absolute executable whose resolved basename is `2.1.227`, creates and later removes one case-local runtime root, then starts the real binary exactly once.
- `verify.mjs`: reads the retained structured result, applies case-specific objective assertions, rejects unexpected HOME files and non-regular entries, and writes the exact marker only on success.

The fixture is deterministic, self-contained, and offline. It uses only installed Node.js, `/bin/bash`, `/usr/bin/env`, and macOS `/usr/bin/sandbox-exec`; it has no dependency install, symlink, daemon, browser, external service, secret, user data, production path, guidance overlay, or generated run output. The real Claude executable is an explicit host prerequisite, not fixture content. The adapter passes a fresh environment allowlist containing only inert settings and one visibly invalid non-secret API-key marker; it never forwards or records the host environment.

The fake HOME represents a clean runner account, `.profile` represents PATH/toolchain initialization, `.bash_profile` represents the higher-precedence shadow, and the login marker represents a later CI or SSH login shell. The file inventory and exact `.profile` digest/mode/mtime checks map to a rollout audit rather than relying on model narration.

## Cases and controlled difference

Run each case once in a fresh runner copy. The exact prompt, executable, wrapper, fake-HOME seed, CLI flags, sandbox profile, environment allowlist, timeout, and verifier are identical. The only treatment difference is the presence of `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`.

| Case | Scrub variable | Expected `.bash_profile` | Expected post-run marker | Verification marker |
|---|---|---|---|---|
| `scrub-unset-control` | unset | absent | visible | `CONTROL_HOME_STARTUP_PRESERVED` |
| `scrub-enabled-treatment` | `1` | exactly zero bytes | hidden | `TREATMENT_EMPTY_BASH_PROFILE_SHADOWED_PROFILE` |

Exact shared prompt:

> Offline startup probe only. Do not use tools, access files, or answer the prompt.

## Exact runner and CLI settings

Before running, resolve the repository root, Node executable, and installed Claude executable to absolute paths; confirm the Claude executable resolves to the already researched `2.1.227` path. Start the runner through `/usr/bin/env -i` with exactly four environment names so neither the runner-facing wrapper nor the tested process can inherit a credential:

```text
/usr/bin/env -i \
  PATH=<absolute-node-bin-directory>:/usr/bin:/bin \
  TMPDIR=/tmp \
  CLAUDE_BIN=<absolute-repository-root>/fixtures/agent-practice/claude-subprocess-scrub-home-stubs/probe-wrapper.mjs \
  REAL_CLAUDE_BIN=<absolute-installed-claude-executable> \
  <absolute-node-executable> scripts/agent-practice/run-experiment.mjs \
  practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json
```

Do not run the manifest without the empty environment and both absolute overrides: ordinary runner Claude cases authenticate and perform a model task, which is outside this zero-cost offline plan. The wrapper rejects any runner environment name outside `CLAUDE_BIN`, `REAL_CLAUDE_BIN`, `PATH`, and `TMPDIR`; its runner-facing `auth status` response explicitly says authentication is unused, and its runner-facing version response is a pinned adapter declaration. Each case separately verifies the real executable's resolved version basename and SHA-256 before startup.

The wrapper starts the real executable once per case from `<case>/.startup-probe-runtime/home/proj` with `-p <exact-prompt> --max-turns 1 --output-format stream-json --verbose --no-session-persistence --setting-sources project`. It supplies only the recorded environment-name allowlist, a fake HOME/TMPDIR, traffic-disable flags, the invalid marker, and `ANTHROPIC_BASE_URL=http://127.0.0.1:9`. No inherited credential or host setting is passed.

Per-case runner timeout is 90 seconds; the inner startup timeout is 30 seconds and verifier timeout is capped by the runner at 60 seconds. Run count and cost limit are exactly two CLI startups total, one per case, with zero successful model/API calls, zero retries, and zero model/API spend.

The manifest's `network: false` is not an all-case security boundary: the current runner does not apply Codex workspace-sandbox networking to host-run Claude branches. For these two Claude cases, the reviewed wrapper independently invokes `/usr/bin/sandbox-exec` with `deny network*`, denies all writes except the isolated case root and `/dev/null`, and denies the named macOS credential-service lookups. An unreachable loopback base is defense in depth, not the network boundary. If `sandbox-exec` cannot compile/apply the profile, the verifier must fail as inconclusive before any recommendation.

## Deterministic verification and strict paths

Verification command: `node verify.mjs`.

Every supportive case must satisfy all of these assertions:

1. The adapter validates the resolved executable basename `2.1.227` and records a SHA-256 digest without invoking a separate version process.
2. The fake HOME is a child of the disposable case root, differs from the host HOME, starts with only the fixed `.profile`, has no `.bash_profile`, and exposes the marker through `bash -lc`.
3. The wrapper receives exactly the four-name empty runner environment, and the child receives exactly the declared non-secret environment-name allowlist; the treatment adds only `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`.
4. The real CLI exits nonzero before 30 seconds because the API path is unavailable; retained booleans show an offline API failure, no sandbox setup error, no login/Keychain/browser prompt, and no model response.
5. `.profile` SHA-256, size, mode, and nanosecond mtime are identical before and after.
6. The control retains only `.profile` and its marker remains visible. The treatment contains only `.profile` plus an exactly empty `.bash_profile` with the standard empty-file SHA-256, and its marker becomes invisible.
7. The case-local runtime directory is removed after structured evidence capture. Protected fixture files `probe-wrapper.mjs` and `verify.mjs` remain byte-identical.
8. The only allowed case-workspace changes are `case-result.json` and `verification.txt`; no symlink or other path is allowed. The runner's own evidence directory remains outside the case diff.

The wrapper intentionally retains classifications, relative inventories, file metadata, process status, CLI digest, and enforcement names—not raw stdout/stderr, environment values, host paths, prompt-bearing events, or credentials. `case-result.json`, runner metrics, diff, and marker state are the objective evidence. A later analysis must inspect both case results; a wrapper success event alone does not support the product claim.

## Pre-registered outcomes and decision rule

Expected outcome: the control leaves `.bash_profile` absent and the marker visible; the treatment alone creates a zero-byte `.bash_profile`, preserves `.profile`, and hides the marker. If both cases pass every assertion, the evidence supports a macOS 26.5/Claude Code 2.1.227 rollout gate: keep credential scrubbing, but enable it only after this disposable-HOME preflight or an equivalent startup-file assertion.

Competing outcome: the treatment does not create exactly the empty shadowing file, the control behaves the same as treatment, or login-shell behavior does not follow the file state. If both cases reach the identical offline startup boundary cleanly, this changes the recommendation to report non-reproduction on the tested macOS/version and not infer that the Linux/2.1.205 report is globally fixed. Any version, sandbox, offline-boundary, credential, timeout, inventory, or evidence failure is inconclusive and blocks rollout; it is not automatically retried or counted as the competing product outcome.

Success requires both declared cases and all assertions. One case cannot support the conjunctive claim. Preserve a failed/inconclusive first attempt and do not retry.

## Safety, cleanup, limitations, and expected article value

- Do not install dependencies, authenticate, access a browser, use MCP/plugins/hooks, contact an external service, read/copy/print credentials, inherit the host environment, mutate Git, publish, or target production state.
- Stop before execution if the absolute binary/version, Node/Bash/sandbox prerequisites, fixture hashes, wrapper overrides, case-root isolation, or redaction cannot be established.
- Stop the case if a model response, login/Keychain/browser prompt, sandbox error, timeout, unexpected HOME entry, non-regular file, write outside the case root, or non-loopback network attempt is observed. Preserve the structured partial result as inconclusive and do not retry.
- Cleanup removes only the exact `.startup-probe-runtime` child after validating that its parent is the case root. The runner then preserves the case result/workspace under ignored `logs/agent/` and removes only its own generated temporary root.

This is one startup sample per case on one macOS/CLI boundary. It does not prove Linux behavior, every shell, every credential family, general subprocess scrubbing efficacy, root cause, future versions, or absence of all host reads. The expected article value is a reproducible, zero-cost preflight that connects a silent startup-file mutation to a concrete disappearing-login-PATH failure without touching a real home or credential.
