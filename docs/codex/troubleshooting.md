# Troubleshooting

Use this file for failures whose diagnosis or fix is likely to be reused. Do not add
one-off mistakes unless they reveal a repository-specific constraint.

## Recording rules

- Describe the observable symptom before the diagnosis.
- Include the sanitized command or workflow, environment assumptions, root cause,
  resolution, and verification.
- Record failed attempts only when they narrow the diagnosis; explain why they failed.
- Mark workarounds clearly and state when they can be removed.
- Never save authentication credentials, API keys, tokens, cookies, Authorization
  headers, private keys, passwords, or their values. Redact them from commands, URLs,
  logs, headers, and error excerpts before recording.

## Entry template

```markdown
## Short symptom or error

- Last verified: YYYY-MM-DD
- Applies to:
- Symptom:
- Sanitized command or workflow:
- Cause:
- Resolution:
- Verification:
- Failed attempts:
- Workaround expiry/removal condition:
- Related:
  - [Research entry](research-log.md#anchor), if applicable
  - [Decision entry](decisions.md#anchor), if applicable
```

## Entries

## GitHub Pages deployment fails after a successful build

- Last verified: 2026-07-05
- Applies to: `.github/workflows/deploy.yaml` on GitHub-hosted Ubuntu runners.
- Symptom: `deploy-pages` finds one `github-pages` artifact, creates the deployment, then
  exits with `Deployment failed, try again later`. Logs may also contain Node 20 and
  `punycode` deprecation warnings.
- Sanitized command or workflow: the `build` job creates one `github-pages` artifact and
  the dependent `deploy` job runs `actions/deploy-pages` for the `github-pages`
  environment.
- Cause: the warnings are from old action runtimes, not from the Quartz build. In the two
  observed failures, build and artifact upload succeeded and the Pages backend changed the
  accepted deployment to `failed` without a public error description. The precise backend
  cause is therefore unverified.
- Resolution: use Node 24-based `actions/deploy-pages@v5` and
  `actions/upload-artifact@v6`, package `public` as the single tar file required by Pages,
  and retry the Pages deployment once after 30 seconds. Keep `workflow_dispatch` for a
  manual retry. Do not enable `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`; it only suppresses
  the runtime migration and does not fix Pages.
- Verification: local build, tar-input checks, YAML parsing, TypeScript checks, and tests
  pass. Hosted deployment verification requires the next push/manual workflow run.
- Failed attempts: changing content or reducing artifact size was not indicated; the two
  failed artifacts were only about 18.5 MB and differed little from the last successful
  18.4 MB artifact.
- Workaround expiry/removal condition: remove the explicit package/upload steps when
  `actions/upload-pages-artifact` publishes a Node 24 major; reconsider the retry after
  Pages deployments are consistently reliable.
- Related:
  - [Research entry](research-log.md#2026-07-05--github-pages-workflow-failure-and-build-time-review)
  - [Decision entry](decisions.md#2026-07-05--keep-correct-date-history-and-optimize-pages-deployment)
