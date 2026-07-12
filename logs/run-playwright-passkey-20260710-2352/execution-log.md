# Playwright passkey practice execution log

## Scope and outcome

- Plan: `practice/practice-playwright-passkey-20260710-2352.md`
- Run directory: `logs/run-playwright-passkey-20260710-2352/`
- Start: 2026-07-10T14:58:08Z
- End: 2026-07-10T14:59:17Z
- Outcome: stopped during dependency installation after the original attempt and the one permitted retry both failed.
- Evidence status: usable negative evidence was produced. No application, test fixture, browser test, or article content was created.

## Environment and versions

Observed in `evidence/environment.txt` before dependency installation:

| Item | Observed value |
|---|---|
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| Kernel | Darwin 25.5.0 arm64 |
| OS | macOS 26.5, build 25F71 |
| Planned Playwright version | 1.61.0; not installed, therefore not verified |
| Planned SimpleWebAuthn versions | server 13.3.1 and browser 13.3.1; not installed, therefore not verified |

The raw environment-variable list was not collected.

## Chronological command record

The run-level start and end timestamps were captured. Separate start/end timestamps for every command were not captured; this is an evidence gap. The retry diagnostic log name records 2026-07-10T14:58:38Z as the npm retry's log timestamp.

| Order | Recorded time | Exact command | Expected | Actual | Exit |
|---:|---|---|---|---|---:|
| 1 | 2026-07-10T14:58:08Z | `date -u; node --version; npm --version; uname -srm; sw_vers` with output redirected to `evidence/environment.txt` | Record a bounded environment snapshot | Recorded the versions above | 0 |
| 2 | after order 1 | `npm init --yes > "$RUN_DIR/evidence/npm-init.log" 2>&1` | Create a minimal package manifest | Created `work/package.json` | 0 |
| 3 | after order 2 | `npm install --save-exact playwright@1.61.0 @simplewebauthn/server@13.3.1 @simplewebauthn/browser@13.3.1 > "$RUN_DIR/evidence/npm-install.log" 2>&1` | Install all exact dependencies | npm could not open a temporary file in the user-level cache and returned `EPERM`; personal path components were redacted in the retained log | 1 |
| 4 | after order 3 | `rg -n -i 'EPERM\|root-owned\|npm cache\|_cacache\|npm install' knowledge/INDEX.md knowledge/*.md` | Find a confirmed repository workaround before further diagnosis | No applicable report found; only an unrelated TypeScript package report matched the broad npm term | 1 (no relevant match) |
| 5 | 2026-07-10T14:58:38Z (npm log timestamp) | `npm_config_cache="$WORK_DIR/.npm-cache" npm install --save-exact playwright@1.61.0 @simplewebauthn/server@13.3.1 @simplewebauthn/browser@13.3.1 > "$RUN_DIR/evidence/npm-install-retry.log" 2>&1` | Use the plan's single retry without changing ownership, deleting a cache, using a mirror, or requiring administrator access | Registry resolution reached the package request, then returned `ETARGET`: no matching version was found for `@simplewebauthn/browser@13.3.1` | 1 |
| 6 | before 2026-07-10T14:59:17Z | cleanup and sanitization checks from the plan | Leave no temporary secret file or server process and retain sanitized evidence | Checks passed; the sensitive-key-name scan returned the expected no-match status 1 | 0 |

The first shell group used `set -eu`, so the failure at order 3 prevented the browser installation and version-listing commands later in that group. The retry shell group also stopped at order 5 before browser installation. Those commands were not executed and are not reported as observations.

## Relevant redacted output

Initial attempt (`evidence/npm-install.log`):

```text
npm error code EPERM
npm error syscall open
npm error path /Users/<USER>/.npm/_cacache/tmp/[redacted-temporary-name]
npm error Your cache folder contains root-owned files
```

Permitted retry (`evidence/npm-install-retry.log`):

```text
npm error code ETARGET
npm error notarget No matching version found for @simplewebauthn/browser@13.3.1.
```

The temporary cache filename above is redacted in this summary. The retained npm log contains no authentication data, but retains the random temporary filename as command-failure evidence.

## Observations

### Directly observed facts

1. `npm init --yes` succeeded and created a package manifest.
2. The exact dependency command failed first with `EPERM` while accessing the existing user-level npm cache.
3. The one permitted retry used a run-local npm cache and progressed to registry version resolution.
4. That retry failed with `ETARGET` specifically for `@simplewebauthn/browser@13.3.1`.
5. No dependency lockfile, installed dependency tree, Playwright browser binary evidence, application source, or test result was produced.
6. No temporary passkey file remained, and the run's secret directory was empty at cleanup.

### Interpretation

- The retry demonstrates that the initial cache-permission failure was not the final blocker for this run.
- The fixed browser-package version in the supplied plan could not be resolved by npm during the permitted retry. Because the plan requires that exact version and allows at most one dependency retry, continuing with a different version would have violated the plan.
- This run provides no basis for any claim about Playwright's passkey API behavior or browser compatibility.

## Failures and attempted fixes

| Failure | Consulted knowledge | Bounded action | Result |
|---|---|---|---|
| User-level npm cache open failed with `EPERM` | Searched `knowledge/INDEX.md` and `knowledge/*.md` using `EPERM`, `root-owned`, `npm-cache`, and `_cacache`; no applicable confirmed report was found | Used a run-local npm cache for the plan's sole retry. No ownership change, administrator command, cache deletion, mirror switch, or system installation was performed | Cache access progressed, but exact dependency resolution failed with `ETARGET` |
| Exact `@simplewebauthn/browser@13.3.1` resolution failed | No second knowledge consultation was performed because the run-practice skill permits one consultation and the plan's dependency retry allowance was exhausted | Stopped without substituting a version | Planned implementation and verification steps remained unexecuted |

## Deviations

1. The retry set `npm_config_cache` to `work/.npm-cache` to avoid mutating or repairing the user-level cache. This remained inside the isolated run directory.
2. Per-command boundary timestamps were not captured. Only the overall timestamps and npm retry log timestamp are available.
3. Steps 2 through 8 of the implementation and test plan were not executed because dependency acquisition met a stated stop condition.

## Verification results

| Planned hypothesis or check | Result | Evidence |
|---|---|---|
| Chromium registration and separate-context login | Inconclusive / not run | Dependencies unavailable |
| Same spec in Chromium, Firefox, and WebKit | Inconclusive / not run | Browser installation not reached |
| Deterministic negative cases | Inconclusive / not run | Test fixture not created |
| Temporary file reuse and mode check | Inconclusive / not run | No passkey material was created; cleanup confirmed no such file remained |
| Chromium CDP baseline comparison | Inconclusive / not run | Test fixture not created |
| Sanitized evidence and no prohibited secret files | Passed for the artifacts that were produced | `evidence/sensitive-key-scan.txt`, `evidence/sensitive-key-scan.exit`, cleanup checks, and `evidence/file-list.txt` |

## Generated files

- `execution-log.md`: this primary record.
- `evidence/environment.txt`: bounded environment snapshot.
- `evidence/npm-init.log`: npm initialization output with personal path components redacted.
- `evidence/npm-install.log` and `.exit`: initial dependency failure and exit status.
- `evidence/npm-install-retry.log` and `.exit`: permitted retry failure and exit status.
- `evidence/knowledge-consult.txt`: knowledge-search outcome and retry rationale.
- `evidence/sensitive-key-scan.txt` and `.exit`: sanitized-artifact scan result.
- `evidence/file-list.txt`: run inventory, regenerated after this log was written.
- `evidence/end-time.txt`: run end timestamp.
- `work/package.json`: manifest created by `npm init`.
- `work/.npm-cache/`: run-local npm cache metadata; not an article-facing evidence source.

## Reproducibility notes

- Reproduction should begin from the same plan and exact dependency versions in a new run directory.
- The user-level npm cache state caused the first failure and is environment-specific. A run-local cache avoided that specific access path without privileged changes.
- A future plan must first cite an actually published compatible `@simplewebauthn/browser` version and update all coupled API assumptions before changing the fixed version. This run does not authorize a version substitution.
- External communication in this run was limited to npm package resolution. Browser downloads and loopback tests were not reached.

## Unresolved limitations

- The availability history or intended replacement for `@simplewebauthn/browser@13.3.1` was not investigated after the stop condition.
- Playwright 1.61.0 was requested but not installed or executed, so its runtime behavior is unknown here.
- No virtual-authenticator result can be generalized to physical hardware because neither was exercised.
- Individual command start/end times cannot be reconstructed from the retained evidence.

## Article-safe facts

Only the following facts are supported for downstream use:

1. On macOS 26.5 arm64 with Node.js v22.17.0 and npm 10.9.2, the first exact dependency-install command failed with `EPERM` on the pre-existing user-level npm cache.
2. A single retry using a cache inside the isolated work directory reached registry resolution but failed with `ETARGET`, reporting no matching version for `@simplewebauthn/browser@13.3.1`.
3. No Playwright or WebAuthn functional test ran, so there is no evidence supporting or contradicting the practice hypotheses.

These are negative setup observations, not product-capability conclusions.
