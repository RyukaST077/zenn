# Codex exec structured JSONL: first schema-valid message versus the final artifact

## Research contract

- Research date: 2026-08-14 (JST)
- External-source access date: 2026-08-14
- Requested scope: current, practical Claude Code or OpenAI Codex know-how not already covered by this repository
- Selected provider: OpenAI Codex CLI only
- Proposed mode: `boundary`
- Likely article type: `failure`
- Selected version boundary: locally installed Codex CLI `0.147.0`, released 2026-08-07
- Performance or provider comparison: excluded. The claim concerns completion semantics in one Codex JSONL stream, not speed, cost, model quality, or Claude Code.
- Practice execution: not performed in this search stage.
- Git, publishing, credential, production, and external-system mutations: not performed.

## Explicit constraints

- Select exactly one current, article-worthy, falsifiable practice claim.
- Exclude substantive duplicates in `articles/*.md` and `research/agent/*.md`.
- Prefer current official documentation and version-pinned OpenAI source; use community material only to identify a hypothesis that must be retested.
- Require a later check to use a bounded offline fixture, harmless read-only commands, finite invocations, and no dependency installation.
- Do not inspect, copy, print, relocate, or modify credentials.
- Do not create a practice plan, execute Codex against a fixture, draft an article, publish, send external messages, or alter Git state in this stage.

## Existing repository exclusions

All 38 Markdown files under `articles/` and all three earlier reports under `research/agent/` were inspected by path, title, and relevant content on 2026-08-14.

- `articles/project-root-agent-instructions.md` and `research/agent/agent-knowhow-project-instruction-loading-20260811-1133.md` already cover behavioral verification of root `CLAUDE.md` / `AGENTS.md` instructions. The selected topic does not test instruction discovery or compliance.
- `articles/codex-pretooluse-dispatch-preflight.md` and `research/agent/agent-knowhow-codex-exec-pretooluse-fail-open-20260812-0503.md` already cover Codex hook dispatch, deny behavior, and harmless side-effect oracles. The selected topic uses no hook and tests the output stream/final-artifact boundary instead.
- `research/agent/agent-knowhow-claude-subprocess-scrub-home-stubs-20260813-0502.md` covers Claude Code subprocess credential scrubbing and shell-startup side effects. Claude environment isolation is excluded.
- `articles/codex-gpt-5-6-model-guide.md` covers GPT-5.6 model-family and reasoning-level selection. Model selection, benchmark, latency, and quality claims are excluded.
- No existing article or prior agent report covers `codex exec --json` message finality, `--output-schema` on intermediate agent messages, loss of message phase on the exec surface, or `-o` as a completion artifact.
- The remaining articles concern Zenn publishing or non-agent engineering topics and are not substantive duplicates.

## Searched queries and representative coverage

Live web search was performed on 2026-08-14 with these representative queries:

1. `site:code.claude.com/docs "--safe-mode" Claude Code`
2. `site:code.claude.com/docs "--bare" Claude Code`
3. `site:developers.openai.com/codex "strict-config" Codex CLI`
4. `site:developers.openai.com/codex execpolicy rules check Codex CLI`
5. `OpenAI Codex CLI --strict-config official documentation`
6. `site:developers.openai.com/codex/cli "output-schema"`
7. `site:github.com/openai/codex/issues "output-schema" codex exec`
8. `site:github.com/openai/codex/issues "strict-config" codex`
9. `site:github.com/openai/codex "final_output_json_schema"`
10. `site:github.com/openai/codex "output_last_message" "agent_message"`
11. `Codex exec output-schema intermediate agent_message first final JSONL`
12. `Zenn Codex --output-schema --json agent_message`
13. `Codex exec JSONL parse final message output-schema CI`
14. `Codex CLI structured output --output-schema article`

Representative strong existing coverage includes OpenAI's non-interactive guide and Codex Cookbook CI review guide, plus the independent [codex exec JSONL Reference](https://codex.danielvaughan.com/2026/04/08/codex-exec-jsonl-reference/) (published 2026-04-08, updated 2026-08-13, accessed 2026-08-14). The independent reference explains event types, `--output-schema`, and `-o`, and says the structured response appears in the final `agent_message`; it does not test whether earlier `agent_message` items can also satisfy the same schema or provide a first-valid-versus-final parser oracle. The Zenn-specific query did not return a directly matching article in the observed results; this does not prove that no Japanese coverage exists.

## Official and primary sources

1. [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: `codex exec --json` emits JSONL with one object per state change, while `-o` / `--output-last-message` writes only the final message to a file.
   - Clearly marked paraphrase: `--output-schema` requests a final response conforming to a JSON Schema, and the official example combines it with `-o` for a downstream artifact.
   - Relevance: establishes the documented stream, schema, and final-file interfaces, but does not specify whether schema-valid agent messages can occur before turn completion.

2. [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: the current `codex exec` flags include `--json`, `--output-schema`, `--output-last-message`, `--ephemeral`, `--ignore-user-config`, and the `read-only` sandbox.
   - Clearly marked paraphrase: `--json` is an event stream, whereas `-o` is described as the assistant's final message for downstream scripting.
   - Relevance: supports a bounded current CLI invocation and the distinction between telemetry events and the final artifact.

3. [Codex CLI 0.147.0 release](https://github.com/openai/codex/releases/tag/rust-v0.147.0)
   - Publisher: OpenAI's official Codex repository.
   - Released: 2026-08-07.
   - Accessed: 2026-08-14.
   - Exact release fact: the page identifies `0.147.0` as the latest release at access time and tag `rust-v0.147.0` at commit `be6e8ea`.
   - Relevance: pins the proposed check to the locally installed current executable rather than extrapolating from an older issue report.

4. [Codex 0.147.0 protocol source](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/protocol/src/protocol.rs)
   - Publisher: OpenAI's official Codex repository, version-pinned source.
   - Version publication date: 2026-08-07 with release `0.147.0`; no separate file date is displayed.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase of the source comment: `final_output_json_schema` is described as the optional JSON Schema constraining the final assistant message for a turn.
   - Relevance: establishes intended final-message semantics at the protocol layer without proving the sequence of live JSONL messages.

5. [Codex 0.147.0 JSONL event processor](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs) and [exec event types](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/exec_events.rs)
   - Publisher: OpenAI's official Codex repository, version-pinned source.
   - Version publication date: 2026-08-07 with release `0.147.0`; no separate file dates are displayed.
   - Accessed: 2026-08-14.
   - Clearly marked source observation: each completed `ThreadItem::AgentMessage` is mapped to an exec `item.completed` carrying `AgentMessageItem { text }`; the exec type has a `text` field but no commentary/final phase field.
   - Clearly marked source observation: each completed agent message temporarily updates `final_message`, and on a completed turn the processor replaces it with the last agent message found in the turn items before emitting `turn.completed`; failed or interrupted turns clear the final message.
   - Relevance: provides a version-pinned reason that a stream consumer cannot classify finality from the `agent_message` payload alone and that successful turn completion is material to final-artifact selection. It still does not prove that the current service/model will emit multiple schema-valid messages in the proposed fixture; that remains the practice claim to test.

6. [Build Code Review with the Codex SDK](https://github.com/openai/openai-cookbook/blob/main/examples/codex/build_code_review_with_codex_sdk.md)
   - Publisher: OpenAI Cookbook, primary engineering guidance.
   - Publication/update date: not displayed on the rendered `main` page; `main` is mutable.
   - Accessed: 2026-08-14.
   - Clearly marked paraphrase: the guide maps schema-constrained Codex output to real CI review automation and uses an output file as the value consumed by later SCM steps.
   - Relevance: supplies a credible real-work mapping for parser correctness without being evidence for the selected failure boundary.

## Community and issue coverage used only as hypotheses

1. [codex exec --output-schema does not apply only to final output, openai/codex issue #19816](https://github.com/openai/codex/issues/19816)
   - Author/source: community bug report in the OpenAI Codex repository; not official product documentation.
   - Opened: 2026-04-27.
   - Reported version/environment: Codex CLI `0.125.0`, GPT-5.5, Linux.
   - Accessed: 2026-08-14.
   - Reported observation: a forced multi-command run emitted several intermediate `agent_message` events that each conformed to the final schema, so accepting the first schema-valid message returned progress rather than the final result.
   - Additional context: an OpenAI repository collaborator replied on 2026-04-28 that this was a limitation of the then-current Responses server endpoint. Because this is an issue comment rather than a versioned product contract, it is retained only as a strong hypothesis for 0.147.0.

2. [exec JSON events drop agent message phase, openai/codex issue #30190](https://github.com/openai/codex/issues/30190)
   - Author/source: community bug report in the OpenAI Codex repository; not official product documentation.
   - Opened: 2026-06-26; open at access time.
   - Accessed: 2026-08-14.
   - Reported observation: the exec JSON surface drops the upstream phase that distinguishes commentary from final answer.
   - Use here: hypothesis and competing interpretation. The version-pinned 0.147.0 source independently confirms that the exec event's `AgentMessageItem` contains only `text`, but only a live bounded run can show whether this creates a first-valid parser failure under current service behavior.

3. [codex exec JSONL Reference: Every Event Type and the Complete Output Schema](https://codex.danielvaughan.com/2026/04/08/codex-exec-jsonl-reference/)
   - Author/source: independent community reference; not OpenAI documentation.
   - Published: 2026-04-08; updated: 2026-08-13.
   - Accessed: 2026-08-14.
   - Guidance: use `--json` for the event stream, `--output-schema` for a structured response, and `-o` for raw final text.
   - Use here: representative strong existing coverage. It answers normal usage but leaves the specific multiple-schema-valid-message boundary untested.

No community recommendation is relabeled as an OpenAI recommendation.

## Candidate assessment

### Selected: schema-valid progress messages versus the successful final artifact

This boundary is selected because a CI consumer can be fully JSON- and schema-correct yet still act on the wrong message. The failure is operationally meaningful: an early progress object can be posted as a review result, stored as job metadata, or trigger an incomplete downstream action. The official interface already exposes a dedicated final-message file, and the version-pinned source shows that exec JSONL agent messages do not carry a phase discriminator. A tiny tool-using run can therefore add a concrete parser rule beyond a feature overview.

### Excluded candidates

- Codex `--strict-config`: current official documentation already states that it errors on unrecognized `config.toml` fields. Without a separate observed precedence or semantic-validation failure, a first article would largely restate the flag description.
- Codex execpolicy `check`: the official Rules page already documents shell-splitting boundaries, strictest-decision behavior, and an offline checker. It is useful but is adjacent to the repository's existing Codex policy/hook preflight coverage and no narrower uncovered failure was established in this search.
- Claude Code `--bare`: official documentation directly explains skipped auto-discovery, explicit configuration inputs, and the non-OAuth authentication boundary. It is also adjacent to the existing instruction-loading article, and the locally authenticated OAuth setup cannot exercise bare mode without obtaining different credential authority.
- Claude Code `--safe-mode`: current local help describes it as a troubleshooting mode that disables customization while retaining managed policy. This search did not establish an external-source-backed gap that is both narrower and more useful than the selected parser failure.
- Codex `--approve-for-me`: release 0.147.0 introduces the flag, but a fair safety evaluation needs approval-category and policy scenarios beyond a tiny offline read-only fixture. It is not needed for the selected reader decision.
- Cross-provider structured-output comparison: rejected because a Claude-versus-Codex comparison does not help a maintainer safely parse one Codex JSONL run.

## Selected falsifiable practice claim

> With the locally installed Codex CLI 0.147.0, a successful `codex exec --json --output-schema <schema> -o <final-file>` turn that is explicitly required to emit a short message before each of two harmless, sequential local read commands produces at least two completed `agent_message` events whose `text` independently validates against the schema, while `<final-file>` equals only the last completed agent message. Therefore an automation must not accept the first schema-valid `agent_message`; for this CLI boundary it should require exit code 0 and exactly one `turn.completed`, then parse and independently validate the `-o` artifact.

This is one conjunctive parser-safety claim. It is false if the current run emits only one schema-valid agent message, an earlier message is not schema-valid, the `-o` artifact does not equal the last completed agent message, the turn does not complete successfully, or the CLI no longer omits information needed to distinguish finality. A prompt that fails to cause the exact two commands and required pre-command messages makes the case inconclusive rather than support for the claim.

## Target reader and practical uncertainty

- Reader: a CI or local-automation maintainer who runs `codex exec --json --output-schema` and consumes its output from a shell, Node.js wrapper, or build runner.
- Situation: the maintainer wants live JSONL for observability while also passing one schema-constrained result to a later job, review publisher, or metadata store.
- Current problem: every `agent_message.text` can look like valid final JSON, the exec event shape exposes no commentary/final phase in version 0.147.0, and accepting the first valid object is attractive for low latency but may terminate on progress.
- Decision after reading: whether to parse a streamed message immediately or wait for successful completion and consume the dedicated final artifact. The promised action is a copyable completion gate, not a claim that JSON Schema validates factual correctness.

## Article promise

The article would let the reader reproduce the stream/final-file difference with two inert local reads, see why schema validity is not a finality signal, and implement a deterministic consumer rule: retain JSONL for audit/progress, require successful turn completion, then validate the `-o` payload before any downstream side effect. If the boundary is not reproduced on 0.147.0, the article should instead report the non-reproduction and avoid recommending a workaround as necessary for that version.

## What existing sources answer and the remaining coverage gap

Official documentation already answers:

- `codex exec --json` produces an event stream rather than one result object;
- `--output-schema` requests a schema-conforming final response;
- `-o` writes the assistant's final message for downstream scripting;
- `read-only`, `--ephemeral`, and `--ignore-user-config` can bound a non-interactive run.

OpenAI's version-pinned 0.147.0 source additionally shows:

- every completed agent message becomes an exec `item.completed` with text;
- the exec `AgentMessageItem` does not include a message phase;
- completed-turn handling selects the last agent message as the final message and clears it on failure/interruption.

Strong community coverage already provides a broad JSONL reference, and two issue reports identify the suspected intermediate-message and missing-phase boundaries. What remains missing is current primary execution evidence on 0.147.0 that deliberately creates more than one schema-valid agent message, compares a deliberately wrong first-valid consumer with the successful `-o` artifact, and maps the difference to one copyable CI decision rule. That is more useful than another structured-output tutorial because it tests when a syntactically valid object is still premature.

## Practical mapping

| Offline fixture element | Real-work analogue |
| --- | --- |
| two fixed text files and sequential read-only commands | inspecting a diff, test log, or repository metadata across multiple tool steps |
| required pre-command messages | normal agent preambles or progress updates during a longer task |
| each schema-valid `agent_message.text` | a candidate result seen by a streaming CI consumer |
| naive first-valid extractor | a low-latency wrapper that stops as soon as JSON parsing/schema validation succeeds |
| `turn.completed`, process exit code, and `-o` file | the job's completion receipt and downstream result artifact |
| independent local validation of `-o` | defense against malformed/truncated artifacts and future schema drift |

The fixture does not claim that two reads model the quality of a real code review. It models only the lifecycle distinction between progress generated before tools finish and the final result generated after the turn completes.

## Minimal verification idea

In a later plan/run stage, create one temporary, non-Git fixture containing:

- `alpha.txt` and `beta.txt` with fixed, non-sensitive one-line contents;
- a small JSON Schema requiring an object with exactly one string field, for example `message`, and `additionalProperties: false`;
- a dependency-free Node.js verifier that parses JSONL, selects completed `agent_message` items, applies the same exact local schema predicate to each text payload, records the first-valid and last-valid values, parses `final.json`, and checks the completion/exit gates.

Use a fixed prompt that requires, sequentially: emit one short progress message, run one exact read-only command for `alpha.txt`, emit a second short progress message, run one exact read-only command for `beta.txt`, then return a final summary. Prohibit edits, alternate commands, web search, MCP, and additional tools. Run once with the installed Codex using `--sandbox read-only`, `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `--skip-git-repo-check`, `--json`, `--output-schema schema.json`, `-o final.json`, and a finite timeout. Do not use danger-full-access or bypass approval/sandbox flags.

Optionally run one matched no-tool baseline before the selected tool-using case to verify that the parser itself reports one final object in the simple path; cap the experiment at two total model invocations. The baseline is diagnostic context, not a second practice claim.

Retain the redacted exact command, CLI version, stdout JSONL, stderr, exit code, command events, message count/order, schema predicate results, `turn.completed` count, `final.json`, and final file inventory. Do not automatically retry if the model omits a required progress message or command; classify that single case as inconclusive.

## Local feasibility observed without running the practice

- `codex --version` returned `codex-cli 0.147.0` on 2026-08-14.
- Local `codex exec --help` exposes `--sandbox read-only`, `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `--skip-git-repo-check`, `--json`, `--output-schema`, and `-o`.
- Node.js is already available locally and is sufficient for a dependency-free fixture/verifier; no package installation is needed.
- The fixture can use only static local files and read-only commands. Model API access is necessarily external, but the agent's task needs no web, package registry, Git remote, MCP server, or production system.
- Authentication was not exercised, inspected, copied, printed, or modified. A later run must treat ordinary authenticated Codex access as a prerequisite and stop cleanly if unavailable.
- No fixture, manifest, practice directory, or execution log was created in this search stage.

## Expected evidence and decision rule

Retain and evaluate:

- exact `codex-cli 0.147.0` version output and sanitized invocation;
- process exit code 0;
- JSONL that parses line by line and contains exactly one `turn.completed` and no `turn.failed`/fatal error;
- exactly the two allowed completed read-only command executions, in order, with exit code 0 and expected static output;
- all completed `agent_message.text` values, their order, JSON parse result, and exact-schema result;
- `final.json`, independently parsed and checked against the same schema;
- equality comparisons among first schema-valid message, last completed agent message, and `final.json`;
- confirmation that static inputs and schema were unchanged and that no unexpected file other than the declared output/evidence files appeared.

Support the claim only if the tool-using case has at least two schema-valid completed agent messages, the first-valid value differs from `final.json`, the last completed agent message equals `final.json`, and all completion, command, and mutation gates pass. Mark the claim `not reproduced` if a conforming successful run has only one agent message or earlier messages are not schema-valid. Mark it `inconclusive` if the prompt contract, command sequence, authentication, timeout, schema parsing, or completion gate fails.

The adoption rule is stricter than “take the last line”: require exit 0 and `turn.completed`, consume the dedicated `-o` artifact, validate it independently, and retain JSONL only as audit/progress evidence. A failed or interrupted turn must not promote an earlier valid-looking message.

## Safety, cost, and stop conditions

- Run only in a fresh temporary directory containing inert static files. Never point the agent at the repository root or a production checkout.
- Use `read-only` sandboxing, no added writable directories, no web search, no MCP servers, no plugins, no Git remote operations, and no dependency installation. The wrapper may write JSONL, stderr, and `final.json` outside the agent's read-only workspace as declared evidence outputs.
- Allow at most two paid/model invocations (optional no-tool baseline plus one selected case), each with a finite timeout and no automatic retries. Record usage if surfaced but make no cost or performance claim.
- Do not inspect, copy, echo, relocate, or modify authentication files or environment-variable values. Record only sanitized authentication success/failure.
- Do not publish, commit, stage, branch, push, create a PR, or contact external services other than the authenticated Codex model endpoint required for the run.
- Stop before execution if the fixture hashes differ, ordinary authentication is unavailable, output redaction cannot be guaranteed, the read-only boundary cannot be established, or the exact CLI flags are unavailable.
- Stop the case on an unexpected tool or command, any attempted edit, network/MCP use, timeout, fatal event, missing/duplicate completion event, unexpected file mutation, or verifier disagreement. Preserve the failure as evidence and do not retry automatically.

## Recommended editorial stance if later evidence is obtained

- Lead with the reader decision: schema validity answers “is this shaped correctly?”, not “is this the completed turn result?”
- Show the first-valid extractor failure and the successful `-o` gate side by side, with exact retained events rather than inferred internal behavior.
- Keep the conclusion version-scoped to Codex CLI 0.147.0, the recorded model/service conditions, and a single bounded run unless repetition is explicitly added later.
- Do not call the behavior a security vulnerability, guaranteed server limitation, or universal model property. Describe only the observed lifecycle and parser consequence.
- If the current run does not reproduce multiple schema-valid messages, publish only if the non-reproduction still gives a clear version-specific decision boundary; otherwise stop rather than forcing an article.
