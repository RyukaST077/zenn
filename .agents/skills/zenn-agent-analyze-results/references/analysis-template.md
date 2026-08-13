# Agent result analysis contract

Near the top include exactly:

```text
verdict: confirmed|conditional|not-reproduced|unsupported|inconclusive
action: draft|rerun|stop
```

Then include:

## Evidence analysis

- claim, conditions, and case matrix
- deterministic results
- observed facts and their evidence paths
- external facts and citations
- interpretation and alternative explanations
- comparison with the pre-registered expectation
- limitations
- reusable recipe present in successful evidence
- unsafe or unsupported variants
- article-safe facts

## Editorial brief

- one concrete reader and situation
- reader problem
- one-sentence article promise and takeaway
- coverage gap filled beyond official documentation or existing articles
- article type: `how-to`, `practice-validation`, `failure`, `new-feature`, `configuration-harness`, or `comparison`
- why the result matters in real work
- practical decision rule and practical mapping from fixture signals to real tasks
- an evidence-led story arc using only recorded motivation, expectation, observations, and interpretation
- body evidence that directly advances the reader's decision
- reproducibility or audit details to move to a later section or appendix
- two or three concrete, non-clickbait title candidates
- unsupported angles, emotions, comparisons, and generalizations to avoid

Every empirical statement must identify an evidence path. Do not invent first-person experience or claim surprise without a recorded expected-result contrast.
