# Codex exec isolation flags versus user skills: does an ambient skill still enter the run?

## Research contract

- Research date: 2026-08-15 (JST)
- External-source access date: 2026-08-15
- Requested scope: current, practical Claude Code or OpenAI Codex know-how not already covered by this repository
- Selected provider: OpenAI Codex CLI only
- Proposed mode: `boundary`
- Likely article type: `configuration-harness`
- Selected version boundary: locally installed Codex CLI `0.147.0`, released 2026-08-07
- Performance or provider comparison: excluded. The claim concerns hidden configuration inputs in one Codex automation surface, not speed, cost, model quality, or Claude Code.
- Practice execution: not performed in this search stage.
- Git, publishing, credential, production, and external-system mutations: not performed.

## Explicit constraints

- Select exactly one current, article-worthy, falsifiable practice claim.
- Exclude substantive duplicates in `articles/*.md` and `research/agent/*.md`.
- Prefer current official documentation and version-pinned primary sources; use community material only to identify a hypothesis or competing interpretation that must be retested.
- Require a later check to use a bounded local fixture, a disposable home directory, no task-side network or tools, finite model invocations, and no dependency installation.
- Do not inspect, copy, print, relocate, or modify credentials.
- Do not create a practice plan, execute Codex against a fixture, draft an article, publish, send external messages, or alter Git state in this stage.

## Existing repository exclusions

All 40 Markdown files under `articles/` and all five earlier reports under `research/agent/` were inspected by path, title, and relevant content on 2026-08-15. This includes currently untracked repository content; Git state was not changed.

- `articles/project-root-agent-instructions.md` and `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md` already cover whether ordinary non-interactive runs behaviorally reflect a project-root `AGENTS.md` or `CLAUDE.md`. The selected topic does not retest project instructions; it tests a user-scoped Codex skill while both new configuration-isolation flags are present.
- `articles/codex-pretooluse-dispatch-preflight.md` and `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md` already cover Codex hook dispatch and deny behavior. They use `--ignore-user-config` as a harness input but do not test what that flag leaves model-visible, and the selected fixture has no hooks.
- `articles/codex-resume-ephemeral-rollout-gate.md` and `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md` already cover persistence when `--ephemeral` is combined with `codex exec resume`. The selected claim concerns skill discovery in a fresh run, not session storage or resume.
- `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md` covers JSONL message finality and `-o` as a completion artifact. The selected fixture may retain JSONL as evidence but makes no stream-parser claim.
- `articles/agent-plugins-spec-claude-code-half-load.md` covers Claude Code's Agent Plugins layout and implementation boundary. The selected topic is a direct user skill in Codex, not plugin packaging, schema validation, distribution, or Claude behavior.
- `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md` covers a Claude Code subprocess and fake-home shell-startup side effect. The selected use of a disposable `HOME` is only an input-isolation technique; no shell startup or subprocess credential-scrubbing claim is made.
- `articles/codex-gpt-5-6-model-guide.md` covers model-family and reasoning-level selection. Models, benchmarks, latency, and quality are excluded.
- No existing article or prior agent report asks whether `$HOME/.agents/skills` remains model-visible and explicitly invocable under `codex exec --ignore-user-config --ignore-rules`.
- The remaining articles concern Zenn publishing or non-agent engineering topics and are not substantive duplicates.

## Searched queries and representative coverage

Live web search was performed on 2026-08-15 with these representative queries:

1. `site:code.claude.com/docs/en "--setting-sources" Claude Code settings CLI`
2. `site:code.claude.com/docs/en Claude Code changelog 2.1.227 settings sources bare safe mode`
3. `site:developers.openai.com/codex/cli/reference Codex CLI 0.147 config feature`
4. `site:developers.openai.com/codex/changelog Codex CLI 0.147.0`
5. `site:learn.chatgpt.com/docs/codex "--ignore-user-config"`
6. `site:learn.chatgpt.com/docs/codex "--ignore-rules"`
7. `site:developers.openai.com/codex "ignore-user-config" "ignore-rules"`
8. `site:github.com/openai/codex "ignore-user-config" "ignore-rules"`
9. `site:learn.chatgpt.com/docs/codex skills CODEX_HOME skills Codex CLI`
10. `site:developers.openai.com/codex skills Codex CLI`
11. `site:github.com/openai/codex "ignore-user-config" skills`
12. `"--ignore-user-config" Codex skills`
13. `Codex CLI --ignore-user-config --ignore-rules skills automation hermetic`
14. `Codex CLI user skills ignore config reproducible automation`
15. `site:zenn.dev Codex ignore-user-config ignore-rules`
16. `site:zenn.dev Codex skills CLI automation isolation`

Representative strong existing coverage includes OpenAI's official Non-interactive mode, Developer commands, and Build skills pages, plus the independent [Make CI runs reproducible with --ignore-user-config and --ignore-rules](https://www.agentscli.com/course/codex/automation/reproducible/) page (publication/update date not displayed; accessed 2026-08-15). That independent guide correctly narrows the flags to user `config.toml` and execpolicy `.rules`, warns that `AGENTS.md` remains, and lists additional reproducibility inputs such as hooks and MCP servers. It does not test or provide a gate for the separate user-skill discovery path.

The Zenn-specific queries did not surface a directly matching article in the observed results. This describes the returned search results only; it does not prove no Japanese article exists.

## Official and primary sources

1. [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-15.
   - Clearly marked paraphrase: `--ignore-user-config` prevents a run from loading `$CODEX_HOME/config.toml`; `--ignore-rules` skips user and project execpolicy `.rules` files.
   - Clearly marked paraphrase: the same automation section recommends least-privilege sandboxing and describes the two flags as controls for a controlled automation environment, not as a universal switch for every filesystem-derived input.
   - Relevance: establishes the exact documented boundary of the two flags. The page does not say that either flag disables skill discovery.

2. [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-15.
   - Clearly marked paraphrase: the current `codex exec` reference defines `--ignore-user-config` as skipping `$CODEX_HOME/config.toml` while authentication still uses `CODEX_HOME`, and defines `--ignore-rules` as skipping user and project execpolicy `.rules` files.
   - Clearly marked paraphrase: current `codex exec` also exposes `--sandbox read-only`, `--ephemeral`, `--skip-git-repo-check`, `--json`, `--output-schema`, and `-o`, which permit a bounded later probe.
   - Relevance: supports a fixture that changes `HOME` for skill discovery without copying authentication and that records a normal authenticated result without broad filesystem permission.

3. [Build skills](https://learn.chatgpt.com/docs/build-skills)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-15.
   - Clearly marked paraphrase: Codex begins with a model-visible list containing each discovered skill's name, description, and path, then reads full `SKILL.md` instructions when a skill is selected.
   - Clearly marked paraphrase: Codex can activate a skill through an explicit `$skill-name` mention or implicit description matching.
   - Clearly marked paraphrase: user-scoped skills are discovered from `$HOME/.agents/skills` and are intended to apply across repositories; the documented way to disable a local skill without deleting it is a `[[skills.config]]` entry in `~/.codex/config.toml`.
   - Relevance: establishes that skill discovery is a filesystem input separate from the `config.toml` file that `--ignore-user-config` suppresses. Combining the two official pages suggests the selected boundary but does not replace a version-pinned behavioral check.

4. [Codex CLI 0.147.0 release](https://github.com/openai/codex/releases/tag/rust-v0.147.0)
   - Publisher: OpenAI's official Codex repository.
   - Released: 2026-08-07.
   - Accessed: 2026-08-15.
   - Exact release fact: the page identifies version `0.147.0`, tag `rust-v0.147.0`, and commit `be6e8ea`.
   - Clearly marked paraphrase: the release includes skill-catalog budgeting and skill-routing work among its changes, so an older skill-discovery observation should not be treated as sufficient evidence for this local current binary.
   - Relevance: pins the proposed check to the locally installed release and explains why the claim must be version-scoped.

## Community and issue coverage used only as hypotheses

1. [Project-level config should support disabling global/user skills while preserving repo skills, openai/codex issue #24237](https://github.com/openai/codex/issues/24237)
   - Author/source: community bug report in the OpenAI Codex repository; not official product documentation.
   - Opened: 2026-05-23.
   - Reported version/environment: Codex CLI `0.133.0`, GPT-5.5, macOS arm64.
   - Accessed: 2026-08-15.
   - Reported observation: a user skill under `~/.agents/skills` remained in the model-visible skills block despite a project-level attempt to disable it; a session-level `-c 'skills.config=[...]'` control removed it.
   - Use here: strong hypothesis that user-skill discovery and session-level filtering are separate from project configuration. It does not test `--ignore-user-config`, `--ignore-rules`, version 0.147.0, explicit invocation, a disposable home, or an unknown-marker oracle.

2. [Make CI runs reproducible with --ignore-user-config and --ignore-rules](https://www.agentscli.com/course/codex/automation/reproducible/)
   - Author/source: independent community tutorial; not OpenAI documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-15.
   - Guidance: use the two flags to remove personal `config.toml` and execpolicy `.rules` variability, while recognizing that `AGENTS.md` remains and that complete reproducibility also requires pinning other inputs.
   - Use here: representative strong existing guidance and a competing scope boundary. It is accurate about the two named layers but supplies no direct evidence or decision rule for `$HOME/.agents/skills`.

3. [[TypeScript SDK] Expose hardened execution controls for automation, openai/codex issue #34802](https://github.com/openai/codex/issues/34802)
   - Author/source: community feature request in the OpenAI Codex repository; not official product documentation.
   - Opened: 2026-07-22.
   - Accessed: 2026-08-15.
   - Reported need: SDK users want equivalents of `--ignore-user-config` and `--ignore-rules` before automation starts because ordinary overrides cannot stop ambient files from loading first.
   - Use here: evidence of a concrete automation-reader need for input isolation, not proof of the selected skills boundary.

No community recommendation is relabeled as an OpenAI recommendation.

## Candidate assessment

### Selected: user skill discovery under both `codex exec` isolation flags

This boundary is selected because the two flags have names broad enough to be mistaken for a clean-context mode, yet the official contracts describe only `config.toml` and execpolicy files while skills are discovered from another home-directory tree. A personal skill can contribute name, description, path, and eventually full instructions to an unattended run without appearing in the script's prompt or named configuration flags. A disposable two-case fixture can turn that abstract distinction into a precise adoption rule: do not call the invocation skill-hermetic until the user skill catalog has its own control and oracle.

The article would add more than an official feature summary by testing the interaction of two separately documented subsystems, showing a false-clean control, and mapping one hidden marker to a real CI wrapper that inherits a developer or runner home directory.

### Excluded candidates

- `--ignore-rules` versus project `AGENTS.md`: official and strong independent guidance already state that `--ignore-rules` means execpolicy files, not project instructions. More importantly, this repository already has an article and report centered on observable `AGENTS.md` loading, so another instruction-marker article would be substantively too close.
- `--ignore-user-config` versus user execpolicy rules: the separate `--ignore-rules` flag and official reference already answer this directly. A two-flag tutorial without a third input would only restate documentation.
- `--strict-config`: official documentation already states that it errors on unrecognized configuration fields. This search did not establish a narrower uncovered precedence or semantic-validation failure.
- Codex `--approve-for-me`: version 0.147.0 makes the flag easier to invoke, but a fair adoption claim needs several approval categories, reviewer outcomes, and policy states. A tiny no-tool fixture cannot support a useful safety conclusion.
- Codex Agent Plugins: the current repository now contains a detailed Claude Code Agent Plugins implementation-boundary article. A cross-client plugin comparison was rejected because no concrete distribution decision requiring both clients was established.
- Claude Code `--settings` plus `--setting-sources`: official documentation explicitly says that `--settings` merges with file-based settings and that omitted keys remain. A first local matrix would mostly restate the documented precedence, while Claude `--bare` is already the documented scripted-isolation mode.
- Claude Code `--safe-mode`: official documentation and current local help directly enumerate the disabled customization categories. No narrower version-specific failure with better practical value was established.
- Cross-provider isolation comparison: rejected because a Claude-versus-Codex comparison is unnecessary for deciding whether one Codex CI wrapper inherits personal skills.

## Selected falsifiable practice claim

> With the locally installed Codex CLI 0.147.0, a non-interactive run launched with both `--ignore-user-config` and `--ignore-rules` still discovers and explicitly invokes an instruction-only user skill placed only at `$HOME/.agents/skills/ambient-probe/SKILL.md`: when the skill body contains a randomly generated marker that is absent from the prompt and output schema, the treatment run returns that exact marker, while a matched disposable-home control with no skill returns no marker. Therefore these two flags are not, by themselves, a skill-hermetic automation boundary.

This is one conjunctive configuration-boundary claim. It is false if the treatment cannot discover the exact skill, cannot return the hidden fixture marker after explicit invocation, either flag suppresses the skill, or the no-skill control returns the marker. It is inconclusive if the marker leaks into the prompt/schema/logged command, the two cases do not share the same non-skill inputs, authentication fails, the wrong CLI version runs, the skill catalog is truncated, an unrelated same-name skill is present, or the model does not honor the explicit invocation despite discovery.

The claim does not say that `--ignore-user-config` is broken. Its documented job is to skip `$CODEX_HOME/config.toml`; the proposed evidence tests the separate and narrower question of whether that constitutes complete model-context isolation.

## Target reader and practical uncertainty

- Reader: a CI, evaluation, or local-automation maintainer who uses `codex exec --ignore-user-config --ignore-rules` on a developer workstation, self-hosted runner, or reused container home.
- Situation: the maintainer wants a run whose instructions come only from the checked-in fixture and explicit prompt, while retaining normal authenticated Codex access.
- Current problem: the two visible isolation flags remove two important layers, but user skills live under a different home-directory path and can add model-visible routing metadata or full instructions. The wrapper has no retained proof that the skill catalog was absent.
- Decision after reading: whether the two flags alone are sufficient for a skill-hermetic gate. The promised action is a copyable disposable-home/control check and a stop condition when an ambient skill marker survives.

## Article promise

The article would let the reader reproduce one hidden-input boundary with an inert, instruction-only skill and no task-side tools: the same explicit `$ambient-probe` prompt fails closed in an empty disposable home but returns a marker known only to the skill body when that user skill exists. It would then turn the result into a practical rule: treat `--ignore-user-config --ignore-rules` as targeted layer controls, not a universal clean-context switch, and separately isolate or explicitly filter the user skill catalog before calling an automation skill-hermetic.

If the treatment does not reproduce on 0.147.0, the article should report the current non-reproduction only if the evidence establishes a useful version boundary; it must not preserve the expected warning as though it were observed.

## What existing sources answer and the remaining coverage gap

Official documentation already answers:

- `--ignore-user-config` skips `$CODEX_HOME/config.toml` while authentication still uses `CODEX_HOME`;
- `--ignore-rules` skips user and project execpolicy `.rules` files;
- Codex discovers user skills from `$HOME/.agents/skills`;
- discovered skills contribute name, description, and path to the initial model-visible list, and full `SKILL.md` is loaded when selected;
- a skill can be explicitly invoked with `$skill-name`;
- local skills can normally be disabled through `[[skills.config]]` in `~/.codex/config.toml`.

Strong independent coverage already explains that the two flags remove fewer inputs than their names may imply and explicitly calls out the `AGENTS.md` exception. A community issue reports that user skills can resist one project-level filter on 0.133.0 and that a session override can filter them.

The precise remaining gap is retained, current primary execution evidence on the local 0.147.0 binary that combines both isolation flags with a disposable `HOME`, proves the treatment-only user skill was actually consumed via a hidden random marker, proves the no-skill control cannot produce that marker, and checks that no tool or unrelated configuration path explains the result. This resolves a concrete automation decision without retesting general skill authoring or general `AGENTS.md` loading.

## Practical mapping

| Local fixture element | Real-work analogue |
| --- | --- |
| disposable `HOME` containing only `.agents/skills/ambient-probe/SKILL.md` | a self-hosted runner or developer home with personal skills installed |
| instruction-only skill with a random hidden marker | an ambient workflow's private instructions, routing metadata, or required output convention |
| `--ignore-user-config --ignore-rules` | a CI wrapper intended to remove machine-local preferences and command-policy files |
| matched empty-home control | a clean runner image with no personal skills |
| exact `$ambient-probe` invocation | an automation prompt or generated task that explicitly references an installed workflow |
| treatment-only exact marker | proof that full skill instructions, not only a name guess, reached the model |
| zero tool events and unchanged fixture inventory | separation of prompt-context loading from shell, MCP, web, hook, or filesystem side effects |

The marker models only skill-instruction consumption. It does not claim that every installed skill triggers implicitly, that skills override higher-priority instructions, that a malicious skill escapes the sandbox, or that all home-directory inputs are covered by the proposed harness.

## Minimal verification idea

In a later plan/run stage, create two fresh temporary non-Git cases under one isolated run directory. Both receive:

- an empty workspace with no `AGENTS.md`, `.codex`, `.agents`, plugin, MCP, hook, rule, or source files;
- a disposable `HOME` containing no ordinary shell dotfiles or unrelated skills;
- the same dependency-free JSON Schema requiring exactly `status` and `value` string fields, without embedding the random marker;
- the same prompt: explicitly use `$ambient-probe`, follow it, use no tools, and return `status: "loaded"` when available or `status: "unavailable"` otherwise. The prompt must not contain the marker or describe its format beyond the generic schema.

Case A is the control: its disposable home has no `ambient-probe` directory. Case B is the treatment: before either invocation, the wrapper creates `$CASE_HOME/.agents/skills/ambient-probe/SKILL.md` with valid frontmatter and instruction-only content telling Codex to return `status: "loaded"` and a high-entropy, non-sensitive marker generated for that run. Store the expected marker in the verifier's evidence area, never in the CLI prompt, output schema, command arguments, or filenames.

Run the installed Codex once per case with `HOME` set to the case home, `CODEX_HOME` left pointing to the existing authenticated Codex home, and these explicit controls: `codex exec --sandbox read-only --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check --json --output-schema <schema> -o <result> -C <empty-workspace> <prompt>`. Use a finite timeout, no retries, no web search, no MCP configuration, no plugin flags, no added directories, and no approval/sandbox bypass.

The wrapper must not read, copy, hash, print, or enumerate credential files. It may check only a sanitized authentication precondition or let the first invocation fail closed. Record `HOME` and `CODEX_HOME` roles symbolically in the command transcript rather than exposing private absolute paths.

Use a dependency-free Node.js verifier to check the case descriptors, skill file hash, prompt/schema absence of the marker, process exits, JSONL completion events, final output schema, exact marker equality, zero tool/file/web/MCP events, and post-run file inventory. The control supports the oracle only when it returns `unavailable` or otherwise omits the marker; the treatment supports it only when it returns the exact hidden marker.

An optional diagnostic may run `codex debug prompt-input` against each disposable home before the paid calls to confirm that the control has no same-name skill and the treatment lists exactly one expected path. Because `debug prompt-input` does not expose the two exec isolation flags in local 0.147.0 help, this is fixture validation only and must not be presented as proof of the selected claim.

## Local feasibility observed without running the practice

- `codex --version` returned `codex-cli 0.147.0` on 2026-08-15.
- Local `codex exec --help` exposes `--sandbox read-only`, `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `--skip-git-repo-check`, `--json`, `--output-schema`, `-o`, and `-C`.
- Local `codex debug prompt-input --help` exposes a JSON rendering of model-visible prompt inputs, but not the two exec-specific ignore flags; it can validate fixture discovery only.
- Node.js `v22.17.0` is available and is sufficient for a dependency-free fixture verifier; no package installation is needed.
- The fixture can be instruction-only, with no shell command, file edit, MCP call, web search, Git operation, or production system access requested from the model. Model API access is necessarily external, but the task fixture itself is offline and static.
- Authentication was not exercised, inspected, copied, printed, or modified. A later run must treat ordinary authenticated Codex access as a prerequisite and stop cleanly if it is unavailable.
- No fixture, manifest, practice directory, or execution log was created in this search stage.

## Expected evidence and decision rule

Retain and evaluate:

- exact `codex-cli 0.147.0` version output and a sanitized invocation template;
- per-case normalized inventory and hashes for the workspace, schema, and treatment skill;
- proof that the random marker is absent from the prompt, schema, CLI arguments, filenames, control home, and all pre-invocation evidence except the treatment `SKILL.md` and verifier expectation;
- optional prompt-input diagnostics showing zero same-name skills in control and one treatment skill at the expected disposable-home path, clearly labeled diagnostic rather than claim evidence;
- process exit code 0, parseable JSONL, exactly one `turn.completed`, and no failed/fatal event per case;
- no completed command execution, file change, MCP tool call, web search, hook, plugin, or unexpected plan/tool event;
- independently schema-validated final output for each case;
- exact control/treatment comparison for `status`, `value`, and marker occurrence;
- confirmation that the workspace and skill inputs are unchanged and that no unexpected file appeared inside either case home or workspace.

Support the claim only if all shared-input and completion gates pass, the control never contains the marker, and the treatment returns the exact marker stored only in its user `SKILL.md`. Classify as `not reproduced` if both cases reach the intended boundary and the treatment skill is demonstrably discovered but its hidden marker is not returned, or if the treatment behaves identically to the empty-home control. Classify as `inconclusive` if discovery is ambiguous, the skill list is truncated, an unrelated same-name skill exists, the marker leaks, authentication/version/completion differs, the model ignores an otherwise visible explicit skill, any tool is used, or evidence is incomplete.

The adoption rule is narrower than “Codex cannot be isolated.” It is: do not describe `--ignore-user-config --ignore-rules` as skill-hermetic. When personal skill absence matters, provide a separately controlled home/catalog or an explicit session-level skill filter, and run a hidden-marker control before trusting the wrapper. The later experiment may demonstrate the disposable-home pattern; it must not claim a universal isolation recipe for plugins, hooks, MCP servers, managed configuration, system skills, memory, or other host inputs.

## Safety, cost, and stop conditions

- Use only fresh temporary case homes and empty workspaces. Never create, remove, or modify a skill in the user's real `$HOME/.agents/skills`, `$CODEX_HOME/skills`, repository root, or system directories.
- Keep `CODEX_HOME` unchanged only so normal authentication remains available; do not read, copy, list, hash, print, relocate, or modify its credential files or config contents.
- Use `read-only` sandboxing, no added writable directories, no task-side network, no web search, no MCP servers, no plugins, no hooks, no Git operations, no dependency installation, and no danger-full-access or approval/sandbox bypass.
- Allow exactly two paid/model invocations, one control and one treatment, each with a finite timeout and no automatic retry. Record usage only if surfaced in already-sanitized output; make no cost or performance claim.
- The wrapper may write declared JSONL, stderr, final-result, hash, and verification files outside the agent's read-only workspace. It must use explicit validated temporary paths and keep evidence free of credentials and private home paths.
- Stop before execution if the real CLI version differs, the disposable homes are not exclusive, the marker already appears outside the treatment skill/verifier, ordinary authentication is unavailable, output redaction cannot be guaranteed, or any required flag is absent.
- Stop a case on an unexpected tool, file mutation, network/MCP/plugin/hook event, timeout, fatal/failed/duplicate completion event, same-name skill collision, skill-budget warning that can omit the probe, or verifier disagreement. Preserve the case as evidence and do not retry automatically.
- Do not publish, commit, stage, branch, push, create a PR, or contact external services other than the authenticated Codex model endpoint required for the later run.

## Recommended editorial stance if later evidence is obtained

- Lead with the reader decision: the two flags are targeted controls for `config.toml` and execpolicy files, not a promise that every home-derived model input is absent.
- Show the empty-home control and hidden-marker treatment side by side; the marker must remain absent from the prompt and schema so the result demonstrates skill-body consumption rather than prompt echo.
- Keep the conclusion scoped to Codex CLI 0.147.0, the recorded skill location, explicit invocation path, and two bounded cases.
- Do not call the behavior a vulnerability or a broken flag. It is a configuration-boundary and harness-design result unless evidence shows a contradiction with a documented guarantee.
- Distinguish model-context isolation from filesystem sandboxing and authentication. A loaded skill does not by itself prove tool execution, privilege escalation, or credential exposure.
- If the treatment is not reproduced, report only the established version/location boundary and avoid recommending unnecessary cleanup or filtering.
