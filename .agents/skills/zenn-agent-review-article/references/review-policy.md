# AI coding-agent review policy

Review publication integrity and editorial quality separately. Strong evidence does not compensate for an article that gives the reader no useful decision, and polished prose does not compensate for unsupported claims.

## Publication integrity gates

- Blocker: fabricated or contradicted result; fabricated author experience; secret exposure; unsafe command presented without boundaries; missing core evidence; mismatched artifacts; broken article format; or materially misleading publication.
- Warning: missing material version or date; uncited product fact; command or configuration mismatch; hidden local assumption; insufficient limitation; one-run generalization; community guidance labeled official; deterministic check failure; correctable reproducibility gap; or a recommendation stronger than the evidence.
- Suggestion: optional improvement that does not affect truthfulness, reader value, or the score threshold.

## Editorial quality rubric

Score each category with a short reason tied to article locations and the editorial brief.

1. Reader problem and promise — 20 points
   - One concrete reader and situation are clear.
   - The opening establishes the problem, answer, and value without generic preamble.
2. Insight and original value — 20 points
   - The central takeaway adds a verified boundary, tradeoff, failure mode, workflow, or decision rule beyond source summarization.
   - The takeaway is specific enough to be disproved and remains visible throughout the article.
3. Explanation and story — 15 points
   - Motivation, expectation or question, experiment, result, interpretation, and changed decision form a coherent causal path when the evidence supports them.
   - Prerequisites and caveats appear where they help understanding rather than following pipeline order.
4. Evidence and reproducibility — 20 points
   - Decision-relevant code, output, diff, and conditions appear close to their claims.
   - Facts, interpretations, uncertainty, and small-run limits are distinguishable; audit-only detail does not overwhelm the main argument.
5. Practical action — 15 points
   - The reader receives a copyable next step, practical mapping, and a clear use, avoid, or investigate-further rule.
6. Readability and authorial judgment — 10 points
   - The title and headings communicate concrete value, paragraphs advance the argument, repetition is limited, and tables or lists clarify real relationships.
   - Evidence-backed judgment is visible without invented anecdotes, emotions, or false first-person experience.

Editorial findings are warnings when existing evidence permits an edit and the total is below 80/100 or any category earns less than half its points. Do not award points for length, number of headings, code-block count, or mechanically including every evidence field.

## Verdicts

- `pass`: zero blockers, zero warnings, editorial score at least 80/100, and at least half credit in every category.
- `fix`: all blockers and warnings, including editorial threshold failures, can be resolved from existing evidence by rewriting, restructuring, compressing, retitling, or clarifying.
- `rerun`: new execution evidence is required for an otherwise valuable and viable article.
- `blocker`: safe, truthful, and sufficiently useful publication cannot be reached within the supplied scope.
