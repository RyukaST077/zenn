# Reader-centered AI coding-agent article format

Use YAML front matter with `title`, `emoji`, `type: tech`, `topics`, and `published: false`. Keep the title at most 70 characters and use 1-5 topics.

## Core editorial contract

- Write for the one reader and problem named in the editorial brief.
- Keep one central takeaway that gives the reader a decision, action, boundary, or reusable mental model beyond an official feature summary.
- Make the opening establish the concrete problem, the answer, and what was actually tested. Prefer the first several paragraphs over a generic `対象読者` or `はじめに` section.
- Show the headline result before long source, environment, or command inventories.
- Place each important code sample, output, diff, or table close to the claim it supports.
- Explain why an observation matters and distinguish observation, interpretation, recommendation, and uncertainty.
- Preserve only detail that changes understanding or enables reproduction. Move audit-only flags, complete conditions, and secondary warnings to a later reproducibility section or appendix.
- Use headings that express reader questions or claims rather than pipeline labels such as `主張と公式情報` or `観測結果` when a more specific heading is possible.
- Include an honest practical mapping when the experiment uses a fixture, marker, or toy task.
- End with a concrete decision rule or next action, not a repetition of the introduction.
- Put citations close to external claims. Label single or small runs as a case study, not a universal benchmark. Include only recipes present in successful recorded cases.
- Do not invent an anecdote, prior belief, emotion, surprise, or personal recommendation. Authorial voice must come from recorded motivation, expected outcomes, observed friction, and evidence-backed judgment.

## Choose a shape by article type

Do not force every heading below. Use the smallest coherent shape for the evidence.

- `how-to`: concrete goal and result; minimal working steps; why each important step exists; common failure or boundary; copyable recipe; when to use it.
- `practice-validation`: practical uncertainty and conclusion; minimal experiment design; decisive results; interpretation and alternatives; decision rule; limits and reproduction details.
- `failure`: symptom and impact; investigation; failed or misleading approaches; confirmed cause; fix; verification; prevention and remaining uncertainty.
- `new-feature`: what changed and why it matters; first verified behavior; hands-on procedure; differences from the prior workflow; adoption recommendation; freshness and limits.
- `configuration-harness`: failure mode; design principle; minimal configuration; behavioral verification; real-work mapping; safety boundary; adoption checklist.
- `comparison`: reader decision; fair criteria and controlled setup; results by criterion; tradeoffs; recommendation by use case; fairness and run-count limits.

## Required technical material

Include the verification date, material CLI and model information that was actually recorded, conditions required to interpret the result, decisive commands or configuration, observed outcome, limitations that affect the recommendation, and references. Exact placement depends on the article type. Do not front-load them merely because they appear first in the evidence artifacts.
