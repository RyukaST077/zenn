# Review: TypeScript 7 / TypeScript 6 bin collision log

verdict: fix
blockers: 0
warnings: 1

## Scope

- Article: `articles/typescript7-tsc-bin-collision-log.md`
- Execution log: `logs/run-typescript7-side-by-side-20260711-171217/execution-log.md`
- Slug: `typescript7-tsc-bin-collision-log`

The supplied article and execution log match. The article limits its conclusions to the failed version gate and does not infer results for the unexecuted diagnostics, emit, Compiler API, or benchmark work.

## Warning

### 1. The reproduction procedure does not establish the fresh work directory used by the run

- Article location: `## 再現手順`, lines 39–64, especially `WORK_DIR="$(pwd)"` followed by `npm init -y`.
- Issue: The recorded run created a new, previously unused work directory before installation, but the article starts from whatever directory the reader is already in. An existing `package.json`, lockfile, `node_modules`, or npm configuration can change dependency and bin-link resolution. This is material here because the article itself notes that a pre-existing lockfile can produce a different graph. The shown commands therefore do not fully reproduce the isolation condition behind the reported result.
- Required change: Before assigning `WORK_DIR`, add commands that create and enter a new empty verification directory (or explicitly state that the reader must start in one). Keep the path generic, retain the run-local npm cache, and do not add cleanup commands that could affect an existing directory.
- Existing evidence permitting the edit: The execution log's chronological command record says a new isolated `work/` directory was created and no existing directory was reused. Its reproducibility notes retain the corresponding lockfile. The practice plan's `## 隔離ディレクトリ` section provides a safe generic creation pattern, so no new experiment is required.

## Verification

- Deterministic check passed: `bash scripts/check-article.sh articles/typescript7-tsc-bin-collision-log.md --expect-published false`.
- The environment values, registry responses, exact top-level package versions, local CLI outputs and exit statuses, failed assertions, manifest fields, symlink targets, direct-entrypoint outputs, mandatory stop, and limitations trace to the execution log.
- The TypeScript team's primary announcement supports the external claims that TypeScript 7.0 has no programmatic API and that `@typescript/typescript6` is provided for side-by-side TypeScript 6 access.
- No blocker, secret exposure, unsupported post-gate result, or broken article format was found.

## Verdict rationale

The reproducibility warning can be resolved using the already recorded isolation procedure, so the verdict is `fix`, not `blocker`.
