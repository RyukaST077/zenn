---
name: zenn-draft-article
description: Draft a Zenn Markdown article from an explicit execution log using only recorded evidence and cited primary sources. Use for the pipeline draft stage or requests to turn a logs/run execution-log.md into a slugged article under articles/ with published false.
---

# Draft the article

1. Use only the execution log supplied in the prompt. Resolve its plan and research report references; abort if evidence is too incomplete for a truthful article.
2. Separate verified facts, external facts with citations, interpretations, and limitations. Never fill gaps from memory.
3. Choose a unique lowercase slug of 12-50 characters matching `[a-z0-9-]+`; check `articles/` for local collisions.
4. Create `articles/<slug>.md` following [article-format.md](references/article-format.md). Set `published: false`, use 1-5 topics, and keep the title within 70 characters.
5. Copy only genuinely useful images into `images/<slug>/` and reference them as `/images/<slug>/<file>`. Do not invent screenshots.
6. Run `bash scripts/check-article.sh <article> --expect-published false`; fix deterministic failures without adding unsupported claims.
7. Do not review, publish, or change Git state.
8. End with only the pipeline result object. Set `artifact` to the article, `metadata.slug` to the slug, and other metadata to `null`.
