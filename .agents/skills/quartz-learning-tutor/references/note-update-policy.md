# Note update and publication policy

Use this policy for Consolidate, Apply, and Publish review.

## Authorize the edit

- Without an explicit update instruction, present the target sections and rewrite intent, then
  wait.
- When the current request already says `反映して`, `更新して`, or `整理して`, state the short edit
  plan before using file tools and proceed; do not demand duplicate confirmation.
- Treat an explicitly enabled auto-apply mode as scoped authorization only after an accurate
  comprehension assessment. It never authorizes publication.
- Preserve unrelated worktree changes. If the target overlaps unexplained user edits, inspect and
  merge carefully; stop only when safe intent cannot be determined.

## Classify material before writing

| Class                        | Admission rule                                                       | Page treatment                                                                                     |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Confirmed fact               | Supported by the existing note/source or newly verified evidence     | State directly and cite at the relevant section when adding a new fact                             |
| Model or inference           | Useful for explanation but not directly established as fact          | Label as a simplified model, analogy, interpretation, or inference                                 |
| Confirmed user understanding | The user paraphrased it and the rubric found it technically accurate | Normalize wording for technical accuracy without implying that AI-proposed text came from the user |
| Unresolved question          | Evidence or understanding remains insufficient                       | Keep under `## 未解決` or mark the exact claim `（要確認）`                                        |

Never infer a fact from a model. Never label an AI-generated framework as the user's understanding.
Do not preserve a personal analogy if it breaks at a boundary relevant to the page.

## Restructure the page

1. Rewrite the relevant existing section instead of appending the conversation.
2. Arrange the explanation as whole-map position → necessity → cause/constraint/result →
   procedure or example.
3. Merge duplicate old and new explanations. Remove corrected misconceptions and let Git preserve
   history.
4. Keep optional depth in a clearly marked further-exploration section.
5. Use stable comparison axes and a table when comparing three or more similar concepts.
6. Preserve code, callouts, citations, internal links, image references, and unresolved markers
   unless the rewrite intentionally changes them.
7. Preserve the original `date`. Set `modified` to the current repository-local date after a
   meaningful body or frontmatter change.
8. Preserve `draft`, `publish`, and equivalent state unless the user separately approves the exact
   publication change after review.

Do not add a transcript, chronological question log, Q&A archive, or dialogue-dependent phrases.
Use reader-neutral `## 理解の手がかり` by default. Use `## 自分の理解` only for an explicitly
requested personal voice, and keep personal models distinct from facts.

## Handle sources

- Reuse sufficient existing evidence instead of researching every explanation again.
- Verify current product behavior, price, limit, version, or deprecation before adding it.
- Prefer specifications, official documentation, primary repositories, and original papers.
- Add a source to the section whose new claim it supports.
- Mark unsupported or conflicting claims `（要確認）`; do not smooth over the gap.

## Run publication review

Run this checklist only after an explicit `公開準備` or `公開前レビュー` request:

- frontmatter order and repository convention
- `title`, original `date`, current `modified`, `tags`, `aliases`, and `description`
- the active Quartz publication filter and the corresponding `draft` or `publish` field
- no body-level H1
- all unverified information visibly marked
- sources placed at the sections they support
- no stale duplicate or contradicted explanation
- no chat log or conversation-dependent wording
- no personal information, secret, confidential content, sensitive screenshot, or internal URL
- valid internal links and image references
- Obsidian-specific syntax supported by the active Quartz configuration
- successful `npx quartz build`

Report remaining uncertainties and validation results. A successful review is not publication
approval. After the user explicitly approves the exact publication-state change, make only that
change and run `npx quartz build` again.

## Validate an applied update

1. Inspect the complete target diff and verify that no classified material crossed categories.
2. Run `git diff --check`.
3. Follow directory-local formatting and all `AGENTS.md` checks.
4. Run `npx quartz build` for changes affecting frontmatter, links, images, or rendering.
5. Report skipped checks with the reason and unverified scope.
