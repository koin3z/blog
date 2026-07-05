# Decisions

Use this file for lightweight records of architectural, tooling, content, or workflow
decisions that future Codex runs should preserve or consciously revisit.

## Recording rules

- Give each decision a date and status.
- Capture context, chosen option, alternatives considered, consequences, and evidence.
- Use `superseded` with a link to the replacement instead of deleting history.
- Record only decisions actually made; keep proposals labeled `proposed`.
- Never save authentication credentials, API keys, tokens, cookies, Authorization
  headers, private keys, passwords, or their values. Redact them from commands, URLs,
  logs, headers, and excerpts before recording.

## Decision template

```markdown
## YYYY-MM-DD — Short decision title

- Status: proposed | accepted | superseded | deprecated
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Evidence and verification:
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#anchor), if applicable
  - [Troubleshooting entry](troubleshooting.md#anchor), if applicable
```

## Decisions

## 2026-07-05 — Keep correct date history and optimize Pages deployment

- Status: accepted
- Context: Pages builds were already short, but action runtimes were stale, irrelevant
  changes triggered deployments, and page-specific OG rendering dominated local build
  time. Some published notes rely on Git history for dates.
- Decision:
  - Keep separate build/deploy jobs, `fetch-depth: 0`, manual dispatch, and serialized
    Pages deployments.
  - Restrict automatic runs to actual site/build inputs and scope Pages/OIDC write
    permissions to the deploy job.
  - Remove `configure-pages` and `.nojekyll`, package the artifact directly, use Node 24
    action majors, and retry one transient Pages failure.
  - Disable `Plugin.CustomOgImages()` and use the existing default OG image.
- Alternatives considered:
  - Shallow checkout was rejected because pages with incomplete date frontmatter use Git.
  - Combining build and deploy could save one runner handoff but weakens permission and
    environment separation and departs from the recommended deploy-pages structure.
  - Keeping `upload-pages-artifact@v4` was rejected because its wrapped uploader declares
    Node 20; opting back into Node 20 was rejected as an insecure temporary workaround.
- Consequences: content builds are faster and unrelated maintenance commits no longer
  deploy. Social previews use one shared image instead of a generated image per page. The
  workflow contains a small amount of explicit tar packaging until the Pages uploader has
  a Node 24 release.
- Evidence and verification: local build time changed from about 6.2 seconds/529 outputs
  to 2.1 seconds/422 outputs; tests and targeted checks passed. See the related research
  entry for hosted-run evidence and official sources.
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#2026-07-05--github-pages-workflow-failure-and-build-time-review)
  - [Troubleshooting entry](troubleshooting.md#github-pages-deployment-fails-after-a-successful-build)
