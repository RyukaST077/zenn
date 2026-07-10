---
name: zenn-save-knowledge
description: Save a newly resolved non-trivial development failure from Zenn practice as a redacted, searchable report under knowledge/. Use after confirming a cause and fix for a command, build, test, dependency, browser, or configuration problem; do not use for generic notes.
---

# Save troubleshooting knowledge

1. Use only evidence already present in the execution session and log. In non-interactive mode, skip saving when cause or verification is materially uncertain.
2. Search `knowledge/` for duplicates. Append only when the existing report covers the same cause; otherwise create `knowledge/YYYY-MM-DD-<slug>.md`.
3. Redact tokens, cookies, personal data, private hosts, and irrelevant output before writing.
4. Follow [knowledge-format.md](references/knowledge-format.md). Clearly separate confirmed cause, failed attempts, final fix, and verification.
5. Add or update the newest-first entry in `knowledge/INDEX.md`.
6. Do not change Git state. Knowledge output is auxiliary and must never replace the current stage's primary artifact or pipeline result.
