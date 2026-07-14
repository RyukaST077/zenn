# Execution log

- Plan: `practice/practice-focusgroup-chrome150-20260713-1033.md`
- Run directory: `logs/run-focusgroup-chrome150-20260713-103650`
- Start: 2026-07-13 10:36:50 JST
- End: 2026-07-13 10:39:55 JST
- Outcome: stopped at the mandatory property-based capability gate; usable negative evidence was produced

## Environment and versions

- Effective sandbox mode: `danger-full-access` (supplied by the caller); real-browser launch was allowed.
- OS: macOS 26.5 (Build 25F71), Darwin 25.5.0, arm64.
- Node.js: v22.17.0.
- npm: 10.9.2.
- `playwright-core`: 1.61.1, installed locally with scripts disabled.
- Chrome for Testing Stable manifest version: 150.0.7871.115, mac-arm64.
- Chrome CLI result: `Google Chrome for Testing 150.0.7871.115`.
- Browser executable: `work/browser/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
- Manifest URL: `https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json`.
- Artifact URL is recorded in `work/evidence/cft-stable.tsv`; SHA-256 values are in `work/evidence/sha256.txt` and `work/evidence/artifact-sha256.txt`.
- Full raw environment: `work/evidence/environment.txt`; dependency inventory: `work/evidence/dependency-versions.json`.

## Chronological commands

| Start (JST) | Exact command / operation | Exit | Relevant redacted output |
|---|---|---:|---|
| 10:36:50 | `RUN_ID="$(date '+%Y%m%d-%H%M%S')"; RUN_DIR="$PWD/logs/run-focusgroup-chrome150-$RUN_ID"; test ! -e "$RUN_DIR"; mkdir -p "$RUN_DIR/work"/{browser,downloads,evidence,fixture,shots}` plus the plan's environment capture block | 0 | Isolated directory created without collision. |
| 10:37 | Create `execution-log.md` and the plan-defined local `package.json` using `apply_patch` | 0 | Log existed before dependency/browser work. |
| 10:37 | `npm install --ignore-scripts --no-audit --no-fund 2>&1 \| tee evidence/npm-install.txt` | 0 | `added 1 package`; exact output retained. |
| 10:37 | `curl --fail --location --silent --show-error https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json --output downloads/cft.json` | 0 | Official Stable manifest retained. |
| 10:37 | Plan-supplied `jq -er` query selecting Stable major >=150 and `mac-arm64`, writing `evidence/cft-stable.tsv` | 0 | Selected 150.0.7871.115. |
| 10:37 | `curl --fail --location --silent --show-error "$CFT_URL" --output downloads/chrome.zip` | 0 | Official archive downloaded. |
| 10:37 | `unzip -q downloads/chrome.zip -d browser`; executable test; `"$CFT_EXECUTABLE" --version`; plan-supplied `shasum` | 0 | Executable discovered; CLI major 150 confirmed. |
| 10:38 | Create the bounded localhost fixture, server, capability gate, and automation sources under `work/` using `apply_patch` | 0 | No repository source, article, practice, or research file changed. |
| 10:39 | `wc -l fixture/app.js > evidence/source-lines.txt` and the plan-supplied branch-token `grep` | 0 | Source metrics retained; they were not interpreted as quality evidence. |
| 10:39 | `node server.mjs > evidence/server-url.txt 2> evidence/server-stderr.txt &` with cleanup trap and readiness loop | 0 | Bound to `http://127.0.0.1:52243/`. |
| 10:39 | `node gate.mjs --executable "$CFT_EXECUTABLE" --url "$BASE_URL" > evidence/gate-stdout.txt 2> evidence/gate-stderr.txt` | 0 | Browser launch, context/page creation, and localhost navigation succeeded. |
| 10:39 | `jq -e '(.launch == "ok") and (.browserMajor >= 150) and (.focusgroupPropertySupport == true)' evidence/capability.json > /dev/null` | 1 | Mandatory property gate failed because the observed value was `false`. Execution stopped immediately. |
| 10:39 | Cleanup trap: kill/wait for server; later verify the recorded port with `lsof` | 0 | No listener remained on TCP port 52243. |
| 10:39 | Inventory/checksum generation with plan-supplied `find`, `sort`, and `shasum`; `npm list --depth=0 --json` | 0 | Evidence inventory and hashes retained. |

The phase commands for `basic`, `edges`, and `responsibility` were present after the gate in the bounded shell block but were not reached because `set -e` stopped at the mandatory `jq` gate. Their exit-code files are therefore absent, not zero.

## Redacted relevant output

`work/evidence/capability.json` records the observed gate result:

```json
{
  "launch": "ok",
  "browserVersion": "150.0.7871.115",
  "browserMajor": 150,
  "focusgroupPropertySupport": false,
  "navigation": "ok"
}
```

No credentials or personal page content were accessed. The executable and URL fields remain in the raw evidence because they are run-local reproducibility data and contain no secret.

## Observed facts

- Official Chrome for Testing Stable 150.0.7871.115 downloaded, unpacked, and launched headlessly through Playwright.
- Browser context creation, page creation, and navigation to the loopback fixture succeeded.
- On that loaded localhost page, the exact property-based expression `'focusgroup' in HTMLElement.prototype` evaluated to `false`.
- The mandatory gate required that expression to evaluate to `true`; therefore the UI/keyboard/DOM/accessibility phases were not executed.
- `gate.mjs` itself exited 0 because it successfully observed and serialized the unsupported property value. The following contract assertion (`jq -e`) exited 1; this distinction explains `work/evidence/gate-exit-code.txt` containing `0` while the overall gate sequence failed.
- Server cleanup completed and no listener remained on its recorded port.

## Interpretation

- This run does not establish any `focusgroup` keyboard, memory, RTL, edge, selection, fallback, or accessibility behavior. Those results must not be inferred.
- The only behavior-level conclusion supported by this run is that the plan's required property-support gate was not met in the selected official Stable artifact in this environment.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Browser launch | pass | `work/evidence/capability.json` |
| Browser major >= 150 | pass (150) | `work/evidence/capability.json`, `browser-cli-version.txt` |
| Localhost context/page/navigation | pass | `work/evidence/capability.json` |
| `'focusgroup' in HTMLElement.prototype === true` | fail (observed `false`) | `work/evidence/capability.json` |
| Basic JS/native matrix | not-run | stopped by capability gate |
| Memory/boundary matrix | not-run | stopped by capability gate |
| Responsibility/fallback matrix | not-run | stopped by capability gate |
| AX tree | not-run | stopped by capability gate, not an AX API failure |
| Screenshots | not-run | stopped by capability gate |
| Cleanup | pass | no listener on recorded port 52243 |

## Failures and attempted fixes

- Failure: mandatory property gate returned false.
- Per `zenn-run-practice`, troubleshooting knowledge was consulted once before diagnosis. Search terms were `focusgroup`, `focusgroupPropertySupport`, `Chrome for Testing`, `Playwright`, and `capability gate`.
- Matched report: `knowledge/2026-07-11-codex-sandbox-infeasible-practice-plans.md` (browser-gate/sandbox report).
- Applicability: no fix applied. That report concerned browser context launch failure under `workspace-write`; this run used `danger-full-access`, and launch/context/navigation all succeeded. It provides no applicable remedy for an observed false platform property.
- No alternate browser, channel, feature flag, cached Chromium, or attribute-based inference was attempted because the supplied plan explicitly forbids those fallbacks and requires immediate stop.

## Deviations

- No behavioral deviation from the plan. Fixture/automation sources were prepared before the capability gate as ordered, but their UI automation was not run.
- The execution log summarizes the exact shell blocks and points to verbatim stdout/stderr evidence rather than duplicating the downloaded binary/archive content.

## Generated files

- Primary artifact: this `execution-log.md`.
- All generated project work: `work/`.
- Machine-readable capability result: `work/evidence/capability.json`.
- Exact evidence inventory: `work/evidence/file-list.txt`.
- Evidence checksums: `work/evidence/artifact-sha256.txt`.
- Fixture and automation source inventory: `work/fixture/`, `work/server.mjs`, `work/gate.mjs`, `work/run.mjs`.
- Browser archive and unpacked browser: `work/downloads/`, `work/browser/`.

## Reproducibility notes

- Start at repository root and use only the supplied plan.
- The Stable manifest is time-varying; this run preserved its downloaded JSON and selected URL/version.
- Reproduction must retain the property-based gate exactly. `hasAttribute("focusgroup")` is not equivalent and was not used.
- Do not proceed to keyboard or AX verification unless all three gate requirements pass.

## Unresolved limitations

- Why Stable 150.0.7871.115 exposes no `focusgroup` property was not investigated because the plan classifies the false property result as an immediate stop and allows only a stopping record as fallback.
- All behavioral matrix items and AX evidence remain `not-run`, not `unavailable` and not failed assertions.

## Article-safe facts

- In this run on macOS arm64, official Chrome for Testing Stable 150.0.7871.115 launched successfully through `playwright-core` 1.61.1 and loaded the loopback fixture.
- On the loaded fixture, `'focusgroup' in HTMLElement.prototype` evaluated to `false`.
- Because that was a mandatory capability gate, no claims about keyboard navigation or accessibility behavior are supported by this run.
