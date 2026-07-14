# Review: deno29-task-cache-boundaries

verdict: pass
blockers: 0
warnings: 0

## Scope

- Article: `articles/deno29-task-cache-boundaries.md`
- Execution log: `logs/run-deno29-task-cache-20260713-164641/execution-log.md`
- Effective sandbox recorded by the run: `danger-full-access`
- Browser verification: not applicable to this CLI-only plan; the execution log records that browser use was allowed but excluded by scope (`execution-log.md:10-12`, `185-186`). No browser result is inferred.

## Deterministic check

`bash scripts/check-article.sh articles/deno29-task-cache-boundaries.md --expect-published false` passed with slug `deno29-task-cache-boundaries` and `published=false`.

## Findings

No blocker, warning, or suggestion. No article change is required.

## Evidence trace

- The environment, isolated Deno binary/cache, checksum, and schema-probe statements at article lines 29-42 match the run identity, environment, and gates at `execution-log.md:3-53` and the retained `work/evidence/{environment,deno-target-version,deno-checksum}.txt` files.
- The fixture source and task definitions at article lines 46-178 match the retained files under `work/fixture/`. The article correctly presents the initial `alpha`, `prefix-one`, and `command-v1` states before the logged mutations.
- The command sequence and exit-class statements at article lines 180-260 and 308-314 match the chronological 29-command record at `execution-log.md:55-91`, including the two intentional exit-1 cases and the patch-mechanism deviation.
- The cache-hit, restoration, invalidation, boundary-case, and SHA-256 claims at article lines 262-306 and 331-337 match the case matrix and full restoration hashes at `execution-log.md:93-158`, plus the bounded interpretation and article-safe facts at `execution-log.md:160-164` and `206-212`.
- The limitations at article lines 316-329 cover the unresolved limitations recorded at `execution-log.md:198-204`, including the exploratory scope of the mtime-only and unlisted-environment observations.
- External claims at article lines 17 and 327 were checked against the linked primary Deno 2.9 release and current `deno task` reference. Those sources support cache opt-in through `files`, fingerprint inputs, appended arguments, listed environment variables, dependency fingerprints, host OS/CPU/Deno version, declared-output restoration, and the zero-match behavior.

## Publication-readiness conclusion

The draft is evidence-bounded, reproducible from the supplied fixture and command order, explicit about untested scope, and passes the repository's deterministic article check. Publication would not require new evidence or evidence-backed corrections.
