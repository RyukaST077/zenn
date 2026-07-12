# Execution log: CSS Gap Decorations comparison

## Plan

- Plan path: `practice/practice-css-gap-decorations-20260711-0622.md`
- Run directory: `logs/run-css-gap-decorations-20260711-0622/`
- Outcome: **Stopped at the mandatory browser gate (negative/partial evidence).**
- No article was created. No Git command, network access, package installation, authentication, or ordinary browser profile was used.

## Environment and versions

| Field | Observed value |
|---|---|
| Start (UTC) | `2026-07-10T21:26:56Z` |
| End (UTC) | `2026-07-10T21:29:18Z` |
| OS | `Darwin` |
| Architecture | `arm64` |
| Node.js used from `work/` | `v22.17.1` |
| npm | `10.9.2` |
| Playwright | `1.61.1` |
| System Chrome executable version | `Google Chrome 149.0.7827.201` |

The repository-root preflight resolved Node.js as `v22.17.0`, while the commands run from `work/` resolved it as `v22.17.1`; the latter is the version that parsed and ran `verify.cjs`. The Chrome version command proves that the executable exists and reports version 149. It does not prove that the browser launched successfully or that any CSS feature is supported.

## Chronological command record

Commands are shown relative to the repository root or, where noted, `logs/run-css-gap-decorations-20260711-0622/work/`. Generated-project work remained under the run directory.

| Time/order | Working directory | Exact command | Exit/result |
|---|---|---|---|
| Preflight 1 | repository root | `test ! -e logs/run-css-gap-decorations-20260711-0622 && test -f node_modules/playwright/index.js && test -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; status=$?; date -u '+%Y-%m-%dT%H:%M:%SZ'; node --version; npm --version; node node_modules/playwright/cli.js --version; '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --version; uname -s; uname -m; exit $status` | Exit 1: zsh reserves `status` as read-only. This was a shell-wrapper mistake, not a product-under-test result. |
| Preflight 2 | repository root | Same command with `rc` replacing `status` | Exit 0; prerequisites and versions observed. |
| Setup | repository root | `mkdir -p logs/run-css-gap-decorations-20260711-0622/work/evidence/screenshots logs/run-css-gap-decorations-20260711-0622/work/tmp-profile` | Exit 0. |
| Fixture | repository root | Created `work/index.html`, `work/styles.css`, and `work/verify.cjs` from the supplied plan. | Completed. |
| Environment | `work/` | `date -u '+%Y-%m-%dT%H:%M:%SZ' > evidence/start-time.txt` | Exit 0. |
| Environment | `work/` | `node --version > evidence/node-version.txt` | Exit 0. |
| Environment | `work/` | `npm --version > evidence/npm-version.txt` | Exit 0. |
| Environment | `work/` | `node ../../../node_modules/playwright/cli.js --version > evidence/playwright-version.txt` | Exit 0. |
| Environment | `work/` | `'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --version > evidence/system-chrome-version.txt 2>&1` | Exit 0. |
| Environment | `work/` | `uname -s > evidence/os.txt` and `uname -m > evidence/arch.txt` | Exit 0. |
| Syntax gate | `work/` | `node --check verify.cjs > evidence/node-check.txt 2>&1` | Exit 0; stderr/stdout file is empty. |
| Browser gate | `work/` | `node verify.cjs --gate-only > evidence/gate-stdout.txt 2> evidence/gate-stderr.txt` | Exit 1. The runner tried system Chrome first and then the one permitted bundled-Chromium fallback. Neither produced a usable browser context. |
| Knowledge lookup | repository root | `rg -i -n 'MachPortRendezvousServer|bootstrap_check_in|Permission denied \(1100\)|launchPersistentContext|SIGTRAP|Chromium.*sandbox' knowledge/INDEX.md knowledge/*.md` | Exit 1 (no match). No repository fix was applicable. |
| Redaction | `work/` | Mechanical replacement of the repository and Playwright-cache absolute prefixes in the two browser error files | Exit 0. No username or complete home path remains in those files. |
| Cleanup | `work/` | `rm -rf tmp-profile` then `test ! -e tmp-profile` | Exit 0. |

## Relevant redacted output

The system-Chrome attempt was captured in `evidence/system-chrome-launch-error.txt`:

```text
Error: browserType.launchPersistentContext: Target page, context or browser has been closed
```

After the system attempt failed, the runner made the single plan-permitted bundled Chromium attempt. `evidence/gate-stderr.txt` records these relevant lines (paths redacted):

```text
Error: browserType.launchPersistentContext: Target page, context or browser has been closed
<launching> <playwright-cache>/chromium_headless_shell-1228/.../chrome-headless-shell ... --user-data-dir=<repo>/logs/run-css-gap-decorations-20260711-0622/work/tmp-profile ...
[err] FATAL:base/apple/mach_port_rendezvous_mac.cc:159] Check failed: kr == KERN_SUCCESS. bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)
<process did exit: exitCode=null, signal=SIGTRAP>
```

Observed fact: both allowed browser-launch paths failed before the runner could create a page and evaluate the gate. Interpretation: the bundled attempt was prevented by a macOS Mach service permission failure. The captured system-Chrome error is too generic to assign the same cause to that attempt.

## Observations

### Observed facts

- The fixture and verifier were created in the isolated work directory, and `node --check verify.cjs` passed.
- The installed system Chrome executable reported major version 149.
- System Chrome did not yield a persistent browser context.
- The permitted bundled Chromium fallback terminated with `SIGTRAP` after `bootstrap_check_in ... Permission denied (1100)`.
- No browser page was available, so `CSS.supports()`, computed styles, element rectangles, overflow, responsive columns/rows, fallback activation, and rendered gap decorations were not observed.
- No external URL was requested by a successfully launched page because no page was established.

### Interpretation

- The mandatory gate cannot be marked pass or fail on the CSS criteria: browser major and CSS support were never jointly observed inside a running browser.
- Under the plan's stop conditions, downloading another browser, changing security boundaries, or making more launch retries was not allowed. The run therefore stopped before full verification.

## Verification results

| Check | Expected | Actual | Result |
|---|---|---|---|
| Node syntax check | `verify.cjs` parses | Exit 0 | Pass |
| Chromium context launch | Context opens | System and bundled attempts both failed | Fail / stop |
| Chromium major in running browser | 149 or later | Not observed in browser | Not verified |
| `CSS.supports('row-rule', ...)` | `true` | Not observed | Not verified |
| `CSS.supports('column-rule', ...)` | `true` | Not observed | Not verified |
| Full JSON assertions | 0 failures | Not run after gate failure | Not verified |
| Screenshots | 10 PNG files | 0 PNG files | Not produced |
| Temporary profile cleanup | Directory absent | Directory absent | Pass |

## Failures and attempted fixes

1. The first read-only preflight wrapper used zsh's reserved `status` variable. It was corrected to `rc`; the corrected preflight passed. This did not modify the repository outside the new run directory.
2. The browser gate failed. Per `zenn-run-practice`, `zenn-consult-knowledge` was used once before further diagnosis. High-signal terms were `MachPortRendezvousServer`, `bootstrap_check_in`, `Permission denied (1100)`, `launchPersistentContext`, `SIGTRAP`, and Chromium sandbox. Neither `knowledge/INDEX.md` nor `knowledge/*.md` contained a match, so no recorded fix was applied.
3. The verifier itself had already performed the only allowed fallback: system Chrome followed by bundled Chromium. No further browser retry was made.

## Deviations

- The planned full run, integrity assertion, screenshots, `results.json`, and optional-engine observation were skipped because the mandatory browser gate could not launch either permitted browser.
- `gate.json` was not created: browser launch failed before the runner reached gate serialization. The raw redacted stderr and system-launch error are retained instead.
- The execution ended well inside the timebox because the plan explicitly requires stopping when both launch paths fail.

## Generated files

- `execution-log.md`
- `work/index.html`
- `work/styles.css`
- `work/verify.cjs`
- `work/evidence/arch.txt`
- `work/evidence/end-time.txt`
- `work/evidence/file-list.txt`
- `work/evidence/gate-stderr.txt`
- `work/evidence/gate-stdout.txt`
- `work/evidence/node-check.txt`
- `work/evidence/node-version.txt`
- `work/evidence/npm-version.txt`
- `work/evidence/os.txt`
- `work/evidence/playwright-version.txt`
- `work/evidence/start-time.txt`
- `work/evidence/system-chrome-launch-error.txt`
- `work/evidence/system-chrome-version.txt`

`work/evidence/screenshots/` exists but contains no files. `tmp-profile/` was removed.

## Reproducibility notes

- Run from the repository root with the preinstalled Node.js, Playwright, and Chrome; install nothing.
- The exact gate command is `cd logs/run-css-gap-decorations-20260711-0622/work && node verify.cjs --gate-only`.
- Do not treat a future successful launch as evidence for this run. A new isolated run must capture its own gate and full-run outputs.
- Browser retry limits still apply: system Chrome first, bundled Chromium once only.

## Unresolved limitations

- The cause of the system-Chrome launch failure was not specific in Playwright's top-level error.
- The macOS permission boundary behind the bundled Chromium failure was not changed or bypassed.
- All CSS Gap Decorations behavior remains unverified in this run.
- Firefox and WebKit were not installed or executed, as planned.

## Article-safe facts

Only the following claims are supported by this execution log:

- In the isolated work directory, Node.js `v22.17.1`, npm `10.9.2`, Playwright `1.61.1`, and a system Chrome executable reporting `149.0.7827.201` were present. The repository-root preflight separately resolved Node.js as `v22.17.0`.
- The generated verification runner passed Node's syntax check.
- Both permitted Chromium launch paths failed before CSS feature detection, so this run provides no evidence about CSS Gap Decorations support, rendering, layout invariance, computed styles, responsive behavior, or progressive enhancement.

No positive CSS behavior claim is article-safe from this run.
