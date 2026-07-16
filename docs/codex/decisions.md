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

## 2026-07-16 — Group OCI Database notes by reader intent

- Status: accepted
- Context: `content/cloud/oracle/database/` contained one overview and 26 detail pages in a flat directory. Service selection, backup, migration, maintenance, and security notes have different retrieval questions and update cycles, so filename prefixes no longer provided a sufficient navigation boundary.
- Decision:
  - Keep `content/cloud/oracle/database/index.md` and the directory-local `.prettierrc` at the root.
  - Put hosting and data-store selection notes under `services/`, protection notes under `backup/`, data-movement and replication notes under `migration/`, update and patch lifecycle notes under `maintenance/`, and encryption notes under `security/`.
  - Use reader intent as the primary axis instead of creating one folder per product. Cross-service operational topics remain together even when they apply to Base Database Service, Exadata, or Autonomous deployments.
  - Add each former `cloud/oracle/database/<slug>` URL to the moved page's `aliases` and update internal wiki links to the new canonical path.
  - Add a category index only when a subfolder can answer a retrieval question that is not already handled by the database overview or an existing selection hub.
- Alternatives considered:
  - Keeping a flat directory was rejected because 26 detail files mixed product selection with unrelated operational workflows.
  - Creating one folder per service was rejected because most folders would contain one file and backup, migration, maintenance, and security notes span several service families.
  - Adding an index to every subfolder was rejected because the current backup and migration hubs already provide the required selection paths, while thin directory indexes would duplicate the database overview.
- Consequences: The root remains a stable portfolio entry point, directory browsing follows the reader's task, and previously published page URLs continue to resolve through Quartz alias redirects. Future notes should enter the nearest intent-based folder and should create a new category only when their retrieval question does not fit an existing one.
- Evidence and verification: All 26 moved pages retain their former path as an alias, internal links target the new canonical paths, and the Quartz production build emits both canonical pages and redirects for the former URLs.
- Supersedes:
- Superseded by:
- Related:
  - [Decision entry](#2026-07-16--use-an-engine-first-oci-database-service-hierarchy)
  - [Decision entry](#2026-07-15--split-the-oci-database-backup-note-by-reader-intent)

## 2026-07-16 — Use an engine-first OCI database service hierarchy

- Status: accepted
- Context: The existing Oracle Database service overview compared Base, Exadata, and Autonomous deployments, but the repository had no entry point for PostgreSQL, MySQL, NoSQL, cache, or search services. Expanding the Oracle page into one portfolio article would mix engine compatibility with Oracle-specific responsibility and placement choices.
- Decision:
  - Use `content/cloud/oracle/database/index.md` as the stable portfolio entry point and compare services first by data model, protocol compatibility, transaction requirements, and access pattern.
  - Preserve `content/cloud/oracle/database/services/oci-oracle-database-services.md` as the Oracle Database selection hub and use it to compare co-managed, Autonomous, infrastructure, and placement models.
  - Create one product/service-family detail note for Base Database Service, Exadata Database Service, Autonomous AI Database, Globally Distributed Database, OCI Database with PostgreSQL, MySQL HeatWave, Oracle NoSQL Database Cloud Service, OCI Cache, and OCI Search with OpenSearch.
  - Keep Exascale, Dedicated, and Cloud@Customer variants within their Exadata or Autonomous family note unless a future variant accumulates a distinct lifecycle and source set that justifies a separate page.
  - Present OCI Cache and Search with OpenSearch as purpose-specific stores whose data should be recoverable from a durable source unless the application explicitly accepts their persistence and recovery model.
  - Keep Recovery Service, Database Migration, GoldenGate, Data Safe, Database Management, and Operations Insights outside the hosting-service comparison and link them as adjacent capabilities.
- Alternatives considered:
  - A single page for all engines and every deployment model was rejected because readers would need to cross unrelated compatibility, responsibility, placement, and operational details before making a first choice.
  - One page per Exadata or Autonomous placement variant was rejected because the pages would repeat the same responsibility model and become thin notes.
  - Excluding OCI Cache and Search with OpenSearch was rejected because they are first-party managed data services exposed in Oracle's database catalog and must be distinguished from primary systems of record.
- Consequences: Readers choose the engine or access model from one overview, then follow only the relevant family page. Future service additions should enter the portfolio matrix first and receive a separate detail page when they have a distinct responsibility model, resource lifecycle, or recovery boundary.
- Evidence and verification: See the related research entry; targeted Prettier checks, `git diff --check`, and the Quartz production build passed.
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#2026-07-16--oci-managed-database-service-portfolio-taxonomy)

## 2026-07-16 — Structure notes by retrieval question and dependency

- Status: accepted
- Context: The repository covers protocols, internal mechanisms, cloud services, comparisons,
  and operational procedures. A single article template cannot organize all topics, while
  preserving discovery order leaves related facts disconnected and hard to retrieve later.
- Decision:
  - Use `.agents/skills/knowledge-note-structuring/` when restructuring existing `content/`
    pages or turning collected facts into a reusable knowledge model.
  - Define one retrieval question and primary organizing axis before editing.
  - Choose the nearest structural archetype and order sections by conceptual dependency rather
    than by the source's discovery history or a fixed heading template.
  - Adapt the reference articles' causal and relational order, but retain the repository's
    personal-memo voice, bullet-first style, source placement, and uncertainty markers.
  - Give each mapping or comparison one primary representation; do not narrate table rows again
    in adjacent prose.
  - Preserve stable URLs as hubs when pages split, and separate structural movement from factual
    corrections in the handoff.
- Alternatives considered:
  - A single fixed outline was rejected because mechanism, protocol, service, comparison, and
    procedure notes answer different retrieval questions.
  - Copying the reference articles' question-and-answer headings and reader-facing narration was
    rejected because this repository is a personal knowledge base rather than a publication.
  - Preserving the source page's fact order was rejected because collection order often hides
    ownership, state transitions, and causal dependencies.
- Consequences: Future restructuring should make the archetype, primary axis, split decision,
  unknown claims, and validation explicit. Structural quality still requires human review;
  formal preservation checks alone do not demonstrate that a skill output is more useful than
  the repository instructions without the skill.
- Evidence and verification: see the related research entry and the two evaluation iterations
  under `.agents/skills/knowledge-note-structuring-workspace/`.
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#2026-07-16--personal-knowledge-note-structure-patterns)

## 2026-07-16 — Separate Oracle Database migration methods from orchestration

- Status: accepted
- Context: The upgrade note referenced several migration technologies but did not give readers a stable place to compare them, and a single long migration article would mix selection guidance with implementation detail.
- Decision:
  - Add `content/cloud/oracle/database/migration/oci-oracledb-migration.md` as the selection hub.
  - Give Data Pump, Transportable Tablespaces, PDB migration, Data Guard, GoldenGate, AutoUpgrade, ZDM, and OCI Database Migration their own detail notes in the migration or maintenance category.
  - Reuse `oci-oracledb-backup-rman.md` for RMAN physical-migration guidance because backup and restore mechanics are inseparable from that method.
  - Keep `oci-oracledb-update.md` focused on patching and upgrades, with links to the migration hub and AutoUpgrade detail.
- Alternatives considered:
  - Keeping every method in the update note was rejected because upgrade and migration have different decision boundaries and rollback conditions.
  - Creating a second RMAN page was rejected because it would duplicate recovery dependencies and operational cautions.
- Consequences: Readers start with a compact method matrix, then open only the relevant method or orchestration page. Future migration methods should be introduced in the hub and split out when they require distinct design or operational guidance.
- Evidence and verification: see the related research entry.
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#2026-07-16--oracle-database-migration-method-taxonomy)

## 2026-07-15 — Split the OCI Database backup note by reader intent

- Status: accepted
- Context: The original backup note mixed method selection, Recovery Service internals, RCV/ZRCV terminology, retention controls, and brief references to RMAN and other backup methods. It was too broad to serve both comparison and implementation readers.
- Decision:
  - Use `content/cloud/oracle/database/backup/oci-oracledb-backup.md` as the selection hub and preserve the former `cloud/oracle/database/oci-oracledb-backup` URL through an alias.
  - Use sibling notes for Recovery Service (RCV/ZRCV), unmanaged RMAN, and other methods such as managed Object Storage, local FRA, Data Pump, and standby offload.
  - Keep incoming links from service, update, patch, and TDE notes pointed at the overview; link from the overview to the detail pages.
- Alternatives considered:
  - Renaming the existing file to a different topic slug was rejected because it would weaken the established retrieval path without adding a new concept.
  - Creating one page per minor method was rejected because the smaller topics share selection context and would become thin notes.
- Consequences: Readers can compare methods without reading implementation detail, while deep links remain available for each main operational model. New backup topics should be added to the overview first and split only when they have enough distinct design and operational content.
- Evidence and verification: see the related research entry; local validation is recorded there.
- Supersedes:
- Superseded by:
- Related:
  - [Research entry](research-log.md#2026-07-15--oci-base-database-service-backup-methods)

## 2026-07-07 — Keep Oracle Database notes unwrapped and omit checklists

- Status: accepted
- Context: The notes under `content/cloud/oracle/database/` are intended as reference memos.
  Hard-wrapped prose interrupts source readability, and pre-deployment or final-verification
  checklists duplicate the explanatory content.
- Decision:
  - Keep each prose paragraph and list item on one physical line in this directory.
  - Use the directory-local `.prettierrc` with `proseWrap: never` so later formatting
    preserves this convention without changing Markdown elsewhere.
  - Omit checklist sections and task checkboxes. Keep explanatory sequences, tables,
    commands, and operational cycles when they carry distinct technical information.
- Alternatives considered:
  - Changing the repository-root Prettier setting was rejected because the requested style
    applies only to the Oracle Database notes.
  - Disabling Prettier for the files was rejected because tables, frontmatter, and code
    blocks should remain mechanically formatted.
- Consequences: Source lines can exceed the general 100-character print width by design;
  rendered wrapping remains the responsibility of Quartz and the browser. Callout titles and
  bodies remain separate quoted paragraphs so Quartz recognizes them.
- Evidence and verification: all five Database Markdown files pass the directory-local
  Prettier check and the Quartz production build.
- Supersedes:
- Superseded by:
- Related:

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
