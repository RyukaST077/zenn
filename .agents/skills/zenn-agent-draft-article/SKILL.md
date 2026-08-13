---
name: zenn-agent-draft-article
description: Draft a reader-centered Zenn Markdown article from an explicit AI coding-agent analysis, editorial brief, and execution log. Use for evidence-based Claude Code or Codex how-to, practice-validation, configuration, failure, workflow, harness, new-feature, or comparison articles; never invent runs, author experience, or publication state.
---

# Draft an AI coding-agent article

1. Use only the supplied analysis and execution log. Resolve their manifest, plan, and source report. Abort unless the analysis action is `draft` and its editorial brief identifies a reader problem, one-sentence takeaway, article type, and evidence-led story arc.
2. Trace product claims to recorded primary sources and empirical claims to the run evidence. Preserve uncertainty and distinguish a case study from a general benchmark. Use first-person motivation, expectation, surprise, or judgment only when it is explicitly supported by the report, plan, or analysis.
3. Choose a unique lowercase slug of 12-50 characters matching `[a-z0-9-]+`; inspect `articles/` for collisions.
4. Create `articles/<slug>.md` using [article-format.md](references/article-format.md). Select the structure for the declared article type instead of serializing the evidence artifacts in pipeline order. Put the reader's problem, answer, and practical value near the beginning; keep one central claim throughout.
5. Include the verification date, CLI versions, material conditions, commands, observations, limitations, and a copyable final recipe when supported, but move audit-only detail later or omit it from the narrative when it does not change a reader decision.
6. Never expose local account identifiers, credential paths beyond generic documented locations, tokens, session IDs, or unrelated machine configuration.
7. Run `bash scripts/check-article.sh <article> --expect-published false` and fix deterministic failures without adding unsupported claims.
8. Do not review, revise, publish, or change Git state.
9. End with only the pipeline result object. Set `artifact` to the article path.
