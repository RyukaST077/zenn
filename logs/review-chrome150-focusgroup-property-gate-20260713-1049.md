# Review: chrome150-focusgroup-property-gate

verdict: pass
blockers: 0
warnings: 0

## Scope

- Article: `articles/chrome150-focusgroup-property-gate.md`
- Execution log: `logs/run-focusgroup-chrome150-20260713-103650/execution-log.md`
- Reviewed: 2026-07-13 10:49 JST
- Deterministic check: `bash scripts/check-article.sh articles/chrome150-focusgroup-property-gate.md --expect-published false` passed with slug `chrome150-focusgroup-property-gate` and `published=false`.

The supplied paths exist and match: the article identifies the same run directory, Chrome for Testing artifact, environment, capability result, and stop boundary recorded by the execution log.

## Findings

No blockers or warnings.

- Article lines 15, 34, and 113-148 accurately report that Chrome for Testing 150.0.7871.115 launched, loaded the loopback fixture, returned `false` for `'focusgroup' in HTMLElement.prototype`, and then stopped at the mandatory `jq -e` contract assertion. Evidence: execution log sections `Redacted relevant output`, `Observed facts`, and `Verification results`; `work/evidence/capability.json`; `work/evidence/gate-exit-code.txt`.
- Article lines 40-50 accurately reproduce the recorded OS, Node.js, npm, `playwright-core`, browser version/platform, headless mode, and loopback delivery details. Evidence: execution log section `Environment and versions`; `work/evidence/environment.txt`; `work/evidence/dependency-versions.json`; `work/evidence/browser-cli-version.txt`; `work/evidence/cft-stable.tsv`.
- Article lines 52-109 clearly label the commands and directory tree as excerpts, state the missing setup categories, and direct readers to the chronological execution log. This resolves the reproducibility ambiguity without presenting the snippets as a standalone procedure. Evidence: execution log sections `Chronological commands`, `Generated files`, and `Reproducibility notes`.
- Article lines 133-144 and 164-182 preserve every post-gate item as unexecuted and do not infer keyboard, memory, RTL, fallback, accessibility-tree, or screenshot results. Evidence: execution log sections `Interpretation`, `Verification results`, and `Unresolved limitations`.
- Article lines 150-162 accurately distinguish the observed property failure from browser-launch troubleshooting and state that no alternate channel, flag, system browser, or cached browser was substituted. Evidence: execution log section `Failures and attempted fixes`.

## External-source verification

- Chrome for Developers, `New in Chrome 150`, supports the article's description of declarative arrow-key navigation, a single Tab stop, and last-focused memory: https://developer.chrome.com/blog/new-in-chrome-150
- W3C APG, `Developing a Keyboard Interface`, supports treating a composite as one Tab-sequence stop and using non-Tab keys for internal focus movement: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- The preserved official Chrome for Testing availability manifest and selected TSV support the artifact source and version; the article appropriately warns that the live manifest changes: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json
- The linked feature-detection article supports checking the corresponding DOM property rather than inferring support from an attribute; Chrome's primary focusgroup RFC also gives the exact expression used by the gate: https://adactio.com/journal/22445 and https://developer.chrome.com/blog/focusgroup-rfc
- The Open UI explainer explicitly separates focus navigation from selection management, matching the article's characterization of that statement as external design documentation rather than a local observation: https://open-ui.org/components/focusgroup.explainer/

## Suggestions

### Suggestion 1: cite the primary feature-detection example directly

- Article location: lines 109 and 197.
- The current citation is sufficient, but adding or replacing it with Chrome's focusgroup RFC would point readers directly to the exact expression `'focusgroup' in HTMLElement.prototype`. This is optional and does not affect publication readiness.
