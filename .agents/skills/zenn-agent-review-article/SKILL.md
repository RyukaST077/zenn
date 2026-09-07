---
name: zenn-agent-review-article
description: Review an explicit Claude Code or Codex Zenn draft against its analysis, editorial brief, execution log, manifest, and sources. Use for evidence traceability, reproducibility, version freshness, safety, comparison fairness, overclaim review, and scored editorial quality; do not substantially rewrite the article.
---

# Review an AI coding-agent article

1. Use the article, analysis, and execution log paths explicitly supplied by the prompt. Abort when any is missing or mismatched.
2. Run `bash scripts/check-article.sh <article> --expect-published false`.
3. Trace every behavior, result, timing, version, and recommendation to evidence. Verify external product facts against the recorded source or a current primary source when necessary.
4. Apply both layers of [review-policy.md](references/review-policy.md): publication integrity gates and the 100-point editorial rubric. Judge the draft against the article type and editorial brief rather than requiring one universal section order.
5. Look up this slug's contract in `analytics/contracts/<slug>.json`, falling back to `analytics/article-ledger.jsonl`. When present, each of these is a blocker: the reader decision is not singular and explicit; the takeaway is not in the body as a real artifact a reader can copy; fewer than three verification items appear as results; the value archetype is `deprecated` in `strategy/topic-selection-policy.json`. When absent, it is a warning for a pre-loop draft and a blocker for an article selected after the loop began. Rationale: [analytics-feedback-loop.md](../../../docs/analytics-feedback-loop.md).
6. Check for secret exposure, hidden local assumptions, one-run generalization, community guidance presented as official, unsupported performance claims, commands that differ from the run, a buried or documentation-only takeaway, report-like evidence dumping, missing practical mapping, and fabricated authorial voice.
7. Choose exactly one verdict: `pass`, `fix`, `rerun`, or `blocker`. `pass` requires zero blockers, zero warnings, an editorial score of at least 80/100, and at least half credit in every editorial category.
8. Create `logs/agent/review-<slug>-YYYYMMDD-HHMM.md` with exact `verdict:`, `blockers:`, `warnings:`, `article_type:`, and `editorial_score: N/100` lines near the top. Include category scores, evidence-based reasons, and prioritized actionable findings with article and evidence locations.
9. Do not edit the article.
10. End with only the pipeline result object. Set `artifact` to the review report.
