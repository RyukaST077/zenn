---
name: zenn-consult-knowledge
description: Search the repository knowledge directory for prior confirmed fixes to a non-trivial development failure. Use proactively during Zenn practice when a command, dependency, test, build, browser, or configuration problem occurs, or when asked to check known solutions.
---

# Consult troubleshooting knowledge

1. Extract 3-6 high-signal terms: exact error token, tool, library, and symptom.
2. Search `knowledge/INDEX.md` and `knowledge/*.md` with `rg -i`, ranking exact error tokens and matching technology tags first.
3. Read the most relevant reports and compare environment, versions, symptoms, and confirmed cause.
4. Apply a recorded fix only when its preconditions match. Treat it as evidence, not authority.
5. Report the matched report paths and applicability briefly. If nothing applies, say so and continue normal diagnosis.
6. Do not modify knowledge files or Git state.
