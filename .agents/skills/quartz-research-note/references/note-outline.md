# Initial Note Outline

Use this reference while turning research into a Quartz-compatible Markdown page. Select only the
sections needed by the learning outcomes.

## Frontmatter

Follow the repository's existing key order. A typical initial note with `RemoveDrafts` is:

```yaml
---
title: ページタイトル
date: YYYY-MM-DD
modified: YYYY-MM-DD
draft: true
tags:
  - topic/category
aliases: []
description: ページの対象、境界、判断に使える内容を一文で示す。
---
```

With `ExplicitPublish`, keep the page unpublished and follow repository convention. If the
repository records the state explicitly, use `publish: false`; never add `publish: true` without
explicit publication approval.

Do not combine `draft: true` and `publish: true`. Do not use publication metadata as a
confidentiality boundary.

## Section selection

Choose a dependency order that makes later sections rely mainly on terms already introduced.

| Section                 | Use when it answers                                                            |
| ----------------------- | ------------------------------------------------------------------------------ |
| `## Overview`           | Where does the topic sit, what role does it have, and what are its main parts? |
| `## 全体構造`           | Which components, actors, artifacts, or layers relate to one another?          |
| `## 成立理由`           | What prior limitation or design pressure made the concept necessary?           |
| `## 仕組み`             | Which state, data, or control flow causes the observed behavior?               |
| `## 類似概念との違い`   | Which stable axes distinguish easily confused alternatives?                    |
| `## 具体例`             | What smallest scenario exposes the mechanism or boundary?                      |
| `## 制約と失敗パターン` | Which assumptions, limits, exceptions, and common errors matter?               |
| `## 理解の手がかり`     | Which explicitly labeled model or analogy reduces initial cognitive load?      |
| `## 未解決`             | Which claims remain `（要確認）` or need later dialogue?                       |
| `## 関連する深掘り`     | Which useful topics are intentionally outside the main scope?                  |
| `## References`         | Which sources support the whole page rather than one section?                  |

Do not add a body-level `#` heading. Do not include empty sections merely to match the table.

## Evidence notation

Place evidence before the claims it supports:

```markdown
## 仕組み

Doc: [RFC 9449: OAuth 2.0 Demonstrating Proof of Possession](https://www.rfc-editor.org/rfc/rfc9449)

- DPoP proofは、HTTP requestの要素と公開鍵を署名付きJWTへ結び付ける
```

Use `API:` when the link is an API reference:

```markdown
API: [Create resource](https://example.com/api/create-resource)
```

Label synthesis that goes beyond a source:

```markdown
> [!NOTE] 説明モデル
> 以下は責任境界を理解するための単純化モデルであり、実装の全構成を表すものではない。
```

Keep unresolved content explicit:

```markdown
- バージョン2での既定動作は変更された可能性がある（要確認）
```

## Tables and diagrams

Use a table when two or more alternatives share stable comparison axes. Name the axis in the first
column; do not use vague rows such as「特徴」when a responsibility, trust boundary, state owner, or
failure consequence can be named.

Use Mermaid only after confirming `ObsidianFlavoredMarkdown` and Mermaid support in
`quartz.config.ts`. Prefer it for relationships among at least three components, a branching flow,
or a lifecycle whose order matters. Explain in prose the fact the reader should extract from the
diagram.

Check callout and Wikilink support before using Obsidian-specific syntax. Resolve each internal
link against the repository's active link-resolution setting.

## Writing constraints

- Use Japanese plain form (`常体`) for Japanese pages.
- Present the whole map and causal structure before procedures.
- Explain the reason beneath a surface-level operation when it affects decisions or failure.
- Keep examples minimal and subordinate to the mechanism.
- Avoid greetings, rhetorical hooks, chat logs, chronological research notes, and repeated
  summaries.
- Give each fact one primary representation; do not restate every table row as prose.
- Put optional depth under `関連する深掘り`.
- Keep `（要確認）` visible until evidence resolves it.

## Pre-validation review

- Frontmatter contains a useful title, creation date, modified date, unpublished state, tags,
  aliases, and description in repository order.
- The body contains no H1.
- Every fenced code block declares a language.
- Each material claim is a verified fact, labeled inference or model, or marked unresolved.
- Similar concepts use explicit comparison axes.
- Links and images resolve and are safe to publish.
- No private or internal-only information entered publishable paths.
- The page remains a consolidated knowledge artifact rather than a transcript.
