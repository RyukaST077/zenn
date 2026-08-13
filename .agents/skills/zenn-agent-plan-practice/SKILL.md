---
name: zenn-agent-plan-practice
description: Convert an explicit AI coding-agent know-how report into a safe, reproducible Claude Code or Codex experiment manifest and, when necessary, a minimal deterministic fixture. Use for planning tests of CLAUDE.md, AGENTS.md, hooks, skills, permissions, prompts, models, subagents, harnesses, or other agent practices without executing them.
---

# Plan an AI coding-agent practice

1. Use only the report path explicitly supplied under `research/agent/`. Abort if it is missing or does not identify one claim.
2. Inspect `fixtures/agent-practice/` and reuse the smallest fixture that can falsify the claim without distorting it. If none fits, create one minimal self-contained fixture under `fixtures/agent-practice/<topic>/` and any product guidance under `fixtures/agent-practice/guidance/<topic>/`. Do not modify an unrelated shared fixture to fit the claim.
3. Choose one supported mode: `smoke`, `recipe`, `ablation`, `boundary`, `workflow`, `failure`, or `comparison`. Product comparison is optional; prefer the fewest cases that answer the claim.
4. Keep a new fixture deterministic and offline: use only runtimes already present in the repository environment; require no dependency installation, external service, secret, user data, symlink, daemon, browser login, or production state. Start from a bounded input and include a verifier with an objective exit status. Store no generated run output in the fixture.
5. Preserve the report's reader problem and article promise. Pre-register the expected outcome, the competing outcome that would change the recommendation, and the practical decision the evidence can support. Do not design cases to manufacture a dramatic result.
6. Define exact providers, guidance overlays, prompt, verification command, assertions, timeouts, model overrides if required, isolation, network policy, cost limit, and redaction requirements. Treat manifest `network` as Codex workspace-sandbox enforcement only; explicitly record that the host-run Claude branch is not network-isolated.
7. Create a human-readable sibling plan and a machine manifest under `practice/agent/` using [plan-template.md](references/plan-template.md) and [manifest-contract.md](references/manifest-contract.md). Use the manifest as the primary artifact.
8. Run `node scripts/agent-practice/validate-manifest.mjs <manifest>` and fix every validation error. When a new fixture was created, inspect its paths and verifier statically but do not execute the practice or claim the verifier passed.
9. Do not invoke `claude`, `codex`, or write article prose.
10. End with only the pipeline result object. Set `artifact` to the repository-relative manifest path.
