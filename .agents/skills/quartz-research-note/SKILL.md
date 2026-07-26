---
name: quartz-research-note
description: >-
  Research a new concept or technology and create a sourced, unpublished initial learning note
  for an Obsidian vault published with Quartz 4. Use for requests to investigate a topic, map its
  overall structure and mechanism, or create a new Quartz learning page that can support later
  dialogue. Do not use for questions about an existing note, comprehension checks, paraphrase
  feedback, dialogue-only updates to an existing note, or Quartz and general software
  implementation.
---

# Quartz Research Note

Create an evidence-backed starting page that can mature into a public technical note. Build a
usable model of the topic rather than a chronological research report or finished tutorial.

## Establish repository context

1. Read the repository-root `AGENTS.md`.
2. Before substantial investigation, read `docs/codex/README.md` and the related files it routes
   to.
3. Inspect the worktree and preserve unrelated user changes.
4. Inspect relevant pages under `content/`, their siblings, and the repository's naming and
   frontmatter conventions.
5. Inspect `quartz.config.ts` before choosing publication metadata or using Mermaid, callouts, or
   Wikilinks. Never infer the active publication filter.

Treat every file under `content/` and `attachments/` as potentially public. Do not store private
transcripts, personal identifiers, credentials, confidential URLs, internal-only sources, or
sensitive screenshots there. Do not duplicate general subject research in
`docs/codex/research-log.md`; put subject knowledge in the target page.

Use Slack, Confluence, SharePoint, or another external connector only when the user explicitly
places that source in scope.

## Frame the learning task

Convert the request into one to three concrete outcomes the learner should be able to explain,
compare, decide, or diagnose. Define the in-scope question and the important exclusions.

Use the supplied understanding level and learning goal when present. Otherwise infer a sensible
starting depth from the request and existing notes. Keep optional depth outside the main scope and
offer it under `## 関連する深掘り`.

Do not ask again for choices already fixed by the request or repository. If no destination is
given:

1. Inspect `AGENTS.md`, `content/`, related index pages, and existing slug conventions.
2. Choose the closest natural classification and a descriptive filename.
3. Ask only when two or more placements are materially plausible.
4. Do not choose an unnatural location merely to avoid a question.

## Research the topic

Read [references/research-workflow.md](references/research-workflow.md) before collecting external
evidence.

Use web search when it is available and the topic needs external evidence. If it is unavailable,
state the evidence limitation instead of presenting memory as current verification.

1. Build a whole-topic map: components, classification axes, the target's position, and required
   prerequisites.
2. Investigate why the concept became necessary alongside what it is.
3. Trace causal structure, state or data flow, design constraints, trade-offs, and common failure
   modes one level below surface-level usage.
4. Define stable comparison axes when adjacent concepts can be confused.
5. Prefer specifications, standards, official documentation, official repositories, and original
   papers. Use secondary sources to bridge explanations, not to replace accessible primary
   evidence.
6. Reconcile apparent conflicts by checking version, date, scope, and assumptions.
7. Mark claims that cannot be verified as `（要確認）`; never fill a gap with an unlabeled guess.
8. Label causal explanations not stated by a source as an inference or explanatory model.

For products, services, APIs, laws, standards, or other changing subjects, verify the current
version and record the confirmation date where it affects interpretation. Summarize sources in
your own words and avoid long quotations.

## Synthesize the initial page

Read [references/note-outline.md](references/note-outline.md) before drafting.

Create one consolidated Markdown page under `content/` unless the scope clearly requires a hub and
detail pages. The initial page is a grounded draft for later dialogue, not a transcript, research
log, or claim of completed understanding.

- Put the title in frontmatter and do not add a body-level `#` heading.
- Set `date` and `modified` to the creation date.
- Keep the initial page unpublished. With `RemoveDrafts`, set `draft: true`. With
  `ExplicitPublish`, do not set `publish: true`.
- Follow existing frontmatter order, tags, aliases, slug, URL, and directory-local formatting.
- Use plain-form Japanese (`常体`) for Japanese pages.
- Never call generated text the user's understanding unless the user has stated it in their own
  words and it has been checked.
- Put verified facts, explicit inference, explanatory models, and unresolved points in visibly
  distinct forms.
- Place `Doc:` or `API:` at the start of the section whose claims the source supports. Reserve
  `## References` for sources that support the page as a whole.
- Use only the outline sections that answer the learning outcomes. Do not force a fixed template.
- Use a comparison table when stable shared axes clarify similar concepts.
- Use a Mermaid diagram only when relationships or flow become materially clearer and the active
  Quartz configuration supports it.
- Add an image only after checking public suitability, license, confidentiality, and repository
  placement. Do not automatically download external images into `attachments/`.

Do not start tutoring inside this workflow. Questions about an existing note, comprehension
checks, paraphrase feedback, and incorporation of confirmed dialogue belong to
`quartz-learning-tutor`.

## Validate

Determine the active publication filter, then run the bundled checker:

```shell
python3 .agents/skills/quartz-research-note/scripts/check_learning_note.py \
  --publication-filter remove-drafts \
  content/path/to-note.md
```

Use `explicit-publish` instead when that filter is active. The checker verifies frontmatter and
its basic order, publication-state safety, body H1 headings, and language-less fenced code blocks.

Then:

1. Run the checks required by `AGENTS.md`.
2. Run `npx quartz build` for frontmatter, links, images, or rendering changes.
3. Inspect the relevant diff and run `git diff --check`.
4. Confirm that no unrelated file was changed by this task.
5. Keep any unverified claim visibly marked and report any validation that could not run.

## Handoff

Lead with the created page. Report:

- its path and selected classification
- the one to three learning outcomes and main scope boundary
- important source/version assumptions
- unresolved `（要確認）` items
- checks run, results, and any unverified scope

Do not change publication state during handoff. Publication is a later phase requiring explicit
user approval.
