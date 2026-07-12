# Execution log: Node.js `node:vfs` config loader fixture

## Run metadata

- Plan: `practice/practice-node-vfs-config-fixture-20260711-1140.md`
- Run directory: `logs/run-node-vfs-config-fixture-20260711-114257/`
- Work directory: `logs/run-node-vfs-config-fixture-20260711-114257/work/`
- Start: 2026-07-11T11:42:57+09:00
- End: 2026-07-11T11:52:08+09:00
- Outcome: partial/negative evidence. The mandatory root-traversal rejection condition failed, so the run stopped before the outside-symlink case and five repetitions.
- Safety: all generated work stayed under this run directory. No repository Git command was run. No credential, private data, browser, SaaS, or paid service was used.

## Environment and versions

| Item | Observed value |
|---|---|
| Host | macOS 26.5 (Build 25F71), Darwin 25.5.0, arm64 |
| Docker CLI | 28.5.1, build e180ab8 |
| Planned image | `node:26.5.0-bookworm-slim` |
| Actual runtime | official `node-v26.5.0-darwin-arm64.tar.gz` fallback |
| Node.js | v26.5.0 |
| Runtime platform / arch | darwin / arm64 |
| Archive SHA-256 | `ee920559aaa2391569cff4d737e3b83963430e3a14dedd91bfe0ff53171b5af9` (matched official `SHASUMS256.txt`) |
| Docker image ID / digest | unavailable because the pull did not complete |

Full runtime component versions are in `work/evidence/runtime.json`; host details are in `work/evidence/host-environment.txt`.

## API gate and documented signatures

The checked Node.js v26.5.0 versioned documentation was saved as `work/evidence/vfs-doc-v26.5.0.html`. It documents these signatures, which were used without a compatibility shim:

- `create([provider][, options])`; omitting the provider selects `new MemoryProvider()`.
- `new MemoryProvider()` and `memoryProvider.setReadOnly()`.
- `new RealFSProvider(rootPath)`, passed to `create(provider)`.
- synchronous, callback, promise, symlink, and watch APIs on `VirtualFileSystem`.

Observed exports with `--experimental-vfs` (exit 0): `MemoryProvider`, `RealFSProvider`, `VirtualFileSystem`, `VirtualProvider`, `create`, `default`.

Import without the flag exited 1 with `ERR_UNKNOWN_BUILTIN_MODULE`. Import with the flag succeeded. The runtime gate therefore passed on the official archive fallback.

## Chronological command record

| Time (JST) | Command | Exit | Relevant result |
|---|---|---:|---|
| 11:42:57 | create `logs/run-node-vfs-config-fixture-20260711-114257/work/{evidence,host-fixture,realfs-root}` | 0 | isolated work directory created |
| 11:43:13 | `docker pull node:26.5.0-bookworm-slim` | interrupted (130) | no output for approximately 6m10s; bounded attempt stopped within the 20-minute gate |
| 11:48–11:49 | consult `knowledge/INDEX.md` and `knowledge/*.md` for Docker pull/hang/timeout terms | 0 | one report said Docker had worked in past runs, but supplied no matching pull-hang fix |
| 11:49:23 | `curl --fail --location --max-time 600 --output .../node-v26.5.0-darwin-arm64.tar.gz https://nodejs.org/dist/v26.5.0/node-v26.5.0-darwin-arm64.tar.gz` | 0 | plan-permitted official archive fallback downloaded |
| 11:49:24 | download official `SHASUMS256.txt`, calculate and compare SHA-256 | 0 | expected and actual hashes matched |
| 11:49:25 | `tar -xzf .../node-v26.5.0-darwin-arm64.tar.gz -C "$WORK_DIR"` | 0 | isolated runtime extracted under work directory |
| 11:49:46 | fallback Node `--version` | 0 | `v26.5.0` |
| 11:49:47 | capture `process.platform`, `process.arch`, `process.versions` | 0 | darwin/arm64; details saved |
| 11:49:47 | fallback Node `--experimental-vfs -e "import('node:vfs')..."` | 0 | required public exports present |
| 11:49:47 | fallback Node without flag importing `node:vfs` | 1 (expected) | `ERR_UNKNOWN_BUILTIN_MODULE` |
| 11:50 | download Node.js v26.5.0 versioned VFS documentation | 0 | signature evidence saved |
| 11:51:34 | capture pre-run inventory and exact test sources | 0 | files saved under `work/evidence/` |
| 11:51:34 | `node --experimental-vfs --test verify.mjs` from work directory | 1 | 6 passed, RealFS root-traversal rejection test failed |
| 11:51:52 | collect post-run inventory, hashes, and all host `config.json` paths | 0 | no `config.json` outside the expected host and RealFS fixture directories |
| 11:52:08 | capture host versions | 0 | environment record completed |

Exact command transcripts and timestamps are in `gate-command-log.txt`, `fallback-command-log.txt`, `suite-command-log.txt`, and `boundary-command-log.txt`. The interrupted Docker command has no in-log end marker because SIGINT ended its shell; exit 130 was observed by the executor.

## Verification results

| Case | Expected | Actual | Result |
|---|---|---|---|
| Flagged `node:vfs` import | exit 0 | exit 0, required exports present | pass |
| Unflagged import | nonzero | exit 1, `ERR_UNKNOWN_BUILTIN_MODULE` | pass |
| Host valid config | parsed `{name}` | `{ "name": "host" }` | pass |
| Host missing file | `ENOENT` | `ENOENT` from `stat` | pass |
| Host invalid JSON | `SyntaxError` | `SyntaxError` | pass |
| Two MemoryProvider-backed VFS instances | state isolated | first read succeeded; second returned `ENOENT` | pass |
| Sync write / promise read | both work | exact seeded content read | pass |
| Memory invalid JSON | `SyntaxError` | `SyntaxError` | pass |
| Memory directory as file | structured failure | `Error`, `EISDIR` | pass |
| Read-only after seed | read works; write `EROFS` | read succeeded; write returned `EROFS` | pass |
| Memory symlink | readlink, realpath, linked read succeed | `/target.json`, `/target.json`, `{name:"linked"}` | pass |
| Memory watch | bounded event evidence | 2 rename events, no timeout, watcher closed | pass for this run only |
| RealFS mapping | `/config.json` maps beneath root | created `realfs-root/config.json` | pass |
| RealFS `..` input | reject input | input was accepted and normalized to `realfs-root/escape.json` | **fail / stop** |
| RealFS outside symlink | reject access | not run after immediate stop | unverified |
| Five repetitions | deterministic cases exit 0 five times | not run after immediate stop | unverified |

Test runner summary: 7 tests, 6 passed, 1 failed, exit 1. Full stdout is `work/evidence/test.stdout`; stderr is `work/evidence/test.stderr` (empty because the Node test runner incorporated diagnostics into stdout).

## Relevant structured output

```text
{"observation":"memory-second-instance-missing","name":"Error","code":"ENOENT",...}
{"observation":"memory-readonly-write","name":"Error","code":"EROFS",...}
{"observation":"memory-symlink","readlink":"/target.json","realpath":"/target.json","config":{"name":"linked"}}
{"observation":"memory-watch","events":[{"eventType":"rename","filename":"renamed.json"},{"eventType":"rename","filename":"watched.json"}],"count":2,"timedOut":false,"closed":true}
{"observation":"realfs-dotdot","rejected":false,"name":null,"code":null,"message":null}
ROOT_ESCAPE_SUSPECTED
```

The watch event names, count, and order above are one observation and are not generalized.

## Generated files and host impact

Primary generated sources:

- `work/config-loader.mjs`
- `work/verify.mjs`

Source hashes:

- `config-loader.mjs`: `ac7babc9e159b5f896a890b9ce8203be996c98289a19485edc2ba03ca189fcc7`
- `verify.mjs`: `e9c8c4a5bf9ee4959622f904b4245c05e707b99ff1831089adba79bb05a8f805`

Host-side config files found after the run:

- `work/host-fixture/config.json`
- `work/realfs-root/config.json`

No MemoryProvider `/config.json` appeared on the host. The accepted traversal input created `work/realfs-root/escape.json`, still inside the configured RealFS root. No `work/escape.json` appeared outside that root. The detailed file inventory is `work/evidence/files-after-run.txt`.

## Failures, fixes, and deviations

1. The Docker pull produced no output and did not finish during a bounded approximately 6m10s attempt. The required one-time knowledge consultation found `knowledge/2026-07-11-codex-sandbox-infeasible-practice-plans.md`, but its only applicable fact was that Docker had worked in earlier runs; it had no confirmed fix for this symptom. The plan's official, platform-matching archive fallback was then used and checksum-verified.
2. Because the fallback ran natively, the actual platform was darwin/arm64 rather than the planned Linux container, and `--network none` was not available. After the downloads, the test itself made no network request and accessed only fixture paths under the run work directory.
3. `RealFSProvider` did not reject the single `/../escape.json` input. It normalized it to a path inside its root and created `realfs-root/escape.json`. The harness emitted `ROOT_ESCAPE_SUSPECTED` and stopped immediately, as required by the plan. No outside-symlink attempt and no repeat runs followed.
4. The execution log is retained; cleanup was not requested.

## Observed facts versus interpretation

Observed facts:

- Node.js v26.5.0 required `--experimental-vfs` for the tested import.
- Separate default `create()` instances did not share `/config.json` state in this run.
- The tested MemoryProvider read-only write failed with `EROFS`; symlink operations and a bounded watch produced the recorded results.
- RealFSProvider mapped `/config.json` to the configured host root.
- The tested `/../escape.json` VFS path did not escape the configured root, but it was not rejected; it created `realfs-root/escape.json`.

Interpretation limited to the evidence:

- The host config loader can be exercised against the VFS `fs`-like surface without changing the loader implementation.
- This run does not establish that traversal-like input is rejected, does not verify the outside-symlink boundary, and does not establish five-run stability.
- The result must not be described as proof that `node:vfs` is a security sandbox or as a performance comparison.

## Reproducibility notes and unresolved limitations

- Reproduction uses the exact sources captured in `work/evidence/*.source.txt`, Node.js v26.5.0, and the verified archive hash above.
- The primary Docker image ID/digest was not captured because the pull did not complete.
- Linux container behavior is unverified; observations came from the official darwin-arm64 release.
- The outside-root symlink case and five repetitions are intentionally unverified due to the mandatory stop.
- The root traversal test demonstrates normalization inside the root, not a write outside the run directory.

## Article-safe facts

Only the following claims are supported by this execution log:

- In the official Node.js v26.5.0 darwin-arm64 runtime tested here, importing `node:vfs` succeeded with `--experimental-vfs` and failed without it.
- The exact MemoryProvider isolation, error, read-only, symlink, and single-run watch observations in the verification table occurred as recorded.
- RealFSProvider created its mapped files under the configured root, but the tested `/../escape.json` input was normalized and accepted rather than rejected.
- The outside-symlink boundary, Linux image behavior, and repeated stability remain unverified and must not be claimed.
