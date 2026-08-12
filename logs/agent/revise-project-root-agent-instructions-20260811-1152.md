# Revision log: project-root-agent-instructions

- Revised at: 2026-08-11 11:52 JST
- Source article: `articles/project-root-agent-instructions.md`
- Review: `logs/agent/review-project-root-agent-instructions-20260811-1148.md`
- Analysis: `logs/agent/analysis-project-instruction-loading-20260811-1140.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Review verdict: `fix`
- Publication state after revision: `published: false`

## Scope confirmation

The source article, review, analysis, and execution log all describe the same single four-case `project-instruction-loading-20260811-1133` ablation: one baseline and one project-root-guided run for Claude Code, and the same pair for Codex CLI. No rerun or new evidence was required by the review.

## Finding dispositions

### W1: All-cases network-disabled claim

- Disposition: resolved.
- Exact edit: replaced the unqualified `ケース内ネットワーク: 無効` environment claim with a provider-specific statement that task-tool network access was disabled only for Codex via `sandbox_workspace_write.network_access=false`; stated that the recorded Claude cases did not enforce network isolation. Added a limitation that the absence of observed Claude network commands is not proof of isolation.
- Evidence used: review W1, including its recorded runner/command/event findings; the supplied analysis conditions and limitations; the supplied execution-log environment and case record.

### B1: Temporary fixture presented as a safety boundary

- Disposition: resolved.
- Exact edit: labeled the displayed Claude command as the historical recorded command rather than a recommended safety template; stated that the host-executed `bypassPermissions` run had neither OS-level filesystem isolation nor enforced network isolation; clarified that a disposable fixture and post-run diff are not security boundaries. Added reader-facing guidance to use an internet-disabled container, VM, or dev container when retaining `bypassPermissions`, or replace it with a narrower permission configuration. Updated the workflow, limitations, and conclusion so they do not imply that the recorded fixture was OS-isolated.
- Evidence used: review B1 and its quoted current Anthropic permission-mode guidance; the recorded Claude command already shown in the article; the supplied analysis reusable recipe and unsupported-variant caution; the supplied execution-log environment.

### W3: Node.js version omitted

- Disposition: resolved.
- Exact edit: added `Node.js: v22.17.0` to the environment section and explicitly noted that it was the recorded research/run-environment value, not a manifest-pinned runtime.
- Evidence used: review W3; the supplied analysis and execution log identifying `node test.mjs` as the deterministic verifier.

### W4: Recoverable Codex command failures omitted

- Disposition: resolved.
- Exact edit: added that `git status --short` exited 128 in both Codex cases because the copied fixtures were not Git repositories; distinguished those intermediate tool failures from final agent and verifier exits of 0. Retained the separate uninvestigated rollout state-database warnings.
- Evidence used: review W4; the supplied analysis case outcomes and observed-warning record; the supplied execution-log case results.

### W5: Exact setup and runner entry omitted

- Disposition: resolved.
- Exact edit: added the fixture source, both guidance-file sources, manifest path, runner path, and repository-root runner invocation. Explained the guided per-case placement and that `--skip-git-repo-check` was required because copied fixtures were not initialized as Git repositories, while not making `git status` succeed.
- Evidence used: review W5; the supplied article's recorded per-provider commands; the supplied analysis reusable recipe; the supplied execution log's manifest and guidance paths.

## Slug and image paths

- Old slug: `project-root-agent-instructions`
- New slug: `project-root-agent-instructions`
- Article path: unchanged at `articles/project-root-agent-instructions.md`
- Image paths/references: unchanged; no slug rename occurred.

## Deterministic check

Executed after the article edits:

```text
bash scripts/check-article.sh articles/project-root-agent-instructions.md --expect-published false
OK: articles/project-root-agent-instructions.md (slug=project-root-agent-instructions, published=false)
```

## Unresolved items

None. Every blocker and warning in the supplied review was resolved using existing evidence. No experiment was rerun, no new verification result was invented, and the article remains unpublished.
