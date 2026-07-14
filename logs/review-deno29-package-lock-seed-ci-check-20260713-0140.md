# Review: deno29-package-lock-seed-ci-check

verdict: pass
blockers: 0
warnings: 0

- Article: `articles/deno29-package-lock-seed-ci-check.md`
- Execution log: `logs/run-deno29-lockfile-seed-20260712-231032/execution-log.md`
- Reviewed: 2026-07-13T01:40:38+0900

## Findings

No blockers or warnings. No article change is required for publication readiness under the review policy.

## Evidence trace

| Article location | Reviewed claim | Evidence |
|---|---|---|
| `## 環境` | Darwin/arm64, Node.js v22.17.1, npm 10.9.2, isolated Deno 2.9.0, system Deno 2.8.3, checksum and registry gates | Execution log `Environment and capability gates`; `work/evidence/environment.txt`; `deno-checksum.txt`; `deno-target-version.txt`; `npm-registry-gate-1.*` |
| `### 1. npmのfixtureとbaselineを作る` | npm install/ci, entry, and test commands exited 0; entry width was 5 | Execution log chronological record and observed fact 4; `work/evidence/npm-baseline/*` |
| `### 2. package-lock.jsonからdeno.lockを作る` | No pre-existing Deno lock/modules, observed seed message, five installed packages, schema version 5 with five npm entries | Execution log observed facts 1–2; `work/evidence/deno-before-files.txt`; `deno-seed/deno-install-first.*`; `deno-lock-schema-summary.json` |
| `### 3. 2つのlockfileを機械比較する` | One direct and four transitive package/version/integrity rows matched mechanically | Execution log observed fact 3; `work/evidence/npm-lock.normalized.json`; `deno-lock.normalized.json`; `lock-comparison.json`; `lock-comparison.meta` |
| `### 4. 実行互換とcleanなdeno ciを試す` | Node/npm/Deno tests passed, second install preserved the lock byte-for-byte, and clean `deno ci` plus subsequent tests passed | Execution log observed facts 4–6; `work/evidence/runtime-compat/*`; `second-install-lock-compare.meta`; `second-install-lock.diff`; `second-install-lock.sha256` |
| `### 5. lockfile driftの負例を作る` | A package.json-only 7.2.0 to 7.1.0 change made `deno ci` exit 1 with an out-of-date diagnostic without changing the lock | Execution log observed fact 7; `work/evidence/drift-package.before.json`; `drift-package.after.json`; `drift/deno-ci-drift.*`; `drift-deno.lock.diff` |
| `## 観測結果` through `## まとめ` | npm rollback succeeded and retained the baseline package lock; conclusions remain limited to one fixed pure-JavaScript fixture | Execution log observed fact 8, interpretation table, limitations, and article-safe facts; `work/evidence/rollback/*`; `summary.json` |

## Deterministic check

`bash scripts/check-article.sh articles/deno29-package-lock-seed-ci-check.md --expect-published false` completed successfully with slug `deno29-package-lock-seed-ci-check` and `published=false`.

## External-source verification

- Deno 2.9 release notes support first-install seeding from `package-lock.json` and carrying resolved versions and integrity hashes: <https://deno.com/blog/v2.9>.
- The npm migration guide supports using Deno first as a package manager while retaining Node.js, and documents the reversible workflow: <https://docs.deno.com/runtime/migrate/migrate_from_npm/>.
- The lockfile guide supports the described lockfile role and strict `deno ci` behavior for missing or stale lockfiles: <https://docs.deno.com/examples/dependency_lockfile_tutorial/>.
- The supply-chain guide is an appropriate primary reference for the explicitly out-of-scope security features: <https://docs.deno.com/runtime/packages/supply_chain/>.

The CLI-only scope matches the execution log. The effective sandbox was `danger-full-access`; browser/UI work was outside the plan, so no browser capability gate was needed and no browser result was inferred.

## Suggestions

None.
