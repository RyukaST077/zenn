# Revision log: node-vfs-config-loader-fixture

## Sources

- Article: `articles/node-vfs-config-loader-fixture.md`
- Review: `logs/review-node-vfs-config-loader-fixture-20260711-1157.md`
- Execution log: `logs/run-node-vfs-config-fixture-20260711-114257/execution-log.md`

The review scope names the same article path and slug, so the review belongs to this article.

## Findings and dispositions

### Warning 1: reproduction section was not executable from the published steps

- Disposition: resolved.
- Exact edit summary:
  - Labeled the short code in steps 1–6 as excerpts from the executed harness.
  - Added the complete captured `verify.mjs` source.
  - Documented that `config-loader.mjs` and `verify.mjs` were colocated in the run work directory and that the harness creates `host-fixture` and `realfs-root`.
  - Added the exact work-directory-relative invocation: `./node-v26.5.0-darwin-arm64/bin/node --experimental-vfs --test verify.mjs`.
  - Retained the immediate-stop branch and explicitly stated that the outside-symlink code and five repetitions did not run.
- Evidence used:
  - `logs/run-node-vfs-config-fixture-20260711-114257/work/evidence/verify.source.txt`
  - `logs/run-node-vfs-config-fixture-20260711-114257/work/evidence/config-loader.source.txt`
  - `logs/run-node-vfs-config-fixture-20260711-114257/work/evidence/suite-command-log.txt`
  - Execution-log sections `Chronological command record`, `Verification results`, and `Reproducibility notes and unresolved limitations`.

## Slug and image paths

- Old slug: `node-vfs-config-loader-fixture`
- New slug: `node-vfs-config-loader-fixture`
- Article path was not renamed.
- No image path was present or changed.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/node-vfs-config-loader-fixture.md --expect-published false`
- Result: passed; reported slug `node-vfs-config-loader-fixture` and `published=false`.

## Unresolved items

- No review finding remains unresolved.
- The original run limitations remain unchanged: the outside-root symlink case and five repetitions were not executed, and Linux behavior is unverified.
