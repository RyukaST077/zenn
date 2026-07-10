---
name: zenn-run-practice
description: Execute an explicit Zenn practice plan in an isolated run directory and record commands, outputs, failures, and verified observations as primary evidence. Use for the pipeline run stage or requests to execute practice/practice-*.md; never use to draft or publish an article.
---

# Run the practice

1. Use only the supplied plan under `practice/`. Abort if it is absent or unsafe.
2. Create `logs/run-<topic>-YYYYMMDD-HHMM/work/` and perform all generated project work there. `git init` or clone is allowed only inside this work directory.
3. Execute the plan non-interactively. Respect its time, cost, network, and cleanup limits. Never expose credentials and never change this repository's Git state.
4. On a non-trivial failure, use `$zenn-consult-knowledge` once before further diagnosis. Continue with a bounded fallback when the original plan permits it.
5. Record exact commands, relevant redacted outputs, versions, timestamps, expected versus actual results, failed attempts, file inventory, and unresolved gaps in `execution-log.md`. Do not claim unobserved success.
6. Use [execution-log-template.md](references/execution-log-template.md). Partial or negative results are valid evidence when clearly labeled.
7. Do not create article content.
8. End with only the pipeline result object. Use the execution log as `artifact`; return `abort` only when no usable evidence was produced or safety requires stopping.
