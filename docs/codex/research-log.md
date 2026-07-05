# Research Log

Use this file for durable findings from repository investigations. Prefer updating an
existing entry when the same question is revisited.

## Recording rules

- Record the question, scope, evidence, findings, verification, and remaining unknowns.
- Distinguish verified findings from hypotheses.
- Link repository files with relative paths and public sources with stable URLs.
- Summarize relevant output; do not paste full command output or session transcripts.
- Never save authentication credentials, API keys, tokens, cookies, Authorization
  headers, private keys, passwords, or their values. Redact them from commands, URLs,
  logs, headers, and excerpts before recording.

## Entry template

```markdown
## YYYY-MM-DD — Short investigation title

- Status: verified | partial | superseded
- Question:
- Scope:
- Evidence:
  - `path/to/file`: relevant detail
  - Public source URL: relevant detail
- Findings:
- Verification:
- Open questions:
- Related:
  - [Troubleshooting entry](troubleshooting.md#anchor), if applicable
  - [Decision entry](decisions.md#anchor), if applicable
```

## Entries

## 2026-07-05 — GitHub Pages workflow failure and build-time review

- Status: partial (local changes verified; the next GitHub-hosted deployment is pending)
- Question: Is the Pages workflow doing unnecessary work, can it be faster, and why did
  the two latest deployments fail after successful builds?
- Scope: `.github/workflows/deploy.yaml`, `quartz.config.ts`, the 19 public workflow runs
  through run 28710349149, and current GitHub Pages/Actions documentation.
- Evidence:
  - `.github/workflows/deploy.yaml`: this is the repository's only workflow.
  - `quartz.config.ts`: `CreatedModifiedDate` falls back to Git and several published pages
    lack complete date frontmatter, so `fetch-depth: 0` is required for accurate dates.
  - [Failed run 28710349149](https://github.com/koin3z/notes/actions/runs/28710349149):
    build succeeded in 37 seconds and deployment failed in 6 seconds after Pages accepted
    the 18.5 MB artifact. Run 28640991724 had the same shape. The public Deployment API
    contains no detailed failure description.
  - [GitHub Node 20 deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/):
    action authors should move to Node 24 and workflow users should select updated actions.
  - [deploy-pages v5 release](https://github.com/actions/deploy-pages/releases/tag/v5.0.0)
    and [upload-artifact v6 release](https://github.com/actions/upload-artifact/releases/tag/v6.0.0):
    these majors use the Node 24 action runtime.
  - [upload-pages-artifact Node 20 issue](https://github.com/actions/upload-pages-artifact/issues/138):
    v4 wraps `upload-artifact@v4.6.2`, which still declares Node 20.
  - [GitHub custom Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages):
    a Pages artifact is a tar archive uploaded as `github-pages`; deployment needs
    `pages: write`, `id-token: write`, a build dependency, and an environment.
- Findings:
  - The Node 20 and `punycode` messages came from JavaScript action runtimes and were not
    the direct cause of the reported failure. The deployment was created, then the Pages
    backend returned `failed`; the public APIs expose no more specific cause.
  - There is no duplicate workflow. `configure-pages` is unnecessary for this already
    enabled site with a fixed `baseUrl`; successful deployments predate that step.
    Creating `.nojekyll` was also ineffective because `upload-pages-artifact@v4` excluded
    dotfiles, and artifact-based Pages deployments do not run Jekyll on `public`.
  - Generating 107 page-specific OG images increased a local production build from about
    2.1 seconds to 6.2 seconds. Disabling it retains the existing default
    `quartz/static/og-image.png` metadata on every page.
  - Path filtering can skip deployment for repository-only files such as `AGENTS.md`,
    `docs/codex/**`, and local Obsidian metadata without missing site inputs.
- Verification:
  - `npm test`: 48 tests passed.
  - `npm run build`: 109 inputs, 422 outputs, about 2.1 seconds locally with custom OG
    images disabled; representative pages reference the default OG image.
  - YAML parsing, `git diff --check`, TypeScript `tsc --noEmit`, and targeted Prettier
    checks passed.
- Open questions:
  - Confirm the hosted Pages deployment and retry behavior on the next push or manual run.
  - If both v5 deployment attempts still fail, use the request ID surfaced by the newer
    action when opening a GitHub Support case; public deployment status has no cause field.
- Related:
  - [Troubleshooting entry](troubleshooting.md#github-pages-deployment-fails-after-a-successful-build)
  - [Decision entry](decisions.md#2026-07-05--keep-correct-date-history-and-optimize-pages-deployment)
