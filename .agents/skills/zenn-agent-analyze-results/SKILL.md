---
name: zenn-agent-analyze-results
description: Evaluate an explicit Claude Code or Codex practice execution log, decide whether the tested know-how was confirmed, conditional, not reproduced, unsupported, or inconclusive, and produce an evidence-backed editorial brief. Use after zenn-agent-run-practice to recommend whether and how the result should become a reader-centered article without drafting it.
---

# Analyze AI coding-agent evidence

1. Use only the execution log explicitly supplied under `logs/agent/run-*`. Resolve its manifest, plan, and research report references.
2. Verify every case against raw metrics, verifier output, diff, and recorded CLI exit status. Treat missing evidence as missing, never as success.
3. Separate external claims, observed facts, interpretation, and limitations.
4. Choose exactly one result verdict: `confirmed`, `conditional`, `not-reproduced`, `unsupported`, or `inconclusive`.
5. Compare the result with the plan's pre-registered expectation. Call something a surprise only when that contrast is recorded; never invent the author's prior belief, motivation, emotion, or experience.
6. Choose exactly one next action: `draft`, `rerun`, or `stop`. Negative results may still use `draft` when they teach a reproducible boundary or failure. Use `stop` when the evidence is true but adds no concrete reader decision beyond existing documentation.
7. Produce an editorial brief with one reader, one problem, one-sentence takeaway, coverage gap filled, article type, evidence-led story arc, practical decision rule, practical mapping, candidate titles, body evidence, appendix evidence, and unsupported angles to avoid.
8. Create `logs/agent/analysis-<topic>-YYYYMMDD-HHMM.md` using [analysis-template.md](references/analysis-template.md). Include reusable configuration only when it was present in a successful recorded case.
9. Do not create or edit an article.
10. End with only the pipeline result object. Set `artifact` to the analysis report. Abort only when the evidence cannot support any honest analysis.
