# Revision log: node26-package-map-store-gate

- Revised at: 2026-07-13T14:19:53+09:00
- Source article: `articles/node26-package-map-store-gate.md`
- Review report: `logs/review-node26-package-map-store-gate-20260713-1417.md`
- Execution log: `logs/run-node26-package-maps-20260713-141143/execution-log.md`
- Review/article match: confirmed by the review's Article and Execution log fields
- Old slug: `node26-package-map-store-gate`
- New slug: `node26-package-map-store-gate` (unchanged)
- Old image path: not applicable
- New image path: not applicable

## Finding dispositions

### Warning 1: assertion input path and reproduction prerequisites were incomplete

- Disposition: resolved with existing evidence.
- Exact edits:
  - Renamed `再現手順` to `実行手順の抜粋` so the section does not claim to be a complete reproduction procedure.
  - Added that the run also used isolation exports including `XDG_CONFIG_HOME`, and that no complete environment dump was collected; omitted isolation settings therefore remain a possible influence on the observed readback.
  - Replaced the three bare commands with their redacted `run-recorded.sh` forms so the stdout-recording step is explicit.
  - Changed the assertion input from the uncreated relative `pnpm-store-dir.stdout` to `<WORK>/evidence/toolchain/pnpm-store-dir.stdout`.
- Evidence used:
  - The review identifies the recorded stdout path, the omitted isolation exports, and the appropriate fix.
  - The execution log records the three wrapper invocations, the command-record file layout, the failed assertion, the isolation environment, and the absence of a full environment dump.
- New evidence generated: none.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/node26-package-map-store-gate.md --expect-published false`
- Result: pass
- Output: `OK: articles/node26-package-map-store-gate.md (slug=node26-package-map-store-gate, published=false)`

## Unresolved items

- None from the review.
- The article intentionally retains the execution log's unresolved limitation that the cause of the `store-dir` readback mismatch was not diagnosed.
