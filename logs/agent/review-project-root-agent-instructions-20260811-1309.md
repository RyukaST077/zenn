# Editorial review: project-root-agent-instructions

verdict: fix
blockers: 0
warnings: 4
article_type: configuration-harness
editorial_score: 63/100

## Scope

- Article: `articles/project-root-agent-instructions.md`
- Analysis and editorial brief: `logs/agent/analysis-project-instruction-loading-20260811-1307.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Research: `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md`
- Review time: 2026-08-11 13:09 JST

The artifacts describe the same four-case project-root instruction-loading ablation. The article was reviewed without editing it.

## Publication integrity gates

No blocker was found.

- The four result rows match the corresponding case `metrics.json`, `verify.log`, and `diff.patch` files.
- The common prompt matches the manifest and command records and omits both `verification.txt` and `AGENT_RULE_APPLIED`.
- The displayed Claude and Codex commands match recorded commands after placeholder substitution.
- Versions, single-run scope, unresolved backend model snapshots, root-only scope, and lack of performance comparison are disclosed.
- The article distinguishes behavioral evidence from direct internal-context observation and does not present instruction files as enforcement.
- The historical Claude `bypassPermissions` command is labeled unsafe as a default and paired with an OS-level isolation recommendation. The article also states that the recorded Claude cases lacked enforced filesystem and network isolation.
- Official-source claims and URLs match the research report and the current-source recheck in `logs/agent/review-project-root-agent-instructions-20260811-1157.md`.
- `published: false` is intact, and the deterministic article check passes.

## Editorial score

### Reader problem and promise — 11/20

The opening identifies non-interactive Claude Code and Codex users, but it starts with a generic `対象読者` section and a description of what was tested. It does not establish the operational ambiguity from the editorial brief: the main task may pass while a project-only completion rule remains unobservable. The answer—verify behavior with a baseline, guidance-only marker, and changed-path checks—does not appear near the beginning.

Article locations: `## 対象読者`, `## 検証したこと`, and the much later `## この方法を使う場面`.

### Insight and original value — 11/20

The article contains the useful insight that instruction files are not enforcement mechanisms and that behavior should be checked, but the title and early thesis emphasize the already documented question of whether the files “work.” The distinctive contribution—a small verification harness and its decision rule—is buried in the interpretation and usage sections.

Article locations: title, `## 主張と公式情報`, `## 結果の解釈`, and `## この方法を使う場面`.

### Explanation and story — 8/15

The evidence is logically consistent, but the body follows artifact order: sources, test definition, environment, fixture, commands, result, interpretation. This delays the decisive result and separates it from the practical reason for running the ablation. The long command and safety material interrupts the main explanatory path before the reader sees what happened.

Article locations: the sequence from `## 主張と公式情報` through `## 再現したコマンドと設定`; the result first appears under `## 観測結果`.

### Evidence and reproducibility — 19/20

This is the strongest dimension. The prompt, guidance content, conditions, command records, deterministic assertions, result matrix, interpretation limits, safety boundaries, and sources are present and consistent with primary evidence. One point is withheld because audit-only command detail dominates the narrative before the result, reducing the evidence's explanatory effectiveness.

Evidence: manifest; all four case metrics, verifiers, diffs, and commands; final integrity review at `logs/agent/review-project-root-agent-instructions-20260811-1157.md`.

### Practical action — 9/15

The article eventually maps the marker to lint, tests, and generated artifacts and supplies a four-step workflow. However, the main reproducible entry point depends on repository-specific fixture and manifest paths, while the exact recorded Claude command is intentionally not a safe default. The article needs a small product-neutral harness pattern the reader can adapt without copying the historical unsafe command.

Article locations: `## 再現したコマンドと設定` and `## この方法を使う場面`.

### Readability and authorial judgment — 5/10

The headings are report labels, several caveats repeat across the command section, limitations, and conclusion, and the conclusion largely restates the result. The prose is accurate but offers little visible editorial judgment about the recommended operating rule. The review does not request a fabricated anecdote or emotion; the evidence-backed judgment should be the explicit recommendation to treat instruction files as guidance plus deterministic verification, never as a security boundary.

Article locations: `## 主張と公式情報`, `## 環境とバージョン`, `## 観測結果`, `## 限界`, and `## まとめ`.

## Actionable warnings

### Warning 1 — Replace the documentation-led opening with the practical problem and answer

Rewrite the title and opening around the configuration-harness claim from the editorial brief. Within the opening paragraphs, state that the experiment confirmed guided-only behavior in the four recorded cases and that the practical lesson is to verify an instruction file through an observable condition rather than its presence.

Permitted evidence: analysis editorial brief; manifest; four case metrics and diffs.

### Warning 2 — Reorder the article around the decision path

Move the compact result table immediately after the minimal experiment design. Explain the interpretation next. Move versions, complete flags, secondary warnings, and untested variants to a later reproducibility and limitations section. Remove pipeline-label headings when a claim-oriented heading is available.

Permitted evidence: analysis story arc and body/appendix evidence split.

### Warning 3 — Make the harness reusable without recommending the historical unsafe command

Add the fixture-to-real-work mapping and a minimal checklist: same task with and without guidance, a guidance-only observable requirement, normal task verifier, protected paths, and allowed change scope. Keep the exact Claude command only as a historical recorded condition or omit its full flags; do not convert `bypassPermissions` into a recommended template.

Permitted evidence: analysis practical mapping and reusable recipe; manifest verification contract; recorded safety boundary.

### Warning 4 — Tighten the ending and remove repetition

Condense repeated safety and one-run limitations. End with a concrete decision rule: use `CLAUDE.md` or `AGENTS.md` for project guidance, but accept a run only through deterministic task checks and write-boundary verification. Do not claim surprise or changed personal experience because the observed result matched the pre-registered expectation.

Permitted evidence: analysis expectation comparison, takeaway, and unsupported-angle list.

## Verdict rationale

The article is truthful, reproducible, and safe enough to revise from existing evidence, but its 63/100 editorial score is below the 80-point threshold. All four warnings can be resolved by retitling, restructuring, compressing, and strengthening the evidence-backed practical mapping. No new experiment is required, so the correct verdict is `fix` rather than `rerun`.
