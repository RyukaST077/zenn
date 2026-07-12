# Review: playwright-passkey-dependency-failure

verdict: pass
blockers: 0
warnings: 0

## Review scope

- Article: `articles/playwright-passkey-dependency-failure.md`
- Execution log: `logs/run-playwright-passkey-20260710-2352/execution-log.md`
- Practice plan consulted for the planned scope and retry constraint: `practice/practice-playwright-passkey-20260710-2352.md`
- Reviewed at: 2026-07-11 00:03 JST

The article and execution log match: both describe the run in `logs/run-playwright-passkey-20260710-2352/`, the exact dependency request, the initial user-level npm cache failure, the single run-local-cache retry, and the resulting stop before any Playwright/WebAuthn functional test.

## Deterministic check

`bash scripts/check-article.sh articles/playwright-passkey-dependency-failure.md --expect-published false` completed successfully with:

```text
OK: articles/playwright-passkey-dependency-failure.md (slug=playwright-passkey-dependency-failure, published=false)
```

## Evidence trace

- Article lines 29-40 (environment and requested-but-uninstalled versions) agree with execution log lines 12-25 and `evidence/environment.txt`.
- Article lines 42-63 (initial exact install and the run-local-cache retry) agree with execution log lines 27-40. The article's `$PWD/.npm-cache` is equivalent to the logged `$WORK_DIR/.npm-cache` because the command ran from the work directory.
- Article lines 65-90 (exit codes and redacted `EPERM` / `ETARGET` excerpts) agree with execution log lines 42-76 and the retained `.exit` and npm log evidence.
- Article lines 92-100 and 116-123 correctly preserve the execution log's negative boundary: no dependency tree, browser binary, application, test fixture, or Playwright/WebAuthn functional result was produced (execution log lines 64-77, 92-101, and 124-139).
- Article lines 102-114 (knowledge search, bounded retry, stop without version substitution, and safe next step) agree with execution log lines 79-90 and 117-129 and with the practice plan's dependency retry and stop conditions.
- Article lines 125-129 do not generalize the setup failures into a product-capability conclusion and are consistent with the execution log's article-safe facts at lines 131-139.

## External fact verification

- Article lines 17-19 are supported by the current official Playwright 1.61 release notes: `browserContext.credentials` is introduced as a virtual authenticator that can answer WebAuthn ceremonies without a real hardware key and is described as working in all browsers. Source checked: https://playwright.dev/docs/release-notes#version-161
- Article lines 21-23 are supported by the current official Playwright authentication guide, which shows `credentials.get()`, seeding another context with `credentials.create()` and `install()`, and warns that the saved credential contains a private key and should stay out of source control. Source checked: https://playwright.dev/docs/auth#passkeys-webauthn
- No runtime behavior or compatibility result is attributed to SimpleWebAuthn; its links are reference context only.

## Suggestions

1. Optional terminology cleanup at article lines 54, 108, and 129: use `ユーザー単位cache` consistently instead of `共有cache`. The execution log consistently names the failing location as the pre-existing user-level npm cache. This does not change the technical conclusion or reproducibility.

No publication-blocking or evidence-correctness findings remain.
