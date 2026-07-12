# Execution log: Node.js test order randomization and seed replay

## Plan and status

- Plan: `practice/practice-node-test-randomize-20260711-0950.md`
- Run directory: `logs/run-node-test-randomize-20260711-095234/`
- Work directory: `logs/run-node-test-randomize-20260711-095234/work/`
- Started (UTC): `2026-07-11T00:52:34Z`
- Stopped (UTC): `2026-07-11T00:53:33Z`
- Result: partial evidence; execution stopped at the plan's seed-extraction stop condition.

## Environment and fixed runtime

| Item | Observed value |
|---|---|
| Host | `Darwin 25.5.0 arm64` |
| Docker CLI | `Docker version 28.5.1, build e180ab8` |
| Image tag | `node:24.16.0-bookworm-slim` |
| Image ID | `sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203` |
| Repo digest | `node@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203` |
| Node.js | `v24.16.0` |
| Container platform | `linux arm64` |

The image was pulled from the official `library/node` repository. All test containers that ran after the pull used `--rm`, `--network none`, mounted only this run's `work/` directory at `/work`, and used `/work` as the working directory.

## Chronological command record

| # | Command | Exit | Expected versus actual |
|---:|---|---:|---|
| 1 | `STAMP="$(date '+%Y%m%d-%H%M%S')"; RUN_DIR="$PWD/logs/run-node-test-randomize-$STAMP"; test ! -e "$RUN_DIR"; mkdir -p "$RUN_DIR/work/logs"; printf '%s\\n' "$RUN_DIR" \| tee "$RUN_DIR/work/logs/run-directory.txt"; date -u '+%Y-%m-%dT%H:%M:%SZ' \| tee "$RUN_DIR/work/logs/start-time-utc.txt"` | 0 | New isolated run directory created as expected. |
| 2 | `docker pull node:24.16.0-bookworm-slim` | 0 | Fixed official image downloaded as expected. |
| 3 | `docker image inspect node:24.16.0-bookworm-slim --format 'image_id={{.Id}} repo_digests={{json .RepoDigests}}'` | 0 | Image ID and digest recorded. |
| 4 | `docker run --rm --network none -v "$PWD:/work" -w /work node:24.16.0-bookworm-slim node --version` | 0 | Expected and actual: `v24.16.0`. |
| 5 | `docker run --rm --network none -v "$PWD:/work" -w /work node:24.16.0-bookworm-slim node -p '\`${process.platform} ${process.arch}\`'` | 0 | Actual: `linux arm64`. |
| 6 | Create `order-dependent.test.js`, `sequential-subtests.test.js`, and `isolated-state.test.js` with the exact fixture contents from the plan. | 0 | Files created inside the isolated work directory. |
| 7 | `docker run --rm --network none -v "$PWD:/work" -w /work node:24.16.0-bookworm-slim node --test order-dependent.test.js >logs/baseline.log 2>&1` | 0 | Expected and actual: both sibling tests passed in declaration order. |
| 8 | `docker run --rm --network none -v "$PWD:/work" -w /work node:24.16.0-bookworm-slim node --test --test-randomize order-dependent.test.js >logs/random-01.log 2>&1` | 0 | A passing randomized attempt, within the allowed search loop. |
| 9 | Same randomized command, output to `logs/random-02.log`. | 1 | Expected search outcome observed: consumer ran first and failed. |
| 10 | `cp "$FAIL_LOG" logs/random-first-failure.log` | 0 | First failing attempt preserved. |
| 11 | `SEED="$(sed -nE 's/.*random seed: ([^ ]+).*/\\1/p' logs/random-first-failure.log \| tail -n 1)"; test -n "$SEED"` | 1 | Expected a non-empty seed; actual variable was empty because the emitted line was `Randomized test order seed: 1476629161`, which does not match the plan's lowercase `random seed:` expression. Stop condition reached. |
| 12 | `rg -i -n "test-randomize\|random seed\|Randomized test order seed\|node:test\|seed extraction" knowledge/INDEX.md knowledge/*.md` | 0 | `$zenn-consult-knowledge` was used once after the non-trivial failure; no matching report was found. No recorded fix was applied. |
| 13 | `docker --version`; `uname -srm`; UTC end timestamp; pre-log file inventory | 0 | Environment and preserved evidence recorded without continuing the test procedure. |
| 14 | `find . -maxdepth 2 -type f -print \| LC_ALL=C sort \| tee logs/evidence-files.txt`; checksum command from plan | 0 | Final work-directory inventory and 20 SHA-256 checksums recorded. |

## Fixture contents

### `order-dependent.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');

let shared = [];

test('01 initializes shared state', () => {
  shared.push('ready');
  assert.deepEqual(shared, ['ready']);
});

test('02 consumes shared state', () => {
  assert.deepEqual(shared, ['ready']);
});
```

The two other planned fixture files were created but not executed because the stop condition occurred first. Their exact copies are retained in `work/`.

## Relevant observed output

Baseline (`logs/baseline.log`, exit 0):

```text
✔ 01 initializes shared state
✔ 02 consumes shared state
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Random search summary (`logs/random-attempts.tsv`):

```text
attempt=1 exit_code=0 log=logs/random-01.log
attempt=2 exit_code=1 log=logs/random-02.log
```

First randomized failure (`logs/random-first-failure.log`, exit 1):

```text
✖ 02 consumes shared state
✔ 01 initializes shared state
ℹ Randomized test order seed: 1476629161
ℹ tests 2
ℹ pass 1
ℹ fail 1

AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'ready'
- ]
```

Durations and stack traces are retained verbatim in the evidence file. No credentials, environment dump, private hostnames, or personal data were captured.

## Observed facts

1. The fixed image ran Node.js `v24.16.0` on `linux arm64`.
2. The order-dependent fixture passed normally with two passes and zero failures.
3. Random attempt 1 passed; random attempt 2 exited 1.
4. On attempt 2, `02 consumes shared state` ran before `01 initializes shared state` and its deep-equality assertion failed because the state was empty at assertion time.
5. Node printed the numeric seed `1476629161` in the line `Randomized test order seed: 1476629161`.
6. The supplied extraction expression produced an empty value and `test -n "$SEED"` failed.

## Interpretation (separate from observed facts)

The normal pass followed by a randomized order reversal and assertion failure is evidence that this small fixture has a test-order dependency. It is not evidence that the displayed seed replays deterministically, because the replay step was not run.

## Failures and attempted fixes

- Failure: the plan's `sed` expression expected text containing lowercase `random seed:`, while Node.js v24.16.0 emitted `Randomized test order seed:`. The seed was visible in output, but automated extraction failed.
- Knowledge consultation: no relevant entry was found in `knowledge/INDEX.md` or `knowledge/*.md`.
- Attempted fix: none. The plan explicitly says to stop if seed extraction fails, so the extraction command was not altered and execution did not continue.

## Deviations

- Fixture files were created with the workspace's patch-based editing mechanism rather than the plan's `tee` heredocs. Their contents match the plan and they remain inside the isolated work directory.
- After the stop condition, only read-only knowledge search and evidence-preservation commands were run.

## Verification results

| Criterion | Result | Evidence |
|---|---|---|
| Node.js exactly v24.16.0 | Pass | `work/logs/node-version.log` |
| Broken fixture passes normally | Pass | `work/logs/baseline.log`, `baseline.exit` |
| Randomized failure within 20 attempts | Pass (attempt 2) | `random-attempts.tsv`, `random-first-failure.log` |
| Extract failing seed automatically | Fail | extraction command exited 1 |
| Replay same failure three times | Not run | stopped before step 4 |
| Sequential subtests across seeds 1–5 | Not run | stopped before step 5 |
| Watch plus randomize observation | Not run | stopped before step 5 |
| Fixed fixture baseline/former seed/10 seeds | Not run | stopped before step 6 |

## Generated files

- Primary log: `logs/run-node-test-randomize-20260711-095234/execution-log.md`
- Fixtures: `work/order-dependent.test.js`, `work/sequential-subtests.test.js`, `work/isolated-state.test.js`
- Runtime evidence: `work/logs/docker-pull.log`, `docker-image.txt`, `node-version.log`, `node-platform.log`, `docker-version.log`, `host-platform.log`
- Test evidence: `work/logs/baseline.log`, `baseline.exit`, `random-01.log`, `random-02.log`, `random-attempts.tsv`, `random-first-failure.log`
- Timing and inventory evidence: `work/logs/start-time-utc.txt`, `end-time-utc.txt`, `run-directory.txt`, `evidence-files-pre-log.txt`
- Final evidence index and checksums: `work/logs/evidence-files.txt`, `work/logs/SHA256SUMS`

## Reproducibility notes

- Use the exact image digest recorded above, retain `--network none`, and mount only an isolated work directory.
- The exact supplied extraction command is expected to stop against the output observed here. A revised future plan would need to explicitly authorize a pattern matching `Randomized test order seed:` before replay could be tested.
- Random attempt counts are bounded observations from this run only.

## Unresolved limitations

- Deterministic replay of seed `1476629161` was not tested.
- The sequential-subtest, watch-mode, and isolated-state hypotheses were not tested.
- The full success criteria were therefore not met.

## Article-safe facts

Only these claims are supported by this run:

- In the pinned Node.js v24.16.0 container, this two-test fixture passed in normal execution.
- `--test-randomize` produced a reversed order and an assertion failure on the second of two attempts.
- That failing output displayed `Randomized test order seed: 1476629161`.
- The extraction command in the supplied practice plan did not match that emitted text, so replay and later verification were not performed.

Do not claim from this run that seed replay succeeded, that sequential awaited subtests preserve order under randomization, that watch mode is incompatible, or that the isolated-state change passed its regression matrix.
