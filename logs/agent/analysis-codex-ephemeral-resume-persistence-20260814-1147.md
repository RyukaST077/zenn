# Codex ephemeral resume rollout persistence: result analysis

verdict: confirmed
action: draft

## Evidence analysis

### Claim, conditions, and case matrix

The evaluated claim is deliberately narrow: with locally installed Codex CLI `0.147.0`, one successful `codex exec resume <session-id> --ephemeral` of an exact persisted session appends the resumed turn to that session's existing rollout, changing its SHA-256 and byte size without shortening it, preserving all prior bytes as a prefix, and placing the unique resume marker in the appended bytes. The manifest registered one Codex case, no model or effort override, fixture-wrapper execution, a 300-second case timeout, and the marker `RESUME_PERSISTENCE_BOUNDARY_OBSERVED` (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/manifest.json`).

| Case | Registered conditions | Raw process result | File oracle | Verifier and diff | Assessment |
| --- | --- | --- | --- | --- | --- |
| `codex-0147-ephemeral-resume` | Codex CLI `0.147.0`; fixture wrapper; approval `never`; child sandbox `read-only`; network disabled for workspace tools; user config and rules ignored; no model override | Wrapper/agent exit `0`; not timed out; baseline and resume child codes `0`; each emitted one completion, no failure, the same single thread ID, and zero recognized tool events | SHA-256 changed; `38,025` to `42,427` bytes; `14` to `23` lines; original prefix unchanged; resume-marker count `0` before and `5` after, all `5` occurrences found in appended bytes | Verifier exit `0`, output `claim-supported`, expected marker matched; only `probe-result.json` and `verification.txt` changed; no protected or unexpected change | Claim supported under every pre-registered gate |

Case evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/verify.log`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`.

### Deterministic results

The case was decisive rather than merely successful at the outer process layer. The live wrapper recorded Codex CLI `0.147.0`, one baseline completion and one resume completion against the identical generated session ID, exit code `0` for both child invocations, no timeout or signal, no failed terminal event, and zero recognized command, file-change, web-search, or MCP tool events (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`). The runner independently recorded outer agent exit `0`, verifier exit `0`, matching expected and observed case markers, no protected-path change, only the two allowed generated files, and no unexpected change (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`).

The persistence oracle matched the registered claim-supported branch exactly: before the resume, the target had SHA-256 `ee691034ed3b91dea72ff792c96c7b5030024b1d26a22f56846e5c40f28637d6`, `38,025` bytes, `14` lines, and no resume marker; afterward it had SHA-256 `3ed77b333ea06276977f72b8ccbda440bee3681d9fbbb1ec985801ff252d44f1`, `42,427` bytes, `23` lines, and five resume-marker occurrences. The measured delta was `4,402` bytes and `9` lines, the old bytes remained an unchanged prefix, and all five resume-marker occurrences were counted in appended bytes (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; the same redacted measurements are preserved in `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`).

The verifier accepted only two registered shapes: the append shape just described or a fully byte-identical, marker-absent non-reproduction. It asserted the version, controls, process states, shared session ID, pre-resume marker state, mutation measurements, and observation, then exited `0` with `claim-supported` (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/verify.mjs`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/verify.log`). The offline fake-CLI rehearsal also passed its wrapper and verifier with no protected or unexpected changes, showing that the harness's expected append branch worked before the authenticated case (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/preflight.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/preflight-verify.log`).

### Observed facts and evidence paths

- The tested installed executable identified itself as `codex-cli 0.147.0`; the outer command record points to the local installed Codex entry point without recording credential material (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/command.json`).
- The baseline and resume addressed the same exact emitted session ID, and the recorded target was the single Codex-home-relative rollout containing that ID (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; target-resolution logic: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`).
- The resumed invocation completed successfully while the target rollout grew by an attributable append containing the harmless resume marker (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- The case workspace changed only in the two declared output files; protected fixture files and unexpected paths were unchanged (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`).

### External facts and citations

- OpenAI's CLI documentation describes `--ephemeral` as running without persisting session rollout files and exposes it alongside `codex exec`/resume controls; this is the user-visible contract tested at the resume boundary ([Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli), accessed 2026-08-14; source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
- OpenAI's non-interactive guide recommends `--ephemeral` when rollout files should not be persisted, but its example concerns a fresh execution rather than a resumed one ([Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), accessed 2026-08-14; source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Version-pinned OpenAI source for `0.147.0` forwards `config.ephemeral` into thread-start parameters, while the adjacent resume construction does not forward it; the `ThreadResumeParams` protocol shape has no ephemeral field ([exec source](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/lib.rs), [thread protocol](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/app-server-protocol/src/protocol/v2/thread.rs), accessed 2026-08-14; source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Community issue `#20084` supplied an older-version hypothesis, not proof about `0.147.0`; it reported matching resume persistence on versions through `0.125.0` ([issue #20084](https://github.com/openai/codex/issues/20084), accessed 2026-08-14; source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Interpretation and alternative explanations

The most direct interpretation is that, on the tested `0.147.0` resume path, accepting `--ephemeral` and returning success did not prevent the resumed turn from being appended to the pre-existing local rollout. This follows from the same-session ID gate, unique rollout resolution, changed hash and size, unchanged old-byte prefix, and resume marker restricted to appended bytes (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; oracle implementation: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`). This observed asymmetry is consistent with, but does not by itself prove causation from, the missing ephemeral field in version-pinned resume source (external source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).

Accidental attribution to a different session is strongly constrained because both child event summaries held the same sole session ID and the wrapper required exactly one matching rollout before and after resume (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`). Accidental attribution to an overwrite or unrelated mutation is constrained by the unchanged-prefix test and appended-marker count, although the run cannot prove that no unrecorded concurrent host process touched the rollout because host-wide process isolation was not part of the recorded evidence (evidence boundary: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`; run limitation: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).

### Comparison with the pre-registered expectation

The plan registered two decisive outcomes. Its expected claim-supported branch required a changed SHA-256, increased bytes, nondecreasing lines, an unchanged prior-byte prefix, and the resume marker in appended bytes; its competing branch required a completely byte-identical target with the marker absent (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`). The live result matched every condition of the expected claim-supported branch and none of the competing branch (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`). Therefore the result confirms the registered claim; it is not described as a surprise because the plan explicitly expected this branch.

### Limitations

- This is one live sample of one case on one installed CLI version; the manifest did not register repetitions, other versions, other model backends, or other platforms (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).
- No model override was recorded, so the backend snapshot is not established by the CLI version (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).
- The raw rollout was intentionally not copied into the log; retained evidence consists of a Codex-home-relative path, hashes, counts, status facts, and harmless-marker measurements. A reader can audit the wrapper and verifier, but cannot recompute the historical hashes solely from the redacted log artifact (evidence policy: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`; retained result: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- The recorded network control governs Codex workspace-tool access, not the provider transport or OS-level host isolation (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).
- The result addresses local rollout persistence only. It does not test server-side retention, model memory, encryption, privacy compliance, fresh ephemeral starts, forks, interactive Codex, or general security impact (scope evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`; `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Reusable recipe present in successful evidence

The successful case supports a version-pinned conformance recipe, not a blanket workaround. In a fresh disposable non-Git directory, create one harmless persisted baseline with JSON output, capture its exact emitted session ID, resolve exactly one rollout bearing that ID, and record hash, bytes, lines, and harmless-marker counts. Then run exactly one resume for that ID with the following recorded controls and compare the same target before and after (successful configuration evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/command.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; exact child construction: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`):

```sh
codex -a never exec --ephemeral --json --sandbox read-only \
  --ignore-user-config --ignore-rules --skip-git-repo-check \
  -C <disposable-case-dir> \
  -c sandbox_workspace_write.network_access=false \
  -o <temporary-final-output> \
  resume <exact-session-id> '<harmless-marker-only prompt>'
```

Accept the resume combination for a pinned environment only if the target stays byte-identical and the resume marker remains absent. Treat attributable growth as failed non-persistence, and treat every other mutation shape, ambiguous path, ID mismatch, nonzero exit, timeout, tool event, or verifier disagreement as inconclusive (registered decision rule: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Unsafe or unsupported variants

- Do not generalize this result to all uses of `--ephemeral`, fresh threads, forks, interactive sessions, other CLI versions, or other operating systems; those variants were not cases in the manifest (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`).
- Do not use sensitive prompts as markers, inspect unrelated rollouts, echo credentials, move authentication files, or run the probe in a production checkout; the registered fixture used inert markers, an exact generated session, existing authentication through normal CLI behavior, and a disposable workspace (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Do not interpret a successful exit or accepted flag as a persistence oracle; in this case both child calls exited `0` while the rollout still grew (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- Do not recommend deleting or rewriting Codex session files automatically; the plan preserved the experiment's harmless session as primary evidence and did not authorize mutation of user session data (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Article-safe facts

- On the recorded Codex CLI `0.147.0` case, both the persisted baseline and exact-ID `--ephemeral` resume completed with code `0`, one completion each, the same sole session ID, and no recognized tool events (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- The exact target rollout grew from `38,025` to `42,427` bytes and from `14` to `23` lines; its SHA-256 changed while all prior bytes remained an unchanged prefix (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- The resume marker was absent before the resume and occurred five times afterward, with five occurrences in appended bytes (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
- The deterministic verifier exited `0` with `claim-supported`, and the runner found no protected or unexpected workspace changes (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/verify.log`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`).

## Editorial brief

### Reader and situation

One reader: a CI, batch-runner, or local automation-harness maintainer who persists a Codex exec session for multi-step work and wants a later resumed turn to leave no new local rollout content (reader definition: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Reader problem

The CLI accepts `--ephemeral` on a resume and can exit successfully, but those surface signals do not tell the maintainer whether the already-existing rollout grew. The maintainer needs a safe, version-pinned file oracle before relying on the combination for a non-persistence requirement (documented contract and uncertainty: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`; successful-but-persisted observation: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).

### One-sentence promise and takeaway

For Codex CLI `0.147.0`, this article will show why `codex exec resume --ephemeral` must not be trusted from flag acceptance or exit code alone, demonstrate the observed `4,402`-byte attributable rollout append, and give a harmless-marker conformance gate that accepts the combination only when the pinned environment produces no growth and no marker (result evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; registered operational rule: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Coverage gap filled

Official documentation states the non-persistence promise and general resume support, version-pinned source shows an asymmetric start/resume parameter path, and existing community coverage describes session lifecycle or older affected versions. The missing coverage is a current `0.147.0` installed-binary run that resolves one exact rollout, compares it immediately before and after an exact-ID `--ephemeral` resume, and turns the result into a machine-checkable adoption rule (source-gap analysis: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`; current primary run: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).

### Article type

`failure`

### Why this matters in real work

A temporary working directory and read-only tool sandbox do not answer whether transcript content is appended under the separate Codex session store. In the recorded case, those controls coexisted with a successful resume and an attributable local rollout append, so automation with a local non-persistence requirement needs a content-level gate rather than a command-success check (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; boundary explanation: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Practical decision rule and mapping

Decision rule: pin the CLI version and run a harmless two-call preflight against a fresh session. If the exact rollout grows and the resume marker appears in appended bytes, reject `resume --ephemeral` for workflows requiring no new local transcript content. If the target is byte-identical and the marker stays absent, permit it only within that tested version/environment boundary. If session resolution, process completion, attribution, or verifier checks are not decisive, stop and classify the preflight as inconclusive (registered outcomes: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

| Fixture signal | Real-task meaning | Harness response |
| --- | --- | --- |
| Persisted baseline plus exact emitted session ID | A resumable automation job and its stored resume handle | Resolve only the one rollout belonging to that handle |
| Before/after SHA-256, bytes, lines, and marker counts | Content-level local persistence contract | Compare the exact same target, not merely whether a filename exists |
| Unchanged prefix plus resume marker in appended bytes | The resumed turn reached the existing local transcript | Fail the non-persistence gate and avoid the command combination |
| Byte-identical target and absent resume marker | Effective local non-persistence in the pinned fixture | Allow only within the recorded version/environment boundary |
| Any ambiguous path, ID mismatch, malformed result, tool event, timeout, or unregistered mutation | Attribution or safety is not established | Stop as inconclusive; do not retry automatically |

Mapping basis: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`; observed append branch: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`.

### Evidence-led story arc

1. Start with the documented promise and the reader's concrete uncertainty: `--ephemeral` is accepted on resume, but documentation does not establish the existing rollout's before/after state ([Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli); research synthesis: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
2. Explain the pre-registered competing outcomes and why a same-file hash/size/line/marker oracle is stronger than asking the model what it remembers (evidence design: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
3. Present the process gates first: exact CLI version, two successful same-session calls, zero recognized tool events, unique rollout, and verifier success (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/verify.log`).
4. Reveal the decisive observation: `+4,402` bytes, `+9` lines, unchanged old prefix, and five appended resume-marker occurrences (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`).
5. Interpret narrowly: this confirms the registered failure on `0.147.0` and aligns with the version-pinned parameter asymmetry, without claiming source-level causation or a universal ephemeral failure (evidence and external-source synthesis: this report; `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
6. End with the copyable conformance gate, version-scoped decision rule, and explicit retest requirement after upgrades (successful recipe evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`; registered rule: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Body evidence

- The official `--ephemeral` promise and the fact that ordinary documentation does not spell out this resume exception (source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
- The two registered decisive outcomes and why prefix plus appended-marker attribution matters (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
- The compact live result table: version, child statuses, same session, zero tool events, before/after bytes and lines, prefix, marker, verifier result (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/probe-result.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/metrics.json`).
- The practical accept/reject/inconclusive rule and sanitized resume command (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`; successful configuration: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`).

### Appendix evidence

- Full manifest fields, runner command record, and environment-control semantics (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/manifest.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/command.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`).
- Wrapper path-resolution, event-parsing, cleanup, and redaction implementation (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/codex-resume-wrapper.mjs`).
- Verifier assertions, preflight output, raw diff, and the single retained outer fixture event (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/work/codex-0147-ephemeral-resume/verify.mjs`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/preflight.json`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/diff.patch`; `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/codex-0147-ephemeral-resume/events.jsonl`).
- One-sample, backend, redaction, network-enforcement, and scope limitations (evidence: `logs/agent/run-codex-ephemeral-resume-persistence-20260814-1130-20260814-114308/execution-log.md`; `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).

### Candidate titles

1. `Codex CLI 0.147.0で resume --ephemeral 後もrolloutが増えた：再現と判定ゲート`
2. `Codexの --ephemeral はresumeでも非永続化される？0.147.0をファイル差分で検証`
3. `終了コード0では判定できない：Codex resume --ephemeral のローカル永続化を検査する`

### Unsupported angles to avoid

- Avoid “all Codex ephemeral sessions persist,” “`--ephemeral` is completely broken,” or claims about fresh starts, forks, every CLI version, every platform, or every backend; only one `0.147.0` resume case was run (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`).
- Avoid calling the result a security vulnerability, credential leak, server-retention finding, privacy-compliance failure, encryption weakness, or proof of model memory; none was tested (scope evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Avoid claiming OpenAI confirmed issue `#20084` or that its older-version report proves this run; the issue was a hypothesis source and this run is the primary current evidence (source assessment: `research/agent/agent-knowhow-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Avoid performance, price, quality, Claude-versus-Codex, or model comparisons; no such cases or metrics were registered (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json`).
- Avoid invented author emotions, first-person production experience, or “surprising” framing; the plan recorded the claim-supported append branch as expected (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
- Avoid presenting automatic deletion of session files or sensitive-content probing as remediation; the evidence used harmless markers and preserved the newly created session (evidence: `practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.md`).
