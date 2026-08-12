# Review: codex-pretooluse-dispatch-preflight

verdict: pass
blockers: 0
warnings: 0
article_type: failure
editorial_score: 95/100

## Review scope

- Article: `articles/codex-pretooluse-dispatch-preflight.md`
- Analysis and editorial brief: `logs/agent/analysis-codex-pretooluse-fail-open-20260812-0511.md`
- Execution log: `logs/agent/run-codex-pretooluse-fail-open-20260812-0503-20260812-051000/execution-log.md`
- Supporting evidence checked: the referenced manifest, plan, research report, fixture source, and both cases' `command.json`, `metrics.json`, `verify.log`, `events.jsonl`, `diff.patch`, `stderr.log`, and `result.txt`.
- Deterministic article check: `bash scripts/check-article.sh articles/codex-pretooluse-dispatch-preflight.md --expect-published false` returned `OK` with the expected slug and `published=false`.

The supplied artifacts match the same `codex-pretooluse-fail-open-20260812-0503` practice and the article follows the analysis verdict `not-reproduced`. No article edit was made.

## Publication integrity gates

### Blockers

None.

- The article does not fabricate hook dispatch or a successful deny. Its opening and conclusion restrict the result to Codex CLI 0.147.0 and the recorded invocation (`articles/codex-pretooluse-dispatch-preflight.md:9-13,151-157`), matching the analysis boundary (`logs/agent/analysis-codex-pretooluse-fail-open-20260812-0511.md:51-55,105-111`).
- The reported command completion and `effect.txt` diff (`article:24-46`) match both case event streams and diffs: each records `/bin/zsh -lc 'node write-marker.mjs'`, exit code 0, and exact content `TOOL_RAN`.
- The missing dispatch evidence and verifier failure (`article:48-56`) match both `verify.log` files, which stop at `hook evidence must exist`, and the fixture writes evidence before selecting either response branch (`fixtures/agent-practice/codex-pretooluse-boundary/hook.mjs:8-28`).
- The trust-bypass command is bounded to the reviewed inert fixture, with approval, sandbox, network, and one-run limits retained (`article:115-149`). It is not presented as a way to bypass approval or sandbox controls.
- No fabricated author experience, destructive recipe, comparison claim, publication claim, or credential/secret exposure was found.

### Warnings

None.

- Version and date are material and present (`article:17,117-130`). Model and effort uncertainty, one-run limits, network enforcement, absent root-cause ablations, and non-generalization are explicit (`article:78-89,151-157`).
- The exact redacted invocation (`article:132-147`) matches both recorded `command.json` files after replacing case-specific and audit paths with placeholders.
- Product facts at `article:70-76` match the primary-source paraphrases recorded on 2026-08-12 in `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md:52-69`. The historical issue at `article:89` is correctly labeled community evidence and is not generalized to CLI 0.147.0.
- The article distinguishes absent evidence from proven non-execution and does not claim that Codex parsed and ignored the deny response (`article:54-56,78-89,151-157`).
- The unsuccessful fixture response objects are not presented as a verified recipe. The reusable part is limited to the conservative preflight gate (`article:91-113`), as required by the analysis (`analysis:91-103,140-156`).

## Editorial rubric

### 1. Reader problem and promise — 20/20

The opening names an unattended `codex exec` maintainer, the unsafe inference from a local hook file and trust notice, the observed failure, and the actionable answer within five paragraphs (`article:9-13`). This directly realizes the editorial brief's reader and promise (`analysis:115-129`) without generic preamble.

### 2. Insight and original value — 19/20

The central insight is falsifiable and remains visible: configuration presence and a trust notification are only prerequisites; adoption requires dispatch evidence, runtime blocking, and absence of the harmless side effect (`article:13,58-76,91-113,151-157`). This adds a verified decision boundary rather than summarizing hook schemas. One point is withheld because the run did not diagnose which discovery, matcher, trust, configuration, or runtime condition caused the absent dispatch, a limitation the article correctly preserves.

### 3. Explanation and story — 14/15

The draft moves coherently from the decision, through the two-case expectation and observed failure, to oracle design, unresolved causes, a rollout gate, reproduction conditions, and the supported boundary (`article:9-157`). Facts and interpretations are separated at the point they matter. One point is withheld because the causal story necessarily ends at competing hypotheses rather than a diagnosed cause.

### 4. Evidence and reproducibility — 19/20

The case matrix, exact command event, diff, first verifier assertion, versioned conditions, and redacted invocation are close to their claims (`article:17-56,115-149`). They agree with both cases' raw artifacts and with the pre-registered manifest and plan. The draft clearly labels the single-run and unknown-model limits. One point is withheld because this negative run cannot supply a successful blocked-event excerpt or a validated hook configuration; the article does not imply otherwise.

### 5. Practical action — 14/15

The reader gets a copyable conjunctive gate, an ordered five-step preflight, real-work mappings for the inert marker, and explicit stop/retain boundaries (`article:91-113,151-157`). One point is withheld because implementation of a parser for Codex's runtime classification is deliberately left to the reader and cannot be validated from a run with no blocked case.

### 6. Readability and authorial judgment — 9/10

The title, headings, compact matrix, short evidence excerpts, and conclusion all advance the same decision. The article avoids report-like artifact dumping and fabricated first-person experience while showing evidence-backed judgment. One point is withheld for the unavoidable density of mixed Japanese and hook/runtime field names in the preflight and reproduction sections.

## Prioritized actionable findings

No required changes. The article meets all integrity gates, scores at least half credit in every category, and exceeds the 80-point publication threshold with zero warnings.

Optional, non-scoring suggestion:

1. If a later bounded run successfully records a blocked event, add its minimal sanitized event excerpt and the exact parser assertion beside the `runtime_classification == "blocked"` gate. Do not add it from the current evidence, which contains no blocked classification.

