# Review: node-vfs-config-loader-fixture

verdict: fix
blockers: 0
warnings: 1

## Review scope

- Article: `articles/node-vfs-config-loader-fixture.md`
- Execution log: `logs/run-node-vfs-config-fixture-20260711-114257/execution-log.md`
- Slug: `node-vfs-config-loader-fixture`
- Deterministic check: `bash scripts/check-article.sh articles/node-vfs-config-loader-fixture.md --expect-published false` passed and confirmed the expected slug and `published=false`.

## Findings

### Warning 1: the reproduction section cannot be executed from the published steps

- Article location: `## 再現手順`, especially steps 3–6.
- Problem: the section presents separate snippets as reproduction steps, but step 4 uses `loadConfig` and `assert` without importing them, step 6 uses an undeclared `realfsRoot`, and no step supplies the complete test harness or the command that runs it. A reader following the article therefore cannot reproduce the reported seven-test suite, watch setup, boundary stop, or test-runner summary from the published flow. The snippets may be intended as excerpts, but they are not labeled as excerpts and the missing setup/invocation is material.
- Required change: either publish a complete executable `verify.mjs` plus its isolated-directory setup and `node --experimental-vfs --test verify.mjs` invocation, or explicitly label the snippets as excerpts and link/provide the complete captured harness and exact invocation needed to reproduce the run. Preserve the documented immediate-stop behavior and do not imply that the outside-symlink case or five repetitions ran.
- Permitted evidence: `logs/run-node-vfs-config-fixture-20260711-114257/work/evidence/verify.source.txt`, `config-loader.source.txt`, `suite-command-log.txt`, and execution-log sections “Chronological command record,” “Verification results,” and “Reproducibility notes” contain the exact sources, setup context, command, exit code, and stop behavior. Existing evidence is sufficient; no new experiment is required.

## Evidence trace summary

- The environment values, archive checksum match, Docker fallback, API-gate exports and exit codes, six passing tests, one failing RealFSProvider boundary expectation, two watch events, and host-file inventory all agree with the execution log and captured evidence.
- The loader shown in the article matches `config-loader.source.txt`. The MemoryProvider isolation, invalid JSON, directory read, read-only, symlink, watch, and RealFSProvider observations match `verify.source.txt` and `test.stdout`.
- The article accurately distinguishes the failed expectation from an actual root escape: `/../escape.json` was accepted and normalized to `realfs-root/escape.json`, while no `work/escape.json` was observed.
- The limitations correctly state that Linux behavior, the outside-root symlink case, five-run stability, generalized watch ordering, sandbox guarantees, and performance were not verified.
- The captured Node.js v26.5.0 VFS documentation supports the external claims that `node:vfs` was added in v26.4.0, is experimental, requires `--experimental-vfs`, and documents MemoryProvider, RealFSProvider, read-only, symlink, and watch APIs.
- No secret exposure, fabricated result, contradicted claim, or additional publication-blocking issue was found.
