# Codex exec JSONL final-artifact boundary: result analysis

verdict: inconclusive
action: rerun

## Inputs and scope

- Execution log: `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`
- Manifest: `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`
- Plan: `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`
- Research report: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`
- Analyzed case: `two-read-finality-boundary`, the only case declared by the manifest (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`).

## Evidence analysis

### Claim, conditions, and case matrix

The tested claim was that one successful, schema-constrained Codex CLI 0.147.0 turn with two ordered harmless reads would emit three schema-valid completed `agent_message` items, that the first would differ from the final artifact, and that `-o` would equal the last message. The plan required every command, completion, artifact, mutation, and verifier gate to pass before supporting that conjunctive claim (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

| Case | Recorded conditions | Raw product observations | Harness result | Classification |
| --- | --- | --- | --- | --- |
| `two-read-finality-boundary` | Codex CLI 0.147.0; no model or effort override; workspace sandbox network requested false; agent exit 0; no timeout (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`) | Three schema-valid messages occur around the two exact successful reads; one `turn.completed` occurs; `result.txt` equals the last message and differs from the first (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`) | Verifier exit 1; expected marker absent; `passed=false`; no changed files; empty diff (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/diff.patch`) | Inconclusive under the pre-registered rule because the verifier failure was not a conforming competing product outcome (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`) |

### Deterministic results

- The retained JSONL contains ten events: `thread.started`, `turn.started`, five completed items interleaved with two command-start events, and one `turn.completed`; it contains no `turn.failed` or `error` event (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The completed-item order is exactly `agent_message`, `command_execution`, `agent_message`, `command_execution`, `agent_message` (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The commands are exactly `/bin/zsh -lc 'head -n 1 alpha.txt'` and `/bin/zsh -lc 'head -n 1 beta.txt'`; both completed with exit code 0 and outputs `ALPHA_READY\n` and `BETA_READY\n` respectively (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The three message texts are `{"message":"alpha will be read"}`, `{"message":"beta will be read; alpha output was ALPHA_READY"}`, and `{"message":"ALPHA_READY + BETA_READY"}`. Each is an object with exactly one non-empty string field named `message`, matching the retained schema predicate (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/schema.json`).
- The trimmed final artifact is `{"message":"ALPHA_READY + BETA_READY"}`. It differs from the first message and equals the last completed message (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The outer runner recorded agent exit code 0, no timeout, and a 13,808 ms duration (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
- The verifier did not reach its stream, command, message, final-artifact, or marker assertions. It stopped while opening missing `agent-process.json`, after its static input and schema checks (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/verify.mjs`).
- The recorded case workspace contains the five static fixture files but not the wrapper-declared `agent-events.jsonl`, `agent-final.json`, `agent-process.json`, or `verification.txt`; metrics report no changed files, and `diff.patch` is empty (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/diff.patch`).

### Observed facts and evidence paths

1. The model-facing turn followed the requested two-read/message sequence in the retained stdout event stream (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
2. A naive consumer taking the first locally schema-valid message would select `{"message":"alpha will be read"}`, not the retained final artifact (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`).
3. The raw stream/final-file pair therefore exhibits the hypothesized parser boundary in this one invocation (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`).
4. The registered case nevertheless failed its deterministic evidence contract because the verifier exited 1 before checking that pair and never wrote the expected marker (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

### External facts and citations

- OpenAI's non-interactive documentation distinguishes the JSONL state-change stream from `-o` / `--output-last-message`, which writes the final message, and documents `--output-schema` for a schema-constrained final response. This is an external interface claim, not evidence that the tested sequence succeeded ([OpenAI non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode); recorded source analysis: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- OpenAI's CLI command reference records `--json`, `--output-schema`, `--output-last-message`, `--ephemeral`, `--ignore-user-config`, and a read-only sandbox as available exec controls. This supports the fixture design, not its verdict ([OpenAI developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli); recorded source analysis: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- Version-pinned OpenAI source for 0.147.0 maps completed agent messages to exec items containing text without a commentary/final phase field, and the event processor tracks the last message for completed-turn final output. This explains why message payload shape alone may be insufficient, but it does not substitute for a passing execution verifier ([0.147.0 event processor](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs); [0.147.0 exec event types](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/exec_events.rs); recorded source analysis: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- Earlier issue reports describe schema-valid intermediate messages and lost message-phase information, but they are hypothesis sources rather than product contracts or evidence for this run ([openai/codex issue #19816](https://github.com/openai/codex/issues/19816); [openai/codex issue #30190](https://github.com/openai/codex/issues/30190); recorded source analysis: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Interpretation and alternative explanations

The narrow product behavior is visible in the retained raw outputs, so this is not a non-reproduction: all three messages validate locally, the first differs from `-o`, and the last equals `-o` (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`). However, it is not a confirmed or conditional successful result because the pre-registered plan explicitly classifies verifier disagreement outside the competing product outcome as inconclusive, and the registered result is `passed=false` (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

The evidence supports only the diagnosis that the declared generated case artifacts were unavailable when verification ran. The wrapper was designed to write `agent-events.jsonl`, `agent-process.json`, and `agent-final.json` into the case root, but the verifier could not open the first process artifact and the preserved workspace contains none of them (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/codex-wrapper.mjs`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/`). A path-handoff, snapshot, cleanup, or copy-order defect could explain that mismatch, but the supplied evidence does not distinguish among those causes. The raw JSONL and `result.txt` agree, yet they were not independently accepted by the declared verifier, so their agreement cannot be promoted to a passing case.

### Comparison with the pre-registered expectation

The expected product sequence was observed in the raw JSONL and final file: three schema-valid messages, two exact successful reads, one successful completion, first message different from `-o`, and last message equal to `-o` (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`). The expected evidence outcome was not observed: the marker was absent, verifier exit was 1, `passed` was false, and the declared generated change set was absent (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`). The plan pre-registered this type of verifier disagreement as inconclusive, so the verdict follows the recorded rule rather than retroactively relaxing it (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Limitations

- There is one invocation and no repetition (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`).
- No model or effort override was recorded, so Codex CLI 0.147.0 does not identify the resolved backend snapshot (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`).
- The missing `agent-process.json` prevents the intended independent process-status check; only the outer runner's exit status is retained (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
- The verifier did not evaluate the retained JSONL or final artifact, and the marker was not produced (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
- An empty diff and no changed files show what the outer runner retained, but they do not prove why the wrapper-declared generated artifacts disappeared (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/diff.patch`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
- The fixture models message lifecycle only; it does not measure review quality, factual correctness, security, cost, or performance (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Reusable recipe present in successful evidence

None. The only registered case has `passed=false`, so no configuration from this run qualifies as a reusable successful recipe (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`). The retained prompt, wrapper, and verifier are audit material for repairing and rerunning the experiment, not a publishable recipe (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/codex-wrapper.mjs`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/verify.mjs`).

### Unsafe or unsupported variants

- Do not generalize the raw observation to future Codex versions, every model, every schema, or every prompt; only one default-model invocation on CLI 0.147.0 was recorded (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`).
- Do not describe the behavior as a security vulnerability or assign a server-side root cause; this run tested a parser boundary and did not isolate internal causation (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- Do not claim that JSON Schema establishes factual correctness; the fixture checked shape and lifecycle only (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- Do not present the wrapper or completion gate as verified reusable configuration until a rerun preserves its declared artifacts and passes the verifier (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`).
- Do not compare Codex with Claude, models, latency, cost, or quality; those dimensions were excluded (`research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Article-safe facts

- The retained Codex CLI 0.147.0 JSONL contains three schema-valid completed messages surrounding two exact successful read commands and one `turn.completed` (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/schema.json`).
- The retained `result.txt` equals the last completed message and differs from the first (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The outer runner recorded agent exit 0, but the case verifier exited 1 because `agent-process.json` was missing; no marker was observed and the case did not pass (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`).
- Therefore the honest current result is an observed raw boundary inside an inconclusive experiment, not a confirmed practice (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

## Editorial brief

### One concrete reader and situation

A CI or local-automation maintainer who consumes `codex exec --json --output-schema` from a shell or Node.js wrapper, wants live progress, and must promote exactly one completed structured result to a later job (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Reader problem

Several `agent_message.text` values in one stream can satisfy the requested schema, so a first-valid parser may accept progress before the reads finish; the current run visibly demonstrates that risk but failed its registered evidence harness (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`).

### One-sentence article promise and takeaway

After a passing rerun, show with one bounded Codex CLI 0.147.0 trace why schema validity is not a finality signal and give maintainers a verified rule to wait for successful completion before independently validating and promoting the dedicated `-o` artifact; the present evidence is not yet sufficient to publish that rule as a confirmed practice (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

### Coverage gap filled

Official documentation distinguishes the JSONL stream, output schema, and final-message file, while version-pinned source explains the event shape; neither provides a current, bounded first-valid-versus-final trace with a deterministic consumer oracle ([OpenAI non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode); [0.147.0 exec event types](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/exec_events.rs); `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`). A passing rerun would fill that gap; this failed verification does not yet fill it.

### Article type

`failure`

The failure to explain is a first-valid streaming consumer selecting a progress object. The harness failure belongs in the audit trail and must be repaired before drafting, not reframed as the reader-facing product failure (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`).

### Why the result matters in real work

A schema-valid progress object can be posted as a review result, stored as job metadata, or trigger an incomplete downstream step if a wrapper treats parsing success as completion. The fixture isolates that lifecycle decision without claiming to model review quality (`research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`; `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

### Practical decision rule and mapping

Candidate rule to verify on rerun: keep JSONL for observability, perform no downstream side effect from the first schema-valid `agent_message`, require process exit 0 and exactly one successful `turn.completed`, then read and independently validate `-o`. Do not publish this as a run-confirmed recipe until the declared verifier and artifact gates pass (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

| Fixture signal | Real-task analogue | Reader decision |
| --- | --- | --- |
| `alpha.txt` and `beta.txt` read in order (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`) | Multiple repository, diff, or test-log inspection steps | Treat intermediate text as progress while work remains |
| First and second schema-valid messages (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`) | Candidate structured results in a live stream | Do not promote solely because JSON parsing and schema checks pass |
| One `turn.completed` plus outer exit 0 (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`) | Completion receipt for a CI job | Gate later processing on successful completion |
| `result.txt` equal to the last message (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`) | Dedicated downstream artifact | Parse and validate the final artifact independently |
| Verifier ENOENT (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`) | Broken evidence handoff in an automation harness | Rerun after repairing artifact preservation; do not relabel raw agreement as a pass |

### Evidence-led story arc

1. Start with the documented distinction between a JSONL event stream and the final-message file, and the maintainer's concrete choice between first-valid and completion-gated consumption ([OpenAI non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode); `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`).
2. State the pre-registered expectation and competing outcome before showing results (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
3. Walk through the five completed items and show that all three messages validate while only the last equals `-o` (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`).
4. Disclose that the deterministic verifier never checked those outputs because `agent-process.json` was missing, making the registered result inconclusive (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
5. After a passing rerun, close with the tested completion gate and its scope limits; until then, stop before drafting (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

### Body evidence

- The exact completed-item sequence and three message payloads (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The `result.txt` equality comparison with first and last messages (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/result.txt`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`).
- The pre-registered decision rule that verifier disagreement outside the competing outcome is inconclusive (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- The verifier ENOENT and failed metrics, because they determine why drafting must wait (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).

### Appendix evidence

- Full manifest, prompt, safety settings, allowed changes, and expected marker (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`).
- Redacted runner invocation (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/command.json`).
- Wrapper and verifier implementation (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/codex-wrapper.mjs`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/verify.mjs`).
- Full event JSONL, stderr, metrics, empty diff, and case inventory (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/events.jsonl`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/stderr.log`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/diff.patch`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`).

### Candidate titles

1. Codex execで「最初にSchema-validなJSON」を採用してよいか
2. `--json`と`-o`の境界をCodex CLI 0.147.0で検証する
3. Codex execの最終結果判定：JSONLと`-o`を分けて扱う

### Unsupported angles, emotions, comparisons, and generalizations to avoid

- Avoid claiming confirmation, successful reproduction, or a reusable recipe from this failed registered case (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/metrics.json`).
- Avoid invented first-person experience, surprise, frustration, motivation, or production impact; only the plan's recorded expectation and the observed contrast are available (`practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
- Avoid blaming Codex for the missing verifier artifact or naming an exact harness root cause; the evidence shows the missing file, not why it was missing (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/two-read-finality-boundary/verify.log`).
- Avoid universal claims across versions, models, schemas, providers, or failure/interruption paths (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/execution-log.md`).
- Avoid Claude comparisons, model rankings, security claims, speed/cost claims, and claims that schema validation proves factual correctness (`research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`; `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).

## Next action

Rerun once, without drafting first, after repairing the experiment's artifact handoff so that `agent-process.json`, `agent-events.jsonl`, and `agent-final.json` are present in the directory from which `verify.mjs` runs and are preserved in the recorded case workspace. Require verifier exit 0, marker `FIRST_VALID_IS_NOT_FINAL`, the exact allowed change set, and no protected or unexpected changes before changing the verdict (`logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/codex-wrapper.mjs`; `logs/agent/run-codex-exec-jsonl-final-artifact-20260814-0504-20260814-051329/work/two-read-finality-boundary/verify.mjs`; `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.md`).
