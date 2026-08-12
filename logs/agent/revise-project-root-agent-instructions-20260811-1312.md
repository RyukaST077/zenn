# Revision: project-root-agent-instructions

## Sources

- Article: `articles/project-root-agent-instructions.md`
- Review: `logs/agent/review-project-root-agent-instructions-20260811-1309.md`
- Analysis and editorial brief: `logs/agent/analysis-project-instruction-loading-20260811-1307.md`
- Execution log: `logs/agent/run-project-instruction-loading-20260811-1133-20260811-113714/execution-log.md`
- Manifest: `practice/agent/agent-practice-project-instruction-loading-20260811-1133.json`
- Revision time: 2026-08-11 13:12 JST

## Original editorial score

- Total: 63/100
- Reader problem and promise: 11/20
- Insight and original value: 11/20
- Explanation and story: 8/15
- Evidence and reproducibility: 19/20
- Practical action: 9/15
- Readability and authorial judgment: 5/10

## Finding dispositions

### Warning 1: documentation-led opening

- Disposition: resolved.
- Edit: changed the title from a yes/no product question to the verification-harness outcome; removed the generic `対象読者` opening; opened with the ambiguity between main-task success and project-only instruction compliance; stated the four-case result and decision rule before setup detail.
- Evidence: editorial brief reader problem, promise, takeaway, candidate title, and four case metrics/diffs.

### Warning 2: pipeline-shaped structure

- Disposition: resolved.
- Edit: moved the result table immediately after the introduction; followed it with the common-prompt versus guidance-only condition and the harness explanation; moved official documentation, exact environment, safety conditions, and limitations later.
- Evidence: editorial brief story arc and body/appendix evidence split; execution log and manifest.

### Warning 3: weak reusable mapping and unsafe historical command prominence

- Disposition: resolved.
- Edit: added the five-part product-neutral harness pattern and a fixture-to-real-work mapping table; retained the deterministic repository runner entry point; removed the full product CLI command blocks from the main narrative; preserved the recorded `bypassPermissions` condition only as an explicit historical safety warning.
- Evidence: analysis reusable recipe and practical mapping; manifest verification contract; both Claude `command.json` files; prior safety review.

### Warning 4: repeated limitations and weak ending

- Disposition: resolved.
- Edit: consolidated scope limits into one section; removed the Codex exploration failure and state-database warning from the main article because they do not change the reader's decision; replaced the recap-style conclusion with the guidance-versus-enforcement decision rule.
- Evidence: analysis expectation comparison, unsupported angles, later-audit details, and takeaway.

## Evidence preservation

- Preserved the exact four case outcomes, run count, CLI versions, common prompt, guidance content, protected-path result, and unexpected-change result.
- Preserved the distinction between behavioral evidence and direct internal-context observation.
- Preserved the lack of reliability, performance, cost, quality, and provider-superiority evidence.
- Preserved the recorded Claude isolation weakness and did not turn `bypassPermissions` into a recommended template.
- Deleted only audit-only narrative detail from the article body. Raw commands, Codex warnings, events, metrics, verifiers, and diffs remain under the original run directory.
- Added no new execution result, personal anecdote, emotion, surprise, or unrecorded model information.

## Slug and images

- Old slug: `project-root-agent-instructions`
- New slug: `project-root-agent-instructions`
- No image directory or image references were present, so no path migration was needed.

## Deterministic check

Command:

```bash
bash scripts/check-article.sh articles/project-root-agent-instructions.md --expect-published false
```

Result:

```text
OK: articles/project-root-agent-instructions.md (slug=project-root-agent-instructions, published=false)
```

## Unresolved items

- Editorial pass status remains pending a new review against the revised article.
- The underlying experiment remains a one-run-per-case behavioral case study with unresolved backend model snapshots and no OS-level isolation for the recorded Claude cases.
