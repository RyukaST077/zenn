# Execution log: Node.js 26 package maps / pnpm 11.8.0

## Run summary

- Plan: `practice/practice-node26-package-maps-20260713-1404.md`
- Run directory: `logs/run-node26-package-maps-20260713-141143/`
- Work directory in raw evidence: `/Users/katayamaryuunosuke/workspace/024_zenn/logs/run-node26-package-maps-20260713-141143/work`
- Public-path placeholder: `<WORK>` means the work directory above.
- Started: 2026-07-13T14:11:43+09:00 (directory stamp); first recorded external command 2026-07-13T14:12:18+09:00
- Ended: 2026-07-13T14:14:22+09:00
- Effective Codex sandbox mode: `danger-full-access`
- Outcome: **stopped at the pnpm store configuration capability gate; the core package-map matrix was not run.**
- Browser capability gate: not applicable. The plan is browser-independent and explicitly excludes adding browser work.

This is a partial, negative run. It produced usable evidence for the Node and pnpm acquisition/version gates and for the failed pnpm store readback gate. It did not produce evidence about package-map behavior.

## Environment and exact versions

Observed facts:

| Item | Observed value | Evidence |
|---|---|---|
| OS | Darwin | `work/evidence/os.txt` |
| Architecture | arm64 | `work/evidence/arch.txt` |
| Node.js archive | `node-v26.5.0-darwin-arm64.tar.gz` | recorded download command |
| Isolated Node.js | `v26.5.0` | `work/evidence/toolchain/node-version.stdout` |
| Isolated pnpm | `11.8.0` | `work/evidence/toolchain/pnpm-version.stdout` |
| pnpm registry integrity | `sha512-wfXnxMskHI8XS3Q4UdgvQrgCMkr8iw8Ra5atsVqgZmSUjd42lgo7oQebpbSyndAUATW5S1tfUmNZIknWjlVfJg==` | `work/evidence/pnpm-bootstrap/pnpm-integrity.stdout` |
| Node archive SHA-256 | `ee920559aaa2391569cff4d737e3b83963430e3a14dedd91bfe0ff53171b5af9` | local `shasum -a 256`; official checksum verification also returned `OK` |
| pnpm tarball SHA-256 | `1e963a5c4ca5168550ba03fc4ee8d873a772b072b7fce63b48fff27d720e2e98` | local `shasum -a 256` after the stop |
| Node package-map CLI flag | help contains `--experimental-package-map=...` | `work/evidence/node-help.txt`, line 104 |

The isolated environment exported `npm_config_store_dir=<WORK>/.cache/pnpm-store` as required by the plan. No full environment dump or user/global npm configuration was collected.

## Chronological command record

Absolute work paths below are redacted to `<WORK>`. The raw `.command`, `.stdout`, `.stderr`, `.exit`, `.started`, and `.finished` files retain the exact local paths and timestamps.

| Time (JST) | Command | Exit | Relevant output / result |
|---|---|---:|---|
| 14:11:43 | `mkdir -p <WORK>/{tools,workspace,evidence,.cache/pnpm-store,.cache/npm-bootstrap,.cache/xdg,.config,.local/share}` | 0 | New, non-reused run directory created. |
| 14:12:18 | `gtimeout 10m tools/run-recorded.sh node-archive curl --fail --location --retry 1 --output tools/node-v26.5.0-darwin-arm64.tar.gz https://nodejs.org/dist/v26.5.0/node-v26.5.0-darwin-arm64.tar.gz` | 0 | 54.5 MiB downloaded. |
| 14:12:18 | `gtimeout 10m tools/run-recorded.sh node-checksums curl --fail --location --retry 1 --output tools/SHASUMS256.txt https://nodejs.org/dist/v26.5.0/SHASUMS256.txt` | 0 | Official checksum list downloaded. |
| 14:12:18 | `(cd tools && rg "  node-v26.5.0-darwin-arm64.tar.gz$" SHASUMS256.txt > node-checksum.txt)` | 0 | Matching checksum entry selected. |
| 14:12:18 | `(cd tools && shasum -a 256 -c node-checksum.txt)` | 0 | `node-v26.5.0-darwin-arm64.tar.gz: OK` |
| 14:12:18 | `mkdir tools/node && tar -xzf tools/node-v26.5.0-darwin-arm64.tar.gz -C tools/node --strip-components=1` | 0 | Isolated Node distribution extracted. |
| 14:12:18–14:12:21 | `<WORK>/tools/node/bin/node --version`, help capture, and `rg -q -- '--experimental-package-map' evidence/node-help.txt` | 0 | Exact version and package-map flag gates passed. |
| 14:12:21 | `gtimeout 10m tools/run-recorded.sh pnpm-integrity npm view pnpm@11.8.0 dist.integrity` | 0 | Registry integrity recorded. |
| 14:12:22 | `gtimeout 10m tools/run-recorded.sh pnpm-pack npm pack pnpm@11.8.0 --pack-destination tools --json` | 0 | `pnpm-11.8.0.tgz` downloaded; JSON package inventory recorded. |
| 14:12:22 | `mkdir tools/pnpm && tar -xzf tools/pnpm-11.8.0.tgz -C tools/pnpm --strip-components=1` | 0 | pnpm CLI extracted. |
| 14:12:22 | `tools/run-recorded.sh node-version <WORK>/tools/node/bin/node --version` | 0 | stdout: `v26.5.0`; stderr empty. |
| 14:12:22–14:12:23 | `tools/run-recorded.sh pnpm-version <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs --version` | 0 | stdout: `11.8.0`; stderr empty. |
| 14:12:23 | `tools/run-recorded.sh pnpm-store-dir <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs config get store-dir` | 0 | stdout: `undefined`; stderr empty. |
| 14:12:23 | `test "$(tr -d '\\r\\n' < work/evidence/toolchain/pnpm-store-dir.stdout)" = "<WORK>/.cache/pnpm-store"` | 1 | Expected isolated store path, actual `undefined`. The enclosing `set -e` stopped the plan. |
| 14:12:54 | Read-only evidence inventory, SHA-256 calculation, help-line lookup, and size inspection | 0 | Used only to assemble this log; no execution fallback attempted. |
| 14:13 | `rg -n -i 'pnpm|store-dir|undefined|config get|npm_config_store_dir' knowledge/INDEX.md knowledge/*.md` | 0 | No applicable confirmed-fix report found. One unrelated pnpm mention concerned a TypeScript peer mismatch. |

## Expected versus actual capability result

| Gate | Expected | Actual | Result |
|---|---|---|---|
| Node archive checksum | Official SHA-256 verification succeeds | `OK` | pass |
| Node exact version | `v26.5.0` | `v26.5.0` | pass |
| Node help flag | `--experimental-package-map` present | `--experimental-package-map=...` present | pass |
| pnpm exact version | `11.8.0` | `11.8.0` | pass |
| pnpm store-dir readback | `<WORK>/.cache/pnpm-store` | `undefined` | **fail / hard stop** |

## Relevant redacted output

```text
$ <WORK>/tools/node/bin/node --version
v26.5.0

$ <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs --version
11.8.0

$ <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs config get store-dir
undefined
```

All three recorded commands exited 0 and produced empty stderr. The capability assertion, not pnpm itself, exited 1.

## Failure, knowledge consultation, and attempted fixes

Observed failure:

- The plan requires `pnpm config get store-dir` to equal `<WORK>/.cache/pnpm-store`.
- It instead printed `undefined`, so the required equality assertion failed.
- The plan states that failure to read back a configuration key is a stopping condition.

Knowledge consultation required by `zenn-run-practice`:

- Searched `knowledge/INDEX.md` and `knowledge/*.md` once using the high-signal terms `pnpm`, `store-dir`, `undefined`, `config get`, and `npm_config_store_dir`.
- No matching report was found. `knowledge/2026-07-09-typescript-eslint-typescript7-cjs-crash.md` was not applicable because its environment and symptom concern a TypeScript peer-dependency crash, not pnpm configuration.

Attempted fixes:

- None. Changing the configuration form, adding `.npmrc`, or continuing to install would be a fallback not authorized by this plan's hard-stop condition.
- No retry was performed because the one-clean-state retry allowance applies to timeout, crash, nondeterminism, or specified pnpm/direct disagreement, none of which was observed here.

Interpretation (not an observed package-map result):

- The exported environment variable did not produce the exact configuration readback required by the plan. This log does not claim why pnpm returned `undefined` because diagnosis beyond the hard gate was intentionally stopped.

## Verification matrix

The fixture was never created and no dependency install or probe ran. Empty cells are not filled with hypotheses.

| probe | no map | loose direct | loose pnpm | standard before direct | standard before pnpm | standard after direct | standard after pnpm |
|---|---|---|---|---|---|---|---|
| declared bare dependency | not run | not run | N/A | not run | N/A | not run | N/A |
| phantom bare dependency | not run | not run | not run | not run | not run | not run | not run |
| relative import | not run | not run | N/A | not run | N/A | not run | N/A |
| `node:` builtin | not run | not run | N/A | not run | N/A | not run | N/A |

No package map was generated. No map hash, schema, key extraction, manifest diff, lockfile, or source hash exists.

## Generated files and inventory

All generated project/toolchain files are under this run's `work/` directory. No fixture files or article content were created.

Key generated files:

- `work/tools/run-recorded.sh`
- `work/tools/node-v26.5.0-darwin-arm64.tar.gz`
- `work/tools/SHASUMS256.txt`
- `work/tools/node-checksum.txt`
- `work/tools/node/` (extracted Node.js distribution)
- `work/tools/pnpm-11.8.0.tgz`
- `work/tools/pnpm/` (extracted pnpm package)
- `work/evidence/node-help.txt`
- `work/evidence/node-checksum-verification.txt`
- `work/evidence/pnpm-pack.json`
- `work/evidence/toolchain-setup/` (download command records)
- `work/evidence/pnpm-bootstrap/` (registry and pack command records)
- `work/evidence/toolchain/` (version and store-dir command records)

Each recorded command directory contains the relevant `.command`, `.started`, `.finished`, `.stdout`, `.stderr`, and `.exit` files. The `pnpm pack --json` output is large because npm included its tarball file inventory; it is preserved unmodified as raw evidence.

## Deviations from the plan

- Used `rg` rather than `grep` to select the exact archive checksum entry, consistent with repository tooling guidance. The selected entry and official `shasum -c` result were preserved.
- Wrapped the two allowed `curl` downloads and the two host npm metadata/package commands with `run-recorded.sh`, providing more complete command evidence than the sample snippets.
- The planned final `toolchain-tarball-sha256.txt` command was not reached because `set -e` stopped at the store-dir assertion. Both hashes were calculated read-only during log assembly and are recorded above.
- Stopped before fixture creation, baseline, loose, standard-before-fix, standard-after-fix, and aggregation because the explicit configuration gate failed.

## Reproducibility notes

To reproduce this negative capability observation, use the exact Darwin arm64 archive and pnpm tarball recorded above, the isolation exports from the supplied plan, and run:

```bash
export npm_config_store_dir="<WORK>/.cache/pnpm-store"
<WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs config get store-dir
```

The single observed output in this run was `undefined` with exit code 0. This is a record of this run, not a claim that all pnpm 11.8.0 environments behave the same way.

## Unresolved limitations

- Cause of the `store-dir` readback mismatch was not diagnosed because the plan required stopping.
- No install occurred, so registry access for `is-number@7.0.0`, lifecycle-script behavior, hoisted layout, and package-map generation were not tested.
- None of the six hypotheses about baseline, loose, standard, dependency repair, relative/builtin resolution, or pnpm-script/direct parity were tested.
- The planned article-facing package-map evidence does not exist in this run.

## Article-safe facts

Observed facts safe to cite from this run, with the exact-version scope retained:

- On Darwin arm64, the official Node.js v26.5.0 archive passed its published SHA-256 check and its help output contained `--experimental-package-map=...`.
- The isolated Node.js executable reported `v26.5.0` and the extracted pnpm CLI reported `11.8.0`.
- In this run's planned isolated environment, `pnpm config get store-dir` printed `undefined`, so the plan's required configuration gate failed and package-map verification was not attempted.

Not article-safe as results: any claim about phantom dependency acceptance/rejection, loose versus standard maps, map contents, or dependency-declaration repair. Those behaviors were not observed.
