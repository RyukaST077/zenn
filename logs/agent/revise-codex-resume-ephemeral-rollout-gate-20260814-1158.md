# Revision log: codex-resume-ephemeral-rollout-gate

- Revised at: `2026-08-14T11:58:24+09:00`
- Source article: `articles/codex-resume-ephemeral-rollout-gate.md`
- Review: `logs/agent/review-codex-resume-ephemeral-rollout-gate-20260814-1154.md`
- Analysis: `logs/agent/analysis-codex-ephemeral-resume-persistence-20260814-1147.md`
- Execution log: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`
- Review verdict: `fix`
- Original editorial score: `87/100`
- Publication state after revision: `published: false`

## Original category scores

| Category | Score |
| --- | ---: |
| Reader problem and promise | 19/20 |
| Insight and original value | 19/20 |
| Explanation and story | 13/15 |
| Evidence and reproducibility | 16/20 |
| Practical action | 11/15 |
| Readability and authorial judgment | 9/10 |

## Finding dispositions

### W1 — Published acceptance predicate was weaker than the recorded gate

- Disposition: resolved from existing evidence; no rerun performed or implied.
- Structural edit: moved the source-level cause-candidate section after the operational gate so the reader reaches the reproducible decision procedure before implementation interpretation.
- Command edit: added the recorded baseline command shape alongside the existing exact-ID resume command, preserving the successful controls (`never`, `read-only`, ignored user config/rules, disabled workspace-tool network, disposable non-Git workspace, JSON output, harmless prompts).
- Implementation-boundary edit: explicitly labels the command blocks as child-process invocation skeletons and the predicate as a non-executable implementation checklist. It maps placeholders to JSONL parsing, exact-ID rollout resolution, before/after measurement, same-path confirmation, and an independent verifier.
- Gate edit: added the missing decisive conditions: pinned scope and controls; exactly one baseline and resume call with no retry; zero exit, no timeout or signal, exactly one success event, zero failed events, one unique session ID, zero recognized tool events for both calls; identical baseline/resume session ID; unique resolution before and after; identical target path; marker absence before resume; complete byte-identity checks; attributable append checks; well-formed oracle output; and explicit `ACCEPT`, `REJECT`, and `INCONCLUSIVE` branches.
- Session-store boundary edit: limits comparison and logging to the single exact-ID target and explicitly forbids outputting or copying unrelated rollout content.
- Safety edit: added stop conditions for ambiguous resolution, changed paths, malformed measurements, verifier disagreement, tool events, process failures, and unregistered mutation shapes, with no automatic retry.
- Evidence used: the review's W1 trace and required fix; the analysis sections “Deterministic results,” “Interpretation and alternative explanations,” “Reusable recipe present in successful evidence,” and “Practical decision rule and mapping”; the execution log's environment, case result, and limitations.

### W2 — Marker-only workspace wording contradicted the executed fixture

- Disposition: resolved from existing evidence.
- Textual edit: replaced the claim that the workspace contained only harmless markers. The article now distinguishes harmless/non-sensitive prompts and retained markers from the actual disposable fixture files: `markers.json`, `codex-resume-wrapper.mjs`, `preflight-codex.mjs`, and `verify.mjs`, plus generated `probe-result.json` and `verification.txt`.
- Evidence placement: kept the verified zero recognized tool-event result in the same paragraph so the presence of fixture files is not confused with Codex acting on them.
- Evidence used: the review's W2 trace and required fix; the analysis's deterministic result and article-safe facts; the execution log's fresh temporary workspace and declared output evidence.

### Suggestion — Opaque SHA-256 labels

- Disposition: resolved from existing evidence.
- Textual edit: replaced `記録値A` and `記録値B` with explicitly shortened forms of the two recorded SHA-256 values and changed the result-table headings to distinguish baseline completion from resume completion. The baseline exit code is now shown as `0`, matching the recorded run.
- Evidence used: the exact before/after hashes and child exit codes in the analysis.

## Editorial improvements for the weakest categories

- Evidence and reproducibility: expanded the partial predicate into the complete recorded decision checklist and mapped every non-shell step to an implementable measurement or parser responsibility.
- Practical action: added both child command shapes, precise preflight sequencing, three-way outcome handling, fail-closed ambiguity rules, and the retest-after-upgrade boundary.
- Explanation and story: corrected the fixture description and moved the source asymmetry after the operational response, preserving it as a qualified cause candidate rather than proof.

## Slug and image paths

- Old slug: `codex-resume-ephemeral-rollout-gate`
- New slug: `codex-resume-ephemeral-rollout-gate`
- Article path unchanged: `articles/codex-resume-ephemeral-rollout-gate.md`
- Related image paths: none; no image rename or reference update was needed.

## Evidence retention and deletion accounting

- Deleted evidence: none.
- Deleted audit-only detail: none. The opaque hash placeholders were replaced with evidence-backed shortened hashes rather than removed.
- Reordered detail: the unchanged, evidence-backed source-asymmetry discussion moved after the conformance gate.
- New verification claims: none. All article claims remain bounded to the supplied one-run evidence; the deterministic article check below validates article structure and publication state only.

## Deterministic check

- Command: `bash scripts/check-article.sh articles/codex-resume-ephemeral-rollout-gate.md --expect-published false`
- Exit: `0`
- Output: `OK: articles/codex-resume-ephemeral-rollout-gate.md (slug=codex-resume-ephemeral-rollout-gate, published=false)`

## Unresolved items

- Review blockers: none.
- Evidence-resolvable warnings or suggestions left open: none.
- Evidence limitations intentionally retained: one CLI version, one live sample, no backend resolution, no raw rollout copy in the log, workspace-tool network control rather than host isolation, and no claims about server retention, model memory, encryption, privacy compliance, fresh starts, forks, interactive sessions, other versions, or other platforms.
