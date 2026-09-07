---
name: zenn-review-article
description: Review an explicit Zenn draft against its execution log, sources, and deterministic checks, then issue pass, fix, or blocker. Use for the pipeline review stage or evidence-based publication-readiness review; do not substantially rewrite the article.
---

# Review the article

1. Use the article and execution log paths explicitly supplied by the prompt. Abort when either is missing or mismatched.
2. Run `bash scripts/check-article.sh <article> --expect-published false`.
3. Trace every technical result and command-output claim to the execution log. Verify linked external facts against the recorded source or current primary source where needed.
4. Look up this slug's contract in `analytics/contracts/<slug>.json`, falling back to `analytics/article-ledger.jsonl`. When present, treat each of these as a blocker: the reader decision is not singular and explicit; the takeaway is not present in the body as a real artifact; fewer than three verification items appear as results; the value archetype is `deprecated` in `strategy/topic-selection-policy.json`; a `quantifiedMetric` contract lacks measured numbers with conditions. When absent, it is a warning for a draft written before the loop (to be rebundled as `legacy-transition`) and a blocker for an article selected after it, which skipped pre-registration. Rationale: [analytics-feedback-loop.md](../../../docs/analytics-feedback-loop.md).
5. Classify findings as blocker, warning, or suggestion using [review-policy.md](references/review-policy.md).
6. Choose exactly one verdict: `pass` only for zero blockers and zero warnings; `fix` when evidence-backed edits can resolve all issues; `blocker` when new evidence or a materially new experiment is required.
7. Create `logs/review-<slug>-YYYYMMDD-HHMM.md`. Put exactly one line matching `verdict: pass|fix|blocker`, one `blockers: N` line, and one `warnings: N` line near the top. Follow them with actionable findings, article locations, and evidence references.
8. Do not make substantial article edits or change Git state.
9. End with only the pipeline result object. Set `artifact` to the review report, `metadata.verdict` to the same verdict, `metadata.slug` to the slug, and `metadata.pr_metadata` to `null`.
