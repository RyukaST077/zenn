# Codex exec JSONL final-artifact boundary plan

## Source, reader problem, and promised decision

- Source report: `research/agent/agent-knowhow-codex-exec-jsonl-final-artifact-20260814-0504.md`
- Reader: a CI or local-automation maintainer consuming `codex exec --json --output-schema` from a shell, Node.js wrapper, or build runner.
- Reader problem: each completed `agent_message.text` can be valid JSON with the requested shape, while Codex CLI 0.147.0's exec event exposes no commentary/final phase. A first-valid parser may therefore promote progress as a completed downstream result.
- Promised decision: decide whether automation on this recorded CLI boundary must wait for exit code 0 and exactly one `turn.completed`, then consume and independently validate `-o`, instead of accepting the first schema-valid stream message.
- Likely article type: `failure`
- Mode: `boundary`
- Target provider: Codex only. Claude and a cross-provider comparison are excluded because they cannot answer a Codex exec-surface finality claim.
- Authoritative execution specification: `practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json`

## Falsifiable claim

With locally installed Codex CLI 0.147.0, one successful `codex exec --json --output-schema schema.json -o <final-file>` turn that is required to emit one short schema-shaped progress message before each of two sequential harmless reads produces exactly three completed `agent_message` items, all independently valid against the same one-field schema. The first valid message differs from `-o`; after exactly one `turn.completed`, `-o` equals the last completed agent message and summarizes both fixed reads.

This plan tests one conjunctive parser-safety claim. A conforming successful run with only one completed agent message, a non-schema-valid progress message, or a first valid message equal to the final artifact is the competing product outcome and does not reproduce the boundary. A prompt-sequence violation, unavailable authentication, version mismatch, unexpected command/tool/path, nonzero command, timeout, malformed event, absent or duplicate completion event, missing final file, protected-path change, or verifier disagreement is inconclusive rather than evidence for either product outcome.

## Minimal fixture and practical mapping

- New fixture: `fixtures/agent-practice/codex-exec-jsonl-final-artifact`
- Existing fixture decision: `instruction-loading` measures edits and guidance discovery, `codex-pretooluse-boundary` measures hook dispatch, and `claude-subprocess-scrub-home-stubs` measures offline Claude startup. None exposes a schema-constrained Codex stream/final-file pair without changing its purpose.
- `alpha.txt` and `beta.txt`: fixed one-line, non-sensitive inputs for two exact read-only commands.
- `schema.json`: a closed object requiring only one non-empty string field named `message`.
- `codex-wrapper.mjs`: a narrow runner adapter required because the generic runner does not natively add `--output-schema` or place its JSONL beside the case verifier. It validates the real CLI version, runner safety flags, and disposable root; changes the requested Codex sandbox from `workspace-write` to `read-only`; injects the fixture schema; delegates one model turn; and copies only stdout, process status, and the already-declared `-o` artifact into the case root. It delegates runner authentication/version probes without reading credential files.
- `verify.mjs`: dependency-free objective verifier for JSONL parsing, exact event order, exact commands and outputs, schema predicates, completion count, process status, and first/last/final comparisons. It writes the expected marker only when every supportive assertion holds.

The fixture is deterministic and self-contained apart from the authenticated Codex provider invocation inherent in the selected claim. It uses only installed Node.js, the installed Codex CLI, `/bin/zsh` selected by Codex, and the standard `head` utility; it installs nothing and needs no browser login, new secret, user data, symlink, daemon, Git repository, production path, package registry, web search, MCP server, plugin, or other external service. Ordinary pre-existing Codex authentication is a runner prerequisite and is checked only with `codex login status`; the fixture never reads, copies, prints, or changes credentials. The two fixed reads model multi-step inspection, schema-valid messages model candidate CI results, and exit/completion plus `-o` model the downstream promotion gate; this fixture does not model code-review quality.

## Single case, prompt, and exact settings

Run exactly one case, `two-read-finality-boundary`, once in a fresh runner copy. One provider and one invocation are the fewest cases that can falsify every conjunct of the claim. A no-tool baseline is excluded because it cannot establish or refute premature selection in the tool-using stream.

Exact prompt:

> Perform exactly this sequence and nothing else. First, send one assistant progress message as a JSON object with exactly one non-empty string field named `message`; it must say that alpha will be read, but must not claim any read result. Second, use the command-execution tool exactly once to run `head -n 1 alpha.txt`. Third, send a different assistant progress message using the same exact JSON shape; it must say that beta will be read and may mention the alpha output, but must not claim the beta result. Fourth, use the command-execution tool exactly once to run `head -n 1 beta.txt`. Finally, send exactly `{"message":"ALPHA_READY + BETA_READY"}`. Do not combine commands, edit or create files, use another tool or command, inspect any other path, access the network, use MCP, or add commentary outside those three JSON objects.

Before execution, resolve the installed `codex` and the fixture adapter to absolute paths, confirm the real CLI is exactly `codex-cli 0.147.0`, and invoke the runner with only these two command-specific overrides added to the existing authenticated environment:

```text
CODEX_BIN=<absolute-repository-root>/fixtures/agent-practice/codex-exec-jsonl-final-artifact/codex-wrapper.mjs \
REAL_CODEX_BIN=<absolute-installed-codex-executable> \
node scripts/agent-practice/run-experiment.mjs \
practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json
```

Do not run the manifest without both absolute overrides. The runner supplies approval policy `never`, `exec`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--skip-git-repo-check`, the disposable `-C` root, `--json`, `-o`, and `sandbox_workspace_write.network_access=false`. The adapter rejects missing settings, verifies the real version again, substitutes `--sandbox read-only`, and injects `--output-schema <case-root>/schema.json` immediately before the exact prompt. No guidance, model, or effort override is used, so the execution log must record the authenticated account's resolved defaults without making a model comparison claim.

Timeout is 300 seconds. Cost is capped at exactly one paid/model invocation, with no retry. Stop before the model call if authentication, CLI version, fixture hashes, adapter overrides, redaction, or disposable-root checks fail. `network: false` is enforced for commands inside the Codex workspace sandbox; it does not block the Codex control-plane connection required to run the authenticated provider. The task itself permits no web, MCP, package, Git remote, or other network use.

## Deterministic verification and strict changed paths

Verification command: `node verify.mjs`.

Every supportive run must satisfy all of these assertions:

1. `alpha.txt`, `beta.txt`, and the schema retain exact expected content; the schema predicate accepts only an object containing one non-empty string property named `message`.
2. The wrapper records real Codex exit code 0 and no terminating signal; every non-empty stdout line parses as JSON.
3. There is exactly one `turn.completed` and no `turn.failed` or fatal error event.
4. Exactly two completed `command_execution` items occur, in order, for `/bin/zsh -lc 'head -n 1 alpha.txt'` and `/bin/zsh -lc 'head -n 1 beta.txt'`; both have status `completed`, exit code 0, and exact outputs `ALPHA_READY\n` and `BETA_READY\n`.
5. The completed-item order is exactly progress message, alpha command, progress message, beta command, final message. There are exactly three completed agent messages and every text independently satisfies the same exact local schema predicate.
6. The first schema-valid message differs from the trimmed final artifact; the final artifact equals the last completed agent message and its parsed message is exactly `ALPHA_READY + BETA_READY`.
7. Protected paths `alpha.txt`, `beta.txt`, `schema.json`, `codex-wrapper.mjs`, and `verify.mjs` remain byte-identical. The complete allowed case-workspace change set is `agent-events.jsonl`, `agent-final.json`, `agent-process.json`, and `verification.txt`; any other path fails the runner boundary.

The wrapper retains only inert prompt/tool events, the final JSON, and process status in the disposable case. The standard runner separately records redacted invocation, stderr, events, result, diff, metrics, and inventory under ignored `logs/agent/`. Do not retain environment values, credential material, or unrelated host paths. Preserve a failed or inconclusive first attempt and do not retry automatically.

## Pre-registered outcomes and decision rule

Expected outcome: all three completed messages validate, the first valid value is a progress object distinct from `-o`, exactly one successful completion follows the two fixed reads, and `-o` equals the last agent message. This supports the version-scoped rule: keep JSONL for audit/progress, but perform no downstream side effect until process exit 0 and exactly one `turn.completed`; then parse and independently validate the `-o` artifact.

Competing outcome: the exact prompt and command sequence completes successfully, but there is only one completed agent message, either progress message is absent or schema-invalid, the first valid message equals `-o`, or `-o` is distinguishable as final from fields present in the current exec event. This changes the recommendation to report non-reproduction on the recorded CLI/service/model conditions and avoid presenting the first-valid workaround as necessary for 0.147.0.

Success for the selected claim requires every supportive assertion in the single case. A verifier failure caused by the competing product outcome is evidence for non-reproduction only after the execution log confirms the prompt, command, completion, and artifact gates; all other verifier failures remain inconclusive. The practical evidence can support only the parser choice for this bounded stream, not a claim that JSON Schema establishes factual correctness.

## Cleanup, limitations, and expected article value

- The runner owns the fresh temporary case root, preserves the redacted evidence and final case copy under ignored `logs/agent/`, then removes only its generated temporary root. The fixture itself stores no generated run output.
- Do not install dependencies, authenticate interactively, open a browser, access web/MCP/plugins, add writable directories, inspect credentials, alter Git, publish, message anyone, or touch production state.
- Stop the case on timeout, unexpected command/tool/path, attempted edit, network request, fatal/duplicate/missing completion, protected mutation, unexpected change, malformed JSONL, absent final artifact, or redaction failure. Preserve evidence; do not retry.
- This is one sample on Codex CLI 0.147.0 under the recorded default model/service conditions. It does not prove universal model behavior, future versions, all schemas/prompts, server root cause, security impact, latency, cost, output factuality, or behavior after failure/interruption.

The expected article value is a small reproducible failure boundary and a copyable completion gate showing why syntactic/schema validity alone is not turn finality.
