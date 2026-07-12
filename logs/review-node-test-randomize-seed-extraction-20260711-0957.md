# Review: node-test-randomize-seed-extraction

verdict: fix
blockers: 0
warnings: 2

## Scope

- Article: `articles/node-test-randomize-seed-extraction.md`
- Execution log: `logs/run-node-test-randomize-20260711-095234/execution-log.md`
- Deterministic check: `bash scripts/check-article.sh articles/node-test-randomize-seed-extraction.md --expect-published false` passed.
- Primary sources checked: the Node.js v24 test-runner documentation and the Node.js 24.16.0 release notes linked by the article. They support the external claims about randomized file/queued-test order, seed replay, and introduction in v24.16.0.

## Findings

### Warning 1: the published reproduction flow does not create the log consumed by the seed-extraction command

- Article location: `## 再現手順` step 3 and `## 失敗と対応`.
- Problem: step 3 runs the randomized command directly, but it neither creates `logs/` nor redirects output to `logs/random-first-failure.log`. The later extraction snippet therefore cannot be executed from the article's preceding steps as written. This is a reproducibility gap even though the historical run itself preserved the file.
- Required change: make the article's flow create and populate the referenced failure log (including preservation of the nonzero exit code), or change the extraction example to consume a file that the preceding commands explicitly create.
- Permitted evidence: execution-log chronological commands 8–11 and `work/logs/random-attempts.tsv` show the redirection, failing exit code, copy to `logs/random-first-failure.log`, and subsequent extraction attempt. These existing records are sufficient; no new experiment is needed.

### Warning 2: the extraction-failure explanation identifies only case, not the full incompatible wording

- Article location: `## 失敗と対応`, the sentence beginning `抽出式が期待した小文字の`.
- Problem: the expression requires the contiguous text `random seed:`, while Node emitted `Randomized test order seed:`. Changing only letter case would still not match because `ized test order` also changes the phrase. Describing the cause as a lowercase mismatch is materially ambiguous for readers diagnosing or correcting the parser.
- Required change: state that both capitalization and wording differ, or more directly that the required contiguous substring `random seed:` is absent from `Randomized test order seed:`. Do not claim a corrected expression was tested.
- Permitted evidence: execution-log command 11, observed fact 6, and `work/logs/random-first-failure.log` record the exact expression, emitted line, empty result, and exit code 1.

## Evidence trace summary

The environment table, fixture, baseline pass, two randomized attempts, reversed test order, assertion diff, printed seed, extraction failure, stop condition, and all stated untested limitations agree with the execution log. The article does not claim seed replay or regression success. No secret exposure or contradicted experimental result was found.
