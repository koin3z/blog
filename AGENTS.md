---
title: AGENTS
date: 2026-06-28
update: 2026-07-16
draft: false
tags:
  -
aliases:
  -
description: Operating guidelines for developing, writing, and validating this Quartz 4 personal blog
---

# Repository Guidelines

This repository is a personal digital garden built with Quartz 4.
Apply the same writing guidelines to pages written by the user and pages drafted by AI.

## Repository Structure

| Path                 | Purpose                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `content/`           | Published Markdown pages, organized by topic such as `ai/`, `cloud/`, `identity/`, and `security/` |
| `attachments/`       | Static files, such as images, referenced by pages                                                  |
| `quartz/components/` | Preact components                                                                                  |
| `quartz/plugins/`    | Quartz transformation and emission logic                                                           |
| `quartz/util/`       | Shared logic, including path handling                                                              |
| `quartz/styles/`     | Themes and shared styles                                                                           |
| `quartz.config.ts`   | Site-wide configuration                                                                            |
| `quartz.layout.ts`   | Page layout configuration                                                                          |
| `public/`            | Generated public site output                                                                       |

Treat `public/`, `node_modules/`, and `.quartz-cache/` as generated artifacts.
Do not include them in review or deliverables unless the task explicitly requires them.

## Development and Validation

Use Node.js `v22.16.0` as specified in `.node-version`.
Dependencies are pinned in `package-lock.json`.

| Command                    | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `npm ci`                   | Install the pinned dependencies                           |
| `npx quartz build`         | Build the production site into `public/`                  |
| `npx quartz build --serve` | Build the site and start a local preview                  |
| `npm run check`            | Run TypeScript type checks and Prettier formatting checks |
| `npm test`                 | Run TypeScript tests with `tsx --test`                    |
| `npm run format`           | Apply Prettier across the repository                      |

### Validation by Change Type

- Add or update the relevant tests when changing shared logic under `quartz/util/`, parsers, path handling, or plugins.
- Run `npm test` and `npm run check` for code changes unless the task scope makes either inapplicable.
- Run `npx quartz build` for content changes that affect links, frontmatter, images, or rendering.
- At handoff, state why any required validation was not run and which scope remains unverified.

## Code Style

- Use TypeScript strict mode.
- Treat Prettier as the source of formatting truth: two-space indentation, a 100-character print width, trailing commas, and no semicolons.
- Follow existing Quartz patterns for Preact components, plugins, and utilities.
- Name test files `*.test.ts` and place them near the code they exercise, such as `quartz/util/path.test.ts`.
- Give Markdown files descriptive names. Use kebab-case for English slugs; topic-specific names and Japanese titles are also acceptable.
- A directory-local Prettier configuration takes precedence. For example, in `content/cloud/oracle/database/`, do not wrap prose paragraphs or list items; follow that directory's `.prettierrc`.

### Learning Note Lifecycle

Learning notes move through the following phases.

1. Research draft
   - Establish the scope, whole map, mechanism, evidence, and open questions.
   - Keep the page unpublished.
2. Dialogue consolidation
   - Answer questions against the existing page.
   - Check the user's understanding before recording it as confirmed understanding.
1. Publication review
   - Check evidence, source freshness, internal links, frontmatter, private information, and unresolved claims.
   - Keep unresolved claims marked with `（要確認）`.
4. Publication
   - Change publication state only after explicit user approval.
   - Run the required Quartz build validation after the change.

## Commits and Pull Requests

- Automated backups use commit messages such as `vault backup: 2026-06-07 20:44:01`.
- Keep manual commit messages short and scoped, such as `content: add OCI vault notes` or `quartz: update backlinks styling`.
- Pull requests must describe the change, list validation performed, and link related issues.
- Include screenshots when changing visible layout or theme behavior.

- Treat every tracked file under `content/` and `attachments/` as potentially public.
- `draft: true` and an unpublished Quartz page are publication controls, not confidentiality controls.
- Do not store private learning transcripts, personal identifiers, confidential URLs, internal-only source material, or sensitive screenshots in publishable paths.
- Non-Markdown attachments may be emitted independently of the Markdown page that references them.
- Store genuinely private working material only in a Git-ignored local path.

## Learning Notes and Skill Boundaries

Use dedicated Skills for learning workflows.

| Skill | Responsibility |
| --- | --- |
| `quartz-research-note` | Research a topic, verify evidence, and create the initial learning note |
| `quartz-learning-tutor` | Explain an existing note, check understanding through dialogue, and revise the note after confirmation |

The rules in this file are repository-wide invariants.
Detailed research procedures, dialogue sequencing, comprehension checks, and note-update workflows belong in the corresponding Skill.

### Learning Note Principles

- Present the overall map, causal structure, and design rationale before procedures or conclusions.
- Explain one level below the surface-level how-to when that reason is relevant.
- Put optional deeper topics under a clearly marked further-exploration section rather than expanding the main scope without limit.
- Use a comparison table when similar concepts can be confused.
- Treat explanatory frameworks, diagrams, and analogies as provisional models.
- Revise the framework itself when verified information does not fit it.
- Keep the note as a consolidated knowledge artifact.
- Do not append chat transcripts, chronological question logs, or raw tutoring exchanges.
- Distinguish verified facts, explanatory models or inferences, the user's confirmed understanding, and unresolved questions.
- Do not describe a statement as the user's understanding until the user has expressed it in their own words and its technical accuracy has been checked.
- Rewrite the relevant section after clarification instead of adding a duplicate explanation.
- Preserve the original `date`.
- Update `modified` whenever the page body or meaningful frontmatter changes.
- Initial AI-created learning notes must remain unpublished unless the user explicitly requests otherwise.
- Do not change `draft` or `publish` state without explicit user approval and without checking the active Quartz publication filter.
- Interactive paraphrase questions belong to `quartz-learning-tutor`.
- Do not stop unrelated research, validation, or content-maintenance tasks to ask a tutoring question.