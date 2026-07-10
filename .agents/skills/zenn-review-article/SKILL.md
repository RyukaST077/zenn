---
name: zenn-review-article
description: Review an explicit Zenn draft against its execution log, sources, and deterministic checks, then issue pass, fix, or blocker. Use for the pipeline review stage or evidence-based publication-readiness review; do not substantially rewrite the article.
---

# Review the article

1. Use the article and execution log paths explicitly supplied by the prompt. Abort when either is missing or mismatched.
2. Run `bash scripts/check-article.sh <article> --expect-published false`.
3. Trace every technical result and command-output claim to the execution log. Verify linked external facts against the recorded source or current primary source where needed.
4. Classify findings as blocker, warning, or suggestion using [review-policy.md](references/review-policy.md).
5. Choose exactly one verdict: `pass` only for zero blockers and zero warnings; `fix` when evidence-backed edits can resolve all issues; `blocker` when new evidence or a materially new experiment is required.
6. Create `logs/review-<slug>-YYYYMMDD-HHMM.md`. Put exactly one line matching `verdict: pass|fix|blocker`, one `blockers: N` line, and one `warnings: N` line near the top. Follow them with actionable findings, article locations, and evidence references.
7. Do not make substantial article edits or change Git state.
8. End with only the pipeline result object. Set `artifact` to the review report, `metadata.verdict` to the same verdict, `metadata.slug` to the slug, and `metadata.pr_metadata` to `null`.
