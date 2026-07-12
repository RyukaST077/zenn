# Review: css-gap-decorations-browser-gate-failure

verdict: fix
blockers: 0
warnings: 2

## Deterministic check

- Pass: `bash scripts/check-article.sh articles/css-gap-decorations-browser-gate-failure.md --expect-published false`
- The draft remains `published: false`, and the article checker reported `OK`.

## Findings

### Warning 1: the reproduction commands target the preserved evidence directory

- Article location: `articles/css-gap-decorations-browser-gate-failure.md:47-68`
- Problem: the section is presented as a reproduction procedure, but it tells readers to execute `verify.cjs` inside `logs/run-css-gap-decorations-20260711-0622/work/`. The verifier writes `evidence/system-chrome-launch-error.txt`, can write `evidence/gate.json`, and recreates `tmp-profile/` (`work/verify.cjs:10,29,98,116`). Running the displayed commands can therefore mutate the historical run whose evidence the article is documenting. This conflicts with the article's own instruction not to overwrite a past run and creates an evidence-integrity/reproducibility gap.
- Required change: relabel the commands as the commands recorded for this run and explicitly say not to rerun them in the preserved directory, or provide a copy-to-new-isolated-run procedure and execute the verifier only there. Keep the original execution result clearly separate from any later run.
- Evidence permitting the change: `execution-log.md` under **Reproducibility notes** says a future successful launch is not evidence for this run and that a new isolated run must capture its own outputs; **Generated files** shows the evidence files already retained in the documented run.

### Warning 2: the external-request statement is broader than the captured evidence

- Article location: `articles/css-gap-decorations-browser-gate-failure.md:101`
- Problem: “外部URLへのrequestも発生していません” reads as a claim that no external request occurred at all. The route-based request collector is installed only after a browser context and page exist (`work/verify.cjs:99-111`), but both launches failed before that point. The run therefore did not collect request observations from either failed browser process.
- Required change: narrow the statement to the execution log's supported scope, for example: “ページが成立しなかったため、成功裏に起動したページからの外部URL requestはありませんでした。失敗したブラウザプロセス自体の通信を計測した結果ではありません。”
- Evidence permitting the change: `execution-log.md` under **Observed facts** states only that no external URL was requested “by a successfully launched page because no page was established”; `evidence/gate-stderr.txt` shows the failure occurred during `launchPersistentContext` before the request route was installed.

## Evidence trace summary

- Environment versions, syntax-check success, the two launch failures, the bundled Chromium `SIGTRAP`/Mach-service message, absent feature detection and measurements, zero screenshots, missing `gate.json`/`results.json`, the zsh `status` correction, and the unsuccessful knowledge lookup all match `logs/run-css-gap-decorations-20260711-0622/execution-log.md` and its retained evidence.
- The Chrome official source supports the Grid/Flex/multi-column description and Chrome/Edge 149 availability. The W3C Working Draft supports the `row-rule`/gap-decoration specification claim. The recorded browser-compat-data source in `research/search-topic-20260711-0619.md` supports the explicitly time-scoped Chrome 149 and Firefox/Safari compatibility statement.
- No positive CSS support, rendering, layout, computed-style, or fallback result is claimed as locally verified.

## Publication decision

The issues are evidence-backed wording/procedure corrections and do not require a new browser experiment. After both warnings are fixed, rerun the deterministic article check and review again.
