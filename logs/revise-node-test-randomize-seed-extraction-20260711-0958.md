# Revision log: node-test-randomize-seed-extraction

## Inputs

- Article: `articles/node-test-randomize-seed-extraction.md`
- Review: `logs/review-node-test-randomize-seed-extraction-20260711-0957.md`
- Execution log: `logs/run-node-test-randomize-20260711-095234/execution-log.md`
- Review association: confirmed by the review's Scope section, which names the same article and execution log.

## Findings and dispositions

### Warning 1: the reproduction flow did not create the seed-extraction input log

- Disposition: resolved.
- Edit: added `mkdir -p logs`, redirected randomized output to a numbered log, captured the test command's exit code with `set +e` / `set -e`, and copied a failing log to `logs/random-first-failure.log`. Clarified that the observed run passed on attempt 1, failed on attempt 2, and copied attempt 2's output under the stable failure-log name.
- Evidence: execution-log commands 8–10 and `work/logs/random-attempts.tsv` record redirected attempt logs, exit codes 0 and 1, and preservation as `logs/random-first-failure.log`.

### Warning 2: the extraction explanation described only a case mismatch

- Disposition: resolved.
- Edit: stated that the required contiguous substring `random seed:` is absent from `Randomized test order seed:` because both capitalization and wording differ. No corrected expression or successful extraction was claimed.
- Evidence: execution-log command 11 and observed fact 6 record the exact expression, emitted line, empty extracted value, and exit code 1.

## Slug and image paths

- Old slug: `node-test-randomize-seed-extraction`
- New slug: `node-test-randomize-seed-extraction`
- Article path unchanged: `articles/node-test-randomize-seed-extraction.md`
- Image paths: none; no rename was required.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/node-test-randomize-seed-extraction.md --expect-published false`
- Result: pass (exit code 0), with `published=false` and slug `node-test-randomize-seed-extraction` confirmed.

## Unresolved items

- None from the supplied review. The article continues to mark seed replay and later verification as untested, consistent with the execution log.
