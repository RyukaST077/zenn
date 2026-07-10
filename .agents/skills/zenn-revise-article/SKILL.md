---
name: zenn-revise-article
description: Revise an explicit Zenn article from an explicit review report while staying within the execution log evidence. Use for the pipeline revise stage, including coordinated slug collision renames; do not publish or invent new verification results.
---

# Revise the article

1. Use only the supplied article, review, and execution log. Confirm the review belongs to that article.
2. Address every blocker and warning that existing evidence can resolve. Do not add claims absent from the log or sources.
3. If a slug collision is the issue, choose a unique valid slug and atomically update the article path, `images/<slug>/` directory, and all image references. Do not leave the old generated paths behind.
4. Preserve `published: false` and make the smallest evidence-backed edits.
5. Run `bash scripts/check-article.sh <article> --expect-published false`.
6. Create `logs/revise-<slug>-YYYYMMDD-HHMM.md` using [revision-log.md](references/revision-log.md).
7. Do not publish or change Git state. If new evidence is required, do not simulate it; return `abort` with the reason.
8. End with only the pipeline result object. Set `artifact` to the revised article, `metadata.slug` to its current slug, and other metadata to `null`.
