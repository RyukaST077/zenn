# Deno 2.9 lockfile migration execution log

## Run metadata

- Plan: `practice/practice-deno29-lockfile-migration-20260711-2229.md`
- Isolated work directory: `$WORK` (`logs/run-deno29-lockfile-migration-20260711-2233/work`)
- Started: 2026-07-11T22:35:34+09:00
- Finished: 2026-07-11T22:38:46+09:00
- Network scope used: official Deno release archive and public npm registry only
- Authentication, paid services, GUI, browser, system installation, Docker, and repository Git commands: not used

## Environment and exact versions

| Component | Observed value |
|---|---|
| OS / architecture | Darwin / arm64 |
| Deno | 2.9.0 (stable, release, aarch64-apple-darwin) |
| V8 / TypeScript bundled with Deno | 14.9.207.2-rusty / 6.0.3 |
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| pnpm | 10.13.1 |

Deno was downloaded from the exact official archive URL in the plan. The version gate passed. The Docker fallback was not used.

## Chronological command record

Every numbered command has `.started`, `.finished`, `.stdout`, `.stderr`, and `.exit` evidence files. Outputs were redacted by replacing the isolated absolute work path with `$WORK`.

| Label | Command (working directory relative to `$WORK`) | Exit | Expected / actual |
|---|---|---:|---|
| 00 | `.tools/deno --version` | 0 | Exact 2.9.0 required / matched |
| 02 | `npm install --ignore-scripts` (`fixtures/npm`) | 0 | baseline install success / success |
| 03 | `npm ci --ignore-scripts` (`fixtures/npm`) | 0 | clean baseline success / success |
| 04 | `npm ls --all --json` (`fixtures/npm`) | 0 | dependency tree / recorded |
| 05 | `npm test` (`fixtures/npm`) | 0 | test success / `fixture test: ok` |
| 06 | `pnpm install --ignore-scripts --lockfile-only=false` (`fixtures/pnpm`) | 0 | baseline install success / success |
| 07 | `pnpm install --frozen-lockfile --ignore-scripts` | 0 | frozen baseline success / success |
| 08 | `pnpm list --depth Infinity --json` | 0 | dependency tree / recorded |
| 09 | `pnpm test` | 0 | test success / `fixture test: ok` |
| 10 | `.tools/deno install --node-modules-dir=auto` (`fixtures/npm`) | 0 | migrate npm lock / seeded `deno.lock` |
| 11 | `.tools/deno info --json` (`fixtures/npm`) | 0 | runtime/cache info / recorded |
| 12 | `.tools/deno task test` (`fixtures/npm`) | 0 | migrated test success / `fixture test: ok` |
| 13 | `.tools/deno install --node-modules-dir=auto` (`fixtures/pnpm`) | 0 | migrate pnpm lock / seeded `deno.lock` |
| 14 | `.tools/deno info --json` (`fixtures/pnpm`) | 0 | runtime/cache info / recorded |
| 15 | `.tools/deno task test` (`fixtures/pnpm`) | 0 | migrated test success / `fixture test: ok` |
| 16 | `node tools/compare-locks.mjs npm evidence/npm-package-lock.json evidence/npm-deno.lock` | 0 | package comparison / 8 comparable entries |
| 17 | `node tools/compare-locks.mjs pnpm evidence/pnpm-lock.yaml evidence/pnpm-deno.lock` | 0 | package comparison / 8 comparable entries |
| 18 | `.tools/deno install --frozen --node-modules-dir=auto` | 0 | unchanged manifest success / success |
| 19 | same frozen command after changing `kleur` to `^4.1.0` | 1 | intentional nonzero / nonzero with lockfile-out-of-date diff |
| 20 | same frozen command after restoring manifest | 0 | restored success / success |
| 21 | `.tools/deno task test` after restore | 0 | restored test success / `fixture test: ok` |
| 22 | `pnpm install --ignore-scripts` (`fixtures/workspace`) | 0 | workspace baseline / success |
| 23 | `pnpm --filter @fixture/app test` | 0 | workspace baseline test / `workspace test: ok` |
| 24 | `.tools/deno install --node-modules-dir=auto` (`fixtures/workspace`) | 0 | observe migration / produced only an empty-format lock and no configuration diffs |
| 25 | `.tools/deno task --cwd packages/app test` | 1 | hoped-for migrated task / failed to resolve `@fixture/lib` |
| 26 | `.tools/deno install --node-modules-dir=auto` (`fixtures/lifecycle`) | 0 | default script not run / zero marker files |
| 27 | `.tools/deno install --allow-scripts=local-marker --node-modules-dir=auto` | 1 | optional limited approval / rejected because an `npm:` specifier is required |
| 28 | `.tools/deno install --help` | 0 | required syntax evidence after mismatch / recorded |

Setup commands also created the fixtures with `apply_patch`, copied the identical base fixture, recorded hashes, removed only fixture-local `node_modules`, captured pre/post inventories, copied lockfiles, produced diffs, and generated the final inventory and SHA-256 list.

## Observed outputs and verification results

### Baselines and initial Deno migration

- The base, npm, and pnpm fixture contents had identical SHA-256 values for `package.json`, `index.mjs`, and `test.mjs` before lock generation.
- npm and pnpm each installed eight packages in the resolved tree, created their expected lockfile, and passed the same test.
- Command 10 reported that it seeded `deno.lock` from `package-lock.json`. Command 13 reported that it seeded `deno.lock` from `pnpm-lock.yaml`.
- Both generated Deno locks use top-level key `npm` (plus `version`, `specifiers`, and `workspace`) and both Deno task tests passed.

### Package-level lock comparison

The parser used the formats actually observed: npm `packages[*]`, pnpm `packages` with `resolution.integrity`, and Deno's top-level `npm` map. It did not infer missing fields.

| Source lock | Packages classified | Version result | Integrity result |
|---|---:|---|---|
| npm `package-lock.json` | 8 | 8 `version_match` | 8 `integrity_match` |
| pnpm `pnpm-lock.yaml` | 8 | 8 `version_match` | 8 `integrity_match` |

The eight packages were `kleur`, `lodash`, `uvu`, `yaml`, `dequal`, `diff`, `sade`, and `mri`. Thus all four direct dependencies and all four observed transitives matched in both version and the complete integrity string for these exact fixtures.

### Frozen behavior

- Unchanged lock plus manifest: exit 0.
- After only the `kleur` specifier changed from `4.1.5` to `^4.1.0`: exit 1. Deno reported the lockfile was out of date and displayed the specifier changes.
- After restoring the original manifest: frozen install and task test both returned exit 0.

### Workspace boundary (negative result)

- pnpm installed the two-package workspace and the app test passed.
- Deno command 24 returned 0 and reported seeding from `pnpm-lock.yaml`, but produced `deno.lock` containing only `{ "version": "5" }`.
- Root `package.json`, `pnpm-workspace.yaml`, and both package manifests had no diffs. No `deno.json` was generated.
- The Deno task invoked the Node test, which failed with `ERR_MODULE_NOT_FOUND` for `@fixture/lib`. Therefore workspace package linking and the catalog were not demonstrated as migrated in this fixture.

### Lifecycle boundary (partial result)

- The default Deno install returned 0 and created no `marker.txt`, so the local package's `postinstall` was not run by default.
- Limited approval with the exact planned spelling returned 1 before running the script: Deno 2.9.0 required an `npm:` package specifier. Help output was saved as required by the plan.
- The plan prohibited broadening approval. No marker existed after the rejected command, so explicit opt-in execution was not demonstrated.

## Failures, attempted fixes, and deviations

1. The plan's recording wrapper used Bash process substitution with `tee`. The sandbox rejected `/dev/fd/62` with `Operation not permitted`. As required after this non-trivial failure, `knowledge/INDEX.md` and `knowledge/*.md` were searched for `/dev/fd`, `operation not permitted`, `process substitution`, `tee`, and `run-recorded`. The only match was `knowledge/2026-07-11-codex-sandbox-infeasible-practice-plans.md`; it confirmed that sandbox constraints must be established from execution evidence but did not contain this exact wrapper fix.
2. The wrapper was changed within `$WORK` to run the command with stdout/stderr redirected directly to evidence files and then replay them with `cat`. A first attempted replay using `tee /dev/stdout` was also rejected, so `cat` was used. Exit code and timestamps remained recorded. This is the only recording-method deviation.
3. Workspace task failure was retained as negative evidence. No speculative configuration changes were made because command 24 suggested no documented non-interactive option.
4. Lifecycle approval syntax mismatch was handled exactly as the plan directed: help was recorded and the optional approval step stopped without allowing all scripts.

## Generated files and reproducibility

- Full file inventory: `work/evidence/final-file-inventory.txt`
- Evidence hashes: `work/evidence/evidence-sha256.txt`
- Original and generated locks: `work/evidence/npm-package-lock.json`, `npm-deno.lock`, `pnpm-lock.yaml`, `pnpm-deno.lock`
- Comparisons: `work/evidence/16-npm-lock-comparison.{tsv,json}` and `17-pnpm-lock-comparison.{tsv,json}`
- Workspace diffs and command output: `work/evidence/24-*`, `25-*`
- Lifecycle output and help: `work/evidence/26-*`, `27-*`, `28-*`

To reproduce, use the exact versions above, recreate a fresh run directory, keep `NO_COLOR=1`, place npm/pnpm/Deno caches inside `$WORK`, and execute the numbered commands in order. Public registry availability is the only external dependency. npm reported two vulnerability advisories during the baseline audit summary; no audit fix was run because dependency versions were deliberately fixed by the plan.

## Unresolved limitations

- Results apply only to the exact small fixtures and versions recorded here; they do not establish compatibility for arbitrary Node.js projects.
- Workspace migration did not preserve a runnable package link in the tested layout, and no catalog mapping was observed.
- The approved lifecycle execution branch was not tested because the planned local package selector is invalid in Deno 2.9.0 and the plan forbade widening permission.
- Deno's seed messages plus complete lock comparisons support the observed transfer for these packages, but do not prove how every possible lockfile field or package shape is handled.

## Article-safe facts (observed, not generalized)

1. Deno 2.9.0 printed explicit seed messages for both the npm and pnpm lockfiles in these fixtures.
2. For each source lock, all eight observed packages had identical resolved versions and complete integrity strings in the generated Deno lock.
3. Both migrated single-package fixtures passed the same task test under Deno.
4. Frozen installation passed before and after manifest restoration and returned nonzero for the deliberate specifier mismatch.
5. The pnpm workspace baseline passed, while the tested Deno workspace task could not resolve the local package and no configuration diff was generated.
6. The local lifecycle script did not run during default installation. The planned limited selector was rejected before execution because Deno required an `npm:` specifier.
