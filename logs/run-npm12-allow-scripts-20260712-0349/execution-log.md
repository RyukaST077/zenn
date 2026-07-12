# npm v12 `allowScripts` practice execution log

## Run metadata

- Plan: `practice/practice-npm12-allow-scripts-20260712-0345.md`
- Run directory: `logs/run-npm12-allow-scripts-20260712-0349/`
- Work directory in this log: `$WORK`
- Started: 2026-07-12T03:49:15+09:00
- Finished: 2026-07-12T03:57:58+09:00
- Outcome: usable partial/negative and positive evidence produced; all work remained under the run directory.
- Network use: public npm registry only, for npm metadata and the npm 11.18.0/12.0.1 tarballs.
- Authentication/cost/GUI/Docker: none / 0 JPY / not used / not used.

## Environment and fixed versions

| Item | Observed value |
|---|---|
| OS / architecture | Darwin / arm64 |
| Node.js | v22.17.0 |
| npm 11 | 11.18.0 |
| npm 12 | 12.0.1 |
| npm registry `latest` | 12.0.1 |

The version gates passed: the npm 11 selection matched `11.18.x`, the npm 12 selection matched `12.0.x`, and registry `latest` equaled 12.0.1. Tarball integrity strings and SHA-256 values are in `work/evidence/`. npm 12.0.1 emitted a warning on every invocation that Node v22.17.0 is unsupported and that it supports `^22.22.2 || ^24.15.0 || >=26.0.0`. This was a warning, not the plan's engine-error fallback condition, so Docker was not used. Results involving npm 12 are therefore observations from an unsupported Node/npm pairing and must be labeled accordingly.

## Chronological command record

Commands below use the redactions `$WORK`, `$NODE_BIN`, `$NPM11_CLI`, and `$NPM12_CLI`. Per-command `.command`, `.started`, `.finished`, `.stdout`, `.stderr`, and `.exit` files are under the named case's `evidence/` directory.

| Time (JST) | Case / label | Exact command (redacted) | Exit | Expected / actual |
|---|---|---|---:|---|
| 03:49-03:50 | bootstrap | `npm view 'npm@11.18' version --json`; `npm view 'npm@12.0' version --json`; `npm view npm dist-tags --json`; integrity queries; `npm pack npm@11.18.0`; `npm pack npm@12.0.1`; `tar -xzf ...`; `shasum -a 256 tools/*.tgz` | 0 | Exact versions and local CLIs obtained as expected. |
| 03:50, rerun 03:57 | versions | `$NODE_BIN --version`; `$NODE_BIN $NPM11_CLI --version`; `$NODE_BIN $NPM12_CLI --version` | 0 | v22.17.0 / 11.18.0 / 12.0.1 observed. Initial recorder attempt failed before execution; rerun succeeded. |
| 03:51 | failed-copy/npm11-install | `$NODE_BIN $NPM11_CLI install` | 0 | Invalid empty case caused by interrupted setup; excluded. |
| 03:51 | failed-copy/npm11-observe | `$NODE_BIN observe.cjs` | 1 | Expected file was absent; excluded and case retained. |
| 03:52 | npm11-baseline/install | `$NODE_BIN $NPM11_CLI install` | 0 | Install and fixture script succeeded. |
| 03:52 | npm11-baseline/observe | `$NODE_BIN observe.cjs` | 0 | Marker true, content `fixture-installer@1.0.0`. |
| 03:52 | npm11-baseline/test | `$NODE_BIN $NPM11_CLI test` | 0 | Runtime assertion passed. |
| 03:52 | contaminated npm12 baseline | install, pending, observe, test with npm 12 | 0 each | Excluded: `file:` dependency was a symlink and reused npm 11's source marker. Retained as failed attempt. |
| 03:52-03:53 | npm12-baseline/install | `$NODE_BIN $NPM12_CLI install` | 0 | Install succeeded; warning said one script was blocked. |
| 03:53 | npm12-baseline/pending | `$NODE_BIN $NPM12_CLI approve-scripts --allow-scripts-pending` | 0 | Listed `fixture-installer@1.0.0`. |
| 03:53 | npm12-baseline/observe | `$NODE_BIN observe.cjs` | 0 | Marker false, content null. |
| 03:53 | npm12-baseline/test | `$NODE_BIN $NPM12_CLI test` | 1 | Expected negative assertion result; script-dependent test failed. |
| 03:53 | version-pinned/10-11 | npm 12 `install`; pending command | 0, 0 | Script blocked and pending entry observed. |
| 03:53 | version-pinned/12 | `$NODE_BIN $NPM12_CLI approve-scripts fixture-installer@1.0.0` | 0 | CLI approved the local file identity, not a name@version key. |
| 03:53 | version-pinned/13-15 | npm 12 `install`; `node observe.cjs`; npm 12 `test` | 0, 0, 0 | Clean install created the 1.0.0 marker; test passed. |
| 03:54 | version-update/20 | `$NODE_BIN $NPM12_CLI install --package-lock-only` | 0 | Lock updated to the 1.0.1 fixture path. |
| 03:54 | version-update/21-24 | install; pending; observe; test | 0, 0, 0, 1 | New path was pending; marker false; expected negative test failure. |
| 03:54 | version-update/25-27 | approve `fixture-installer@1.0.1`; clean install; test | 0, 0, 0 | New local file identity approved; 1.0.1 marker/test succeeded. |
| 03:54-03:55 | name-only/30-33 | install; approve `fixture-installer`; clean install; test | 0 each | Approval again produced a local file key; 1.0.0 test passed. |
| 03:55 | name-only/34-36 | lock update; install; pending; test | 0, 0, 0, 1 | Updated path was not covered; marker false and test failed. |
| 03:55 | explicit-deny/40-43 | install; pending; approve installer; deny denied fixture | 0 each | Two pending entries; true/false local file policies recorded. |
| 03:55 | explicit-deny/44-46 | clean install; installer test; denied observe | 0 each | Installer marker true; denied marker false. |
| 03:56 | ci-approved/50-52 | npm 12 `ci`; observe; test | 0 each | Policy copy regenerated marker and test passed. |
| 03:56 | ci-no-policy/53-55 | npm 12 `ci`; observe; test | 0, 0, 1 | `ci` succeeded while marker stayed false and test failed as expected. |

## Relevant observed output

Unapproved npm 12 install and pending review:

```text
npm warn install-scripts 1 package had install scripts blocked because they are not covered by allowScripts:
npm warn install-scripts   fixture-installer@1.0.0 (postinstall: node postinstall.cjs)
1 package has install scripts blocked because they are not covered by allowScripts:
  fixture-installer@1.0.0 (postinstall: node postinstall.cjs)
```

Approval with the local `file:` dependency:

```text
Approved file:../../../fixtures/fixture-installer:
  added file:../../../fixtures/fixture-installer
```

The actual policy after the command containing `fixture-installer@1.0.0` was:

```json
{"allowScripts":{"file:../../../fixtures/fixture-installer":true}}
```

After changing the dependency path to the 1.0.1 fixture, pending output identified the new local source and the old policy did not cover it. Reapproval added a second file key. Explicit denial produced:

```json
{
  "allowScripts": {
    "file:../../../fixtures/fixture-installer": true,
    "file:../../../fixtures/fixture-denied": false
  }
}
```

## Verification matrix

| npm | Policy / dependency | Install command | Install exit | Pending | Marker observation | Runtime test |
|---|---|---|---:|---|---|---|
| 11.18.0 | none / 1.0.0 | `install` | 0 | warning only; npm 11 suggested review | true, `fixture-installer@1.0.0` | pass (0) |
| 12.0.1 | none / 1.0.0 | `install` | 0 | yes | false, null | fail (1), expected |
| 12.0.1 | approved local file / 1.0.0 | clean `install` | 0 | covered | true, `fixture-installer@1.0.0` | pass (0) |
| 12.0.1 | old local-file policy / 1.0.1 path | `install` | 0 | yes | false, null | fail (1), expected |
| 12.0.1 | new local file approved / 1.0.1 | clean `install` | 0 | covered | true, `fixture-installer@1.0.1` | pass (0) |
| 12.0.1 | command used name-only argument / changed local path | `install` | 0 | yes | false, null | fail (1) |
| 12.0.1 | installer true; denied fixture false | clean `install` | 0 | covered/denied | installer true; denied false | installer pass; denied observe pass |
| 12.0.1 | policy present / 1.0.0 | `ci` | 0 | covered | true, `fixture-installer@1.0.0` | pass (0) |
| 12.0.1 | policy removed / 1.0.0 | `ci` | 0 | blocked warning | false, null | fail (1), expected |

## Observed facts versus interpretation

Observed facts:

- npm 11.18.0 executed the harmless local fixture's `postinstall`; npm 12.0.1 blocked it when no policy was present, while both installs returned 0.
- npm 12 pending output, policy diffs, marker contents, and runtime exit codes were all recorded separately.
- The supplied approval arguments containing `name@version` and name-only forms both resolved to `file:...` keys for these local dependencies.
- Moving to a different local fixture path required a second approval; after that approval the 1.0.1 marker and test succeeded.
- An explicit false policy prevented the denied fixture marker while an approved fixture in the same install ran.
- `npm ci` with the policy ran the fixture; `npm ci` without it returned 0 but did not run the fixture.

Interpretation bounded by the evidence:

- Install success and lifecycle-script success are distinct in this fixture.
- For this `file:` fixture, the observed trust boundary was the normalized local file identity. The run did **not** establish npm-registry package name-only versus version-pinned semantics.
- No conclusion is made about native addons, remote/Git dependencies, global installs, `npx`, or third-party packages.

## Failures, fixes, and deviations

1. The exact planned recorder failed before the first real command because Bash process substitution attempted `/dev/fd/62` and the sandbox returned `Operation not permitted`. `$zenn-consult-knowledge` was used once. `knowledge/2026-07-11-codex-sandbox-infeasible-practice-plans.md` was the only loose sandbox match but had no directly applicable recorder fix. The runner was changed to redirect stdout/stderr to files and replay them with `cat`; timestamps, commands, outputs, and exit codes remain recorded, but live stdout/stderr interleaving is not preserved.
2. Because the acquisition shell stopped at that recorder failure, the first baseline copy was absent. An accidental empty npm 11 case was retained as `npm11-baseline-failed-copy` and excluded. Correct copies used `cp -R source/. destination/`.
3. A first npm 12 baseline was contaminated because npm local `file:` installs were symlinks and npm 11 had written the marker into the shared fixture source. The contaminated case is retained as `npm12-baseline-contaminated`. All valid subsequent comparisons removed only the generated marker in `$WORK/fixtures/...` before each clean install.
4. The plan described version-pinned and name-only policy semantics, but npm 12.0.1 normalized both approval commands to local file keys. The run preserved this contrary result and did not invent version/name policy entries or expand to a third-party package.
5. The name-only update test was expected by the hypothesis to pass, but it failed because the policy key remained the original file path. The failure was recorded and treated as evidence.

## Generated files and reproducibility

- Complete relative file inventory: `work/evidence/generated-files.txt` (4,356 files at scan time).
- Fixture hashes: `work/evidence/fixture-source-sha256.txt` and `work/evidence/fixture-version-source-sha256.txt`.
- npm CLI hashes: `work/evidence/npm-cli-tarball-sha256.txt`; registry integrity values are adjacent.
- Source/version diff: `work/evidence/fixture-version-update.diff`.
- Policy diffs: each relevant case's `evidence/approval.diff` or `reapproval.diff`, plus `work/evidence/ci-policy.diff`.
- Per-command raw evidence: each case's `evidence/` directory.
- No cleanup was requested; caches, local npm CLIs, cases, and node_modules are retained for reproduction.
- A selected first-party/evidence text scan found no credential-like assignments or personal absolute paths: `work/evidence/secret-scan.txt`.

## Unresolved limitations

- npm 12.0.1 was run with Node v22.17.0 despite npm's unsupported-engine warning. The CLI commands completed, but this limits generalization.
- The intended registry-like version-pinned versus name-only comparison was not established because local `file:` dependencies became file-identity policy keys.
- `install --package-lock-only` warning output mentioned both 1.0.0 and 1.0.1 before the subsequent real install narrowed pending output to the active 1.0.1 local source; no cause is inferred.
- Timing is from a single run with a warm, isolated cache and is not a performance measurement.

## Article-safe facts

The following facts may be used only with the exact version/environment and local-fixture limitations above:

- With npm 12.0.1 on Node v22.17.0 (an unsupported pairing), an unapproved harmless local `file:` dependency produced install exit 0, a blocked-script warning, no marker, and a failing marker-dependent runtime test.
- The same fixture under npm 11.18.0 produced install exit 0, the marker, and a passing runtime test.
- npm 12.0.1 recorded true/false `allowScripts` entries using normalized local `file:` identities in this run.
- A policy-bearing clean copy passed npm 12 `ci` and regenerated the marker; removing only the policy left `ci` at exit 0 while the marker-dependent test failed.
- Explicit denial kept the denied fixture's marker absent while an explicitly approved fixture in the same install ran successfully.
