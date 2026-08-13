# Claude Code subprocess credential scrubbing: does an isolated macOS home gain a shadowing `.bash_profile`?

## Research contract

- Research date: 2026-08-13 (JST)
- External-source access date: 2026-08-13
- Requested scope: current practical Claude Code or OpenAI Codex know-how, configuration, workflow, harness, model or CLI feature, or reproducible failure boundary not already covered by this repository
- Selected provider: Anthropic Claude Code only
- Proposed mode: `boundary`
- Likely article type: `failure`
- Selected platform/version boundary: the locally installed Claude Code `2.1.227` on macOS 26.5 arm64
- Comparison: one-provider control/treatment ablation only. A cross-provider comparison would not help the reader decide whether to enable this Claude Code control.
- Practice execution: not performed in this search stage.
- Git operations, publishing, credential inspection, production access, and external-system mutation: not performed.

## Explicit constraints

- Select exactly one article-worthy, falsifiable practice claim.
- Exclude substantive duplicates in all `articles/*.md` and prior `research/agent/*.md` reports.
- Prefer current official documentation and primary engineering sources. Treat issue reports and third-party articles only as hypotheses or competing coverage.
- Add a practical boundary beyond a feature summary: the result must tell a CI or local automation maintainer whether this control is safe to enable on the tested host/version without a startup-file preflight.
- Keep a later check offline, bounded, deterministic, and confined to fresh temporary home directories. It must not use or print a real credential, contact an API, mutate the actual home directory, or run a model task.
- Do not create a fixture, write a practice plan, execute Claude Code against the proposed fixture, draft an article, alter Git state, or publish in this stage.

## Existing repository exclusions

All 37 files under `articles/*.md` and both prior files under `research/agent/*.md` were inspected by filename/title and relevant agent, CLI, hook, sandbox, subprocess, environment, and credential content on 2026-08-13.

- `articles/project-root-agent-instructions.md` and `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md` cover project-root `CLAUDE.md` / `AGENTS.md` loading and behavioral verification in non-interactive runs. They do not cover subprocess credential scrubbing, shell startup files, fake-home isolation, or filesystem side effects before a model turn.
- `articles/codex-pretooluse-dispatch-preflight.md` and `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md` cover Codex `PreToolUse` dispatch and deny evidence. The selected claim concerns a Claude Code environment control and a host-home side effect, not hook dispatch or tool blocking.
- `articles/codex-gpt-5-6-model-guide.md` covers model and reasoning-level selection. Model quality, latency, cost, and provider comparison are excluded here.
- No repository article or prior agent report mentions `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`, subprocess environment scrubbing, PID-namespace isolation, `.bash_profile` creation, or a login-shell startup-file shadowing check.
- The remaining repository articles concern Zenn publishing or non-agent engineering topics and are not substantive duplicates.

## Searched queries

Live web search was performed on 2026-08-13 with these representative queries:

1. `site:code.claude.com/docs/en 2026 Claude Code hooks async worktree settings precedence official`
2. `site:code.claude.com/docs/en/changelog Claude Code asyncRewake setup init-only 2026`
3. `site:code.claude.com/docs/en "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"`
4. `site:github.com/anthropics/claude-code "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"`
5. `"CLAUDE_CODE_SUBPROCESS_ENV_SCRUB" Claude Code`
6. `site:github.com/anthropics/claude-code/issues "empty .bash_profile" "SUBPROCESS_ENV_SCRUB"`
7. `site:github.com/anthropics/claude-code/issues "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 leaves"`
8. `site:zenn.dev Claude Code "SUBPROCESS_ENV_SCRUB" bash_profile`
9. `site:dev.to Claude Code "SUBPROCESS_ENV_SCRUB" "bash_profile"`
10. `"CLAUDE_CODE_SUBPROCESS_ENV_SCRUB" "bash_profile" -github.com/anthropics`
11. `Claude Code subprocess environment scrub credentials CI guide 2026`
12. `site:gnu.org/software/bash/manual Bash Startup Files bash_profile bash_login profile`

The Zenn- and Dev.to-specific searches did not surface a representative article that reproduces this exact home-startup-file boundary. This describes the returned results, not proof that no such article exists.

## Official and primary sources

1. [Environment variables](https://code.claude.com/docs/en/env-vars)
   - Publisher: Anthropic, official Claude Code documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-13.
   - Clearly marked paraphrase: setting `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` removes Anthropic and cloud-provider credentials from Bash tool, hook, and MCP stdio subprocess environments while leaving the parent Claude process able to authenticate.
   - Clearly marked paraphrase: on Linux, the same setting also places Bash subprocesses in an isolated PID namespace, so host processes are not visible through ordinary process tools.
   - Relevance: establishes the intended security control and its documented subprocess scope. The page does not document creating missing home dotfiles or any shell-startup side effect.

2. [Claude Code changelog](https://code.claude.com/docs/en/changelog)
   - Publisher: Anthropic, official Claude Code release notes.
   - Relevant release dates: 2026-03-25 for 2.1.83; 2026-04-09 for 2.1.98; 2026-08-10 for the locally installed 2.1.227.
   - Accessed: 2026-08-13.
   - Clearly marked paraphrase: 2.1.83 introduced `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` for credential removal from Bash, hook, and MCP stdio subprocesses; 2.1.98 added Linux PID-namespace isolation when the flag is set.
   - Relevance: dates the feature and distinguishes the cross-platform credential-scrub promise from the documented Linux-only PID-namespace addition. No release note located in the searched current changelog states that the reported home-dotfile side effect was fixed.

3. [Security, anthropics/claude-code-action](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)
   - Publisher: Anthropic-owned primary engineering repository.
   - Publication/update date: not displayed on the rendered file.
   - Accessed: 2026-08-13.
   - Clearly marked paraphrase: when `allowed_non_write_users` is configured, the action performs best-effort scrubbing of Anthropic, cloud, and GitHub Actions secrets from subprocess environments; Linux runners with Bubblewrap also receive PID-namespace isolation. The document emphasizes that this reduces rather than eliminates prompt-injection risk and requires minimum workflow permissions.
   - Relevance: shows a current practical path by which maintainers can receive this control in CI, making startup and filesystem regressions more than a niche manual toggle.

4. [Bash Startup Files](https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files)
   - Publisher: GNU Project / Free Software Foundation, primary Bash reference manual.
   - Manual edition/update context: the current indexed Bash 5.3 manual is dated 2025-05-18; the individual page does not display a separate update date.
   - Accessed: 2026-08-13.
   - Clearly marked paraphrase: a login Bash reads the first readable file that exists in this order: `~/.bash_profile`, `~/.bash_login`, then `~/.profile`.
   - Relevance: establishes why an empty `.bash_profile` can be a semantic failure rather than harmless clutter: its existence prevents `.profile` from being selected.

## Community and issue coverage used only as hypotheses

1. [Claude Code issue #76236: `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` leaves an empty `~/.bash_profile` behind](https://github.com/anthropics/claude-code/issues/76236)
   - Source: community bug report in Anthropic's Claude Code repository; not official product guidance and not a confirmed maintainer diagnosis.
   - Opened: 2026-07-10; status observed: open.
   - Accessed: 2026-08-13.
   - Reported observation: on Ubuntu/Debian with Claude Code 2.1.205 and Bubblewrap, an unauthenticated startup with the scrub flag created zero-byte missing dotfiles under an isolated `$HOME`, including `.bash_profile`; the control without the flag did not. The report also says existing files retained their contents and timestamps.
   - Reported practical effect: because `.bash_profile` then exists, a subsequent login Bash no longer selects the seeded `.profile`, causing its PATH additions and other initialization to disappear.
   - Use here: this is the sole origin of the expected failure behavior. It is a hypothesis to test against the current local 2.1.227 macOS binary, not evidence that macOS behaves the same way or that 2.1.227 remains affected.

2. [claude-code-action issue #1547: every Bash call fails under subprocess isolation](https://github.com/anthropics/claude-code-action/issues/1547)
   - Source: community bug report in Anthropic's action repository; not official guidance or a confirmed root cause.
   - Opened: 2026-07-25; status observed: open.
   - Accessed: 2026-08-13.
   - Reported observation: action runs on Ubuntu began failing every Bash command after a CLI version bump while subprocess scrubbing/isolation was enabled; a marker-based A/B attributed the observed boundary to the enabled control, and the author hypothesized a missing sensitive-file mount target.
   - Use here: competing evidence that stub/mount handling around missing home paths has practical CI failure modes. It does not prove the selected `.bash_profile` claim and will not be cited as such.

3. [Claude Code `-p` (Headless) Implementation Guide](https://zenn.dev/takish/articles/claude-code-headless)
   - Source: independent Zenn article; not Anthropic documentation.
   - Published: 2026-04-08.
   - Accessed: 2026-08-13.
   - Coverage: broad practical guidance for `claude -p`, `--bare`, structured output, tool restrictions, and CI automation.
   - Use here: representative strong existing Japanese coverage of scripted Claude Code. It does not discuss `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`, fake-home filesystem inventories, or the `.bash_profile` / `.profile` selection boundary, leaving a narrower failure-focused gap.

No community report is relabeled as an Anthropic recommendation or confirmed implementation fact.

## Candidate assessment

### Selected: subprocess-scrub startup side effect at the macOS home boundary

This candidate joins three facts that a feature summary does not resolve: the control is current and security-relevant; a recent Linux report says enabling it creates missing home dotfiles before authentication; and the local executable is a newer macOS build. A controlled current-version A/B can decide whether macOS automation needs a preflight or whether the reported behavior is bounded to a different platform/version.

The test has a deterministic oracle independent of model narration: file inventory plus Bash's startup-file selection. It can run without a real API credential, network access, package installation, or writes to the actual home directory.

### Excluded candidates

- Claude Code `--bare` skipping subscription login/keychain: official headless and authentication documentation already states the boundary, and current Zenn coverage explains it. A local failure would mostly restate documented authentication behavior.
- Claude Code ordinary async hooks versus `asyncRewake`: official hook documentation directly explains that ordinary async output waits for another turn while `asyncRewake` exit 2 can wake an idle session. No additional concrete local failure with stronger reader value was found during this search.
- Claude Code `defer` for non-interactive permission hooks: official documentation already gives the single-tool-call constraint and preserved pending-call behavior. Verifying it would require a more elaborate resume wrapper, with less immediate repository/CI safety value than the selected startup mutation boundary.
- Claude Code worktree base ref and `.worktreeinclude`: already rejected in the prior Codex-hook report because current official documentation gives the core decision table; no newly identified local contradiction was found here.
- Claude Code `sandbox.failIfUnavailable`: the feature is valuable, but the local macOS host has a working Claude installation and this search did not identify a safe deterministic way to force sandbox unavailability without distorting the practical environment.
- Subprocess credential scrubbing of dummy `AWS_*` values inside Bash/hooks: this would validate the documented happy path, but it would not answer the more consequential recent report that enabling the control may mutate shell startup state.
- Linux-only Bubblewrap reproduction of issue #1547: the current workspace host is macOS. Pulling a new Linux Claude binary or depending on a remote GitHub Actions run would violate the preference for a bounded locally feasible fixture and add external setup.
- Cross-provider comparison: Codex has no role in deciding whether this Claude-specific environment flag creates a home startup file, so comparison would add cost without answering a reader decision.

## Selected falsifiable claim

> With the locally installed Claude Code 2.1.227 on macOS 26.5 arm64, starting one non-interactive, network-blocked Claude process with `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` and a fresh isolated `$HOME` that contains a non-empty `.profile` but no `.bash_profile` creates a zero-byte `$HOME/.bash_profile` before the process exits, while an otherwise identical control with the scrub variable unset does not; consequently, `bash -lc` observes the marker exported by `.profile` before the treatment run and in the control, but not after the treatment run.

This is one conjunctive boundary claim. It is false if the treatment does not create `.bash_profile`, creates it non-empty, mutates the existing `.profile`, the control also creates it, or login Bash still observes the `.profile` marker after the treatment. If Claude Code cannot reach the startup path under a scrubbed environment without accessing real credentials or the network, the result is inconclusive rather than support.

## Target reader and practical uncertainty

- Reader: a CI, self-hosted-runner, or local automation maintainer considering `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`, directly or through `claude-code-action` security settings.
- Situation: the maintainer wants to reduce credential exposure to model-triggered Bash, hooks, or MCP stdio servers while preserving deterministic shell initialization.
- Current problem: official sources document what credentials the control removes and its Linux isolation behavior, but they do not say whether startup creates missing home dotfiles. A current Linux issue reports a silent `.bash_profile` side effect, while the available local binary is newer and runs on macOS.
- Decision after reading: whether the tested macOS/version combination can enable the scrub control without a home-file preflight; if not, which exact filesystem and login-shell assertions must gate rollout. The article must not recommend disabling secret scrubbing as a general fix.

## Article promise

The article would let the reader reproduce a safe control/treatment preflight using disposable homes, then adopt a version- and platform-specific rule: enable the credential-scrub control only after the treatment creates no unexpected home startup files and preserves the seeded login-shell marker. If the failure reproduces, the reader can recognize a disappearing login-shell PATH as a startup-file selection problem instead of misdiagnosing package installation or authentication.

## What existing sources answer and the remaining coverage gap

Official sources already answer:

- what `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` is intended to remove from subprocess environments;
- which subprocess classes are in scope;
- that Linux additionally receives PID-namespace isolation;
- that Anthropic's GitHub Action can enable related best-effort scrubbing in a real CI security configuration;
- and, from GNU Bash, why `.bash_profile` takes precedence over `.profile` in a login shell.

The open issue provides a detailed Linux/2.1.205 reproducer and a reported workaround, but it is community evidence, not current local evidence. Broad Zenn headless guidance covers reproducible `-p` automation without this side effect.

The precise remaining gap is a retained, two-case check of the newer local Claude Code 2.1.227 macOS binary that (a) never touches the real home, (b) proves whether the treatment alone creates `.bash_profile`, (c) verifies the existing `.profile` is byte-for-byte unchanged, and (d) ties the file state to Bash login semantics. This resolves a concrete platform/version rollout decision and can establish either reproduction or a narrower Linux/version boundary.

## Practical mapping

| Offline fixture element | Real-work analogue |
| --- | --- |
| fresh temporary `$HOME` | a clean CI runner account, container user, or newly provisioned developer account |
| existing `.profile` with an inert exported marker | PATH, language toolchain, package manager, or environment initialization owned by the account |
| absent `.bash_profile` at baseline | common accounts that rely on `.profile` as their login startup file |
| treatment-only zero-byte `.bash_profile` | a newly introduced higher-precedence startup file with no intended initialization |
| `bash -lc` marker assertion | a later CI step or SSH/login shell resolving tools and environment |
| before/after file inventory, sizes, hashes, and mtimes | an auditable proof that the CLI rather than the model or test harness changed home state |

The marker is only an oracle for Bash startup-file selection. It does not claim to model every shell, operating system, credential family, sandbox path, or GitHub Actions runner.

## Minimal verification idea

In a later planning/run stage, create two fresh directories with `mktemp -d` under a recorded temporary parent and validate their resolved paths before any cleanup. In each, create only `home/proj`, `home/.local/bin`, and a fixed `.profile` that exports an inert marker such as `FIXTURE_PROFILE_MARKER=loaded`. Record the complete file inventory, `.profile` bytes, hash, mode, and timestamp. Confirm `.bash_profile` is absent and `env -i HOME=<case-home> PATH=/usr/bin:/bin /bin/bash -lc 'test "$FIXTURE_PROFILE_MARKER" = loaded'` succeeds.

Resolve the Claude executable to an absolute path before clearing the environment. Invoke it once per case from `home/proj` with the same inert prompt, `-p`, `--max-turns 1`, a finite timeout, telemetry/update traffic disabled, a fixed invalid non-secret API-key marker, and an unreachable loopback API base URL so no external request succeeds. The only difference is whether `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` is present. Do not use `--bare`, sandbox settings, real authentication, user configuration, MCP, plugins, hooks, or network access, because those would add independent behavior to the startup check.

Retain only sanitized stdout/stderr, exit status, CLI version, OS version, exact non-secret environment-name/value allowlist, and post-run inventories. Never print the inherited host environment. After each invocation, repeat the `.profile` integrity checks, classify `.bash_profile` as absent/empty/non-empty, and rerun the login-shell marker assertion. Clean up only the two validated temporary roots after copying evidence into the later isolated run directory.

## Local feasibility observed without running the practice

- Claude executable present at `/Users/katayamaryuunosuke/.local/bin/claude`.
- Installed version observed on 2026-08-13: `2.1.227 (Claude Code)`.
- Host observed on 2026-08-13: Darwin 25.5.0 arm64 (macOS 26.5 environment context).
- Local `/bin/bash` reports GNU Bash 3.2.57; the selected startup-order rule is also documented by the current GNU Bash manual.
- `mktemp`, `env`, `shasum`, `stat`, and absolute-path invocation are available through the host shell. No dependency installation or container image is required.
- The later check intentionally stops before a model call by using a fixed invalid credential marker and unreachable loopback endpoint. Therefore it needs no paid invocation and can remain offline while still exercising the Claude CLI startup boundary described by the community report.
- Authentication availability was not exercised, inspected, copied, or printed. The experiment does not need it and must not fall back to Keychain or stored credentials.
- The repository already contains isolated practice-runner, evidence-redaction, protected-path, and unexpected-file-check concepts that can be reused during a later plan, but no fixture or runner was changed in this search stage.

## Expected evidence and decision rule

Retain for both control and treatment:

- exact Claude Code and host versions;
- sanitized command/environment records containing no real credential or host environment dump;
- pre- and post-run file inventories relative to the disposable home;
- `.profile` byte hash, size, mode, and timestamp before and after;
- `.bash_profile` absence or its byte size/hash after the run;
- login-shell marker result before and after;
- process exit status and bounded sanitized diagnostics showing the run stopped on the intentionally unavailable API path rather than executing a model task;
- proof that the actual user home and repository working tree were not targets.

Support the claim only if the control preserves `.profile`, does not create `.bash_profile`, and keeps the marker visible; the treatment preserves `.profile`, creates an exactly zero-byte `.bash_profile`, and makes the marker invisible to `bash -lc`. Classify as not reproduced if both cases reach the intended startup boundary but treatment does not meet that conjunction. Classify as inconclusive if the cases enter different startup paths, the CLI reads real credentials, external network traffic is possible, an unrelated configuration layer loads, the fake home is not honored, evidence is incomplete, or either baseline is already invalid.

## Safety, cost, and stop conditions

- Never set `HOME` to the actual user home, the repository root, `/`, `~`, or an unresolved variable. Use only newly created, resolved, case-specific temporary directories and assert their expected parent before invocation or cleanup.
- Do not use the issue report's broad hard-coded cleanup command. Let the later harness own and validate each temporary path, and delete only those exact disposable directories after evidence capture.
- Use only a visibly invalid fixed marker where a credential-shaped value is required. Do not read, echo, copy, relocate, or modify Keychain items, `.credentials.json`, environment secrets, or any actual token.
- Disable external network traffic and point the API base at an unreachable loopback endpoint. Do not authenticate, install packages, pull images, contact GitHub, invoke a model, or automatically retry.
- Disable updater, telemetry, error reporting, feedback, and other nonessential traffic for the two processes. Record names and inert fixture values only, never the complete process environment.
- Allow one CLI startup per case with a short finite timeout. Expected cost is zero model/API spend.
- Stop before execution if the absolute Claude binary/version changes, the temporary roots cannot be validated, the baseline `.profile` marker is not visible, `.bash_profile` already exists, network isolation cannot be established, or redaction cannot be guaranteed.
- Stop a case immediately if any path outside its disposable home appears to change, the process prompts for login, a real credential source is requested, the loopback-only boundary is bypassed, or a model response is observed. Preserve the partial result as inconclusive and do not rerun automatically.

## Recommended editorial stance if later evidence is obtained

- Treat the selected sentence as a hypothesis until the run records the complete A/B conjunction.
- If reproduced, frame it as a version- and platform-specific rollout gate for a useful security control, not as a reason to abandon credential isolation.
- If not reproduced, report the current macOS/2.1.227 non-reproduction as a boundary against the Linux/2.1.205 community report; do not claim the upstream issue is fixed globally.
- Do not infer root cause from filenames alone, and do not present either community issue's implementation hypothesis as maintainer-confirmed.
