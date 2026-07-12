# Revision log: TypeScript 7 / TypeScript 6 bin collision log

## Inputs

- Article: `articles/typescript7-tsc-bin-collision-log.md`
- Review: `logs/review-typescript7-tsc-bin-collision-log-20260711-1718.md`
- Execution log: `logs/run-typescript7-side-by-side-20260711-171217/execution-log.md`
- Review/article match: confirmed for `typescript7-tsc-bin-collision-log`

## Findings and dispositions

### Warning 1: reproduction commands omitted the run-local npm cache setting

- Disposition: resolved.
- Exact edit: defined generic `WORK_DIR` from the current verification directory, created `$WORK_DIR/npm-cache`, and added `npm_config_cache="$WORK_DIR/npm-cache"` to both `npm view` commands and the `npm install` command.
- Evidence used: the execution log's chronological command record and reproducibility notes record this same run-local npm cache setting for registry queries and installation.

### Suggestion: unused reference

- Disposition: resolved.
- Exact edit: removed the `Iterating faster with TypeScript 7` reference because the article did not connect it to a body claim.
- Evidence used: no new evidence was needed; this removes an unused citation without changing a claim.

## Slug and image paths

- Old slug: `typescript7-tsc-bin-collision-log`
- New slug: `typescript7-tsc-bin-collision-log`
- Article path rename: none
- Image path changes: none

## Deterministic check

- Command: `bash scripts/check-article.sh articles/typescript7-tsc-bin-collision-log.md --expect-published false`
- Result: passed (`OK`, slug `typescript7-tsc-bin-collision-log`, `published=false`).

## Unresolved items

- None.
