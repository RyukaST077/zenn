# Revision log: npm12-allowscripts-local-fixture

## Inputs

- Article: `articles/npm12-allowscripts-local-fixture.md`
- Review: `logs/review-npm12-allowscripts-local-fixture-20260712-0402.md`
- Execution log: `logs/run-npm12-allow-scripts-20260712-0349/execution-log.md`
- Revised: 2026-07-12 04:04 JST

The review scope names the supplied article, execution log, and slug, so the review belongs to this article.

## Findings and dispositions

### Warning 1: baseline cleanup was missing

- Disposition: resolved from existing evidence.
- Edit: explained that the local `file:` dependency was symlinked, that deleting only `node_modules` is insufficient, and that the valid npm 12 baseline used a separate case and removed the fixture-source `postinstall-marker.txt` before install. Added the cleanup command to the baseline procedure.
- Evidence: execution log `## Failures, fixes, and deviations`, item 3; chronological records for `npm12-baseline-contaminated` and `npm12-baseline`.

### Warning 2: deny and two `npm ci` cases were not reproducible

- Disposition: resolved from existing evidence.
- Edit: added the pending review, approval, denial, fixture-marker cleanup, clean install, installer test, and denied-fixture observation procedure. Split the `npm ci` procedure into policy-present and policy-removed cases, including removal of only `allowScripts` while retaining the dependency and lockfile.
- Evidence: execution log chronological records `explicit-deny/40-46`, `ci-approved/50-52`, and `ci-no-policy/53-55`; `logs/run-npm12-allow-scripts-20260712-0349/work/evidence/ci-policy.diff`.

## Path changes

- Old slug: `npm12-allowscripts-local-fixture`
- New slug: `npm12-allowscripts-local-fixture`
- Article path: unchanged
- Image path: no image directory or image-reference change

## Deterministic check

- Command: `bash scripts/check-article.sh articles/npm12-allowscripts-local-fixture.md --expect-published false`
- Result: passed (`OK: articles/npm12-allowscripts-local-fixture.md (slug=npm12-allowscripts-local-fixture, published=false)`)

## Unresolved items

- None from the supplied review. The environment and generalization limitations already documented in the article remain unchanged.
