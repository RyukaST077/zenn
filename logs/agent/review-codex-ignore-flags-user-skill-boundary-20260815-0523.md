# Review: codex-ignore-flags-user-skill-boundary

verdict: pass
blockers: 0
warnings: 0
article_type: configuration-harness
editorial_score: 96/100

## Review scope

- Article: `articles/codex-ignore-flags-user-skill-boundary.md`
- Analysis and editorial brief: `logs/agent/analysis-codex-ignore-config-user-skills-20260815-0515.md`
- Execution log: `logs/agent/run-codex-ignore-config-user-skills-20260815-0504-20260815-051331/execution-log.md`
- Supporting evidence checked: the supplied run's `manifest.json`, case `command.json`, `metrics.json`, `preflight.json`, `verify.log`, and `diff.patch`, plus `work/matched-home-skill-boundary/probe-result.json`, the raw control/treatment event and final files, `ambient-skill-wrapper.mjs`, `verify.mjs`, the registered plan, and the research report.
- Deterministic article check: `bash scripts/check-article.sh articles/codex-ignore-flags-user-skill-boundary.md --expect-published false` returned `OK` with slug `codex-ignore-flags-user-skill-boundary` and `published=false`.
- External source check: the official OpenAI Non-interactive mode, Developer commands, and Build skills pages were fetched on 2026-08-15. They still define `--ignore-user-config` as skipping `$CODEX_HOME/config.toml`, `--ignore-rules` as skipping user and project execpolicy `.rules`, user skills as loading from `$HOME/.agents/skills`, progressive skill loading as name/description/path followed by full `SKILL.md`, and `$skill` mention as explicit invocation.

The supplied article, analysis, and execution log describe the same version-pinned `codex-ignore-config-user-skills-20260815-0504` practice and the same `matched-home-skill-boundary` case. The article was not edited.

## Publication integrity gates

### Blockers

None.

- The central contrast is fully traceable. Article lines 81-98 report an empty-home control returning `unavailable` with no marker and a one-skill treatment returning `loaded` with the exact skill-body-only marker. These results match `work/matched-home-skill-boundary/probe-result.json`, the raw final files, and the retained diff.
- The numeric and process details at article lines 44-59 and 85-96 match the evidence: Codex CLI `0.147.0`; approval `never`; child sandbox `read-only`; `--ephemeral`, `--ignore-user-config`, and `--ignore-rules`; no model or effort override; two live calls; exit code `0` and no timeout for both; one completion, zero failures, zero recognized tool events, empty workspaces, marker counts `0` and `2`, verifier exit `0`, and no protected or unexpected path changes.
- The displayed child launch shape at article lines 61-79 preserves the executed controls and argument semantics from `ambient-skill-wrapper.mjs`. Its symbolic paths and prompt placeholder do not expose private absolute locations, credentials, or the inert random marker.
- The hidden-marker attribution is supported. The wrapper generated the marker before execution, put it only in the treatment `SKILL.md`, asserted its absence from the shared prompt, schema, and child arguments, and retained exact inventories. The verifier separately checked hashes, controls, event/final alignment, marker equality, and the registered branch.
- The article does not mislabel the observed behavior as a broken flag, vulnerability, sandbox escape, privilege escalation, or universal isolation failure. Article lines 98-100, 142, and 165-177 preserve the configuration-boundary interpretation and explicitly exclude untested versions, backends, invocation modes, skill sets, ambient-input classes, malicious skills, credentials, network access, and repeatability.
- No fabricated author experience, performance or cost claim, provider comparison, destructive remediation, publication claim, or credential/secret exposure was found.

### Warnings

None.

- Material date and version are stated at article lines 11, 15, 48-50, and 167. The unknown backend snapshot, absent model/effort overrides, one control and one treatment invocation, no retry, and the single-sample limitation are explicit at lines 15, 50, 57, and 167-175.
- The official product facts at article lines 17-29 remain supported by the current primary pages cited at lines 181-183: [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli), and [Build skills](https://learn.chatgpt.com/docs/build-skills). The article accurately distinguishes those documented scopes from the run's behavioral evidence.
- The safety and network boundaries are not overstated. Article lines 51-59 use approval `never`, read-only child sandboxes, ephemeral sessions, empty non-Git workspaces, and disabled workspace-tool network, then clarify that this does not isolate provider transport or the host OS. Lines 171-175 separately reject host-security, credential-access, and network-access conclusions.
- The practical decision predicate at article lines 114-142 includes the decisive completion, inventory, control, treatment, marker, and inconclusive branches from the plan and verifier. It does not turn a clean `unavailable` treatment into proof against all ambient inputs.
- The reproduction section at article lines 144-163 preserves the successful repository command and supplies a bounded seven-step porting recipe with version pinning, exact inventories, a harmless body-only marker, no automatic retry, and fail-closed inconclusive states. It does not present the unexecuted `[[skills.config]]` route as a verified fix.

## Editorial rubric

### 1. Reader problem and promise — 20/20

The opening identifies one concrete reader—a CI or evaluation maintainer inheriting a developer or runner `HOME`—then states the exact observed boundary, the version and explicit-invocation scope, and the operational answer within article lines 9-15. It fulfills the editorial brief without generic preamble.

### 2. Insight and original value — 20/20

The article contributes a falsifiable boundary beyond documentation summary: the two ignore flags target config and execpolicy layers, while a matched hidden-marker experiment demonstrates that one user skill remained discoverable and consumable under the recorded conditions. This distinction remains visible in the layer table, result contrast, interpretation, production mapping, and conclusion (`article:17-31,81-114,142,177`).

### 3. Explanation and story — 14/15

The causal path is coherent: reader assumption, documented layer separation, stronger-than-self-report oracle, controlled comparison, decisive result, narrow interpretation, production rule, reproduction recipe, and limitations. Caveats appear beside the claims they constrain. One point is reserved because the full three-way predicate is necessarily dense and briefly interrupts the narrative flow.

### 4. Evidence and reproducibility — 19/20

Decision-relevant conditions and outputs are adjacent to their claims in compact tables (`article:44-59,85-96`), and the launch skeleton, verifier description, complete decision rule, repository command, and porting checklist agree with retained evidence (`article:61-79,96,114-163`). Facts, interpretation, and one-run uncertainty are separated. One point is reserved because the exact wrapper source is referenced through a repository-relative command rather than linked as a stable public artifact; the article compensates with the launch skeleton and implementation checklist and does not claim that the wrapper is embedded in the article.

### 5. Practical action — 14/15

The reader receives a copyable repository command, a portable seven-step fixture recipe, an explicit accept/reject/inconclusive oracle, a fixture-to-production mapping, and a retest rule after CLI or runner changes (`article:102-163,177`). One point is reserved because readers outside the article repository must implement the wrapper from the provided skeleton and checklist unless the harness is later published at a stable URL.

### 6. Readability and authorial judgment — 9/10

The title and headings communicate concrete value, the two tables clarify distinct relationships, the opening and conclusion agree, and the prose shows evidence-backed judgment without invented anecdotes or surprise framing. One point is reserved for limited repetition of the same boundary across the opening, predicate, limitations, and final paragraph; the repetition is defensible for a safety-relevant configuration article.

## Prioritized actionable findings

No required changes. The article has zero blockers and zero warnings, scores above 80/100, and earns at least half credit in every editorial category.

Optional, non-scoring suggestions:

1. If the repository harness is published at a stable public URL, link `run-experiment.mjs`, the manifest, and the fixture beside article lines 146-151 so readers can obtain the exact implementation rather than reconstructing it from the launch skeleton and checklist.
2. At article line 59, a future polish pass could say explicitly that the wrapper did not directly inspect, copy, or move credential files; this would remove any possible ambiguity about the authenticated Codex process still using `CODEX_HOME` for normal authentication.

## Verdict rationale

`pass` is appropriate because every behavioral, numeric, version, command, source, safety, and recommendation claim is supported or explicitly bounded; the deterministic format check passes; no blocker or warning remains; and the 96/100 editorial score satisfies all publication thresholds.
