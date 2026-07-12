# Review: npm 12 allowScripts local fixture

verdict: pass
blockers: 0
warnings: 0

## Scope

- Article: `articles/npm12-allowscripts-local-fixture.md`
- Execution log: `logs/run-npm12-allow-scripts-20260712-0349/execution-log.md`
- Slug: `npm12-allowscripts-local-fixture`

The supplied paths exist and match. The article describes the npm 11.18.0 / npm 12.0.1 local-fixture run recorded by the execution log, including the unsupported Node.js pairing, the excluded contaminated baseline, local-file policy identities, explicit denial, and the two `npm ci` cases.

## Findings

No blockers or warnings.

The reproduction procedure now includes the fixture-source marker cleanup required by the symlink behavior, the explicit approve/deny commands, and separately labeled `npm ci` procedures with and without `allowScripts`. These details agree with the retained execution evidence and resolve the material reproducibility gaps identified in the earlier review.

## Evidence trace

- Article lines 35-42 match the execution log's Darwin/arm64, Node.js v22.17.0, npm 11.18.0, npm 12.0.1, and unsupported-engine warning.
- Article lines 48-118 present the recorded fixture, app, marker, runtime assertion, and isolated npm CLI setup without adding unobserved results.
- Article lines 120-169 match the valid npm 11/npm 12 baseline, source-marker cleanup, blocked-script warning, pending output, approval command, and resulting local `file:` policy.
- Article lines 171-190 match the different-path 1.0.1 case, including the renewed pending state, reapproval, marker generation, and passing test.
- Article lines 192-241 match the explicit-deny and policy-present/policy-absent `npm ci` command records.
- Article lines 243-288 match the execution log's verification matrix, observed interpretation, retained failures, limitations, and article-safe summary. The article does not generalize local-file identity behavior to registry packages or attribute reapproval solely to a version change.
- The linked current primary GitHub npm announcements support npm 12 general availability, `allowScripts` defaulting off, pending review with `approve-scripts --allow-scripts-pending`, approval with `approve-scripts`, denial with `deny-scripts`, and recording policy in `package.json`. The linked npm command documentation is consistent with the command usage shown.
- No credential, token, cookie, private hostname, personal data, or user-bearing absolute path appears in the article.

## Deterministic verification

- Command: `bash scripts/check-article.sh articles/npm12-allowscripts-local-fixture.md --expect-published false`
- Result: passed (`OK: articles/npm12-allowscripts-local-fixture.md (slug=npm12-allowscripts-local-fixture, published=false)`).

## Verdict rationale

The draft is format-valid, its technical claims and command-output claims are supported by the supplied execution log, its external claims are supported by linked primary sources, and its limitations are explicit. With zero blockers and zero warnings, the verdict is `pass`.
