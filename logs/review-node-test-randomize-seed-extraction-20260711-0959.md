# Review: node-test-randomize-seed-extraction

verdict: pass
blockers: 0
warnings: 0

## Review scope

- Article: `articles/node-test-randomize-seed-extraction.md`
- Execution log: `logs/run-node-test-randomize-20260711-095234/execution-log.md`
- Slug: `node-test-randomize-seed-extraction`

## Deterministic check

`bash scripts/check-article.sh articles/node-test-randomize-seed-extraction.md --expect-published false` completed successfully and reported the expected slug and `published=false`.

## Evidence trace

- The environment table matches the execution log's recorded host, Docker CLI version, image tag and digest, Node.js version, and container platform.
- The fixture in the article matches the execution log's `order-dependent.test.js` fixture.
- The baseline result, randomized attempt counts and exit codes, reversed test order, seed `1476629161`, assertion diff, and failed extraction are all supported by the chronological command record, relevant observed output, and observed facts in the execution log.
- The article accurately distinguishes observation from interpretation: it limits the order-dependency conclusion to the fixture and does not claim that seed replay, sequential subtests, watch mode, or the isolated-state regression matrix were executed successfully.
- The reproduction commands are consistent with the recorded commands. The article correctly explains that the `sed` expression expected `random seed:` while Node.js emitted `Randomized test order seed:` and that the plan stopped before any corrective experiment.

## External source verification

- Node.js v24 test-runner documentation states that `--test-randomize` randomizes discovered test files and queued tests within each file, prints the run seed, and permits deterministic replay with `--test-random-seed=<number>`. It also marks the feature as added in v24.16.0: <https://nodejs.org/docs/latest-v24.x/api/test.html#randomizing-tests-execution-order>
- The official Node.js 24.16.0 release notes list `test_runner: support test order randomization` among the notable changes: <https://nodejs.org/en/blog/release/v24.16.0>

## Findings

No blockers, warnings, or suggestions.
