# Research Workflow

Use this reference to control scope, evidence quality, and uncertainty while creating an initial
learning note.

## 1. Define the retrieval outcome

Write one private sentence describing what reopening the note should let the learner explain,
compare, decide, or diagnose. Derive one to three concrete outcomes from it.

Separate:

- prerequisite knowledge needed to follow the mechanism
- core concepts and relationships required by the outcome
- implementation detail that proves or illustrates the mechanism
- optional depth that belongs under `関連する深掘り`
- adjacent subjects that are out of scope for this page

Prefer one coherent question over an encyclopedia page. Split only when subtopics answer
independent retrieval questions or have meaningfully different update cadences.

## 2. Build the whole-topic map

Map the topic before drafting prose:

1. Identify the larger system or problem domain.
2. List components, actors, artifacts, and state.
3. Assign each component a responsibility and boundary.
4. Identify a stable classification axis.
5. Place the target concept on that axis.
6. Trace the normal flow, lifecycle, or decision rule.
7. Add constraints, trade-offs, exceptions, and failure modes beside their causes.

When a term is used before its role is clear, move the prerequisite earlier instead of adding
scattered parenthetical definitions.

## 3. Prioritize sources

Use the strongest available source for the claim:

1. normative specification, standard, or protocol
2. official product or project documentation
3. official repository, source code, release note, or issue
4. original research paper or authoritative technical report
5. maintainer-authored explanation
6. reputable secondary explanation

Use a secondary source when it provides useful context or a clearer example, but verify decisive
behavior against primary or official evidence when available. Do not cite search-result snippets
as evidence.

For changing products or services, capture the relevant version, release channel, document date,
and access date in working notes. Put dates in the page only when they materially bound the claim.

## 4. Classify every material claim

Keep four categories distinct:

| Category          | Meaning                                                             | Page treatment                                                |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Verified fact     | Directly supported by a reliable source or inspected implementation | State normally and place the source near the relevant section |
| Inference         | A conclusion derived from multiple facts but not stated directly    | Introduce as an inference and identify the supporting facts   |
| Explanatory model | A deliberate simplification, analogy, or conceptual frame           | Label it as a model and state where it stops matching reality |
| Unresolved        | Evidence is missing, conflicting, version-bound, or inaccessible    | Mark `（要確認）` and keep it out of conclusions              |

Never convert a plausible inference into a sourced fact. Never describe generated prose as the
user's understanding.

## 5. Resolve conflicts

When sources disagree, check in this order:

1. whether they describe the same object, edition, or deployment mode
2. version and publication or update date
3. normative requirement versus implementation behavior
4. default behavior versus an optional configuration
5. steady state versus migration, failure, or compatibility mode
6. security or trust assumptions

If the conflict remains, preserve both bounded claims and mark the unresolved decision
`（要確認）`. Do not average conflicting statements.

## 6. Place evidence

Put a source where it helps the reader evaluate the associated claim:

- Start a related section with `Doc:` for documentation, specifications, standards, repositories,
  and papers.
- Start a related section with `API:` for API reference material.
- Use `## References` only for material that informs the page as a whole or several sections.
- Prefer stable canonical URLs.
- Paraphrase in your own words and quote only the minimum text needed for precision.

A list of URLs at the end does not repair unsupported causal claims in the body.

## 7. Stop research deliberately

Stop the main investigation when:

- each learning outcome has a supported explanation
- the whole-topic map has no unexplained core component
- the main mechanism or decision rule can be traced end to end
- decisive comparisons use explicit axes
- constraints and common failure paths are represented
- remaining gaps are optional depth or explicitly marked `（要確認）`

Move attractive but nonessential branches to `関連する深掘り` instead of expanding the page
without limit.
