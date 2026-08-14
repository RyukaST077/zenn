# Codex exec `--ephemeral` at the resume boundary: does the existing rollout still grow?

## Research contract

- Research date: 2026-08-14 (JST)
- External-source access date: 2026-08-14
- Requested scope: current, practical Claude Code or OpenAI Codex know-how not already covered by this repository
- Selected provider: OpenAI Codex CLI only
- Proposed mode: `boundary`
- Likely article type: `failure`
- Selected version boundary: locally installed Codex CLI `0.147.0`, released 2026-08-07
- Performance or provider comparison: excluded. The claim concerns one Codex persistence contract, not model quality, speed, cost, or Claude Code.
- Practice execution: not performed in this search stage.
- Git, publishing, credential, production, and external-system mutations: not performed.

## Explicit constraints

- Select exactly one current, article-worthy, falsifiable practice claim.
- Exclude substantive duplicates in `articles/*.md` and `research/agent/*.md`.
- Prefer current OpenAI documentation and version-pinned OpenAI source; use community material only to identify a hypothesis that must be retested.
- Require a later check to use a bounded local fixture, harmless marker text, read-only sandboxing, finite invocations, and no dependency installation.
- Do not inspect, copy, print, relocate, or modify credentials.
- Do not create a practice plan, execute Codex against a fixture, draft an article, publish, send external messages, or alter Git state in this stage.

## Existing repository exclusions

All 38 Markdown files under `articles/` and all four earlier reports under `research/agent/` were inspected by path, title, and relevant content on 2026-08-14.

- `articles/project-root-agent-instructions.md` and `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md` already cover behavioral verification of root `CLAUDE.md` / `AGENTS.md` loading. The selected topic does not test instruction discovery or compliance.
- `articles/codex-pretooluse-dispatch-preflight.md` and `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md` already cover Codex hook dispatch, deny behavior, and side-effect oracles. The selected topic disables user configuration and rules and tests session-file persistence instead.
- `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md` covers Claude Code subprocess credential scrubbing and shell-startup side effects. Claude environment isolation is excluded.
- `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md` covers Codex JSONL message finality and `-o` as a completion artifact. The selected topic uses JSONL only to obtain the exact session ID; it makes no stream-parser claim.
- `articles/codex-gpt-5-6-model-guide.md` covers GPT-5.6 model-family and reasoning-level selection. Model choice, benchmarks, latency, and quality are excluded.
- No existing article or prior agent report covers Codex `--ephemeral`, session rollout persistence, the interaction between `codex exec resume` and `--ephemeral`, or a file-level non-persistence gate.
- The remaining articles concern Zenn publishing or non-agent engineering topics and are not substantive duplicates.

## Searched queries and representative coverage

Live web search was performed on 2026-08-14 with these representative queries:

1. `site:docs.anthropic.com/en/docs/claude-code add-dir CLAUDE.md additional directories`
2. `site:code.claude.com/docs add-dir CLAUDE.md CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`
3. `site:developers.openai.com/codex CLI feature configuration rules sandbox AGENTS 2026`
4. `site:github.com/openai/codex releases 2026 CLI new feature`
5. `site:developers.openai.com/codex "--ephemeral" codex exec`
6. `site:github.com/openai/codex "--ephemeral" session persistence`
7. `site:code.claude.com/docs "--fork-session" "--resume" CLI`
8. `site:code.claude.com/docs "--no-session-persistence"`
9. `site:github.com/openai/codex "Run without persisting session rollout files to disk"`
10. `site:developers.openai.com/codex/cli/reference ephemeral`
11. `site:github.com/openai/codex "ephemeral" "resume" "ThreadResumeParams"`
12. `site:github.com/openai/codex/issues/20084 ephemeral resume fixed`
13. `site:github.com/openai/codex/releases/tag/rust-v0.147.0`
14. `site:github.com/openai/codex/blob/rust-v0.147.0 "thread_resume_params_from_config"`
15. `site:github.com/openai/codex/blob/rust-v0.147.0 "pub struct ThreadResumeParams"`
16. `"codex exec --ephemeral resume"`
17. `Codex CLI --ephemeral resume rollout persistence article`
18. `Zenn Codex ephemeral resume セッション 永続化`
19. `Codex --ephemeral resume regression 0.147.0`
20. `Codex exec ephemeral session privacy automation`

Representative strong existing coverage includes the official OpenAI CLI reference and non-interactive guide, the independent [Codex CLI Session Lifecycle article](https://codex.danielvaughan.com/2026/06/08/codex-cli-session-lifecycle-archive-resume-fork-rollout-persistence-management/) (published 2026-06-08, updated 2026-07-05, accessed 2026-08-14), and the Zenn article [Codex CLIでもセッションの再開（resume）を簡単にするためのCLIツール、「cdxresume」を作った](https://zenn.dev/sasazame/articles/7b66fce66a0e85) (published 2025-09-03, updated 2025-09-06, accessed 2026-08-14). These explain ordinary ephemeral runs, rollout storage, or session resume. None of the representative articles tests whether `--ephemeral` remains effective when attached to `codex exec resume` on current CLI `0.147.0`. The Japanese query surfaced resume tooling but no directly matching current persistence-boundary article; that observation does not prove no such Japanese article exists.

## Official and primary sources

1. [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: `codex exec` is stable, supports a resume subcommand, and exposes `--ephemeral` with the stated behavior of running without persisting session rollout files to disk.
   - Clearly marked paraphrase: `--ignore-user-config` skips `$CODEX_HOME/config.toml` while authentication still uses `CODEX_HOME`; `--ignore-rules` skips user and project execpolicy rules; `read-only` is an available sandbox.
   - Relevance: establishes the user-visible non-persistence contract and the controls needed for a bounded check. It does not document an exception for resumed sessions.

2. [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: OpenAI instructs users to add `--ephemeral` when they do not want session rollout files persisted to disk.
   - Relevance: gives the practical automation promise whose resume boundary must be checked; the example is a fresh `codex exec`, not a resumed run.

3. [Codex CLI 0.147.0 release](https://github.com/openai/codex/releases/tag/rust-v0.147.0)
   - Publisher: OpenAI's official Codex repository.
   - Released: 2026-08-07.
   - Accessed: 2026-08-14.
   - Exact release fact: the page identifies `0.147.0` as the latest release at access time, tag `rust-v0.147.0`, commit `be6e8ea`.
   - Relevance: pins the proposed check to the locally installed current executable instead of extrapolating from an older report.

4. [Codex 0.147.0 exec source](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/lib.rs)
   - Publisher: OpenAI's official Codex repository, version-pinned source.
   - Version publication date: 2026-08-07 with release `0.147.0`; no separate file date is displayed.
   - Accessed: 2026-08-14.
   - Clearly marked source observation: `thread_start_params_from_config` assigns `ephemeral: Some(config.ephemeral)` to `ThreadStartParams`.
   - Clearly marked source observation: the adjacent `thread_resume_params_from_config` constructs `ThreadResumeParams` but has no assignment for `config.ephemeral`; it ends with `..ThreadResumeParams::default()`.
   - Relevance: supplies version-pinned implementation evidence for an asymmetric start/resume path. Source inspection supports the hypothesis but does not substitute for observing the installed binary's filesystem behavior.

5. [Codex 0.147.0 thread protocol](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/app-server-protocol/src/protocol/v2/thread.rs)
   - Publisher: OpenAI's official Codex repository, version-pinned source.
   - Version publication date: 2026-08-07 with release `0.147.0`; no separate file date is displayed.
   - Accessed: 2026-08-14.
   - Clearly marked source observation: `ThreadStartParams` includes `ephemeral: Option<bool>`.
   - Clearly marked source observation: `ThreadResumeParams` includes model, working-directory, permission, configuration, instruction, personality, and history-page overrides, but no `ephemeral` field.
   - Relevance: confirms that the omission is present in the version-pinned public protocol shape rather than only in one call site.

6. [Codex 0.147.0 app-server README](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/app-server/README.md)
   - Publisher: OpenAI's official Codex repository, version-pinned primary engineering documentation.
   - Version publication date: 2026-08-07 with release `0.147.0`; no separate file date is displayed.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: `thread/start` and `thread/fork` accept `ephemeral: true`; an ephemeral thread is intentionally in-memory and has a null path. The documented `thread/resume` operation reopens a stored thread so later turns append to it and does not advertise an ephemeral parameter.
   - Relevance: describes the lower-level lifecycle boundary that plausibly explains why a CLI flag can work for fresh runs yet fail on resume.

## Community and issue coverage used only as hypotheses

1. [Regression: `codex exec --ephemeral resume <id>` silently persists rollouts, openai/codex issue #20084](https://github.com/openai/codex/issues/20084)
   - Author/source: community bug report in the OpenAI Codex repository; not official product documentation or an accepted OpenAI conclusion.
   - Opened: 2026-04-28; displayed as open with no linked development at access time.
   - Reported versions: reproduced on `0.113.0`, `0.123.0`, `0.124.0`, and `0.125.0`; reported not reproduced on `0.112.0`.
   - Accessed: 2026-08-14.
   - Reported observation: an `--ephemeral` resumed turn increased the existing rollout and became visible to a later ordinary resume.
   - Use here: the report supplies the test hypothesis and an older-version reproduction shape only. Its result is not treated as evidence that local `0.147.0` reproduces the bug.

2. [Codex CLI Session Lifecycle: Archive, Resume, Fork, and Rollout Persistence](https://codex.danielvaughan.com/2026/06/08/codex-cli-session-lifecycle-archive-resume-fork-rollout-persistence-management/)
   - Author/source: independent community reference; not OpenAI documentation.
   - Published: 2026-06-08; updated: 2026-07-05.
   - Accessed: 2026-08-14.
   - Guidance: describes rollout JSONL files, the session index, ordinary resume, and non-interactive resume.
   - Use here: representative strong existing lifecycle coverage. It makes the selected narrow failure boundary more useful than another general session-management tutorial.

3. [Codex CLIでもセッションの再開（resume）を簡単にするためのCLIツール、「cdxresume」を作った](https://zenn.dev/sasazame/articles/7b66fce66a0e85)
   - Author/source: independent Zenn article; not OpenAI documentation.
   - Published: 2025-09-03; updated: 2025-09-06.
   - Accessed: 2026-08-14.
   - Coverage: explains early Codex resume tooling and rollout JSONL use around the transition to official resume support.
   - Use here: representative Japanese resume coverage; it does not answer current `--ephemeral` resume persistence.

No community recommendation is relabeled as an OpenAI recommendation.

## Candidate assessment

### Selected: `--ephemeral` non-persistence at the `codex exec resume` boundary

This boundary is selected because automation authors can reasonably read one documented flag as applying to the invocation that accepts it. If the resumed turn is appended anyway, temporary workspace isolation and read-only command sandboxing do not prevent prompt, response, or tool-result text from remaining in the separate Codex session store. The failure is measurable without judging model quality: hash, byte size, line count, and a harmless exact marker in one known rollout before and after the resumed invocation. Current version-pinned source still shows the same missing resume field described by the older issue, making a fresh `0.147.0` check timely rather than archival.

### Excluded candidates

- Claude Code `--add-dir` configuration discovery: current official documentation already gives a detailed matrix—skills load automatically, CLAUDE files require `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`, and most other configuration is ignored. A basic local matrix would mostly restate the documentation and is adjacent to the repository's instruction-loading coverage.
- Claude Code `--no-session-persistence`: official documentation already states the transcript suppression control. This search did not establish a narrower current residual-write failure with stronger evidence than the selected Codex boundary.
- Codex fresh `--ephemeral` behavior: official docs and source align on new thread creation. Testing only a fresh run would be a smoke test with less practical value than the asymmetric resume path.
- Codex JSONL final-message handling: already selected in `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md` and therefore excluded as a duplicate.
- Codex `--approve-for-me`: current release notes introduce it, but a fair safety claim requires multiple approval categories and is not needed for the selected reader decision.
- Cross-provider persistence comparison: rejected because Claude-versus-Codex comparison would not help a maintainer decide whether one Codex command satisfies its own non-persistence requirement.

## Selected falsifiable practice claim

> With the locally installed Codex CLI `0.147.0`, a successful `codex exec resume <session-id> --ephemeral` turn appends the resumed user/assistant turn to that session's pre-existing rollout JSONL despite the flag's documented non-persistence contract: the exact rollout's SHA-256, byte size, and line count change, and a unique harmless resume marker appears in newly appended records. Therefore automation that requires the resumed turn not to be written must not treat `--ephemeral` as an effective control on this version's resume path; it should fail a file-level preflight and avoid that command combination until a version-specific retest passes.

This is one persistence-boundary claim. It is false if a fully successful, correctly targeted run leaves the existing rollout byte-for-byte unchanged and the marker absent. It is inconclusive if the baseline session is not persisted, the exact rollout cannot be resolved uniquely from the emitted session ID, authentication fails, the resume does not complete, a different CLI version runs, or unrelated concurrent Codex activity can mutate the target.

## Target reader and practical uncertainty

- Reader: a CI, batch-runner, or local harness maintainer who resumes a Codex exec session for multi-step work but wants the follow-up turn to be non-persistent.
- Situation: the maintainer sees `--ephemeral` accepted by `codex exec resume` and expects temporary workspace plus this flag to prevent local transcript retention for that invocation.
- Current problem: official CLI text describes one broad non-persistence contract, while current version-pinned start and resume protocol paths are asymmetric. The maintainer cannot tell from exit code or model output whether the existing rollout changed.
- Decision after reading: whether `--ephemeral` can be trusted on resume for CLI `0.147.0`, and how to place a copyable file-level conformance gate before using the combination in a sensitive or high-volume harness.

## Article promise

The article would let the reader reproduce the boundary with two finite calls and harmless exact markers, compare the one known rollout before and after the `--ephemeral` resume, and adopt a version-pinned rule: trust the flag on resume only when a local no-growth/no-marker gate passes. If `0.147.0` does not reproduce the hypothesis, the article should report that non-reproduction and remove the workaround recommendation rather than inheriting the older issue's conclusion.

## What existing sources answer and the remaining coverage gap

Official documentation already answers:

- `codex exec` supports non-interactive sessions and a resume subcommand;
- `--ephemeral` is described as running without persisting session rollout files;
- `--ignore-user-config`, `--ignore-rules`, and `read-only` can reduce unrelated fixture behavior.

OpenAI's version-pinned `0.147.0` source additionally shows:

- a fresh thread-start request explicitly receives `config.ephemeral`;
- the exec resume request does not forward `config.ephemeral`;
- the resume protocol has no ephemeral field, while start and fork do;
- app-server documentation describes resume as reopening a thread so later turns append to it.

The older community issue reports a matching failure only through `0.125.0`, and general session-lifecycle articles explain stored rollouts without testing this flag combination. The precise remaining gap is primary execution evidence from the locally installed current `0.147.0` binary that compares one uniquely identified rollout immediately before and after a successful `--ephemeral` resume, using a harmless marker and machine-checked mutation gates. That evidence would turn an implementation suspicion into a current operational decision rule.

## Practical mapping

| Local fixture element | Real-work analogue |
| --- | --- |
| one persisted baseline session with a unique inert marker | a resumable automation job whose prior context must remain available |
| exact session ID from Codex JSONL | the harness's stored resume handle |
| one uniquely resolved rollout path | the local transcript object whose persistence contract matters |
| SHA-256, byte size, and line count before resume | a content-level preflight baseline, not a filename-existence guess |
| unique inert marker in the resumed prompt | a safe oracle for whether the follow-up turn reached disk |
| `--ephemeral` resumed invocation | a supposedly non-persistent continuation step |
| post-run hash/size/count and marker scan | a CI or wrapper conformance gate for the installed CLI version |

The marker does not model sensitive production content. It models only whether any resumed-turn content is appended under a non-persistence promise. A changed file proves persistence behavior for the fixture; it does not establish OpenAI server retention behavior or encryption properties.

## Minimal verification idea

In a later plan/run stage, create one fresh temporary, non-Git fixture containing only static non-sensitive text and a dependency-free verifier. Generate two unique, clearly harmless marker strings locally: one for the baseline and one for the resumed turn. Do not store credentials, environment dumps, repository content, or production data in the fixture.

1. Record `codex --version`; stop unless it is the explicitly targeted version or the plan has been deliberately repinned with fresh source research.
2. Ensure no other Codex process can be writing the future target session. Do not terminate unrelated user processes; stop if exclusivity cannot be established safely.
3. Run one ordinary baseline `codex exec` in the temporary directory with `--json`, `--sandbox read-only`, `--ignore-user-config`, `--ignore-rules`, and `--skip-git-repo-check`. Prompt it only to reply with the baseline marker and perform no tools. Capture sanitized JSONL, stderr, exit code, and the emitted session ID.
4. Resolve exactly one rollout file whose filename contains that full session ID beneath the existing Codex sessions directory. Do not read or print authentication files, configuration secrets, unrelated rollouts, or environment-variable values. Record only the target path relative to Codex home plus its SHA-256, byte size, line count, and exact harmless-marker counts.
5. Run one resume for that exact ID, placing exec-level controls before the subcommand: `codex exec --ephemeral --json --sandbox read-only --ignore-user-config --ignore-rules --skip-git-repo-check resume <session-id> <prompt>`. Prompt it only to reply with the distinct resume marker and perform no tools. Capture sanitized output and completion state.
6. Recompute the same target rollout's SHA-256, byte size, line count, and the two exact harmless-marker counts. A small dependency-free verifier should compare before/after facts without printing the full rollout.

Cap the experiment at these two model invocations and one target session. Do not add a third ordinary resume merely to ask the model what it remembers: direct file mutation is the selected oracle and avoids a model-dependent semantic test. Do not automatically retry a malformed or incomplete run.

## Local feasibility observed without running the practice

- `codex --version` returned `codex-cli 0.147.0` on 2026-08-14.
- Local `codex exec --help` exposes `--ephemeral` as `Run without persisting session files to disk`, along with `--json`, `--sandbox read-only`, `--ignore-user-config`, `--ignore-rules`, and `--skip-git-repo-check`.
- Local `codex exec resume --help` also accepts `--ephemeral`, `--json`, `--ignore-user-config`, `--ignore-rules`, and an exact session ID.
- Standard local shell tools are sufficient for exact path matching, SHA-256, byte count, line count, and literal marker counting; no package installation is needed.
- The fixture itself can be fully local and inert. The two authenticated model calls necessarily reach the Codex service, but the agent needs no web search, package registry, Git remote, MCP server, connector, or production system.
- Authentication was not exercised, inspected, copied, printed, or modified. A later run must treat ordinary authenticated Codex access as a prerequisite and stop cleanly if unavailable.
- No fixture, manifest, practice directory, execution log, or Codex session was created in this search stage.

## Expected evidence and decision rule

Retain and evaluate:

- exact `codex-cli 0.147.0` version output and sanitized commands;
- both process exit codes and successful terminal events;
- baseline JSONL session ID and proof that exactly one rollout path matches it;
- target rollout relative path, SHA-256, byte size, line count, and exact baseline/resume marker counts before the resumed call;
- the same measurements after the resumed call;
- the resumed JSONL session/thread ID and proof that it targets the same session;
- fixture inventory and proof that neither agent invocation attempted a command, edit, web/MCP call, or unexpected tool.

Support the claim only if both invocations complete successfully, the resumed event targets the exact baseline session, the same rollout changes after the `--ephemeral` resume, byte size or line count increases consistently with an append, and the unique resume marker is absent before but present in the newly persisted content after. Mark the claim `not reproduced` if all gates pass and the rollout remains byte-identical with no resume marker. Mark it `inconclusive` if version, authentication, session resolution, completion, exclusivity, parsing, or mutation attribution fails.

The adoption rule is not “all ephemeral runs are broken.” It is narrower: for `codex exec resume --ephemeral`, pin the CLI version and require a no-growth/no-marker preflight before relying on local non-persistence. A failing preflight means the harness must avoid the combination; possible workflow redesign or a disposable authenticated environment requires separate authorization and is outside this claim.

## Safety, cost, and stop conditions

- Run only in a fresh temporary non-Git directory with inert marker text. Never point the fixture at the repository root, a production checkout, or sensitive files.
- Use `read-only`, `--ignore-user-config`, `--ignore-rules`, no added directories, no web search, no MCP servers, no plugins, no Git operations, and no dependency installation.
- Allow exactly two paid/model invocations, each with a finite timeout and no automatic retries. Record usage if surfaced but make no cost or performance claim.
- Do not inspect, copy, echo, relocate, or modify authentication files or secret-bearing environment variables. Authentication remains in its existing location. Record only sanitized success or failure.
- Inspect only the uniquely resolved rollout for the session created by the experiment. Never scan or print unrelated session contents. The verifier may output hashes, counts, booleans, exact harmless markers, and a relative target path, but not full JSONL records.
- The baseline deliberately creates one harmless persisted session, and the selected failure—if reproduced—adds one harmless turn to it. Preserve it as evidence; do not delete or rewrite user session data automatically.
- Do not publish, commit, stage, branch, push, create a PR, or contact external services other than the authenticated Codex model endpoint required for the two calls.
- Stop before execution if the CLI version or required flags differ, ordinary authentication is unavailable, another process may target the same session, the target rollout is missing or ambiguous, output redaction cannot be guaranteed, or the read-only/config-isolation boundary cannot be established.
- Stop the case on an unexpected tool or command, any attempted edit, network/MCP use, timeout, fatal event, session-ID mismatch, unrelated target mutation, or verifier disagreement. Preserve the failure as evidence and do not retry automatically.

## Recommended editorial stance if later evidence is obtained

- Lead with the reader decision: an accepted flag and exit code are not proof that a resumed turn stayed off disk.
- Show the before/after target measurements and exact harmless-marker boolean, not private rollout content.
- Keep the conclusion scoped to Codex CLI `0.147.0`, `codex exec resume`, the recorded platform, and the two-call fixture.
- Distinguish local rollout persistence from server-side data retention, model memory, encryption, or a general security vulnerability; none of those are tested.
- Describe issue #20084 as the hypothesis source and the local run as the primary evidence. Do not imply OpenAI confirmed the community report.
- If the current run does not reproduce the boundary, publish only if the version-specific non-reproduction still resolves a concrete reader decision; otherwise stop rather than forcing an article.
