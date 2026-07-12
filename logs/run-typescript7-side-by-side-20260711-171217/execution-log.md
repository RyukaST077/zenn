# Execution log: TypeScript 7 / TypeScript 6 side-by-side gate

## Plan and outcome

- Plan: `practice/practice-typescript7-side-by-side-20260711-1707.md`
- Run directory: `logs/run-typescript7-side-by-side-20260711-171217/`
- Work directory: `logs/run-typescript7-side-by-side-20260711-171217/work/`
- Start: 2026-07-11T17:12:17+0900
- End: 2026-07-11T17:15:20+0900
- Outcome: stopped at plan step 2, as required by the plan's failure criteria.
- Reason: the exact top-level packages installed, but both local CLI names resolved to TypeScript 6.0.3. Therefore `tsc` was not 7.0.2 and `tsc6` was not 6.0.2.

No fixture, diagnostic comparison, emit comparison, Compiler API test, or benchmark was created or run after this mandatory stop.

## Environment and versions

Observed in `work/evidence/environment.txt`:

```text
observed_at=2026-07-11T17:12:17+0900
Darwin 25.5.0 arm64
node v22.17.0
npm 10.9.2
logical_cpus=10
total_memory_bytes=17179869184
```

Registry observations:

```text
typescript@7.0.2 -> "7.0.2"
@typescript/typescript6@6.0.2 -> "6.0.2"
```

Installed top-level dependency observations from `npm ls --depth=0 --json`:

```text
typescript -> 7.0.2
@typescript/typescript6 -> 6.0.2
problems -> none
```

The root `package.json` and lockfile both record exact devDependency strings `7.0.2` and `6.0.2`.

## Chronological command record

| Time (JST) | Command / operation | Exit | Expected | Actual |
|---|---|---:|---|---|
| 17:12:17 | Create `logs/run-typescript7-side-by-side-20260711-171217/work/{evidence,npm-cache}` and write the temporary run pointer | 0 | New isolated directory | Created; no existing directory was reused |
| 17:12 | Record date, `uname -srm`, `node --version`, `npm --version`, CPU count, and memory | 0 | Environment evidence | Evidence recorded without an environment-variable dump |
| 17:12 | `npm_config_cache="$WORK_DIR/npm-cache" npm view typescript@7.0.2 version --json` | 0 | `"7.0.2"` | `"7.0.2"` |
| 17:12 | `npm_config_cache="$WORK_DIR/npm-cache" npm view @typescript/typescript6@6.0.2 version --json` | 0 | `"6.0.2"` | `"6.0.2"` |
| 17:12 | Exact registry-value assertions using `jq -r` and `test` | 0 | Both exact versions exist | Both passed; no retry was needed |
| 17:12 | `npm init -y` and `npm pkg set private=true` | 0 | Private isolated package | Created |
| 17:12 | `npm_config_cache="$WORK_DIR/npm-cache" npm install --save-dev --save-exact --ignore-scripts --no-audit --no-fund typescript@7.0.2 @typescript/typescript6@6.0.2` | 0 | Install exact top-level packages without scripts | Four packages added |
| 17:12 | `npm ls --depth=0 --json` | 0 | Top-level 7.0.2 and 6.0.2 | Top-level package versions matched, with no reported problem |
| 17:12 | First `./node_modules/.bin/tsc --version` in the combined gated command | nonzero or interrupted before output was captured | `Version 7.0.2` | `evidence/tsc-version.txt` is empty and the combined command stopped before creating the original `tsc6-version.txt`; the runner did not expose a numeric exit code for this first attempt |
| 17:13 | Consult repository troubleshooting knowledge using `rg -i` for TypeScript/tsc/bin-resolution terms | 0 | Find an applicable confirmed fix | One partially related report found; it did not apply (details below) |
| 17:13 | Retry `./node_modules/.bin/tsc --version` with stdout/stderr/status captured | 0 | `Version 7.0.2` | `Version 6.0.3`; stderr empty |
| 17:13 | Retry `./node_modules/.bin/tsc6 --version` with stdout/stderr/status captured | 0 | `Version 6.0.2` | `Version 6.0.3`; stderr empty |
| 17:13 | Inspect local bin symlinks and the three installed package manifests | 0 | Identify why both version gates failed | `tsc` links to `../@typescript/old/bin/tsc`; `tsc6` links to the wrapper, whose dependency is `@typescript/old: npm:typescript@^6`; installed `@typescript/old` is 6.0.3 |
| 17:13 | `node node_modules/typescript/bin/tsc --version` | 0 | Check the installed 7.0.2 package entrypoint without changing dependencies | `Version 7.0.2` |
| 17:13 | `node node_modules/@typescript/typescript6/bin/tsc6 --version` | 0 | Check the wrapper entrypoint | `Version 6.0.3` |
| 17:14 | Re-run both exact local-bin commands and both planned version assertions | CLI: 0/0; assertions: 1/1 | Both assertions pass | Both CLIs printed 6.0.3; both assertions failed |

## Relevant observed output

Install output:

```text
added 4 packages in 11s
```

Local CLI gate:

```text
$ ./node_modules/.bin/tsc --version
Version 6.0.3
$ ./node_modules/.bin/tsc6 --version
Version 6.0.3
tsc_status=0
tsc6_status=0
tsc_version_assertion_status=1
tsc6_version_assertion_status=1
```

Package and bin inspection:

```text
typescript package version: 7.0.2
typescript package bin: { "tsc": "./bin/tsc" }

@typescript/typescript6 package version: 6.0.2
@typescript/typescript6 dependency: { "@typescript/old": "npm:typescript@^6" }
@typescript/typescript6 bin: { "tsc6": "./bin/tsc6" }

@typescript/old installed version: 6.0.3
tsc  -> ../@typescript/old/bin/tsc
tsc6 -> ../@typescript/typescript6/bin/tsc6
```

Direct package-entrypoint observations (diagnosis only, not substituted for the plan's required local-bin commands):

```text
$ node node_modules/typescript/bin/tsc --version
Version 7.0.2
$ node node_modules/@typescript/typescript6/bin/tsc6 --version
Version 6.0.3
```

No credentials, cookies, environment dump, private hostname, or user-bearing absolute path is included in this public log.

## Observed facts versus interpretation

### Observed facts

- Public registry queries returned the requested wrapper/package versions.
- npm recorded exact top-level dependency versions in both `package.json` and `package-lock.json`.
- The installed `typescript` package's own entrypoint reported 7.0.2.
- The installed local `.bin/tsc` symlink targeted `@typescript/old`, not the top-level `typescript` package.
- `@typescript/typescript6@6.0.2` declared `@typescript/old` as `npm:typescript@^6`; npm selected 6.0.3.
- Both plan-required local commands reported 6.0.3, so neither exact version assertion passed.

### Interpretation

The evidence indicates two distinct dependency/bin effects: npm's bin-link selection exposed the transitive `@typescript/old` compiler as `tsc`, and the wrapper's `^6` dependency selected 6.0.3. This explains the repeatable gate results in this install. It does not establish how every npm version or pre-existing lockfile would resolve the same package set.

## Failure, attempted diagnosis, and knowledge consultation

This was a non-trivial dependency/bin-resolution failure, so `$zenn-consult-knowledge` was used once before further diagnosis.

- Matched report: `knowledge/2026-07-05-npx-tsc-resolves-squatter-package.md`
- Applicability: not applicable as a fix. That report concerns `npx tsc` fetching the unrelated `tsc@2.0.4` package when TypeScript is absent. This run invoked installed local binaries and had `typescript@7.0.2` present.
- No knowledge fix was applied.
- Bounded diagnosis only inspected the already installed manifests, symlinks, and direct entrypoints. Dependencies and bin links were not rewritten.

The plan explicitly says to stop when `tsc`/`tsc6` do not report the expected versions and forbids manually repairing bin links or overriding dependencies. Execution therefore stopped before fixture creation.

## Deviations

- The first combined gate attempt left an empty `evidence/tsc-version.txt` and no original `evidence/tsc6-version.txt`, and its exact numeric exit code was unavailable from the command runner. Both commands were rerun in the same isolated install with stdout, stderr, and status observed; both reruns exited 0 and printed 6.0.3.
- Steps 3 through 7 were intentionally not executed because step 2 triggered a mandatory stop.
- A final full evidence checksum index was not produced because the planned final-verification step was unreachable. Existing evidence remains under the isolated run directory.

## Generated files

Primary artifact:

```text
logs/run-typescript7-side-by-side-20260711-171217/execution-log.md
```

Run files outside npm cache and `node_modules`:

```text
work/package.json
work/package-lock.json
work/evidence/environment.txt
work/evidence/npm-init.txt
work/evidence/npm-install.txt
work/evidence/npm-ls.json
work/evidence/typescript7-registry.json
work/evidence/typescript6-registry.json
work/evidence/tsc-version.txt
work/evidence/tsc-version-retry.stdout.txt
work/evidence/tsc-version-retry.stderr.txt
work/evidence/tsc6-version-retry.stdout.txt
work/evidence/tsc6-version-retry.stderr.txt
```

The isolated npm cache, installed packages, and lockfile are retained for review as required by the plan.

## Verification results

| Criterion | Result | Evidence |
|---|---|---|
| Registry has `typescript@7.0.2` | Pass | `typescript7-registry.json` |
| Registry has `@typescript/typescript6@6.0.2` | Pass | `typescript6-registry.json` |
| Exact top-level versions installed | Pass | `package.json`, `package-lock.json`, `npm-ls.json` |
| Local `tsc` reports 7.0.2 | Fail | Repeatedly reported 6.0.3 |
| Local `tsc6` reports 6.0.2 | Fail | Repeatedly reported 6.0.3 |
| Same-input diagnostic capture | Not run | Mandatory stop at step 2 |
| Emit comparison | Not run | Mandatory stop at step 2 |
| TS 6 Compiler API test | Not run | Mandatory stop at step 2 |
| Benchmark (minimum three conditions) | Not run | Mandatory stop at step 2 |

## Reproducibility notes

- Use the retained `work/package-lock.json` to inspect this exact resolved graph.
- The install used the run-local npm cache and the plan's `--ignore-scripts --no-audit --no-fund` flags.
- No registry retry was needed.
- No Git command, Docker command, browser, global install, dependency override, or bin-link rewrite was performed.
- The temporary pointer `/tmp/zenn-typescript7-run-dir` still identifies this retained run.

## Unresolved limitations

- The planned comparison cannot be evaluated because its required side-by-side CLI gate did not hold.
- No claim can be made about TS 6/7 diagnostic equivalence, emit equivalence, Compiler API behavior, or relative performance from this run.
- The exact cause of the first empty `tsc-version.txt` is unresolved; the repeat runs are sufficient to establish the version mismatch but not that initial transient symptom.
- This run did not test whether a future wrapper release, a different dependency range, or a different npm bin-link implementation changes the outcome.

## Article-safe facts

Only the following facts are supported by this execution log:

- In this Darwin arm64, Node 22.17.0, npm 10.9.2 run, installing the two requested exact top-level package versions succeeded.
- In the resulting dependency graph, `@typescript/typescript6@6.0.2` resolved its `npm:typescript@^6` dependency to TypeScript 6.0.3.
- In this install, both `node_modules/.bin/tsc --version` and `node_modules/.bin/tsc6 --version` printed `Version 6.0.3`.
- The top-level `typescript` package's direct entrypoint printed `Version 7.0.2`, but it was not the target of the installed `.bin/tsc` symlink.
- Because the required version gate failed, later comparison claims were not tested and must not be inferred.
