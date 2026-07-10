---
name: zenn-plan-practice
description: Convert an explicit Zenn topic research report into a safe, reproducible hands-on verification plan. Use for the pipeline plan stage or when asked to turn research/search-topic-*.md into a bounded practice task without executing it or drafting an article.
---

# Plan the practice

1. Use only the research report path explicitly supplied by the prompt. Abort if it is missing, outside `research/`, or does not identify one selected topic.
2. Inspect local tool availability and project constraints without installing dependencies or performing the verification.
3. Design a small reproducible experiment with success criteria, failure criteria, exact commands, expected evidence, cleanup, security limits, timebox, and fallback scope.
4. Require all work to occur under a new `logs/run-<topic>-<timestamp>/work/` directory. Never plan Git changes to this repository.
5. Create `practice/practice-<topic>-YYYYMMDD-HHMM.md` using [plan-template.md](references/plan-template.md). Preserve the source report path and relevant official URLs.
6. Do not run the experiment or write article prose.
7. End with only the pipeline result object; set `artifact` to the plan path and metadata values to `null`. Abort rather than guessing material missing inputs.
