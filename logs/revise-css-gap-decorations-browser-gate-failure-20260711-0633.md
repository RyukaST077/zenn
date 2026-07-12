# Revision log: css-gap-decorations-browser-gate-failure

## Inputs

- Source article: `articles/css-gap-decorations-browser-gate-failure.md`
- Review report: `logs/review-css-gap-decorations-browser-gate-failure-20260711-0631.md`
- Execution log: `logs/run-css-gap-decorations-20260711-0622/execution-log.md`
- Review/article match: confirmed by the review heading, explicit article path, and matching slug.

## Findings and dispositions

### Warning 1: reproduction commands target the preserved evidence directory

- Disposition: resolved.
- Exact edit: renamed `再現手順` to `今回記録した実行手順`; identified the displayed commands as the commands recorded for this run; explicitly prohibited rerunning them in the preserved run directory; instructed future verification to use a new isolated directory and separately retained outputs.
- Evidence used: the execution log's **Reproducibility notes** says a future run is not evidence for this run and must capture its own outputs; **Generated files** records the evidence already retained under the documented run.

### Warning 2: external-request statement exceeds captured evidence

- Disposition: resolved.
- Exact edit: narrowed the statement to say that no external URL request came from a successfully launched page because no page was established, and clarified that browser-process communication during failed launches was not measured.
- Evidence used: the execution log's **Observed facts** limits the observation to a successfully launched page and records that no page was established.

## Slug and image paths

- Old slug: `css-gap-decorations-browser-gate-failure`
- New slug: `css-gap-decorations-browser-gate-failure`
- Article path rename: none.
- Image path rename: none; the article contains no image references requiring coordination.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/css-gap-decorations-browser-gate-failure.md --expect-published false`
- Result: pass (`OK: articles/css-gap-decorations-browser-gate-failure.md (slug=css-gap-decorations-browser-gate-failure, published=false)`).

## Unresolved items

- None from the supplied review. Both warnings were resolved using existing execution-log evidence; no new verification result was introduced.
