# Revision log: TypeScript 7 / TypeScript 6 bin collision log

## Sources

- Article: `articles/typescript7-tsc-bin-collision-log.md`
- Review: `logs/review-typescript7-tsc-bin-collision-log-20260711-1720.md`
- Execution log: `logs/run-typescript7-side-by-side-20260711-171217/execution-log.md`

The review identifies the same article path, execution log, and slug as the supplied inputs.

## Findings and dispositions

### Fresh work directory is not established in the reproduction procedure

- Severity: warning
- Disposition: resolved
- Exact edit: Added `mktemp -d` to create a new generic verification directory and `cd` to enter it before assigning `WORK_DIR`. The existing run-local npm cache and all later commands remain unchanged. No cleanup command was added.
- Evidence used: The execution log records that the run created a new isolated work directory and did not reuse an existing directory. The review explicitly permits expressing this as a safe generic creation pattern without a new experiment.

## Rename record

- Old slug: `typescript7-tsc-bin-collision-log`
- New slug: `typescript7-tsc-bin-collision-log`
- Old image path: none
- New image path: none
- Rename performed: no

## Deterministic check

- Command: `bash scripts/check-article.sh articles/typescript7-tsc-bin-collision-log.md --expect-published false`
- Result: pass (`OK: articles/typescript7-tsc-bin-collision-log.md (slug=typescript7-tsc-bin-collision-log, published=false)`)

## Unresolved items

- None from the review.
