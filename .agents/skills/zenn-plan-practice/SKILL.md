---
name: zenn-plan-practice
description: Convert an explicit Zenn topic research report into a safe, reproducible hands-on verification plan. Use for the pipeline plan stage or when asked to turn research/search-topic-*.md into a bounded practice task without executing it or drafting an article.
---

# Plan the practice

1. Use only the research report path explicitly supplied by the prompt. Abort if it is missing, outside `research/`, or does not identify one selected topic.
2. Inspect local tool availability and project constraints without installing dependencies or performing the verification.
3. The run stage executes inside the Codex `workspace-write` sandbox. Known environment constraints observed in past runs: launching real browsers fails (Playwright with both system Chrome and bundled Chromium could not create a browser context — do not plan browser-launch verification); `brew` and other system-level installs are unavailable; `deno upgrade` is disabled in Homebrew Deno builds. Docker (`docker pull` / `docker run`) has worked. When a specific runtime version is required, prefer the official Docker image or download the official release archive (e.g. nodejs.org/dist, dl.deno.land) into the run workspace and execute that isolated binary directly.
4. Design a small reproducible experiment with success criteria, failure criteria, exact commands, expected evidence, cleanup, security limits, timebox, and fallback scope.
5. Require all work to occur under a new `logs/run-<topic>-<timestamp>/work/` directory. Never plan Git changes to this repository.
6. Create `practice/practice-<topic>-YYYYMMDD-HHMM.md` using [plan-template.md](references/plan-template.md). Preserve the source report path and relevant official URLs.
7. Do not run the experiment or write article prose.
8. End with only the pipeline result object; set `artifact` to the plan path and metadata values to `null`. Abort rather than guessing material missing inputs.
