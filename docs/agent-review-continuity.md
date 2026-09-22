# Review continuity contract

The first review must cover all publication gates and editorial categories in the review skill.
Re-reviews primarily verify whether existing findings were resolved. Keep the same finding IDs,
including resolved findings, and record evidence for every status. Do not reopen a resolved finding
without a `reopen_reason` and new evidence. Do not introduce style preferences as blocking findings.
New findings after the first review are limited to a major omission in the previous review
(`major-oversight`, 重大な見落とし) or a problem introduced by the revision
(`revision-regression`, 修正による問題). Explain which applies and why in `reason`, citing precise
article/evidence locations in `evidence`. Preserve each existing finding's original `category`.
The pass requirements remain unchanged: zero blockers and warnings, total score >= 80/100,
and at least half credit in each category. Never pass because the revision budget is exhausted.

Include exactly one fenced `review-findings` JSON array in every review report. This is the
complete cumulative finding ledger, including resolved findings; use `[]` if there have been none.
Use stable IDs `F-001`, `F-002`, etc. Include every blocker, warning, and suggestion listed in the report.
The report's `blockers:` and `warnings:` counts must match unresolved entries of that severity.
A `fix` verdict requires at least one unresolved blocker or warning, including any score shortfall.

```review-findings
[
  {
    "id": "F-001",
    "status": "unresolved",
    "severity": "warning",
    "category": "initial",
    "reason": "The recipe omits a required option recorded by the run.",
    "evidence": "articles/example.md recipe; execution-log.md command 3"
  }
]
```

`status`: `unresolved` or `resolved`. `severity`: `blocker`, `warning`, or `suggestion`.
Only first-review findings use `initial`. On resolution, update `reason` and `evidence` to describe
what was checked. On reopening, also supply a nonempty `reopen_reason`; unchanged evidence is invalid.
Revision logs must address each unresolved finding ID, describing the edit, evidence, check result,
and any remaining issue. A revision log is an author's claim; the reviewer confirms resolution.

The orchestrator snapshots each reviewed article, accepted report, cumulative findings, and revision
log under the supplied history directory. Read the full history, previous report, revision log,
and generated article diff explicitly on re-review, including when recovering in a replacement session.
Do not modify these snapshots or the reviewed article. Write only the new review report requested.
