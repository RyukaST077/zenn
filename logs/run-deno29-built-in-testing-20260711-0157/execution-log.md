# Deno 2.9 built-in testing execution log

## Plan

- Plan path: `practice/practice-deno29-built-in-testing-20260711-0152.md`
- Run directory: `logs/run-deno29-built-in-testing-20260711-0157/`
- Work directory in commands below: `$WORK` means this run's `work/` directory.
- Outcome: stopped at the plan's mandatory Deno 2.9.0 acquisition gate. No test claim was verified.

## Environment and versions

- Start: 2026-07-11 01:57:26 JST
- End: 2026-07-11 01:58:41 JST
- OS: Darwin
- Architecture: arm64
- Pre-existing Deno: 2.8.3 (`aarch64-apple-darwin`), V8 `14.9.207.2-rusty`, TypeScript `6.0.3`
- Required isolated Deno: 2.9.0
- Required isolated binary after both attempts: absent
- Network scope: only the plan-prescribed `deno upgrade` invocation was attempted.
- Authentication, credentials, paid services, external packages, and elevated Deno permissions: not used.

The pre-existing Deno 2.8.3 was inspected only to record its version. It was not used for the required verification because the plan forbids substituting it for Deno 2.9.0.

## Chronological command record

| Time (JST) | Command | Expected | Exit | Actual |
|---|---|---|---:|---|
| 01:57 | `mkdir -p "$WORK"/{src,tests,evidence,tools,.tools,.deno-cache}` | Isolated work tree is created | 0 | Directories were created under this run only. |
| 01:57 | `chmod +x tools/run-recorded.sh` | Recording helper is executable | 0 | Completed. |
| 01:57 | `/opt/homebrew/bin/deno upgrade --output "$WORK/.tools/deno" 2.9.0` | Official updater writes an isolated Deno 2.9.0 binary | 1 (outer shell) | Updater reported that this Deno was built without the `upgrade` feature. The initial zsh harness then also failed to read Bash-only `PIPESTATUS`, so no dedicated first-attempt exit file was produced. The updater error itself was captured. |
| 01:58 | `rg -n -i 'built without.*upgrade|upgrade feature|deno upgrade|PIPESTATUS|Deno 2\\.9' knowledge/INDEX.md knowledge/*.md` | Find a confirmed repository fix, if one exists | 1 | No matching knowledge report was found; no recorded fix was applied. |
| 01:58 | `/opt/homebrew/bin/deno upgrade --output "$WORK/.tools/deno" 2.9.0` (run once more with Bash) | Plan-permitted retry writes Deno 2.9.0 | 1 | The same built-without-`upgrade` error recurred. `evidence/00-deno-download-retry.exit` records `1`. |
| 01:58 | `/opt/homebrew/bin/deno --version` | Record the existing runtime without using it for tests | 0 | Reported Deno 2.8.3, V8 `14.9.207.2-rusty`, TypeScript `6.0.3`. |
| 01:58 | `uname -s` and `uname -m` | Record OS and architecture | 0 | Darwin / arm64. |
| 01:58 | `test -e "$WORK/.tools/deno"` (reported as present/absent) | Confirm whether an isolated binary exists | 0 (reporting command) | Reported `absent`. |

## Relevant redacted output

First prescribed acquisition attempt:

```text
error: This deno was built without the "upgrade" feature. Please upgrade using the installation method originally used to install Deno.
```

Plan-permitted retry:

```text
error: This deno was built without the "upgrade" feature. Please upgrade using the installation method originally used to install Deno.
```

Existing runtime inspection:

```text
deno 2.8.3 (stable, release, aarch64-apple-darwin)
v8 14.9.207.2-rusty
typescript 6.0.3
```

No credential, token, cookie, hostname, environment dump, or personal data is included. Local absolute paths are represented as `$WORK` in this log.

## Observations

### Observed facts

1. Both invocations of the exact plan-prescribed updater command failed before producing `$WORK/.tools/deno`.
2. The retry's captured updater exit code was 1.
3. The isolated Deno 2.9.0 binary was absent after the retry.
4. The available global binary reported version 2.8.3, not the required exact version 2.9.0.
5. No table, snapshot, retry, repeats, coverage, related, or shard command was executed.

### Interpretation

The plan's acquisition command is incompatible with the locally installed Deno build because that build does not include its self-upgrade feature. Under this plan's fallback rules, using Deno 2.8.3, a mirror, a container, an install script, or another acquisition method is out of scope. Therefore the exact-version gate required stopping the practice.

## Failures and attempted fixes

- Failure: isolated Deno 2.9.0 could not be acquired through the only authorized command.
- First-attempt recording issue: the command was initially launched by zsh, while the plan's exit-capture expression uses Bash-specific `PIPESTATUS`. This did not cause the updater failure, which appeared before the harness error, but it prevented a separate first-attempt updater exit file.
- Bounded correction: the one permitted retry was executed explicitly under Bash, preserving the updater output and exit code. It reproduced the same updater failure.
- Knowledge consultation: `knowledge/INDEX.md` and `knowledge/*.md` had no match for the high-signal terms; no fix was applicable.
- No further workaround was attempted because the plan explicitly forbids alternate binary sources and substitution with Deno 2.8.3.

## Deviations

- The fixture files and recording helper were materialized in `$WORK` before the runtime acquisition command. The plan lists fixture creation after acquisition. They were not formatted or executed, and this ordering did not affect the updater failure.
- The first acquisition attempt used the environment's default zsh rather than Bash, exposing the `PIPESTATUS` harness incompatibility. The permitted retry used Bash.
- Optional `--related` and `--shard` checks were not reached.

## Verification results

| Item | Result | Evidence |
|---|---|---|
| Exact Deno 2.9.0 | Not met | `evidence/00-deno-download-first.log`, `evidence/00-deno-download-retry.log`, `evidence/00-deno-download-retry.exit`, `evidence/01-isolated-deno-status.txt` |
| Deno.test.each and filter | Not run | Blocked by exact-version gate |
| Snapshot lifecycle | Not run | Blocked by exact-version gate |
| Retry and flaky summary | Not run | Blocked by exact-version gate |
| Repeats | Not run | Blocked by exact-version gate |
| Coverage threshold gate | Not run | Blocked by exact-version gate |
| Final required suite | Not run | Blocked by exact-version gate |
| Related and shard (optional) | Not run | Blocked by exact-version gate |

Overall practice success criteria were not met.

## Generated files

Primary artifact:

- `logs/run-deno29-built-in-testing-20260711-0157/execution-log.md`

Evidence:

- `work/evidence/00-start-time.txt`
- `work/evidence/00-deno-download.log`
- `work/evidence/00-deno-download-first.log`
- `work/evidence/00-deno-download-retry.log`
- `work/evidence/00-deno-download-retry.exit`
- `work/evidence/01-existing-deno-version.log`
- `work/evidence/01-isolated-deno-status.txt`
- `work/evidence/01-os.txt`
- `work/evidence/01-arch.txt`
- `work/evidence/99-end-time.txt`

Unexecuted fixtures created from the supplied plan:

- `work/main.ts`
- `work/src/classify.ts`
- `work/src/normalize.ts`
- `work/src/render.ts`
- `work/tests/classify_test.ts`
- `work/tests/normalize_test.ts`
- `work/tests/render_test.ts`
- `work/tests/repeat_test.ts`
- `work/tests/retry_test.ts`
- `work/tools/run-recorded.sh`

No snapshot, coverage, or formatted-output artifact was generated.

## Reproducibility notes

1. This negative result is reproducible only where `/opt/homebrew/bin/deno` is the same kind of build without the `upgrade` feature.
2. The retry command and its exit status are fully recorded in the evidence directory.
3. Re-running later verification requires a new plan or plan revision that authorizes a compatible official method for obtaining exact Deno 2.9.0. This log does not authorize one.
4. Use Bash for the plan's `PIPESTATUS`-based recording snippets.

## Unresolved limitations

- No exact Deno 2.9.0 runtime was available, so none of the planned Deno 2.9 behavior was observed.
- The reason the Homebrew-provided binary omits `upgrade` was not independently diagnosed; only the runtime's own error was observed.
- No claim can be made about whether the fixtures compile, format, or pass.

## Article-safe facts

- On this Darwin arm64 environment, the installed Deno 2.8.3 binary returned exit code 1 for the plan-prescribed isolated `deno upgrade --output ... 2.9.0` retry and reported that it was built without the `upgrade` feature.
- No Deno 2.9 testing feature was verified in this run.
- This is a negative environment/acquisition result, not evidence about Deno 2.9's test runner behavior.
