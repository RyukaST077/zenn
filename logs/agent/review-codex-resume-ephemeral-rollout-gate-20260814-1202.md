# Review: codex-resume-ephemeral-rollout-gate

verdict: pass
blockers: 0
warnings: 0
article_type: failure
editorial_score: 96/100

## Review scope

- Article: `articles/codex-resume-ephemeral-rollout-gate.md`
- Analysis and editorial brief: `logs/agent/analysis-codex-ephemeral-resume-persistence-20260814-1147.md`
- Execution log: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`
- Supporting evidence checked: the supplied run's `manifest.json`, `command.json`, `metrics.json`, `verify.log`, `diff.patch`, `probe-result.json`, `codex-resume-wrapper.mjs`, and `verify.mjs`, plus the registered plan and research report.
- Prior correction trace checked: `logs/agent/review-codex-resume-ephemeral-rollout-gate-20260814-1154.md` and `logs/agent/revise-codex-resume-ephemeral-rollout-gate-20260814-1158.md`.
- Deterministic article check: `bash scripts/check-article.sh articles/codex-resume-ephemeral-rollout-gate.md --expect-published false` returned `OK` with slug `codex-resume-ephemeral-rollout-gate` and `published=false`.
- External source check: the official OpenAI Developer commands and Non-interactive mode pages returned successfully and still describe `--ephemeral` as preventing rollout-file persistence. The version-pinned OpenAI Codex `rust-v0.147.0` exec and protocol sources still show `ephemeral` forwarded for `ThreadStartParams`, omitted from the adjacent resume construction, and absent from `ThreadResumeParams`.

The supplied article, analysis, and execution log all describe the same `codex-ephemeral-resume-persistence-20260814-1130` practice and the single `codex-0147-ephemeral-resume` case. The article was not edited.

## Publication integrity gates

### Blockers

None.

- The central observation is fully traceable. Article lines 21-32 report two successful child calls against the same session, rollout growth from `38,025` to `42,427` bytes, growth from `14` to `23` lines, changed shortened SHA-256 values, an unchanged pre-resume prefix, and five resume-marker occurrences after resume. These values match `work/codex-0147-ephemeral-resume/probe-result.json` and the retained `diff.patch` exactly.
- The article does not turn outer success into a persistence claim. Lines 34-47 explicitly separate process success from the same-file byte oracle, matching the analysis's interpretation and the registered decision boundary.
- The process and attribution conditions at article lines 97-148 match the executed wrapper and verifier: pinned version and controls, one baseline and one resume without retry, zero exit, no timeout or signal, one success event, no failed event, one session ID, zero recognized tool events, unique exact-ID resolution before and after, the same path, marker absence before resume, and independent-verifier agreement.
- The observed `REJECT` branch is not generalized into a universal product claim. Article lines 13, 167-179, and 181-185 retain the one-version, one-session, one-resume boundary and exclude fresh ephemeral starts, forks, interactive sessions, other versions, other operating systems, model backends, server retention, memory, encryption, privacy compliance, repeatability, and host-wide concurrency exclusion.
- The source asymmetry at article lines 163-167 is accurately presented as a cause candidate consistent with the run, not as causal proof. It matches the pinned `rust-v0.147.0` source and the analysis's source assessment.
- No fabricated author experience, security-vulnerability framing, performance or cost claim, provider comparison, publication claim, destructive remediation, or credential exposure was found.

### Warnings

None.

- Material version, date, model/backend uncertainty, sandbox and network boundary, user-config/rules controls, call count, and retry count are present at article lines 56-69.
- The baseline and resume command skeletons at article lines 73-93 preserve the actual child argument ordering and controls from `codex-resume-wrapper.mjs`. Placeholders are clearly labeled, and the prose at lines 95-97 distinguishes executable shell invocations from the non-executable implementation checklist.
- The revised gate no longer omits decisive registered conditions. `SCOPE_OK`, `PROCESS_OK`, `ATTRIBUTED`, `NO_GROWTH`, `ATTRIBUTABLE_APPEND`, and the three-way result at lines 99-148 faithfully represent the wrapper, verifier, analysis, and registered plan.
- The disposable fixture description at article lines 49-51 now matches what ran: harmless prompts and markers, four dependency-free fixture files, two generated result files, and zero recognized tool events. It no longer suggests that the workspace contained marker text alone.
- The same-rollout search and logging boundary at lines 95 and 150-159 excludes unrelated rollout contents and fails closed on missing, ambiguous, changed-path, malformed, or unregistered states. This avoids hidden assumptions and unsafe automatic retries.
- The official documentation facts at article line 17 remain supported by the primary pages cited at lines 189-190. The source observations at lines 165-166 remain supported by the version-pinned primary source cited at lines 191-192.

## Editorial rubric

### 1. Reader problem and promise — 20/20

The opening immediately identifies the relevant CI or batch-maintenance situation, the inadequate surface signal, the exact recorded failure, and the usable answer: pin the version and require a zero-diff same-rollout preflight (`article:9-13`). It directly fulfills the editorial brief's reader, problem, and one-sentence promise without generic background.

### 2. Insight and original value — 20/20

The article contributes a falsifiable operational boundary rather than a documentation summary: flag acceptance and exit code do not establish non-persistence; an exact-session, same-file, byte-and-marker oracle does. That insight remains visible in the result (`article:21-32`), explanation (`article:34-47`), implementation gate (`article:71-161`), and conclusion (`article:181-185`). The accept, reject, and inconclusive branches are specific enough to be disproved.

### 3. Explanation and story — 14/15

The causal path is coherent: documented expectation, observed contradiction, inadequacy of exit-code and model-memory proxies, bounded fixture, operational gate, qualified source-level explanation, limitations, and changed adoption rule. Caveats appear beside the claims they constrain. One point is reserved because the comprehensive gate necessarily interrupts the narrative with a long implementation-oriented predicate, although that detail is justified by the article's practical purpose.

### 4. Evidence and reproducibility — 19/20

The compact result table places decision-relevant process and file measurements beside the claim (`article:21-32`). The commands, conditions, complete predicate, stop states, and upgrade retest rule are adjacent to the operational recommendation (`article:56-161`) and match the retained wrapper and verifier. Facts, source-based inference, and one-run uncertainty are clearly separated. One point is reserved because the intentionally redacted evidence does not retain raw rollout bytes, so historical hashes cannot be recomputed solely from the published log; the article discloses this at lines 179-180 and makes no stronger auditability claim.

### 5. Practical action — 14/15

The reader receives both child-process command skeletons, exact placeholder responsibilities, an implementation checklist, a seven-step operational sequence, fail-closed ambiguity handling, and explicit use/avoid/retest rules (`article:71-161,181-185`). The fixture-to-production mapping is concrete: exact session ID, one rollout, harmless marker, before/after bytes and hash, and three-way classification. One point is reserved because the article intentionally provides a language-neutral checklist rather than a complete copy-paste wrapper; it accurately labels that boundary and supplies enough detail for implementation.

### 6. Readability and authorial judgment — 9/10

The title and headings communicate the decision, the opening and conclusion agree, the result table clarifies the core comparison, and the prose avoids fabricated first-person experience. Evidence-backed judgment is visible throughout. One point is reserved for the density of the predicate and the following operational list, which partially repeat the same gate at specification and procedure levels but serve different reader needs.

## Prioritized actionable findings

No required changes. The article has zero blockers and zero warnings, scores above 80/100, and earns at least half credit in every category.

Optional, non-scoring suggestions:

1. If the wrapper is later published as a stable public artifact, link it beside article line 95 so readers can choose between the language-neutral checklist and the exact dependency-free implementation. Do not imply that the current article already publishes that file.
2. If a later version-specific retest is run, report it as new evidence rather than updating the `0.147.0` observation in place; preserve the current one-sample boundary and the same three-way gate.

## Verdict rationale

`pass` is appropriate because every behavioral, numeric, version, command, source, safety, and recommendation claim is supported or explicitly bounded; the prior incomplete-gate and fixture-description warnings are resolved from existing evidence; the deterministic format check passes; and the 96/100 editorial score satisfies all publication thresholds with zero blockers and zero warnings.
