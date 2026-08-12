# Final editorial review: project-root-agent-instructions

verdict: pass
blockers: 0
warnings: 0
article_type: configuration-harness
editorial_score: 90/100

## Scope

- Article: `articles/project-root-agent-instructions.md`
- Analysis and editorial brief: `logs/agent/analysis-project-instruction-loading-20260811-1307.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Research: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`
- Revision log: `logs/agent/revise-project-root-agent-instructions-20260811-1312.md`
- Review time: 2026-08-11 13:13 JST

The supplied artifacts describe the same four-case project-root instruction-loading ablation. The article was reviewed without editing it.

## Publication integrity gates

- Deterministic article check: passed with `published: false` and slug `project-root-agent-instructions`.
- Result trace: the four result rows match their `metrics.json`, `verify.log`, and `diff.patch` files. Both guided cases alone add the exact marker, all four verifiers exit `0`, protected files are unchanged, and no unexpected path changes.
- Prompt and guidance trace: the displayed common prompt matches the manifest and four command records and omits the marker requirement; the displayed completion requirements match both guidance files.
- Version and condition trace: Claude Code `2.1.227`, Codex CLI `0.147.0`, Node.js `v22.17.0`, null model and effort overrides, one run per case, and the 300-second timeout match recorded artifacts.
- Interpretation trace: the article labels the marker as behavioral evidence, not direct context observation, enforcement, repeated-run reliability, or provider performance.
- Safety trace: the article accurately records Codex workspace network isolation and the lack of equivalent OS-level isolation for the host-run Claude cases. It presents `bypassPermissions` as a historical unsafe condition rather than a recommended template and cites current Anthropic isolation guidance.
- Source trace: product discovery and non-interactive-mode claims match the research report and first-party source recheck recorded on 2026-08-11.
- Secret check: no private-key headers, populated API-key assignments, bearer credentials, or token-like values were found in the article or new analysis/review/revision artifacts.

## Editorial score

### Reader problem and promise — 18/20

The first paragraphs establish the concrete ambiguity, give the recorded result, and state the behavioral-verification decision rule before setup detail. The article clearly serves engineers using project instructions in CI or other non-interactive runs. Two points are reserved because the opening describes the reader situation generally rather than from a recorded production incident, which the evidence does not provide.

### Insight and original value — 18/20

The article no longer centers the documentation-level question of whether root files are discovered. Its visible contribution is the five-part harness and the distinction between project guidance and enforcement. The takeaway remains consistent in the opening, interpretation, practical mapping, and ending.

### Explanation and story — 13/15

The argument now advances from ambiguity to result, experimental separation, reusable harness, interpretation, reproduction, limits, and decision rule. Prerequisites and safety caveats appear after the result and close to the commands they constrain. The evidence contains no recorded surprise or changed personal belief, so omitting that narrative is correct.

### Evidence and reproducibility — 18/20

The result table, representative marker diff, exact common prompt, exact guidance content, changed-path assertions, runner command, versions, safety boundary, and limitations are adjacent to the claims they support. Full per-provider flags and secondary Codex warnings remain in raw evidence rather than overwhelming the body. Two points are reserved for the inherent one-run and unresolved-backend limitations, not for a correctable article defect.

### Practical action — 14/15

The five-part checklist and fixture-to-real-work mapping give the reader an immediately adaptable method while avoiding an unsafe copy-paste Claude command. The final decision rule clearly separates guidance from deterministic acceptance and write-boundary enforcement.

### Readability and authorial judgment — 9/10

The outcome-focused title, claim-oriented headings, early table, short lists, and consolidated limitations make the article scannable. Evidence-backed editorial judgment is explicit without inventing an anecdote, emotion, or first-person experience. Minor density remains in the reproduction section, but it is necessary for interpreting the recorded safety boundary.

## Verdict rationale

The article has zero integrity blockers and zero warnings. Its editorial score is 90/100, and every category is above half credit. The revision resolves all four prior warnings using existing evidence, so the correct verdict is `pass`.
