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

## Markdown Content Guidelines

Write pages under `content/` as technical notes for later retrieval and decision-making.
Prioritize a structure that makes facts, conditions, and reasons easy to find over a polished article-like presentation.

Use the following pages as style references:

- `content/identity/oauth/authorization-server.md`
- `content/cloud/oracle/vault/oci-vault-secret.md`

Do not copy typos, inconsistent notation, or unfinished parts from those pages.
This specification takes precedence.

### Frontmatter

- Order fields as `title`, `date`, `modified`, `draft`, `tags`, `aliases`, and `description` by default.
- Write `description` as one sentence describing the page's subject. Do not repeat only the title.
- Use `date` for the creation date and `modified` for the last content change.
- Align `tags` and `aliases` with the taxonomy and URL structure of existing pages.

### Body Structure

- Do not add an `#` heading to the body. Use the frontmatter `title` as the page title.
- Start with `## Overview` when useful, and briefly state the page's position, role, and main components.
- Use `##` to divide topics and `###` for processing, configuration, constraints, and other details within a topic.
- Make headings short noun phrases and keep one topic per section.
- Prefer lists. Put facts or conclusions in top-level items and conditions, reasons, examples, and exceptions in nested items.
- Keep one idea per list item. Split items that contain multiple conditions or processes.
- Use a comparison table instead of a long list when comparing three or more related concepts or choices.
- Use short paragraphs only when a causal explanation is necessary. Do not restate list content in prose.
- Put each sentence of a paragraph on its own line, with a blank line between paragraphs.

### Style

- For Japanese content, use the plain form and do not mix it with polite `desu/masu` forms in the same page.
- State content directly. Do not add introductions such as “This page explains...” or “The important point is...”.
- Do not add summaries that merely restate the preceding content.
- Keep technically necessary subjects explicit, but do not repeat a subject that is unambiguous from context.
- Describe product and feature behavior directly, using forms equivalent to “does,” “can,” and “requires.” Avoid unnecessarily indirect wording.
- Write technical facts neutrally. A light, informal tone is acceptable for personal observations or conjecture, but do not blur the distinction between fact and inference.
- Omit the final period from single-sentence list items. Use periods in paragraphs and callout bodies.

### Notation

- For Japanese content, consistently use `、` and `。`; do not mix them with `，` and `．`.
- Use ASCII digits. Follow official notation for product names, standards, parameter values, and units.
- Use inline code for parameter names, identifiers, literals, commands, and file paths, such as `client_id`, `redirect_uri`, `CURRENT`, and `true`.
- Do not insert unnecessary spaces between Japanese text and inline code.
- Preserve official capitalization for product names, service names, protocol names, and API names. Use one name consistently for each subject.
- Limit bold text to cautions and easily misunderstood distinctions. Use inline code, not bold text, for parameter names.
- Except for UI labels and quotations, use established Japanese terms where they exist.

### Evidence and Examples

- Prioritize information needed for later decisions, including limits, prerequisites, exceptions, and update constraints.
- Explain not only what is possible, but also why a process is necessary when that explanation is useful.
- Put official references at the start of the relevant section as `Doc: [page name](URL)` or `API: [operation name](URL)`. Put only page-wide references in `## References` at the end.
- Mark unverified content with `（要確認）`. Use a `> [!NOTE] 要確認` callout for a group of items that requires investigation.
- Do not fill gaps in uncertain memory merely to make the prose flow. Mark anything that cannot be verified as unverified.
- Place minimal command, request, and response examples immediately after their explanation. Retain the fields referenced by the text.
- Add a language identifier to code blocks.
- Use meaningful placeholders such as `<secret_ocid>` in examples. Never include real credentials or secret values.
- State what a reader should learn from an image immediately before placing it.

## Commits and Pull Requests

- Automated backups use commit messages such as `vault backup: 2026-06-07 20:44:01`.
- Keep manual commit messages short and scoped, such as `content: add OCI vault notes` or `quartz: update backlinks styling`.
- Pull requests must describe the change, list validation performed, and link related issues.
- Include screenshots when changing visible layout or theme behavior.

## Security

- Do not commit secrets, private notes, or machine-specific Obsidian settings.
- Do not store credentials, including API keys, tokens, cookies, Authorization headers, private keys, or passwords, or their values in `AGENTS.md`, `docs/codex/`, examples, commands, URLs, logs, or error excerpts.
- Remove or replace sensitive material before recording research findings.
- Keep raw logs and sensitive working data only in Git-ignored local paths.
- If a secret may have been exposed, do not reproduce it. State that revocation or rotation is required.

## Reusable Codex Knowledge

Before a substantial investigation, read `docs/codex/README.md` and the knowledge files relevant to the task.

| Location                        | Record                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `docs/codex/research-log.md`    | Reusable research findings, evidence, and open questions |
| `docs/codex/troubleshooting.md` | Repeatable failure symptoms, causes, and resolutions     |
| `docs/codex/decisions.md`       | Architectural, content, and workflow decisions           |

- Record only repository-specific knowledge that can help later work.
- Do not record chat transcripts or raw command output.
- Update an existing entry rather than creating a duplicate for the same topic.
- Separate verified facts from hypotheses, and link relevant repository paths or public sources.
- Leave enough conditions and verification detail for another Codex run to reproduce the result.
- At handoff, state whether reusable knowledge was recorded. If not, briefly explain why.

## Learning Support

For conversations and writing about new concepts or technologies, build understanding in the following order.

### Mechanism-Oriented Explanation

- Explain the causal structure and design rationale before the procedure or conclusion.
- Do not stop at surface-level how-to steps; also cover the underlying reason.
- Do not pursue material outside the main topic. Offer it only as an optional direction for further exploration.

### Structured Retention

- Begin with a map of the whole, including components, classification axes, and position, before moving into details.
- Use a comparison table when similar concepts appear, so their differences are explicit.
- Treat a proposed framework as a hypothesis. If new information does not fit it, revise the framework itself.

### Output, Retrieval, and Verification

- After explaining an important concept, ask one question that lets the user paraphrase it in their own words.
- Do not provide the answer until the user responds.
