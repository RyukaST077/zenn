# Review: codex-resume-ephemeral-rollout-gate

verdict: fix
blockers: 0
warnings: 2
article_type: failure
editorial_score: 87/100

## Review scope

- Article: `articles/codex-resume-ephemeral-rollout-gate.md`
- Analysis and editorial brief: `logs/agent/analysis-codex-ephemeral-resume-persistence-20260814-1147.md`
- Execution log: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`
- Supporting run evidence checked: `probe-result.json`, `metrics.json`, `diff.patch`, `verify.log`, `codex-resume-wrapper.mjs`, and `verify.mjs` under the supplied run directory.
- Deterministic article check: `bash scripts/check-article.sh articles/codex-resume-ephemeral-rollout-gate.md --expect-published false` returned `OK` with slug `codex-resume-ephemeral-rollout-gate` and `published=false`.
- External fact check: the official OpenAI Developer commands and Non-interactive mode pages still describe `--ephemeral` as preventing rollout-file persistence. The pinned `rust-v0.147.0` OpenAI source still shows an `ephemeral` field on `ThreadStartParams` and no such field on `ThreadResumeParams`. These checks support article lines 17 and 71-75; the article correctly labels the source asymmetry as a cause candidate rather than proof.
- Secret/safety check: no credential, token, absolute home path, or raw rollout content is exposed in the article. The commands use placeholders, inert markers, `never` approval, a read-only sandbox, ignored user config/rules, and a disposable directory.

## Integrity-gate result

No blocker was found. The observed `+4,402` bytes, `+9` lines, changed SHA-256, unchanged prior-byte prefix, five appended resume-marker occurrences, matching session ID, zero recognized tool events, child exit codes, verifier result, CLI version, and one-sample limitation all trace to the supplied analysis and retained run evidence.

Two correctable warnings prevent `pass`. Both can be resolved from existing evidence without rerunning the experiment.

## Editorial rubric

| Category | Score | Reason |
| --- | ---: | --- |
| Reader problem and promise | 19/20 | Lines 9-13 immediately identify the CI/batch maintainer, the misleading surface signal, the measured failure, and the version-scoped decision. |
| Insight and original value | 19/20 | The same-rollout file oracle and no-growth/no-marker decision rule are specific, falsifiable, and more useful than a documentation summary. The limitation remains visible. |
| Explanation and story | 13/15 | The article moves coherently from symptom to why exit code/model recollection are insufficient, then to conditions, source interpretation, gate, and limits. The fixture description at line 51 is inaccurate and obscures what actually ran. |
| Evidence and reproducibility | 16/20 | Decision-relevant measurements sit close to the claim, source causation is qualified, and the one-run/redaction boundaries are explicit. The displayed acceptance predicate does not fully match the registered verifier and the runnable file-oracle steps are omitted. |
| Practical action | 11/15 | The version-pin/retest/reject/inconclusive rule is clear and the resume command is copyable after substituting placeholders. The central gate is only partial pseudocode, so a reader cannot reproduce the complete safe preflight from the article as written. |
| Readability and authorial judgment | 9/10 | The title and headings carry the decision, the result table is compact, repetition is controlled, and there is no fabricated first-person experience. The opaque `記録値A`/`記録値B` labels add little audit value. |
| **Total** | **87/100** | Every category exceeds half credit, but publication integrity still requires both warnings to be fixed. |

## Prioritized actionable findings

### W1 — The published acceptance predicate is weaker than the recorded gate

- Article location: lines 90-113, especially the `ACCEPT` block at lines 92-102.
- Evidence locations: analysis lines 20-24 and 60-71; `work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs` lines 153-195; `work/codex-0147-ephemeral-resume/verify.mjs` lines 20-48.
- Problem: the block checks exit codes, a shared session ID, one rollout match, file identity, and marker absence, but omits other decisive registered gates: one successful terminal event per call, zero failed events, no timeout or signal, zero recognized tool events, absence of the resume marker before resume, and unique resolution of the same target again after resume. The prose later mentions some inconclusive cases, but the machine-looking `ACCEPT` formula remains incomplete. The article also gives only the resume command, not the baseline command or a runnable safe implementation for exact-ID rollout resolution and before/after measurement.
- Required fix: align the displayed decision procedure with the actual wrapper/verifier. Include every decisive process, attribution, and file-oracle condition; clearly separate `ACCEPT`, attributable persistence rejection, and `INCONCLUSIVE`; and provide either a bounded copyable baseline-plus-oracle example derived from the retained wrapper or state precisely that the pseudocode is a checklist and link each placeholder to an implementable step. Do not weaken the exact-ID, one-target, harmless-marker, and no-unrelated-rollout boundaries.

### W2 — “Marker-only” workspace wording contradicts the executed fixture

- Article location: lines 49-54, particularly line 51 (`freshな非Gitディレクトリに無害なマーカーだけを置き`).
- Evidence locations: plan section “Minimal fixture and practical mapping”; `manifest.json`; execution-log environment and evidence inventory; wrapper lines 110-125.
- Problem: the live case used a fresh disposable non-Git workspace, but it contained `markers.json`, `codex-resume-wrapper.mjs`, `preflight-codex.mjs`, and `verify.mjs`, then generated `probe-result.json` and `verification.txt`. Only the model prompts were limited to inert marker content. Saying the directory contained only harmless markers overstates workspace minimality and hides a local fixture assumption.
- Required fix: say that the prompts and retained content were inert/non-sensitive, while the disposable workspace also contained the dependency-free wrapper and verifier files. Keep the verified zero-tool-event fact nearby so readers understand that Codex did not act on those fixture files during either child invocation.

## Suggestions

- At lines 21-28, either show shortened recorded hashes with an explicit truncation label or omit the `記録値A`/`記録値B` placeholders. The exact hashes exist in retained evidence, while the article already explains that raw rollout data was not retained.
- Preserve the narrow wording at lines 73-75 and 117-127. It correctly separates source-level consistency from causal proof and local rollout persistence from server retention, memory, encryption, compliance, and other untested variants.

## Verdict rationale

`fix` is appropriate because the article is truthful about the primary observed result, passes deterministic format checks, has no blocker, and scores above 80 with at least half credit in every category. Existing evidence is sufficient to correct the incomplete operational gate and the fixture-description mismatch; no new authenticated execution is required.
