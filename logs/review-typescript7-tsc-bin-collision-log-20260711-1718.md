# Review: TypeScript 7 / TypeScript 6 bin collision log

verdict: fix
blockers: 0
warnings: 1

## Scope

- Article: `articles/typescript7-tsc-bin-collision-log.md`
- Execution log: `logs/run-typescript7-side-by-side-20260711-171217/execution-log.md`
- Slug: `typescript7-tsc-bin-collision-log`

The supplied article and execution log match. The article stays within the failed version-gate experiment and does not claim results for the unexecuted fixture, diagnostics, emit, Compiler API, or benchmark stages.

## Warning

### 1. The reproduction commands omit the run-local npm cache setting

- Article location: `## 検証環境` and `## 再現手順`, especially the two `npm view` commands and the `npm install` command.
- Issue: The article says that npm's cache was placed in an isolated verification directory, but the displayed reproduction commands do not set `npm_config_cache` and do not define an equivalent npm configuration. A reader following the shown commands therefore does not reproduce the stated isolation boundary. This is a reproducibility gap, even though it does not contradict the observed bin-resolution result.
- Required change: Define a run-local cache directory in the reproduction setup and add `npm_config_cache="$WORK_DIR/npm-cache"` (or an equivalent documented npm configuration) to both `npm view` calls and the `npm install` call. Keep the work directory generic and free of user-bearing absolute paths.
- Existing evidence permitting the edit: The execution log's chronological command record and reproducibility notes record the same run-local cache for registry queries and installation. The practice plan gives the exact form `npm_config_cache="$WORK_DIR/npm-cache"`, so no new experiment is required.

## Suggestions

- `Iterating faster with TypeScript 7` appears only in `## 参考資料`. Either connect it to a specific statement in the body or remove it from the references so every listed source has a visible purpose.

## Verification

- Deterministic check passed: `bash scripts/check-article.sh articles/typescript7-tsc-bin-collision-log.md --expect-published false`.
- The environment, registry responses, exact top-level package versions, local CLI outputs and statuses, failed assertions, package manifests, symlink targets, direct-entrypoint outputs, mandatory stop, and stated limitations all trace to the supplied execution log and its retained evidence.
- The TypeScript team's primary announcement supports the external claims that TypeScript 7.0 has no programmatic API and that `@typescript/typescript6` is provided for side-by-side TypeScript 6 access during the transition.
- No credential, token, cookie, private hostname, personal data, or user-bearing absolute path was found in the article.

## Verdict rationale

The single warning can be resolved entirely from existing recorded commands, so the verdict is `fix`, not `blocker`.
