# Review: project-root-agent-instructions

verdict: pass
blockers: 0
warnings: 0

## Scope

- Article: `articles/project-root-agent-instructions.md`
- Analysis: `logs/agent/analysis-project-instruction-loading-20260811-1140.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Research: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`
- Review time: 2026-08-11 11:57 JST

The supplied article, analysis, execution log, manifest, and research report all refer to the same `project-instruction-loading-20260811-1133` four-case ablation. The article was reviewed without editing it.

## Deterministic checks

`bash scripts/check-article.sh articles/project-root-agent-instructions.md --expect-published false` passed:

```text
OK: articles/project-root-agent-instructions.md (slug=project-root-agent-instructions, published=false)
```

The frontmatter remains valid and unpublished, and the filename-derived slug is `project-root-agent-instructions`.

## Result and behavior trace

- All four case `metrics.json` files record agent exit 0, no timeout, verifier exit 0, a matching marker expectation, no protected-path changes, no unexpected changes, and `passed: true`.
- All four `verify.log` files contain `PASS: greet returns the required message`.
- Each `diff.patch` changes `src/greet.js` from the fixture error to ``return `Hello, ${name}!`;``. Only the guided diffs add `verification.txt`; both guided markers are exactly `AGENT_RULE_APPLIED`, and neither baseline creates the marker.
- The article's result table and interpretation match the case evidence in `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/{claude-baseline,claude-guided,codex-baseline,codex-guided}/`.
- The draft explicitly limits the conclusion to one run per case, the recorded CLI versions and defaults, root-level behavioral evidence, and no performance or reliability comparison. It does not present the instruction files as enforcement mechanisms or claim direct observation of the internal context.

## Command and reproducibility trace

- The shared prompt in the article matches the manifest and every `command.json`. It contains neither `verification.txt` nor `AGENT_RULE_APPLIED`.
- The displayed Claude command matches both recorded Claude commands after replacing the common prompt with `<prompt>`.
- The displayed Codex command matches both recorded Codex commands after replacing the case directory, result path, and prompt with placeholders.
- The fixture, guidance paths, manifest path, runner path, and runner invocation identify the recorded setup. The guidance files are identical apart from their filenames and match the article's displayed completion requirements.
- The post-run assertions described in the article match the runner's verifier, digest-based changed-path checks, protected paths, allowed changes, and marker comparison in `scripts/agent-practice/run-experiment.mjs:157-205`.
- Node.js `v22.17.0` is correctly labeled as the recorded environment value rather than a manifest-pinned runtime.

## Failure and safety trace

- Both Codex `events.jsonl` files record the stated intermediate `git status --short` exit 128 in non-Git fixture copies, followed by successful recovery and final agent/verifier exit 0.
- Both Codex `stderr.log` files record the stated rollout state-database discrepancy warnings. The draft correctly limits its claim to the observed non-fatal outcome and does not assert a general cause or harmlessness.
- The runner applies `sandbox_workspace_write.network_access=false` only to Codex. The article accurately states that the Claude cases had no enforced network isolation and that absence of a network command in their recorded events is not evidence of isolation.
- The Claude commands used `bypassPermissions` directly on the host. The article accurately separates that historical condition from reader guidance, states that the temporary copy and diff are not a security boundary, and requires an internet-disconnected container/VM/dev container or a safer permission configuration for reproduction.
- No unsafe command is presented without its boundary, and no disposable fixture or post-run diff is described as preventing out-of-fixture side effects.

## Primary-source freshness

The product facts were rechecked against current first-party documentation on 2026-08-11:

- Anthropic documents project `CLAUDE.md` locations and launch-time loading of files at or above the working directory: <https://code.claude.com/docs/en/memory>.
- Anthropic documents `claude -p` as non-interactive and `--bare` as skipping `CLAUDE.md`: <https://code.claude.com/docs/en/headless>.
- Anthropic documents `--safe-mode` as disabling `CLAUDE.md`: <https://code.claude.com/docs/en/cli-reference>.
- Anthropic documents that `bypassPermissions` disables permission prompts and safety checks and is for isolated containers/VMs/dev containers without internet access: <https://code.claude.com/docs/en/permission-modes>.
- Official OpenAI documentation says Codex builds an instruction chain once per run and searches from project root toward the working directory: <https://learn.chatgpt.com/docs/agent-configuration/agents-md>.
- Official OpenAI documentation describes `codex exec` as non-interactive execution for scripts and CI: <https://learn.chatgpt.com/docs/non-interactive-mode>.

The draft's paraphrases remain supported, clearly attributed, and consistent with the recorded research. No community guidance is presented as official.

## Secret and publication checks

- A targeted scan of the article, analysis, research, manifest, plan, and supplied run directory found no private-key headers, bearer credentials, populated OpenAI/Anthropic/Codex API-key assignments, GitHub token forms, or OpenAI/Anthropic token forms.
- The article does not expose credentials or embed user-specific secret values.
- `published: false` remains intact. No publication or Git operation was performed.

## Verdict rationale

The core behavioral claim is fully traceable to the supplied run evidence, external product facts are current and first-party, commands match the run, safety boundaries are explicit, failures and hidden local limitations are disclosed, and deterministic checks pass. There are zero blockers and zero warnings under `references/review-policy.md`; therefore the verdict is `pass`.
