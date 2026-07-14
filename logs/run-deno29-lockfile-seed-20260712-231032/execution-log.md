# Execution log: Deno 2.9 package-lock seed and `deno ci`

## Run identity

- Plan: `practice/practice-deno29-lockfile-seed-20260712-2305.md`
- Run directory: `logs/run-deno29-lockfile-seed-20260712-231032/`
- Work directory: `logs/run-deno29-lockfile-seed-20260712-231032/work/`
- Start: 2026-07-12T14:10:32Z / 2026-07-12T23:10:32+0900
- End: 2026-07-12T14:12:46Z / 2026-07-12T23:12:46+0900
- Effective sandbox: `danger-full-access` (supplied by the caller)
- Browser capability gate: not invoked. Browser/UI verification was outside this CLI plan and was not added.
- Cost/authentication: no paid service, account, API key, OAuth, or credential was used.

## Environment and capability gates

Observed environment is preserved in `work/evidence/environment.txt`.

| Item | Observed value |
|---|---|
| OS / architecture | Darwin 25.5.0 / arm64 |
| Node.js | `/usr/local/bin/node`, v22.17.1 |
| npm | `/usr/local/bin/npm`, 10.9.2 |
| System Deno (comparison only) | `/opt/homebrew/bin/deno`, 2.8.3 |
| Isolated target Deno | `work/tools/deno-2.9.0/deno`, 2.9.0 |
| Deno archive | `https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip` |
| Checksum gate | pass; `deno-aarch64-apple-darwin.zip: OK` |
| Registry gate | pass on attempt 1; raw response `"7.2.0"` |

Gate evidence: `work/evidence/deno-checksum.txt`, `work/evidence/deno-target-version.txt`, `work/evidence/npm-registry-gate-1.stdout`, and `work/evidence/npm-registry-gate-1.stderr`. No retry was required. The target-version download, checksum, extraction, version, public-registry, and direct-plus-transitive graph gates all passed.

## Chronological command record

Paths below are relative to this run directory. Commands with per-command capture have exact cwd/start/end/exit/expectation in the linked `.meta` file; stdout and stderr use the same basename.

| UTC | Cwd | Exact command | Expected / actual | Evidence |
|---|---|---|---|---|
| 14:10:32 | repository root | `mkdir -p "$WORK_DIR"/{tools,evidence,fixture-npm,fixture-deno,branches,scripts}` | zero / 0 | run identity above |
| 14:10:47 | `work` | environment commands: `date`, `uname -a`, `command -v node`, `node --version`, `command -v npm`, `npm --version`, `command -v deno`, `deno --version` | zero / 0 | `work/evidence/environment.txt` |
| 14:10:47–14:10:52 | `work` | `curl --fail --location --retry 1 --retry-delay 2 --output tools/deno-aarch64-apple-darwin.zip https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip` and matching `.sha256sum` download | zero / 0 | downloaded files under `work/tools/` |
| 14:10:52 | `work/tools` | `shasum -a 256 -c deno-aarch64-apple-darwin.zip.sha256sum` | zero / 0 | `work/evidence/deno-checksum.txt` |
| 14:10:52 | `work` | `unzip -q tools/deno-aarch64-apple-darwin.zip -d tools/deno-2.9.0`; `chmod u+x tools/deno-2.9.0/deno`; target `deno --version`; version grep | zero / 0 | `work/evidence/deno-target-version.txt` |
| 14:10:52 | `work` | `npm view string-width@7.2.0 version --json` | zero / 0 | `work/evidence/npm-registry-gate-1.*` |
| 14:11:37 | `work/fixture-npm` | `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | zero / 0 | `work/evidence/npm-baseline/npm-install.*` |
| 14:11:37–14:11:38 | `work/fixture-npm` | `npm ci --ignore-scripts --no-audit --no-fund` | zero / 0 | `work/evidence/npm-baseline/npm-ci.*` |
| 14:11:38 | `work/fixture-npm` | `node src/index.js` | zero / 0 | `work/evidence/npm-baseline/node-entry.*` |
| 14:11:38 | `work/fixture-npm` | `npm test` | zero / 0 | `work/evidence/npm-baseline/npm-test.*` |
| 14:11:38 | `work/fixture-npm` | `node --test` | zero / 0 | `work/evidence/npm-baseline/node-test.*` |
| after 14:11:38 | `work/fixture-npm` | `npm ls --all --json`; `node work/scripts/extract-npm-lock.mjs package-lock.json work/evidence/npm-lock.normalized.json`; two `jq -e` graph/integrity gates | zero / 0 | `work/evidence/npm-baseline-tree.json`, `work/evidence/npm-lock.normalized.json` |
| 14:11:54–14:11:55 | `work/fixture-deno` | absolute isolated `deno install` | zero / 0 | `work/evidence/deno-seed/deno-install-first.*` |
| after 14:11:55 | `work/fixture-deno` | `jq` schema summary; `node work/scripts/extract-deno-lock.mjs`; `jq -e` integrity gate; `node work/scripts/compare-locks.mjs ...` | zero / 0 | `work/evidence/deno-lock-schema-summary.json`, normalized locks, `work/evidence/lock-comparison.*` |
| 14:12:11 | `work/fixture-deno` | `node src/index.js` | zero / 0 | `work/evidence/runtime-compat/node-entry.*` |
| 14:12:11 | `work/fixture-deno` | `npm test` | zero / 0 | `work/evidence/runtime-compat/npm-test.*` |
| 14:12:12 | `work/fixture-deno` | absolute isolated `deno task test` | zero / 0 | `work/evidence/runtime-compat/deno-task-test.*` |
| 14:12:12 | `work/fixture-deno` | absolute isolated second `deno install` | zero / 0 | `work/evidence/runtime-compat/deno-install-second.*` |
| 14:12:12 | `work/fixture-deno` | `cmp -s` and `diff -u` on lock before/after second install | identical / 0 | `work/evidence/second-install-lock-compare.meta`, `.diff`, `.sha256` |
| 14:12:12 | `work/fixture-deno` | `rm -rf node_modules`; absolute isolated `deno ci` | zero / 0 | `work/evidence/runtime-compat/deno-ci-clean.*` |
| 14:12:12 | `work/fixture-deno` | `npm test` | zero / 0 | `work/evidence/runtime-compat/npm-test-after-deno-ci.*` |
| 14:12:12 | `work/fixture-deno` | absolute isolated `deno task test` | zero / 0 | `work/evidence/runtime-compat/deno-task-after-deno-ci.*` |
| before 14:12:28 | `work/branches/drift` | Node JSON rewrite changing only `string-width` from `7.2.0` to `7.1.0` | zero / 0 | `work/evidence/drift-package.before.json`, `.after.json` |
| 14:12:28 | `work/branches/drift` | absolute isolated `deno ci` | nonzero / 1 | `work/evidence/drift/deno-ci-drift.*` |
| after 14:12:28 | `work/branches/drift` | `shasum -a 256 deno.lock`; `diff -u` against saved lock | unchanged lock / 0-byte diff | `work/evidence/drift-deno.lock.after.sha256`, `.diff` |
| 14:12:28–14:12:29 | `work/branches/rollback` | `rm -rf deno.lock node_modules`; `npm ci --ignore-scripts --no-audit --no-fund` | zero / 0 | `work/evidence/rollback/npm-ci-rollback.*` |
| 14:12:29 | `work/branches/rollback` | `npm test` | zero / 0 | `work/evidence/rollback/npm-test-rollback.*` |
| 14:12:29 | `work/branches/rollback` | `node src/index.js` | zero / 0 | `work/evidence/rollback/node-entry-rollback.*` |
| 14:12:46 | `work` | summary generation, `find . -type f`, and SHA-256 generation for core evidence | zero / 0 | `work/evidence/summary.json`, `file-manifest.txt`, `core-evidence.sha256` |

Fixture and helper files were created under `work/` only, with the exact contents prescribed by the plan. No Git command was run and no article content was created.

## Relevant redacted output

No credential-like data was present, so no substantive output needed redaction.

- Initial Deno stderr: `Seeded deno.lock from .../work/fixture-deno/package-lock.json`, followed by initialization of five npm packages and `Installed 5 packages`. Full output: `work/evidence/deno-seed/deno-install-first.stderr`.
- Entry output: `{"sample":"A界🙂","width":5}`. Full outputs: npm baseline, runtime compatibility, and rollback `node-entry*.stdout` files.
- Tests: each recorded `node --test`/`npm test` path reports one test, one pass, zero failures. Full TAP output is preserved beside each `.meta` file.
- Drift stderr reports `error: The lockfile is out of date` and shows `string-width@7.2.0` changing to `7.1.0`. Full diagnostic: `work/evidence/drift/deno-ci-drift.stderr`.

## Observed facts

1. Before initial Deno installation, the Deno fixture had `package-lock.json`, `package.json`, source, and test files, with no `deno.lock` or `node_modules`; see `work/evidence/deno-before-files.txt`.
2. Initial Deno 2.9.0 installation exited 0 and created `deno.lock`; the raw lock is `work/evidence/deno.lock.first.json`. The lock schema version was `5` with five `npm` entries.
3. Both normalized locks contained the same five package/version/integrity rows: `string-width@7.2.0` (direct), plus `ansi-regex@6.2.2`, `emoji-regex@10.6.0`, `get-east-asian-width@1.6.0`, and `strip-ansi@7.2.0` (transitive). Mechanical comparison exited 0 with both `packageVersionEqual` and `integrityEqual` true.
4. The Node entry printed width 5. Baseline `npm test`, Deno-fixture `npm test`, `deno task test`, and both post-clean-`deno ci` tests exited 0.
5. The second `deno install` exited 0. Before/after `deno.lock` copies were byte-identical (`cmp` exit 0 and zero-byte diff); hashes are in `work/evidence/second-install-lock.sha256`.
6. Clean `deno ci` exited 0 and initialized the five packages. Subsequent npm and Deno task tests exited 0.
7. After only `package.json` was changed to request `string-width@7.1.0`, `deno ci` exited 1 as expected. Its diagnostic described lockfile drift. The saved `deno.lock` remained byte-identical (zero-byte drift diff).
8. In the rollback copy, the npm lock matched the saved baseline before rollback. After deleting `deno.lock` and `node_modules`, `npm ci`, `npm test`, and the Node entry all exited 0; the npm lock still matched the baseline.

## Interpretation and hypothesis verdicts

These verdicts apply only to the single fixed pure-JavaScript fixture.

| Hypothesis | Verdict | Evidence basis |
|---|---|---|
| H1: package-lock seeded deno.lock | pass | exit 0, observed seed diagnostic, generated raw lock |
| H2: direct/transitive package, version, integrity match | pass | five rows on each side; mechanical comparator exit 0 |
| H3: runtime/test compatibility and clean ci | pass | all recorded entry/test/ci commands exit 0 |
| H4: stale lock is rejected | pass | drift `deno ci` exit 1 with out-of-date diagnostic |
| H5: npm rollback is reproducible | pass | baseline lock comparisons and rollback install/test/entry exit 0 |

## Generated files and reproducibility

- Full work-tree inventory: `work/evidence/file-manifest.txt`
- Machine summary: `work/evidence/summary.json`
- Core hashes: `work/evidence/core-evidence.sha256`
- All generated project work is under this run's `work/` directory.
- Reproduction requires macOS arm64, Node/npm compatible with the recorded versions, access to `dl.deno.land` and the public npm registry, and execution of the supplied practice plan in order.
- The isolated Deno binary is always invoked by its absolute path. The system Deno was recorded but not used for verification.

## Failures, fixes, deviations, and unresolved limitations

- Non-trivial failures: none. Therefore `$zenn-consult-knowledge` was not invoked.
- Failed attempts: none. The registry gate passed on its first allowed attempt; no parser adjustment or integrity normalization fallback was needed.
- Deviations: file creation used the execution environment's patch mechanism instead of shell heredoc writes; generated contents and locations match the plan. An extra SHA-256 file was recorded for the before/after second-install locks. These changes do not alter the fixture or verification semantics.
- No browser was launched because the plan explicitly excludes browser/UI work. The caller's danger-full-access override therefore required no browser capability gate in this run.
- Unverified/out of scope: native addons, dependency lifecycle scripts, private registries, workspaces, offline/vendor operation, performance, browser behavior, snapshot testing, and minimum dependency age.
- No result is generalized beyond this fixture.

## Article-safe facts

- With this fixture and isolated Deno 2.9.0, initial `deno install` emitted an observed seed diagnostic and generated a version-5 `deno.lock` containing five npm entries.
- For this fixture, the normalized package names, versions, and integrity strings in npm and Deno locks were mechanically equal.
- The fixture's one test passed through npm and `deno task`, including after clean `deno ci`.
- A `package.json`-only change from `string-width` 7.2.0 to 7.1.0 caused `deno ci` to exit 1 with a stale-lock diagnostic.
- Removing Deno's lock/modules from a copied fixture and running `npm ci` restored a passing npm baseline while preserving the saved `package-lock.json` byte-for-byte.
