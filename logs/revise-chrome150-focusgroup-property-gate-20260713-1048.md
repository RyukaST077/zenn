# Revision log: chrome150-focusgroup-property-gate

- Revised: 2026-07-13 10:48 JST
- Article: `articles/chrome150-focusgroup-property-gate.md`
- Review: `logs/review-chrome150-focusgroup-property-gate-20260713-1046.md`
- Execution log: `logs/run-focusgroup-chrome150-20260713-103650/execution-log.md`
- Review association: confirmed; the review Scope names the same article and execution log.
- Old slug: `chrome150-focusgroup-property-gate`
- New slug: `chrome150-focusgroup-property-gate`
- Image paths: unchanged; no slug collision or image rename was involved.

## Findings and dispositions

### Warning 1: reproduction sequence omitted prerequisites

- Disposition: resolved.
- Exact edit summary: renamed `再現手順` to `再現に使った手順の抜粋`; stated that the snippets are not a standalone complete procedure; documented the run-local `work/` setup and pinned `package.json` at summary level; directed readers to the execution log's `Chronological commands` for the complete order, including archive download/extraction, executable configuration, localhost server startup, and environment-variable setup; narrowed the manifest sentence to say only that the shown commands select the version and URL.
- Evidence used: execution log sections `Environment and versions`, `Chronological commands`, and `Reproducibility notes`.

### Suggestion 1: prefer the current primary feature-detection source

- Disposition: no edit.
- Reason: this was optional, and the existing article citation already supports property-based detection. The supplied execution log does not add a source URL to replace the existing reference, so the minimal evidence-backed revision retains it.

### Suggestion 2: identify the directory tree as abbreviated

- Disposition: resolved.
- Exact edit summary: described the tree as the main files rather than a complete inventory and added an ellipsis entry.
- Evidence used: the execution log's `Generated files` section and its reference to `work/evidence/file-list.txt` as the exact inventory.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/chrome150-focusgroup-property-gate.md --expect-published false`
- Result: pass.
- Output: `OK: articles/chrome150-focusgroup-property-gate.md (slug=chrome150-focusgroup-property-gate, published=false)`

## Unresolved items

- None from the review's required warning.
- The article remains `published: false`.
