---
name: zenn-agent-revise-article
description: Revise an explicit AI coding-agent Zenn article from an explicit evidence and editorial review while staying within recorded research, analysis, and run evidence. Use for structural rewriting, retitling, compression, reader-value improvements, reproducibility, citations, commands, limitations, or slug issues; never manufacture experience, experiments, or publication state.
---

# Revise an AI coding-agent article

1. Use only the supplied article, review, analysis, and execution log. Confirm they describe the same practice.
2. Address every blocker and warning that existing evidence can resolve. Use the editorial brief and category scores to improve the weakest dimensions first. Preserve `published: false`.
3. If the review verdict is `rerun` or new evidence is required, do not simulate it; return `abort` with the precise need.
4. Make the smallest scope of evidence-backed change, not the smallest textual diff. Retitle, rewrite the opening, reorder or merge sections, remove repetition, move audit detail later, strengthen practical mapping, and rewrite the conclusion when required by the review.
5. Keep claims proportional to the run count and conditions. Correct recipes to match successful recorded commands and configuration exactly. Never add an anecdote, emotion, surprise, or first-person judgment absent from recorded sources.
6. If a slug changes, atomically update the article path, related images, and image references.
7. Run `bash scripts/check-article.sh <article> --expect-published false`.
8. Create `logs/agent/revise-<slug>-YYYYMMDD-HHMM.md` using [revision-log.md](references/revision-log.md).
9. End with only the pipeline result object. Set `artifact` to the revised article path.
