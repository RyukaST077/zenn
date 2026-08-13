---
name: zenn-agent-search-knowhow
description: Research current, article-worthy, testable Claude Code and OpenAI Codex practices for Zenn. Use for AI coding-agent know-how discovery, model or CLI release research, CLAUDE.md or AGENTS.md guidance, hooks, skills, subagents, permissions, long-running workflows, harness engineering, or selecting one locally verifiable practice that resolves a concrete reader decision.
---

# Search AI coding-agent know-how

1. Follow explicit topic and product constraints from the prompt. Otherwise consider Claude Code and Codex practices broadly.
2. Inspect `articles/*.md` and prior `research/agent/` reports to exclude substantively duplicated topics. Identify what current official documentation and strong existing articles already answer so the proposed article has a specific remaining gap.
3. Use live web search. For product behavior, prefer current official documentation, release notes, and primary engineering sources. Community sources may supply hypotheses, but never relabel them as official recommendations.
4. Select one concrete reader, one practical uncertainty, and one falsifiable claim that can be checked locally with the authenticated `claude` or `codex` CLI. State what the reader should be able to decide or do after reading. Supported modes are `smoke`, `recipe`, `ablation`, `boundary`, `workflow`, `failure`, and `comparison`.
5. Prefer a claim whose local test can add a boundary, failure mode, tradeoff, decision rule, or reproducible workflow beyond an official feature summary. Reject a topic when the likely article would only restate documentation or present a toy result with no credible practical mapping.
6. Choose the likely article type: `how-to`, `practice-validation`, `failure`, `new-feature`, `configuration-harness`, or `comparison`. Comparison is optional and must not be selected merely because two providers are available.
7. Reject topics that require exposing credentials, modifying production systems, unbounded spend, manual CAPTCHA, or evidence the local environment cannot produce.
8. Create `research/agent/agent-knowhow-<topic>-YYYYMMDD-HHMM.md` using [report-template.md](references/report-template.md). Record URLs, publication or update dates, access dates, exact claim wording or a clearly marked paraphrase, competing guidance, reader problem, article promise, coverage gap, likely article type, practical mapping, and a minimal verification idea.
9. Do not execute the practice, create a plan, or draft an article.
10. End with only the pipeline result object. Set `artifact` to the report path. Abort rather than inventing a source, testable claim, or reader need.
