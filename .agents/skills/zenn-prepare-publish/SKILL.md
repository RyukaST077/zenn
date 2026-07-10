---
name: zenn-prepare-publish
description: Prepare an explicitly reviewed Zenn article for publication by switching published to true and creating PR metadata, without performing Git or GitHub operations. Use only for the pipeline prepare-publish stage after a passing review.
---

# Prepare publication

1. Use only the supplied article, passing review report, and pipeline directory. Confirm the review has exactly one `verdict: pass` line, zero blockers, and zero warnings.
2. Run the draft article check. Abort on any failure, placeholder, or evidence mismatch.
3. Change only front matter `published: false` to `published: true`. Do not edit the body, slug, or images.
4. Run `bash scripts/check-article.sh <article> --expect-published true`.
5. Create `<pipeline-dir>/pr-body.md` from [pr-template.md](references/pr-template.md), then `<pipeline-dir>/pr-metadata.json` containing only `title` and the repository-relative `body_file`. Keep the title non-empty and the body file inside this pipeline directory.
6. Never run Git or GitHub mutation commands.
7. End with only the pipeline result object. Set `artifact` to the article, `metadata.slug` to its slug, `metadata.pr_metadata` to the JSON path, and `metadata.verdict` to `null`.
