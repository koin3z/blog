---
name: knowledge-note-structuring
description: Transform existing Markdown and Obsidian technical notes in this Quartz repository into structured personal knowledge notes. Use this skill whenever the user asks to reorganize, rewrite, consolidate, split, or improve a page under `content/`; when facts are present but their relationships, causal order, comparison axis, or retrieval path are unclear; or when a note should gain the coherence of a technical article without adopting blog-style narration. Preserve verified facts, sources, uncertainty, and stable URLs while following the repository's `AGENTS.md`.
---

# Knowledge Note Structuring

## Purpose

Turn a page from a sequence of collected facts into a reusable model that supports later recall and judgment.

Do not imitate the surface form of a blog article. Reuse its deeper ordering principles: establish scope, introduce concepts before they are used, connect components through flows or decisions, and place evidence next to the claim it supports.

## Repository context

Before substantial work:

1. Read the repository-root `AGENTS.md`.
2. Read `docs/codex/README.md`, then inspect related entries in `research-log.md`, `decisions.md`, or `troubleshooting.md`.
3. Read the target page, relevant sibling pages, and pages that link to it.
4. Check the worktree and preserve unrelated user changes.
5. Read [references/structure-patterns.md](references/structure-patterns.md) before choosing an outline.

Repository instructions override this skill when they conflict.

## Define the note before editing

Write a private one-sentence retrieval question: what should the user be able to explain, compare, decide, or diagnose after reopening this note?

Inventory the existing material under these roles:

- scope and purpose
- components or actors
- artifacts, identifiers, and state
- relationships and ownership boundaries
- normal processing or lifecycle
- variants and decision boundaries
- constraints, failure modes, and exceptions
- evidence, examples, and sources
- unknown or unverified claims

Choose one primary organizing axis. A page ordered simultaneously by product, chronology, API, and personal discovery history becomes hard to scan. Make the other axes subordinate sections, tables, or linked notes.

## Choose a structure

Select the archetype that best matches the retrieval question. Combine two only when one is clearly primary.

| Archetype                  | Primary question                                                    | Default dependency order                                                                              |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Concept or mechanism       | Why does this behavior occur?                                       | role and boundary → components and state → relations → processing rule → observable behavior → limits |
| Protocol or flow           | Who exchanges what, in which trust boundary?                        | purpose and scope → actors → artifacts → normal flow → validation → variants → attacks and errors     |
| Product or service         | What responsibility does this service take, and how is it operated? | role → responsibility boundary → resource model → lifecycle → operations → limits → adjacent services |
| Comparison or selection    | Which option fits which conditions?                                 | decision boundary → comparison matrix → option details → constraints → selection consequences         |
| Procedure or investigation | How is an outcome produced and verified?                            | goal → prerequisites → steps → expected observations → failure branches → rollback or next checks     |

Do not force every heading into every page. A heading earns its place only when it answers part of the retrieval question.

## Build causal order

Arrange material so that each section depends mainly on concepts already introduced:

1. State the page's role, scope, and important distinction.
2. Name the components, actors, or options and assign each one a responsibility.
3. Define artifacts and state that move between or belong to those components.
4. Show the normal flow, lifecycle, or evaluation rule.
5. Explain variants by identifying the one condition that changes the result.
6. Place constraints, threats, failure modes, and operational consequences next to the mechanism that causes them.
7. Keep implementation evidence, commands, payloads, and source excerpts after the abstract rule they demonstrate.

When a later section repeatedly needs undeclared terms, move their definitions earlier rather than adding local parenthetical explanations.

## Convert article expression into personal-note expression

- Remove greetings, hooks, audience address, writing-process commentary, and promises about what will be explained
- Replace rhetorical questions with short noun-phrase headings such as `クライアント種別` or `認可コードの役割`
- Replace story-shaped examples with compact scenarios that expose a boundary, state change, or decision rule
- Remove summaries that merely restate preceding bullets; retain conclusions that support a future choice
- Keep an explicit scope boundary only when it prevents the note from being misapplied
- Use a comparison table when three or more similar concepts share stable comparison axes
- Give each fact one primary representation. When a table already carries a mapping or comparison, follow it only with causality, exceptions, or consequences that the cells cannot express; do not restate each row as prose or bullets
- Use a Mermaid diagram only when relationships among at least three components or a branching flow are materially clearer than prose
- Introduce an image with the fact the reader should extract from it
- Keep official documentation beside the related claim using the repository's `Doc:` or `API:` convention
- Preserve `（要確認）` and `> [!NOTE] 要確認`; never smooth uncertainty into a confident statement

The target is a retrieval-oriented memo, not a miniature textbook. Prefer precise bullets and small tables over narrative transitions.

## Preserve meaning and repository identity

- Preserve the original `date`, stable filename, aliases, tags, links, code examples, and image references unless the task requires a change
- Update `modified` when the page content changes materially
- Keep the frontmatter order and Markdown conventions defined in `AGENTS.md`
- Do not add a body `#` heading
- Do not silently add technical claims during a structure-only rewrite
- If a claim is time-sensitive, contested, or would become more definite through rewording, verify it with a primary source or leave it explicitly unverified
- Separate factual correction from structural movement in the handoff so the user can review each kind of change
- Check incoming links before moving or splitting a stable page

## Decide whether to split a page

Keep one page when the sections answer one retrieval question and share a common update cadence.

Prefer a hub plus detail notes when at least one of these conditions is true:

- the page answers several independent retrieval questions
- readers must compare choices before they need implementation detail
- sections have different source sets or update cadences
- each major section has its own lifecycle, constraints, or failure modes
- the same details are needed from several overview pages

Preserve the established URL as the hub when it already has incoming links. Do not create thin detail pages that only repeat the hub.

## Transformation workflow

1. Audit the target without editing it.
   - Record the retrieval question, primary archetype, useful facts, duplicates, missing prerequisites, and uncertain claims.
2. Draft a dependency outline.
   - Map every existing fact to a destination or mark it as duplicate, unrelated, or unresolved.
3. Decide whether the request is structure-only or includes research.
   - Structure-only work preserves claims and uncertainty.
   - Research work verifies decision-relevant claims using primary sources.
4. Rewrite the smallest useful scope.
   - Prefer reorganizing the existing page before expanding into sibling pages.
5. Run the structural review in [references/structure-patterns.md](references/structure-patterns.md).
   - Compare every table with the paragraphs and bullets immediately around it, and remove one-to-one restatements.
6. Run formatting and build checks in proportion to the changed files, following `AGENTS.md`.
7. Update Codex reuse knowledge only when the work produced repository-specific findings or decisions that will matter later.

## Handoff

Lead with the result. Report:

- the archetype and primary organizing axis used
- whether files were kept together or split, and why
- factual corrections separately from structural changes
- unresolved or unverified claims
- checks run and any unverified scope
- whether Codex reuse knowledge was updated

After explaining an important new concept, ask one short recall question that requires the user to paraphrase the mechanism or decision boundary. Do not provide its answer until the user responds.
