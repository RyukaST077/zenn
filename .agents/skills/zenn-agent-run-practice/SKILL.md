---
name: zenn-agent-run-practice
description: Execute an explicit AI coding-agent experiment manifest with the authenticated Claude Code or Codex CLI and record primary evidence. Use for running planned CLAUDE.md, AGENTS.md, hook, skill, permission, prompt, model, workflow, or harness experiments; never use to draft an article.
---

# Run an AI coding-agent practice

1. Use only the manifest explicitly supplied under `practice/agent/`.
2. Validate it with `node scripts/agent-practice/validate-manifest.mjs <manifest>`. Abort on an unsafe or unsupported case.
3. Execute `node scripts/agent-practice/run-experiment.mjs <manifest>`. The runner owns isolation, CLI invocation, timeout, deterministic verification, file inventory, diff capture, and log redaction.
4. Never read, copy, print, or summarize credential files. Authentication may be checked only through `claude auth status` and `codex login status`.
5. Inspect the generated metrics and execution log for completeness. Preserve decision-relevant failures, recoveries, deviations, warnings, and unexpected observable behavior instead of reducing the run to pass or fail. Do not rewrite failed results into success; partial and negative evidence is valid.
6. Follow [execution-log-contract.md](references/execution-log-contract.md). Record observations only; do not label an event surprising, infer a cause, add subjective experience, or draft an article.
7. End with only the pipeline result object. Set `artifact` to the generated `logs/agent/run-*/execution-log.md` path.
