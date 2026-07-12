# Review: npm 12 allowScripts local fixture

verdict: fix
blockers: 0
warnings: 2

## Scope

- Article: `articles/npm12-allowscripts-local-fixture.md`
- Execution log: `logs/run-npm12-allow-scripts-20260712-0349/execution-log.md`
- Slug: `npm12-allowscripts-local-fixture`

The supplied paths exist and match. The article reports the same npm 11.18.0 / npm 12.0.1 local-fixture run, including the unsupported Node.js pairing, excluded contaminated baseline, local-file policy identities, explicit denial, and `npm ci` cases recorded by the execution log.

## Warnings

### 1. The baseline reproduction omits the cleanup needed to prevent the recorded symlink contamination

- Article location: `## 再現手順` lines 120-135, especially the statement that the npm 11 and npm 12 cases start clean; related explanation at lines 232-234.
- Issue: The article correctly explains that a local `file:` dependency was symlinked and that npm 11's generated marker contaminated the first npm 12 baseline. However, the displayed baseline commands do not remove `postinstall-marker.txt` from the fixture source or show that the two cases use independent fixture sources. Following the commands against the same source after the npm 11 case can therefore reproduce the excluded contaminated observation instead of the published npm 12 result. This is a material reproducibility gap.
- Required change: In the baseline procedure, explicitly show the separate case/fixture layout or add the recorded fixture-source marker removal before the valid npm 12 clean install. State that deleting only `node_modules` is insufficient for this symlinked local dependency.
- Existing evidence permitting the edit: Execution log `## Failures, fixes, and deviations`, item 3, records that valid comparisons removed only the generated marker under `$WORK/fixtures/...` before each clean install. The retained `npm12-baseline-contaminated` and `npm12-baseline` evidence establishes why the cleanup is required; no new experiment is needed.

### 2. The reproduction procedure does not construct or distinguish the deny and two `npm ci` cases

- Article location: `### 5. 明示denyとnpm ciを確認する`, lines 189-208.
- Issue: The section presents the final true/false policy and one generic `ci`/observe/test command sequence, but it omits the `approve-scripts` and `deny-scripts` commands, the denied-fixture observation, and the operation that removes only `allowScripts` for the no-policy copy. A reader cannot tell which of the two `npm ci` result rows the displayed commands produce or reproduce the explicit-deny result from this procedure.
- Required change: Add the recorded commands (or an equivalent explicit procedure) that create the approved/denied policy, observe both fixtures after a clean install, create two clean `ci` cases from the same lockfile, and remove only `allowScripts` in the no-policy case. Label the command sequence for each case.
- Existing evidence permitting the edit: The execution log chronological record for `explicit-deny/40-46`, `ci-approved/50-52`, and `ci-no-policy/53-55`, together with `work/evidence/ci-policy.diff`, records the needed case construction and outcomes. The edits require no new experiment.

## Evidence and source verification

- Article lines 35-42 match the execution log's Darwin/arm64, Node.js v22.17.0, npm 11.18.0, npm 12.0.1, and unsupported-engine warning.
- Article lines 48-116 are faithful readable forms of the retained fixture and app files. The marker content and runtime assertion match the raw evidence.
- Article lines 137-166 match the npm 12 blocked-script warning, pending output, approval output, and `allowScripts` diff for the local `file:` identity.
- Article lines 168-187 and 212-220 match the version-path update, pending result, reapproval, marker observations, install/`ci` exits, and runtime test exits in the execution log's verification matrix.
- Article lines 222-255 remain within the execution log's observed facts and limitations. In particular, the article does not generalize local-file identity behavior to registry packages or attribute reapproval solely to a version change.
- The current primary GitHub npm announcements linked by the article support npm 12 general availability, `allowScripts` defaulting off, pending review via `approve-scripts --allow-scripts-pending`, approval via `approve-scripts`, denial via `deny-scripts`, and recording the resulting allowlist in `package.json`.
- No credential, token, cookie, private hostname, personal data, or user-bearing absolute path was found in the article.

## Deterministic verification

- Command: `bash scripts/check-article.sh articles/npm12-allowscripts-local-fixture.md --expect-published false`
- Result: passed (`OK: articles/npm12-allowscripts-local-fixture.md (slug=npm12-allowscripts-local-fixture, published=false)`).

## Verdict rationale

The technical claims are evidence-backed and the draft format is valid, so there is no blocker. The two reproducibility gaps are material but can both be corrected from retained evidence without a new experiment; therefore the verdict is `fix`.
