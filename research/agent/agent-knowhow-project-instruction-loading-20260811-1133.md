# Project-scoped CLAUDE.md / AGENTS.md loading in non-interactive CLI runs

## Research contract

- Research date: 2026-08-11 (JST)
- External-source access date: 2026-08-11
- Requested topic: project-scoped `CLAUDE.md` and `AGENTS.md` instruction loading in non-interactive Claude Code and Codex CLI runs
- Target providers: Anthropic Claude Code and OpenAI Codex CLI
- Proposed mode: `ablation`
- Performance comparison: excluded. The selected claim concerns observable instruction loading only.
- Practice execution: not performed in this search stage.
- Git, publishing, and credential operations: not performed.

## Explicit constraints

- Select exactly one falsifiable, non-performance claim covering both products.
- Use current official primary sources for both products and record access dates.
- Target the existing `fixtures/agent-practice/instruction-loading` fixture and its product-specific guidance files.
- Keep any later experiment local, bounded, isolated, non-interactive, and free of credential disclosure.
- Do not create a practice plan, execute either agent against the fixture, draft an article, publish, or change Git state in this stage.

## Existing-content exclusions

- Inspected all 31 files under `articles/*.md`. None tests whether project-root `CLAUDE.md` or `AGENTS.md` affects a non-interactive CLI run.
- `articles/codex-gpt-5-6-model-guide.md` mentions non-interactive Codex model selection, but it does not test project-instruction discovery and is not a substantive duplicate.
- `research/agent/` contained no prior reports before this report was created, so there is no prior agent research report to exclude.

## Searched queries

Live web search was performed on 2026-08-11 with these queries:

1. `site:developers.openai.com/codex AGENTS.md instruction discovery CLI non-interactive`
2. `site:developers.openai.com/codex/guides "AGENTS.md"`
3. `site:developers.openai.com/codex "How Codex discovers guidance"`
4. `site:developers.openai.com/codex "Instruction discovery"`
5. `site:code.claude.com/docs CLAUDE.md project memory print mode non-interactive Claude Code`
6. `site:docs.anthropic.com/en/docs/claude-code CLAUDE.md project print mode`
7. `site:code.claude.com/docs "CLAUDE.md" "--print"`
8. `site:code.claude.com/docs/en "Run Claude Code programmatically" --print`
9. `site:code.claude.com/docs/en/headless-mode CLAUDE.md`
10. `site:code.claude.com/docs/en/cli-reference "--print"`

The legacy OpenAI URL `https://developers.openai.com/codex/guides/agents-md` was also opened directly and redirected to the current official ChatGPT Learn page recorded below.

## Official primary sources

### Anthropic Claude Code

1. [How Claude remembers your project](https://code.claude.com/docs/en/memory)
   - Publisher: Anthropic, official Claude Code documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-11.
   - Clearly marked paraphrase: a project instruction can live at `./CLAUDE.md` or `./.claude/CLAUDE.md`; instruction files at or above the working directory are loaded at launch, and `CLAUDE.md` enters context at the start of every session.
   - Relevance: supports project-root discovery and startup loading.

2. [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
   - Publisher: Anthropic, official Claude Code documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-11.
   - Clearly marked paraphrase: `claude -p` is the non-interactive CLI form for scripts and CI. The page separately says `--bare` omits host customizations including `CLAUDE.md`.
   - Relevance: establishes the tested non-interactive entry point and an explicit boundary that must not be enabled in the guided case.

3. [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
   - Publisher: Anthropic, official Claude Code documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-11.
   - Clearly marked paraphrase: `--print` / `-p` returns a response without interactive mode; `--safe-mode` disables `CLAUDE.md` along with other customizations.
   - Relevance: confirms the non-interactive flag and the second explicit opt-out boundary.

### OpenAI Codex CLI

1. [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-11.
   - Clearly marked paraphrase: Codex constructs an instruction chain once per run; at project scope it starts at the project root, normally the Git root, and walks toward the working directory, selecting `AGENTS.override.md`, `AGENTS.md`, or configured fallback names in each directory.
   - Relevance: directly supports project-root `AGENTS.md` discovery for a run. The same page includes a `codex exec` example when discussing active instruction sources.

2. [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
   - Publisher: OpenAI, official ChatGPT/Codex documentation.
   - Publication/update date: not displayed on the page.
   - Accessed: 2026-08-11.
   - Clearly marked paraphrase: `codex exec` runs Codex without the interactive TUI for scripts and CI and accepts explicit sandbox settings.
   - Relevance: establishes the tested Codex non-interactive entry point.

## Community sources

None used. No community claim is needed to formulate the experiment.

## Candidate assessment

The requested topic yields one useful candidate: a matched, four-case ablation asking whether adding the product-native project-root instruction file changes only the guided runs. It is locally observable, does not depend on latency, token counts, subjective quality, or a model-to-model ranking, and can be falsified by either a missing guided marker or an unexpected baseline marker.

Excluded adjacent angles:

- Nested-file precedence: official docs describe it, but the existing fixture targets root loading and a nested test would expand the first proof.
- Claude `--bare` / `--safe-mode`: useful as a later boundary test, but deliberately excluded from the selected default-loading claim because official docs say these modes suppress `CLAUDE.md`.
- Instruction-following rate over repeated trials: a performance/reliability claim requiring multiple paid runs, outside the requested first proof.
- Direct comparison of output quality: subjective and performance-oriented.

## Selected falsifiable claim

> With the locally installed current CLIs, ordinary non-interactive runs launched on isolated copies of `fixtures/agent-practice/instruction-loading` load their product-native project-root instructions: adding the supplied root `CLAUDE.md` makes the Claude Code `-p` guided case create `verification.txt` with marker `AGENT_RULE_APPLIED`, and adding the supplied root `AGENTS.md` makes the Codex `exec` guided case create the same marker, while the matched no-guidance baseline for each product does not create the marker.

This is one conjunctive claim. It is false if either guided case lacks the exact marker, either baseline creates a marker, or the run cannot preserve the fixture's protected files while satisfying its deterministic test.

## Competing guidance and interpretation limits

- Anthropic explicitly documents that `--bare` and `--safe-mode` suppress `CLAUDE.md`. Therefore the claim applies only to ordinary `claude -p` instruction loading without either opt-out.
- Anthropic describes `CLAUDE.md` as contextual guidance rather than an enforcement mechanism. A loaded instruction may still be disobeyed, so a failed guided marker would show that this behavioral proof was not reproduced; it would not by itself prove the file was never injected.
- OpenAI documents discovery once per run and project-root traversal. The claim does not extend to empty files, override files, fallback filenames, byte-limit truncation, or nested precedence.
- Both products may also load user-level guidance. The ablation isolates the presence of the repository guidance file while leaving each authenticated CLI's ordinary host configuration unchanged; case logs must record that limitation.

## Target fixture

- Fixture: `fixtures/agent-practice/instruction-loading`
- Initial implementation: `src/greet.js` throws, so `node test.mjs` initially fails.
- Deterministic verifier: `node test.mjs` requires `greet("Zenn")` and `greet("Claude")` to return `Hello, <name>!`.
- Claude guidance source: `fixtures/agent-practice/guidance/claude/CLAUDE.md`
- Codex guidance source: `fixtures/agent-practice/guidance/codex/AGENTS.md`
- Both guidance files require only `src/greet.js` to be modified, require the test to pass, and then require `verification.txt` containing `AGENT_RULE_APPLIED`.
- Protected paths for a later run: `test.mjs`, `package.json`.
- Allowed changes for a later run: `src/greet.js`, `verification.txt` only.

## Minimal verification idea

Use the repository's existing agent-practice runner in a later stage so every case receives a fresh temporary copy of the fixture. Run exactly four cases with the same bounded task prompt and CLI-default model/effort: Claude baseline without guidance, Claude guided with the supplied `CLAUDE.md` copied to the fixture root, Codex baseline without guidance, and Codex guided with the supplied `AGENTS.md` copied to the fixture root. Use ordinary `claude -p` and `codex exec`, with no Claude `--bare` or `--safe-mode` flag.

For each case, retain the runner's redacted command record, JSONL/stderr, CLI version, file inventory, diff, `node test.mjs` result, protected-path check, and observed marker. The claim is supported only when all four verifier runs pass, neither baseline has `verification.txt`, both guided cases have the exact expected marker, and no file outside the allowed-change set differs.

## Local feasibility

- Existing fixture, guidance files, deterministic test, manifest validator, isolated runner, redaction logic, and case-level evidence capture are present in the repository.
- Locally observed on 2026-08-11 without running the practice:
  - Claude Code: `2.1.227`
  - Codex CLI: `0.147.0`
  - Node.js: `v22.17.0`
- Both CLI executables are present on `PATH`. Authentication was not exercised or printed during this search stage; the later runner already treats authenticated CLIs as a prerequisite and must abort cleanly if either status check fails.

## Expected evidence

- Four isolated case directories and four recorded CLI invocations.
- Baseline marker observations: `null` for Claude and Codex.
- Guided marker observations: `AGENT_RULE_APPLIED` for Claude and Codex.
- `node test.mjs`: exit code 0 in each valid completed case.
- Diffs limited to `src/greet.js` in baselines and to `src/greet.js` plus `verification.txt` in guided cases.
- No changes to `test.mjs` or `package.json`.
- Redacted logs sufficient to distinguish CLI failure, timeout, verifier failure, unexpected files, and marker mismatch.

## Safety, cost, and stop conditions

- Run only inside temporary fixture copies; never point either agent at the repository root as its writable target.
- Disable network inside experiment cases and grant only the minimum workspace-write capability needed for the two allowed files and the local Node verifier.
- Use one invocation per case, CLI-default model and effort, and a finite per-case timeout. Do not repeat failures automatically.
- Do not read or copy credential files. Record only authentication success/failure, sanitized CLI versions, and redacted events.
- Do not perform Git operations, dependency installation, publishing, external messaging, or production access.
- Stop and mark the experiment inconclusive or failed if authentication is unavailable, a CLI version/status check fails, a timeout occurs, a protected path changes, an unexpected file changes, the verifier cannot run, or redaction cannot be guaranteed.
