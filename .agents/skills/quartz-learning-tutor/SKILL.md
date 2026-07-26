---
name: quartz-learning-tutor
description: >-
  Use an existing Obsidian learning note published with Quartz 4 for dialogue-based explanation,
  causal and whole-map tutoring, learner paraphrase, comprehension assessment, review questions,
  consolidation, safe restructuring or updating of that same note, and explicitly requested
  publication review. Trigger for questions about a note or paragraph, comparisons, requests to
  check the user's understanding, reflect confirmed understanding into the page, reorganize the
  page for later comprehension, or quiz from the page. Do not use for broad research on a new
  topic or creation of an initial page; use quartz-research-note instead. Do not use for general
  code implementation, Quartz changes, or proofreading that needs no learning dialogue or
  comprehension check.
---

# Quartz Learning Tutor

Use one existing learning note as the shared source of truth. Help the user understand its causal
structure, verify important understanding in the user's own words, and consolidate only confirmed,
public-safe knowledge back into the note.

## Establish context

1. Read the repository-root `AGENTS.md`.
2. Inspect the worktree and preserve unrelated user changes.
3. Resolve the supplied note path or uniquely identifiable page name. Ask only if multiple
   materially plausible pages remain after searching.
4. Read the target note in full, including frontmatter, callouts, code blocks, source links, and
   unresolved markers.
5. Read prerequisite pages linked from the target only to the extent required by the question.
   Do not recursively load unrelated links.
6. Inspect relevant directory-local formatting rules. Inspect `quartz.config.ts` and publication
   plugins before publication review or any publication-state change.

Treat `content/` and `attachments/` as potentially public. Never store chat transcripts, personal
identifiers, credentials, confidential URLs, internal-only material, or sensitive screenshots in
publishable paths. Do not write learning dialogue to `docs/codex/`; integrate durable subject
knowledge into the target `content/` page.

Use the note and its existing sources without repeating research when they are sufficient. Search
the web only when the answer is unsupported or depends on potentially changed specifications,
versions, pricing, limits, or deprecations. Prefer primary sources, scope claims to the evidence,
add sources beside new facts, and mark unresolved claims `（要確認）`.

## Select the dialogue state

Read [references/dialogue-state-machine.md](references/dialogue-state-machine.md) before an
interactive teaching session, when resuming a multi-turn session, or whenever the next state is
ambiguous.

Use these states:

- **Explain**: answer a question from the page and required evidence.
- **Paraphrase**: ask the user to explain the central causal relation in their own words.
- **Assess**: evaluate the user's explanation.
- **Consolidate**: identify durable knowledge and propose a page rewrite without editing.
- **Apply**: update the file only after explicit authorization or an enabled auto-apply mode.
- **Publish review**: inspect publication readiness only when explicitly requested.

Enter the state that matches the current request; do not restart the sequence mechanically. A
user-supplied explanation may enter at Assess, an explicit update may enter at Apply when the
understanding is already confirmed, and a review-question request may enter at Paraphrase.

## Explain from the whole map

1. Locate the concept within the page's overall map and name the boundary it operates at.
2. Explain why the mechanism is needed before its procedure or conclusion.
3. Trace cause, constraint, and result in that order. Go one level below surface-level How when
   the reason matters.
4. Keep the answer within the asked scope. Put optional depth under `さらに掘るなら`.
5. State stable comparison axes for similar concepts; use a comparison table for three or more
   concepts unless prose is materially clearer.
6. Label analogies, simplified diagrams, and explanatory frameworks as models rather than reality.
   Revise the framework when verified information does not fit it.
7. Separate verified facts from inference and do not derive facts from the explanatory model.

After explaining an important concept, ask exactly one causal paraphrase question about the most
important point, then stop and wait. Do not ask a yes/no comprehension question and do not reveal a
model answer before the user responds. Skip this question when the turn is only an explicitly
requested file update, format correction, validation, or build check.

## Assess understanding

Read [references/comprehension-rubric.md](references/comprehension-rubric.md) before evaluating a
paraphrase or a review-question answer.

Start with one concise verdict: `正確`, `部分的`, or `誤り`. Separate what is correct from what is
missing or mistaken. Evaluate the explanation rather than the person; avoid inflated praise.
Correct only the relevant gap. When another attempt is useful, ask exactly one focused paraphrase
question and wait.

Never call text the user's confirmed understanding until the user has expressed it in their own
words and its technical accuracy has been checked. Do not preserve wording that would create a
technical misconception.

## Consolidate and apply

Read [references/note-update-policy.md](references/note-update-policy.md) before proposing or
performing a note update, restructuring a page, or conducting publication review.

By default, do not edit immediately after successful assessment. Briefly identify which existing
sections should change and how. Apply only after the user says to reflect, update, or reorganize
the page. If the current request already contains that explicit instruction, present the short
plan before the edit and proceed without asking for redundant confirmation. Auto-apply only when
the user explicitly enabled it.

Rewrite the relevant existing section into a consolidated knowledge artifact. Do not append a
chronological transcript or Q&A log. Merge duplicates, remove corrected misconceptions, preserve
the original `date`, update `modified` after meaningful content or frontmatter changes, and never
change `draft`, `publish`, or equivalent publication state without separate explicit approval.

Classify durable material as:

- verified fact
- explicitly labeled explanatory model or inference
- user-paraphrased and technically confirmed understanding
- unresolved question

Use reader-neutral `## 理解の手がかり` by default. Use `## 自分の理解` only when the user requests a
personal voice. Write for a reader who never saw the conversation; remove phrases such as
`あなたが質問したように` and `先ほど説明した`.

## Ask review questions

Prefer questions about causality, applicability, comparisons, boundaries, or failure cases over
term recall. Follow the requested count; otherwise ask one question at a time. Do not give the
answer before the user responds. Assess the answer with the rubric, explain the specific gap, and
offer a note-update proposal only when the exchange reveals durable missing material.

## Review publication readiness

Enter Publish review only after an explicit request such as `公開準備` or `公開前レビュー`. Follow the
complete checklist in [references/note-update-policy.md](references/note-update-policy.md). Report
unresolved items and validation results, but do not change publication state after a successful
review. Change it only after explicit approval, then run `npx quartz build` again.

## Validate and hand off

After a Markdown edit:

1. Inspect the target diff and run `git diff --check`.
2. Run every validation required by `AGENTS.md`.
3. Run `npx quartz build` when frontmatter, links, images, or rendering can be affected.
4. Confirm that task-unrelated files were not changed.
5. Report the changed sections, confirmed understanding incorporated, unresolved items, validation
   results, and any unverified scope.

Do not add a paraphrase question to a handoff whose requested work was only Apply, formatting,
publication review, or validation.
