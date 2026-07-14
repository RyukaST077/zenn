# Deno 2.9 `deno task` cache execution log

## Run identity

- Plan: `practice/practice-deno29-task-cache-20260713-1640.md`
- Run directory: `logs/run-deno29-task-cache-20260713-164641/`
- Work directory: `logs/run-deno29-task-cache-20260713-164641/work/`
- Start: 2026-07-13T07:46:41Z (2026-07-13T16:46:41+0900)
- Practice execution end: 2026-07-13T07:50:10Z (2026-07-13T16:50:10+0900)
- Effective sandbox: `danger-full-access`
- Result: core success criteria 1–6 passed; all planned exploratory and boundary cases were also completed.
- Browser: not used. The plan explicitly excludes browser verification because the selected topic is CLI-only. The supplied browser launch/context stop gate therefore was not invoked.

No applicable `AGENTS.md` exists in the repository root or its ancestor directories. Existing repository files, Git branch, index, commits, and user-level Deno installation/cache were not changed. All generated work is under this run directory.

## Environment and versions

- Host: macOS Darwin 25.5.0, `arm64` (`RELEASE_ARM64_T6020`).
- System Deno (recorded only, not used for cases): `/opt/homebrew/bin/deno`, `deno 2.8.3`.
- Run-local Deno: `work/tools/deno-2.9.0/deno`, `deno 2.9.0 (stable, release, aarch64-apple-darwin)`; V8 `14.9.207.2-rusty`; TypeScript `6.0.3`.
- Run-local cache: `work/deno-dir/`. Schema probe cache: `work/deno-dir-probe/`, removed after the successful probe as planned.
- Required commands found: `/usr/bin/curl`, `/usr/bin/unzip`, `/usr/bin/shasum`, `/usr/bin/jq`; `awk`, `cmp`, `find`, `touch`, and `env` also passed `command -v` gates.
- Target checksum gate: `deno-aarch64-apple-darwin.zip: OK`.
- Repository branch remained `main`; `git diff --name-only` and `git diff --cached --name-only` were empty after practice execution. Pre-existing untracked files were left untouched.

Primary environment records are `work/evidence/environment.txt`, `work/evidence/deno-target-version.txt`, and `work/evidence/deno-checksum.txt`.

## Setup and capability gates

The following plan commands were executed from the repository root or `work/` with `set -eu`:

```sh
test -f research/search-topic-20260713-1634.md
RUN_TS="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$PWD/logs/run-deno29-task-cache-$RUN_TS"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR"/{tools,deno-dir,evidence/commands,evidence/states,fixture,scripts}
for command_name in curl unzip shasum jq awk cmp find touch env; do command -v "$command_name" >/dev/null; done
test "$(uname -s)" = Darwin
test "$(uname -m)" = arm64
curl --fail --location --retry 1 --retry-delay 2 --output tools/deno-aarch64-apple-darwin.zip https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip
curl --fail --location --retry 1 --retry-delay 2 --output tools/deno-aarch64-apple-darwin.zip.sha256sum https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip.sha256sum
(cd tools && shasum -a 256 -c deno-aarch64-apple-darwin.zip.sha256sum)
mkdir tools/deno-2.9.0
unzip -q tools/deno-aarch64-apple-darwin.zip -d tools/deno-2.9.0
chmod u+x tools/deno-2.9.0/deno
work/tools/deno-2.9.0/deno --version
```

All gates passed on the first command execution; `curl --retry 1` did not visibly need a retry. The object-task schema probe accepted `files`, `output`, and `env`, exited 0, ran the fixture body once in the probe-only cache, and printed the expected `main` JSON. The probe output/cache/ledger was then removed before the measured cases, exactly as specified. No blocker or non-trivial failure occurred, so `zenn-consult-knowledge` was not triggered.

The fixture and three recording helpers match the supplied plan. They were written with the workspace patch mechanism instead of shell heredocs; this is a file-creation-method deviation only. Task definitions, permissions, paths, and contents were unchanged from the plan.

## Chronological command record

For every row, cwd was `/Users/katayamaryuunosuke/workspace/024_zenn/logs/run-deno29-task-cache-20260713-164641/work/fixture`. `$DENO_BIN` below is the exact absolute path `/Users/katayamaryuunosuke/workspace/024_zenn/logs/run-deno29-task-cache-20260713-164641/work/tools/deno-2.9.0/deno`. Expanded argv, cwd, UTC timestamps, exit code, expected exit class, stdout, and stderr are retained in `work/evidence/commands/<label>.{meta,stdout,stderr}`.

| # | label | start–end UTC | exact command | expected / actual | relevant output |
| ---: | --- | --- | --- | --- | --- |
| 1 | schema-probe | 07:47:51–07:47:52 | `$DENO_BIN task main` | 0 / 0 | body executed; `message=alpha` |
| 2 | baseline-1 | 07:48:10–07:48:11 | `$DENO_BIN task baseline` | 0 / 0 | body executed |
| 3 | baseline-2 | 07:48:11–07:48:11 | `$DENO_BIN task baseline` | 0 / 0 | body executed |
| 4 | main-first | 07:48:11–07:48:11 | `$DENO_BIN task main` | 0 / 0 | body executed |
| 5 | main-hit | 07:48:11–07:48:11 | `$DENO_BIN task main` | 0 / 0 | `(cached, inputs unchanged)`; empty stdout |
| 6 | main-restore | 07:48:11–07:48:11 | `$DENO_BIN task main` | 0 / 0 | `(cached, inputs unchanged)`; output restored |
| 7 | main-mtime-only | 07:48:20–07:48:20 | `$DENO_BIN task main` | 0 / 0 | `(cached, inputs unchanged)` |
| 8 | main-source-change | 07:48:30–07:48:30 | `$DENO_BIN task main` | 0 / 0 | body executed; `message=beta` |
| 9 | arguments-foo-first | 07:48:42–07:48:42 | `$DENO_BIN task arguments foo` | 0 / 0 | body executed; `marker=foo` |
| 10 | arguments-foo-hit | 07:48:42–07:48:42 | `$DENO_BIN task arguments foo` | 0 / 0 | `(cached, inputs unchanged)` |
| 11 | arguments-bar-miss | 07:48:43–07:48:43 | `$DENO_BIN task arguments bar` | 0 / 0 | body executed; `marker=bar` |
| 12 | listed-env-dev-first | 07:48:43–07:48:43 | `env MODE=dev $DENO_BIN task listed-env` | 0 / 0 | body executed; `mode=dev` |
| 13 | listed-env-dev-hit | 07:48:43–07:48:43 | `env MODE=dev $DENO_BIN task listed-env` | 0 / 0 | `(cached, inputs unchanged)` |
| 14 | listed-env-prod-miss | 07:48:43–07:48:43 | `env MODE=prod $DENO_BIN task listed-env` | 0 / 0 | body executed; `mode=prod` |
| 15 | unlisted-env-a-first | 07:48:43–07:48:43 | `env UNRELATED=A $DENO_BIN task unlisted-env` | 0 / 0 | body executed |
| 16 | unlisted-env-b-hit | 07:48:43–07:48:43 | `env UNRELATED=B $DENO_BIN task unlisted-env` | 0 / 0 | `(cached, inputs unchanged)` |
| 17 | dependency-first | 07:48:53–07:48:53 | `$DENO_BIN task dependency` | 0 / 0 | `prepare` and `dependency` executed; `prefix-one` |
| 18 | dependency-hit | 07:48:53–07:48:54 | `$DENO_BIN task dependency` | 0 / 0 | both tasks `(cached, inputs unchanged)` |
| 19 | dependency-input-change | 07:49:05–07:49:06 | `$DENO_BIN task dependency` | 0 / 0 | both executed; `prefix-two` |
| 20 | command-v1-first | 07:49:06–07:49:06 | `$DENO_BIN task command-key` | 0 / 0 | body executed; `command-v1` |
| 21 | command-v1-hit | 07:49:06–07:49:06 | `$DENO_BIN task command-key` | 0 / 0 | `(cached, inputs unchanged)` |
| 22 | command-v2-miss | 07:49:06–07:49:06 | `$DENO_BIN task command-key` | 0 / 0 | body executed; `command-v2` |
| 23 | zero-match-1 | 07:49:17–07:49:17 | `$DENO_BIN task zero-match` | 0 / 0 | body executed |
| 24 | zero-match-2 | 07:49:17–07:49:17 | `$DENO_BIN task zero-match` | 0 / 0 | body executed again |
| 25 | failure-1 | 07:49:17–07:49:18 | `$DENO_BIN task failure` | nonzero / 1 | `intentional failure`; body ledger appended |
| 26 | failure-2 | 07:49:18–07:49:18 | `$DENO_BIN task failure` | nonzero / 1 | `intentional failure`; body ledger appended again |
| 27 | no-output-first | 07:49:18–07:49:18 | `$DENO_BIN task no-output` | 0 / 0 | body executed |
| 28 | no-output-hit | 07:49:18–07:49:18 | `$DENO_BIN task no-output` | 0 / 0 | `(cached, inputs unchanged)` |
| 29 | no-output-after-delete | 07:49:18–07:49:18 | `$DENO_BIN task no-output` | 0 / 0 | cached; deleted undeclared output stayed absent |

Recorded Deno cache text was exactly `(cached, inputs unchanged)` appended to the task line for hits. No explicit cache text was observed for misses/reruns; those were distinguished by body stdout and ledger deltas.

## Case matrix and verification results

`exists:hash` uses the state immediately before and after the named command. Hashes are SHA-256; shortened hashes below identify full values stored in the state JSON.

| case | changed axis | expected | before→after count | output before→after | observed cache text | verdict |
| --- | --- | --- | ---: | --- | --- | --- |
| baseline-1 / baseline-2 | no `files` | rerun twice | 0→1; 1→2 | absent→present; present→present (`24733d38…`) | none | pass |
| main-first | initial cacheable run | execute | 0→1 | absent→`9cb4a393…` | none | pass |
| main-hit | none | hit | 1→1 | `9cb4a393…`→same | cached | pass |
| main-restore | declared output deletion | hit + restore | 1→1 | absent→`9cb4a393…` | cached | pass |
| main-mtime-only | source mtime only | exploratory hit | 1→1 | `9cb4a393…`→same | cached | pass (exploratory) |
| main-source-change | source content `alpha`→`beta` | miss | 1→2 | `9cb4a393…`→`4551cb0e…` | none | pass |
| arguments foo hit | none | hit | 1→1 | `c752c750…`→same | cached | pass |
| arguments bar | appended argument `foo`→`bar` | miss | 1→2 | `c752c750…`→`ae461f5a…` | none | pass |
| listed env dev hit | same `MODE=dev` | hit | 1→1 | `fe200cc2…`→same | cached | pass |
| listed env prod | `MODE=dev`→`MODE=prod` | miss | 1→2 | `fe200cc2…`→`3a3d5441…` | none | pass |
| unlisted env | `UNRELATED=A`→`B` | exploratory hit | 1→1 | `07edd700…`→same | cached | pass (exploratory) |
| dependency hit | none | upstream + downstream hit | 1→1 downstream; prepare total stayed 1 | `57635e00…`→same | cached for both | pass |
| dependency input | `prefix-one`→`prefix-two` | upstream + downstream miss | 1→2 downstream; prepare 1→2 | `57635e00…`→`e3d67233…` | none | pass |
| command hit | command v1 unchanged | hit | 1→1 | `4c572e60…`→same | cached | pass |
| command definition | command v1→v2 | miss | 1→2 | `4c572e60…`→`6475c292…` | none | pass |
| zero match | `missing/**/*.ts` matches 0 | rerun twice | 0→1; 1→2 | absent→present; hash stable `608ec416…` | none | pass |
| failure | exit 1 | rerun + nonzero twice | 0→1; 1→2 | absent→absent | none | pass |
| no output hit | none | hit | 1→1 | `010a9a2c…`→same | cached | pass |
| no output after delete | undeclared output deletion | hit + no restore | 1→1 | absent→absent | cached | pass |

Declared-output restoration was also verified by both `cmp` exit 0 and matching full hashes:

```text
9cb4a393d42a1aa03c0e42bb50cf855fd6d01907587f18cb8932096cf002e4a2  dist/main.json (first)
9cb4a393d42a1aa03c0e42bb50cf855fd6d01907587f18cb8932096cf002e4a2  dist/main.json (restored)
```

Final invocation counts:

```text
arguments       2
baseline        2
command-key     2
dependency      2
failure         2
listed-env      2
main            2
no-output       1
prepare         2
unlisted-env    1
zero-match      2
```

Core evidence hashes:

```text
1733c49269ae5a2f7f99c2d63ab7e6fd4912b1ad45ce5e52f310f331c8787763  work/evidence/invocations.json
2b3e10d22c0564d9eb224f0d377771ece21cfa925d126da56ef5c86918271e1d  work/evidence/state-snapshots.json
```

## Observed facts

1. Deno 2.9.0 accepted the supplied object task schema in this fixture.
2. A task without `files` executed twice. A task with `files` skipped an unchanged second invocation.
3. Deleting a declared output did not execute the body again; Deno restored a byte-identical output from the run-local cache.
4. Source content, appended argument, listed environment value, dependency input, and command definition changes each caused body execution and a ledger increment.
5. Touching only source mtime and changing an unrelated, unlisted environment variable did not increment the ledger.
6. A zero-match input glob did not yield a false hit: the task executed twice.
7. A task that exited 1 executed and exited 1 on both attempts; neither attempt was cached as success.
8. A cacheable task without `output` skipped an unchanged invocation, but after its generated file was deleted Deno still skipped the body and did not restore the file.

## Interpretation (bounded to this run)

Within Deno 2.9.0 on this macOS arm64 fixture, the ledger and output hashes support H1–H7. `files` acted as the observed cache opt-in boundary. Declaring `output` separated task skipping from artifact restoration. The observed invalidation axes were source content, appended arguments, a listed environment variable, an upstream dependency input, and the command string. These interpretations do not establish behavior for other Deno versions, operating systems, architectures, fixtures, shared/remote caches, or undeclared task inputs.

The plan supplied official source references (`https://deno.com/blog/v2.9` and `https://docs.deno.com/runtime/reference/cli/task/`), but this run did not re-fetch or quote documentation. All claims above are local observations or explicitly marked fixture-bounded interpretations.

## Generated files and inventory

- `work/tools/`: official archive, checksum, and run-local Deno 2.9.0 binary.
- `work/deno-dir/`: isolated measured task cache.
- `work/fixture/`: fixture source, configuration, task definition, ledger, and final generated outputs.
- `work/scripts/`: exact command/state recording helpers.
- `work/evidence/commands/`: 29 `.meta`, 29 `.stdout`, and 29 `.stderr` files.
- `work/evidence/states/`: 28 before and 28 after JSON snapshots.
- `work/evidence/invocations.json`, `state-snapshots.json`, `invocation-counts.tsv`, and `core-evidence.sha256`: aggregated evidence.
- `work/evidence/manifest.txt`: sorted full primary-evidence inventory.
- Total retained run size at practice end: `116M` as reported by `du -sh`.

No article file or article content was created.

## Failures, attempted fixes, and deviations

- Functional failures/blockers: none.
- Expected negative commands: `failure-1` and `failure-2` both exited 1 and were recorded as expected nonzero cases; these are observations, not run failures.
- Attempted fixes/retries: none. No ambiguous case required the plan's one-case rerun fallback.
- Knowledge consultation: not used because no non-trivial development failure occurred.
- Browser deviation: none. Browser use was allowed by the effective sandbox but excluded by the plan.
- File creation deviation: fixture/helper files were created through the workspace patch mechanism rather than shell heredocs; content and execution scope stayed within `work/`.

## Reproducibility notes

- Use the exact Deno 2.9.0 aarch64 Apple Darwin archive and verify its official checksum before running.
- Set `DENO_DIR` to a fresh run-local directory. Do not reuse the schema-probe cache for measured cases.
- Run tasks from `work/fixture/`, because task paths are relative.
- Preserve case order: later source/config/command mutations intentionally build on earlier cache entries.
- Use ledger deltas and output existence/hash as the primary decision signals. Do not infer hits from duration.
- The retained `work/evidence/commands/*.meta` files contain expanded absolute argv and exact recorded timing.

## Unresolved limitations

- No other Deno patch version, OS, CPU, filesystem, or fixture was tested.
- No performance benchmark was performed; duration is not evidence of cache effectiveness here.
- Cache internal format, shared cache behavior, remote cache behavior, concurrency, and CI portability were not inspected.
- The mtime-only and unlisted-env results are exploratory fixture observations, not universal guarantees.
- The browser launch capability gate was not exercised because browser verification was outside this plan.

## Article-safe facts

- On Deno 2.9.0/macOS arm64 in this isolated fixture, an unchanged task with `files` printed `(cached, inputs unchanged)` and did not append to the invocation ledger.
- A deleted declared output was restored with the same SHA-256 while the ledger count remained unchanged.
- Source, appended argument, listed environment, dependency input, and command definition changes each produced a ledger increment in the corresponding controlled case.
- Zero matched input files and a failed task did not produce false successful cache hits in the two-attempt observations.
- A task without declared `output` could be skipped, but its deleted generated file was not restored in this observation.
