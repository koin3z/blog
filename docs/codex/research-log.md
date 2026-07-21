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

## 2026-07-21 — Repository-wide content taxonomy and link audit

- Status: verified
- Question: How should the current pages be grouped so a reader can move from the root to a
  technical topic, product family, protocol role, or document type without relying on the file
  tree?
- Scope: All Markdown pages under `content/`, including the existing Oracle Database performance
  and OCI Block Volume work present in the worktree. The inventory contained 145 pages before
  restructuring and 147 pages after consolidation, moves, and new hubs.
- Evidence:
  - `content/index.md`: root selection hub for subject areas and document-role branches.
  - `content/ai/index.md`, `content/cloud/oracle/index.md`, `content/containers/index.md`,
    `content/development/index.md`, `content/identity/index.md`, `content/linux/index.md`, and
    `content/security/index.md`: subject navigation boundaries.
  - `content/articles/index.md`, `content/bookmarks/index.md`, and `content/meta/index.md`:
    document-role navigation boundaries.
  - `content/ai/agents/google-adk/`, `content/identity/oauth/grant-types/`,
    `content/cloud/oracle/identity/`, `content/containers/docker/`,
    `content/security/vulnerability-management/`, `content/security/software-supply-chain/`, and
    `content/security/cryptography/`: resulting product, protocol-role, and operational groupings.
- Findings:
  - The repository needs two explicit top-level axes. Technical notes are retrieved by subject,
    while articles, bookmarks, and site-maintenance notes are retrieved by document role.
  - Google ADK pages belong under the framework, ID-JAG belongs with OAuth grant types, Oracle
    Access Governance belongs with Oracle Identity, and CVSS, SBOM, and post-quantum cryptography
    answer different security questions than compliance standards.
  - Docker command stubs and image-build notes answered two retrieval questions and were more
    useful as a Docker hub plus one image-build procedure. The empty Access Governance API note
    and the Gemini CLI MCP stub were likewise folded into their owning notes.
  - The nearly empty Kubernetes Service and Ingress pages answered one networking-selection
    question and were consolidated into `content/containers/kubernetes/networking.md`.
  - Former canonical paths were preserved as aliases, while body links were updated to current
    canonical paths.
  - After restructuring, every published page is reachable from the root. Draft-only Quartz and
    Obsidian setup notes remain discoverable through the draft `meta/index.md` source file rather
    than public navigation.
- Verification:
  - Parsed all 147 frontmatter blocks and checked required fields, field order, dates, body H1
    usage, internal page and anchor targets, local resources, aliases, and hub reachability.
  - Found no broken or ambiguous internal target, no invalid anchor, no alias collision, and no
    body link that still uses a moved canonical path.
  - TypeScript, changed-file Prettier, and `git diff --check` passed with Node.js 22.16.0.
  - `npm run build` parsed 147 inputs, filtered 3 drafts, and emitted 549 files with Node.js
    22.16.0.
  - The repository-wide `npm run check` reached the Prettier stage but remains nonzero because
    the unchanged `CODE_OF_CONDUCT.md`, `content/cloud/oracle/ai/index.md`, and
    `content/linux/mount.md` were already outside Prettier's expected format.
- Open questions:
  - Existing time-sensitive technical claims were not re-researched as part of this structural
    change and retain their current verification state.
  - Several intentionally thin or draft notes remain candidates for later factual expansion.
  - The current Oracle Database performance and storage placement should be revisited only if
    those notes later develop a distinct retrieval question or update cycle.
- Related:
  - [Decision entry](decisions.md#2026-07-21--use-topic-hubs-while-preserving-document-role-branches)

## 2026-07-21 — Storage performance metrics and OCI Block Volume measurement

- Status: verified
- Question: How should IOPS, throughput, latency, I/O size, and queue depth be related so
  storage specifications and benchmark results can be compared without mixing measurement
  layers?
- Scope: General block-storage performance concepts, Oracle Database workload examples,
  `fio` measurement conditions, OCI Block Volume performance and Monitoring metrics, and the
  June 2026 Performance SLA terms as of 2026-07-21.
- Evidence:
  - `content/cloud/oracle/database/performance/storage-performance.md`: resulting concept
    map, equations, workload matrix, measurement workflow, and diagnostic table.
  - `content/cloud/oracle/storage/oci-block-volume.md`: resulting product note for resource
    boundaries, VPU/GB performance levels, effective-performance constraints, SLA scope,
    Monitoring, autotuning, and data protection.
  - [OCI Block Volume Performance](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/blockvolumeperformance.htm):
    performance levels, VPU/GB scaling, per-volume and per-instance limits, shape effects,
    and Performance SLA conditions.
  - [Oracle PaaS and IaaS Public Cloud Services Pillar Document, June 2026](https://www.oracle.com/contracts/docs/paas_iaas_pub_cld_srvs_pillar_4021422.pdf?download=false):
    current Block Volume Availability, Manageability, and Performance SLA definitions,
    eligibility conditions, exclusions, credit tiers, and claims process.
  - [OCI Block Volume metrics](https://docs.oracle.com/en-us/iaas/Content/Block/References/volumemetrics-reference.htm):
    interval counters, guaranteed-performance metrics, throttling, and measurement scope.
  - [OCI FIO examples](https://docs.oracle.com/en-us/iaas/Content/Block/References/samplefiocommandslinux.htm)
    and [fio documentation](https://fio.readthedocs.io/en/latest/fio_doc.html): distinct IOPS,
    throughput, and latency profiles; I/O-depth behavior; output semantics; and destructive
    write-test cautions.
- Findings:
  - For the same measurement layer, throughput is approximately IOPS multiplied by average
    I/O size. Maximum IOPS and maximum throughput normally describe different I/O sizes and
    need not be reached simultaneously.
  - In steady state, outstanding I/O is approximately IOPS multiplied by average latency.
    Increasing queue depth can expose concurrency, but after saturation it mainly increases
    latency, so percentile latency must be evaluated with IOPS.
  - Application or database logical I/O, OS block-device I/O, and storage-service I/O are
    different measurements because caches and lower layers can absorb, split, or merge
    requests.
  - OCI performance settings determine IOPS/GB and throughput/GB; volume size scales total
    performance up to per-volume limits, while the Compute shape, attachment, and network can
    impose lower aggregate limits.
  - VPU/GB is a provisioned performance and billing setting rather than observed I/O. At 10
    VPU/GB and above, Oracle publishes formulas for IOPS/GB, KBPS/GB, and per-volume limits;
    the 0 VPU/GB Lower Cost level uses separate fixed characteristics.
  - The June 2026 Performance SLA uses 4 KiB IOPS for a single raw, unformatted volume. Its
    monthly commitment is 99.9%, based on time below 90% of Oracle's published minimum IOPS;
    Lower Cost, throughput, latency, filesystems, databases, and application response time are
    not included in that calculation.
  - Performance SLA eligibility also depends on attachment type and, for paravirtualized
    attachments, VM core count. Ultra High Performance separately requires a supported shape
    and multipath-enabled attachment and has lower paravirtualized and boot-volume limits.
  - `VolumeReadOps`, `VolumeWriteOps`, and actual throughput are interval measurements and
    must be normalized for rate comparisons. `VolumeGuaranteedVPUsPerGB` and
    `VolumeGuaranteedIOPS` are interval-average gauges and must not be rate-converted, while
    `VolumeGuaranteedThroughput` is megabytes per interval and needs rate conversion for an
    MB/s comparison. The `oci_blockstore` namespace has no direct observed latency metric.
  - Read-only benchmarks can still affect production load. Write benchmarks overwrite raw
    devices and ordinary test files, so destructive profiles belong only on disposable test
    storage.
- Verification:
  - Independent technical and note-structure reviews found no remaining material error after
    correcting dimensionally inconsistent formulas, Oracle commit semantics, `fio` output
    interpretation, VPU/GB calculation order, SLA idle-load interpretation, Monitoring rate
    conversion, and Ultra High Performance attachment conditions.
  - Targeted Prettier checks and `git diff --check` passed.
  - A Quartz production build parsed 145 Markdown inputs and emitted 531 files with the
    bundled Node.js 24.14.0 runtime; the new page and both internal backlinks were present.
  - The repository-specified Node.js 22.16.0 was unavailable. System Node.js 26.5.0 exhausted
    its default heap during the same build, so exact 22.16.0 behavior remains unverified.
- Open questions: Revalidate current Block Volume limits, supported attachment and shape
  combinations, the customer's order and Rate Card, and the latest Pillar Document for the
  target tenancy and workload.

## 2026-07-21 — Oracle Database performance features and OCI management boundary

- Status: verified
- Question: How should AWR, ASH, ADDM, SQL Tuning Set, advisors, regression testing,
  and plan stabilization be related, and which parts of OCI Database Management are
  database-native versus OCI-native?
- Scope: Oracle Database 19c through 26ai concepts, OCI Database Management, Operations
  Insights, and licensing boundaries as of 2026-07-21.
- Evidence:
  - `content/cloud/oracle/database/performance/oracledb-performance.md`: resulting feature
    map, comparison tables, responsibility boundary, storage layers, and licensing gates.
  - [Oracle Database Performance Tuning Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/tgdba/performance-tuning-overview.html): AWR, ASH, ADDM, DB Time, and advisor relationships.
  - [SQL Tuning Set documentation](https://docs.oracle.com/en/database/oracle/oracle-database/26/tgsql/managing-sql-tuning-sets.html): STS contents, capture sources, consumers, and transport behavior.
  - [Database Management feature support matrix](https://docs.oracle.com/en-us/iaas/database-management/doc/database-management-feature-support-matrix.html): edition, version, deployment, and Basic/Full gates.
  - [Database Management metrics](https://docs.oracle.com/en-us/iaas/database-management/doc/database-management-metrics.html): OCI Monitoring namespaces and retention boundary.
  - [Operations Insights overview](https://docs.oracle.com/en-us/iaas/operations-insights/doc/operations-insights.html) and [AWR Hub](https://docs.oracle.com/en-us/iaas/operations-insights/doc/awr-hub.html): long-term warehouse and detailed AWR storage.
  - [Oracle AI Database Licensing Information](https://docs.oracle.com/en/database/oracle/oracle-database/26/dblic/Licensing-Information.html): pack, option, edition, and cloud-offering entitlements.
- Findings:
  - AWR is the database-wide historical repository, ASH is high-frequency active-session
    sampling, STS is a selected reusable SQL workload object, and ADDM analyzes AWR rather
    than STS.
  - SPA evaluates SQL independently from an STS. Database Replay preserves request timing,
    concurrency, and transaction dependencies to test a system workload.
  - Database Management is not merely a host UI. It invokes and visualizes database-engine
    features while adding OCI connectivity, IAM, managed resources, Monitoring metrics,
    alarms, fleet views, jobs, and APIs.
  - Keep five storage responsibilities distinct: source-database AWR, source-database
    advisor results, OCI Monitoring metrics, the Operations Insights warehouse, and the AWR
    Hub Warehouse.
  - Database pack entitlements, Database Management service pricing, edition/version
    support, and Operations Insights subscriptions are independent gates and must all be
    checked.
- Verification:
  - Cross-checked official Oracle documentation and completed independent technical and
    note-structure reviews on 2026-07-21.
  - Targeted Prettier checks, `git diff --check`, internal-link inspection, and a Quartz
    production build over 143 Markdown inputs passed.
  - The repository-specified Node.js 22.16.0 was unavailable locally and could not be
    downloaded because of network connectivity. The successful build used the bundled
    Node.js 24.14.0 runtime, so exact 22.16.0 behavior remains unverified.
- Open questions: Revalidate edition/version support, cloud-offering inclusion, regional
  availability, prices, and contract terms at design time.

## 2026-07-16 — OCI managed database service portfolio taxonomy

- Status: verified
- Question: How should the current OCI managed database services be organized so readers can select an engine first and an Oracle Database operating model second?
- Scope: Oracle AI Database services, OCI Database with PostgreSQL, MySQL HeatWave, Oracle NoSQL Database Cloud Service, OCI Cache, and OCI Search with OpenSearch as of 2026-07-16.
- Evidence:
  - `content/cloud/oracle/database/index.md`: engine-level comparison and selection hub.
  - `content/cloud/oracle/database/services/oci-oracle-database-services.md`: Oracle Database operating-model and infrastructure selection hub.
  - `content/cloud/oracle/database/services/`: detail notes for Base Database Service, Exadata Database Service, Autonomous AI Database, Globally Distributed Database, PostgreSQL, MySQL HeatWave, NoSQL, OCI Cache, and Search with OpenSearch.
  - [OCI Database documentation](https://docs.oracle.com/en-us/iaas/Content/Database/home.htm): current Base, Exadata, and Autonomous Oracle Database service families.
  - [OCI Database with PostgreSQL overview](https://docs.oracle.com/en-us/iaas/Content/postgresql/overview.htm): managed PostgreSQL, decoupled storage, node, endpoint, backup, and limit model.
  - [MySQL HeatWave documentation](https://docs.oracle.com/en-us/iaas/mysql-database/index.html): managed MySQL DB systems and optional HeatWave analytics, Lakehouse, AutoML, and GenAI processing.
  - [Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en-us/iaas/nosql-database/index.html): table, JSON, key-value, throughput-unit, consistency, and Global Active Table model.
  - [OCI Cache overview](https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm): current Valkey and Redis engines, non-sharded and sharded clusters, and service limits.
  - [OCI Search with OpenSearch overview](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm): managed search clusters, node roles, private endpoints, resizing, patching, and backup responsibilities.
- Findings:
  - Make database-engine and access-model compatibility the first selection boundary. Oracle Database, PostgreSQL, MySQL, NoSQL, cache, and search indexes are not deployment variants of one interchangeable service.
  - Treat Oracle AI Database as a second-level family. Base and Exadata are co-managed, Autonomous delegates the DBMS lifecycle to Oracle, and Globally Distributed Database introduces application-visible sharding.
  - Include OCI Cache and Search with OpenSearch in the portfolio entry point because Oracle exposes them in the database catalog, but label them as purpose-specific derived state rather than default systems of record.
  - Group Exadata's Exascale, Dedicated, and Cloud@Customer choices in one detail note and Autonomous's Serverless, Dedicated, and Cloud@Customer choices in another. Their shared responsibility models matter more for retrieval than separate thin pages for each placement variant.
  - Keep protection, migration, replication, security, and observability services adjacent to the engine pages. Autonomous Recovery Service, Database Migration, GoldenGate, Data Safe, and Database Management do not host the primary database engine.
  - Service versions, regions, shapes, quotas, and hard limits are time-sensitive. Record decision-relevant limits with an as-of date and point readers to current Service Limits instead of copying region matrices.
- Verification:
  - Cross-checked the current Oracle product and documentation pages on 2026-07-16.
  - Targeted Prettier checks and `git diff --check` passed for the overview, detail pages, and Oracle index.
  - `npx quartz build` parsed 142 Markdown inputs and emitted 487 files successfully.
- Open questions: Region availability, preview features, version support, and service limits must be revalidated for the target tenancy at design time.
- Related:
  - [Decision entry](decisions.md#2026-07-16--use-an-engine-first-oci-database-service-hierarchy)

## 2026-07-16 — Personal knowledge-note structure patterns

- Status: verified
- Question: How should article-like technical explanations be abstracted into a reusable
  structure for personal Obsidian notes without importing blog narration?
- Scope: two public reference articles, the repository's Markdown rules, existing protocol,
  service-lifecycle, concept, comparison, and hub pages, and a project-local Codex skill.
- Evidence:
  - [PostgreSQL internal data structures article](https://zenn.dev/calloc134/articles/postgres-internal-mvcc-index):
    orders observable behavior, internal state, algorithms, and implementation differences by
    conceptual dependency.
  - [OAuth/OIDC article](https://zenn.dev/calloc134/articles/5e8da6c491e720): orders purpose,
    actors, artifacts, normal flows, variants, attacks, and mitigations by trust and data flow.
  - `.agents/skills/knowledge-note-structuring/SKILL.md`: resulting transformation workflow.
  - `.agents/skills/knowledge-note-structuring/references/structure-patterns.md`: archetypes,
    source abstraction, dependency map, and structural checks.
- Findings:
  - Reuse dependency order rather than article headings or voice. Introduce boundaries and
    components before flows, and abstract rules before examples or implementation evidence.
  - Define each note with one retrieval question and one primary organizing axis. Select a
    concept/mechanism, protocol/flow, product/service, comparison/selection, or
    procedure/investigation archetype; combine them only with a clear primary type.
  - Convert blog hooks, rhetorical questions, reader guidance, and recaps into scope,
    noun-phrase headings, minimal scenarios, decision rules, or omit them.
  - Give each fact one primary representation. A table owns stable mappings and comparisons;
    adjacent prose should add causes, exceptions, or consequences instead of restating rows.
  - Preserve uncertainty, evidence, frontmatter, aliases, links, and stable URLs. Keep a page
    together when it answers one retrieval question; use a stable hub plus detail notes when
    readers need selection before implementation or sections have independent update cycles.
- Verification:
  - Tested OAuth authorization-server, OCI Vault Secret, and container overview pages with and
    without the skill, without changing the source pages.
  - Iteration 1 found one skill-side regression: a mechanism table was repeated as adjacent
    bullets. After adding the one-primary-representation rule, iteration 2 passed all 15 formal
    assertions in both configurations and removed the duplicate material.
  - Frontmatter, URLs, wiki links, code blocks, images, named mechanisms, uncertainty markers,
    comparison tables, and dependency order were checked. The static review is generated from
    `.agents/skills/knowledge-note-structuring-workspace/iteration-2/`.
- Open questions:
  - Human review is still needed to judge whether the explicit retrieval question, archetype,
    and split rationale make the skill outputs more useful than the already strong baseline.
  - The skill description has not been optimized with trigger-query evaluation.
- Related:
  - [Decision entry](decisions.md#2026-07-16--structure-notes-by-retrieval-question-and-dependency)

## 2026-07-16 — OCI and Oracle AI service portfolio taxonomy

- Status: verified
- Question: How should the current OCI and adjacent Oracle AI offerings be separated into
  infrastructure, model and agent services, data platforms, database AI, prebuilt AI, and
  application-embedded AI?
- Scope: OCI AI Infrastructure, OCI Enterprise AI and Generative AI, Oracle AI Data Platform,
  OCI Data Science, Oracle AI Database, OCI AI Services, Digital Assistant, MySQL HeatWave AI,
  and Fusion AI Agent Studio as of 2026-07-16.
- Evidence:
  - [OCI Generative AI documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/):
    current Enterprise AI platform scope, including models, Enterprise AI Agents, Responses API,
    tools, memory, guardrails, and hosted agent applications.
  - [OCI Enterprise AI](https://www.oracle.com/artificial-intelligence/enterprise-ai/): current
    product umbrella for building, deploying, and governing production agents.
  - [Oracle AI Data Platform](https://www.oracle.com/ai-data-platform/): lakehouse, catalog,
    semantic context, workbench, model/agent lifecycle, and governance scope.
  - [OCI Data Science overview](https://docs.oracle.com/en-us/iaas/Content/data-science/using/overview.htm):
    notebook, training, jobs, pipelines, model catalog, and HTTP model deployment lifecycle.
  - [Oracle AI Database 26ai AI, ML, and analytics](https://docs.oracle.com/en/database/oracle/oracle-database/26/ai.html):
    AI Vector Search, Select AI, machine learning, and database agent documentation.
  - [Oracle AI Database Private Agent Factory](https://docs.oracle.com/en/database/oracle/agent-factory/index.html):
    database-centered no-code agent and workflow platform.
  - [OCI AI Services](https://www.oracle.com/artificial-intelligence/ai-services/): current
    prebuilt Language, Speech, Vision, and Document Understanding services plus Digital Assistant.
  - [OCI GPU Compute](https://www.oracle.com/cloud/compute/gpu/): GPU VM, bare metal,
    Supercluster, and RDMA cluster-networking foundation.
  - [Fusion AI Agent Studio overview](https://docs.oracle.com/en/cloud/saas/fusion-ai/26b/aiaas/overview.html):
    Fusion-native agent design, validation, deployment, tools, APIs, and knowledge access.
  - `content/cloud/oracle/database/services/oci-oracle-database-services.md`: current OCI Oracle Database
    deployment models and operating responsibility boundaries.
- Findings:
  - Treat OCI AI as a layered portfolio: AI infrastructure; managed models and general-purpose
    agents; governed data and ML platforms; database-native AI; prebuilt perception/language
    services; and embedded application AI.
  - The older `OCI AI Agent Platform` product link now redirects to OCI Enterprise AI. Current OCI
    documentation places Enterprise AI Agents within OCI Generative AI, so these names should not
    be presented as independent parallel platforms without a date and branding note.
  - Distinguish four agent-building scopes: OCI Enterprise AI for general custom agentic
    applications, Oracle AI Data Platform for governed data-centric agents, Fusion AI Agent Studio
    for Fusion business workflows, and Oracle AI Database Private Agent Factory for agents close
    to database data. Oracle Digital Assistant remains relevant for structured conversational bot
    and channel use cases.
  - Oracle AI Database is both an AI-enabled data engine and a deployment family. Vector Search,
    Select AI, in-database ML, and agent capabilities are separate from the OCI infrastructure
    choices such as Autonomous AI Database, Base Database Service, and Exadata Database Service.
  - OCI Language, Speech, Vision, Document Understanding, Data Labeling, and Data Science reduce
    the need to build every model from scratch. The standalone OCI Anomaly Detection service is no
    longer available; current anomaly detection and forecasting guidance is exposed through OCI
    Data Science Operators. Do not copy the retired service from older portfolio diagrams.
  - MySQL HeatWave GenAI/AutoML and Fusion AI Agent Studio are adjacent Oracle Cloud offerings,
    not substitutes for the OCI Enterprise AI developer platform. Label them separately when the
    scope is strictly OCI core services.
- Verification: Cross-checked current Oracle product and documentation pages on 2026-07-16,
  compared the database layer with the repository's verified OCI Database service taxonomy, and
  ran fresh-reader checks across the overview, agent, and service-selection pages. Targeted
  Prettier checks, `git diff --check`, and a Quartz production build also passed (132 inputs, 468
  outputs).
- Open questions: Model availability, regions, preview/limited-availability features, service
  names, and licensing change frequently. Verify them in the target tenancy and current service
  documentation before architecture or procurement decisions. The AI Data Platform product page
  explicitly marks some Agent Hub functionality as coming soon.
- Resulting pages:
  - `content/cloud/oracle/ai/index.md`: portfolio map and selection hub.
  - `content/cloud/oracle/ai/`: detail pages for infrastructure, Enterprise AI, AI Data Platform,
    Data Science, AI Database, prebuilt AI services, agent platforms, application AI, and MySQL
    HeatWave AI.

## 2026-07-16 — Oracle Database migration method taxonomy

- Status: verified
- Question: How should the Oracle Database notes separate migration methods from the tools and services that orchestrate them?
- Scope: Data Pump, Transportable Tablespaces, RMAN, PDB operations, Data Guard, GoldenGate, AutoUpgrade, Zero Downtime Migration, and OCI Database Migration.
- Evidence:
  - `content/cloud/oracle/database/migration/oci-oracledb-migration.md`: migration method and orchestration overview.
  - `content/cloud/oracle/database/migration/oracledb-data-pump.md`, `oracledb-transportable-tablespaces.md`, `oracledb-data-guard.md`, `oracledb-goldengate.md`, and `oracledb-pdb-migration.md`: method-specific notes.
  - `content/cloud/oracle/database/maintenance/oracledb-autoupgrade.md`, `content/cloud/oracle/database/migration/oci-zero-downtime-migration.md`, and `content/cloud/oracle/database/migration/oci-database-migration-service.md`: automation and managed-service notes.
  - [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp): source taxonomy and method-selection factors.
  - [Zero Downtime Migration 26.1](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html): current physical, logical, hybrid, and PDB workflows.
  - [OCI Database Migration overview](https://docs.oracle.com/en-us/iaas/database-migration/doc/overview.html): current managed-service role.
- Findings:
  - Separate the data-movement or replication method from its orchestration layer. ZDM and OCI Database Migration combine underlying Oracle technologies; they are not additional data formats.
  - Model online migration as initial load plus change synchronization. Data Pump or RMAN can instantiate the target while GoldenGate or Data Guard carries later changes.
  - Keep RMAN in the existing backup note and add its physical-migration role there instead of duplicating backup and restore guidance.
  - Avoid static support matrices and fixed version or licensing claims in the overview. Link current Oracle documentation and require source/target validation at implementation time.
- Verification:
  - Targeted Prettier checks, `git diff --check`, and the Quartz production build passed after the migration pages and cross-links were added.
- Open questions: Source and target support, licensing, and cloud-service availability remain time-sensitive and must be checked for each migration project.
- Related:
  - [Decision entry](decisions.md#2026-07-16--separate-oracle-database-migration-methods-from-orchestration)

## 2026-07-15 — OCI Base Database Service backup methods

- Status: verified
- Question: How should the OCI Oracle Database backup note distinguish Recovery Service, unmanaged RMAN, and other backup methods using current Base Database Service behavior?
- Scope: Base Database Service managed backups, Autonomous Recovery Service RCV/ZRCV terminology, RMAN to Object Storage, local FRA, Data Pump, and standby backup offload.
- Evidence:
  - `content/cloud/oracle/database/backup/oci-oracledb-backup.md`: stable overview and selection guide.
  - `content/cloud/oracle/database/backup/oci-oracledb-backup-zrcv.md`: Recovery Service, real-time data protection, retention, and immutability.
  - `content/cloud/oracle/database/backup/oci-oracledb-backup-rman.md`: user-managed RMAN design and recovery dependencies.
  - `content/cloud/oracle/database/backup/oci-oracledb-backup-other-methods.md`: managed Object Storage, local FRA, Data Pump, and standby backup roles.
  - [Base Database Service backup and recovery](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html): managed destination behavior, Object Storage schedule and retention, local storage, and unmanaged RMAN guidance.
  - [Configure automatic backups](https://docs.oracle.com/en/cloud/paas/base-database/backup-db/index.html): current destination availability conditions and on-demand backup behavior.
  - [Recovery Service terminology](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-concepts.html): Level 0/1, real-time data protection, and Virtual Level 0 definitions.
  - [RMAN backup to Object Storage](https://docs.oracle.com/en/cloud/paas/base-database/backup-rman/index.html): backup module, SBT, encryption, and required backup contents.
- Findings:
  - Keep the moved backup page as the hub, preserve its former URL through an alias, and place implementation detail in three sibling notes.
  - Treat RCV/ZRCV as shorthand for Recovery Service without/with the extra-cost real-time data protection feature, not as unrelated products.
  - Do not publish a static list of regions where Recovery Service is the only Console destination. Oracle changed the rollout conditions in 2025 and 2026, so direct readers to the current Console and documentation.
  - Managed Object Storage currently uses weekly Level 0, daily Level 1, and archived redo log backups at a minimum 60-minute frequency, with 7/15/30/45/60-day retention choices.
  - Treat Data Pump as a logical export and Data Guard as availability/replication; neither replaces a recoverable physical backup history.
- Verification:
  - All four backup notes, the Oracle index, and the two Codex knowledge files passed targeted Prettier checks.
  - `git diff --check` passed.
  - `npx quartz build` parsed 113 Markdown inputs and emitted 430 files successfully, including all three new detail pages.
- Open questions: Database-service-specific behavior outside Base Database Service should be verified before expanding these notes to Autonomous, Exadata, or multicloud deployments.
- Related:
  - [Decision entry](decisions.md#2026-07-15--split-the-oci-database-backup-note-by-reader-intent)

## 2026-07-07 — OCI Oracle Database service taxonomy

- Status: verified
- Question: Which current OCI Oracle Database deployment models should an advanced service
  overview distinguish?
- Scope: Base Database Service, Exadata Database Service, Autonomous AI Database,
  Cloud@Customer, globally distributed variants, and adjacent multicloud models.
- Evidence:
  - `content/cloud/oracle/database/services/oci-oracle-database-services.md`: resulting service map,
    responsibility boundaries, selection criteria, and official source links.
  - [Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/about/): current
    VM, edition, RAC, version, maintenance, backup, and support model.
  - [Exadata Database Service on Exascale Infrastructure](https://docs.oracle.com/en-us/iaas/exadb-xs/doc/overview-exadb-xs-service.html):
    shared physical infrastructure, VM cluster scaling, and Exascale storage architecture.
  - [Autonomous responsibility model](https://docs.oracle.com/en/cloud/paas/autonomous-database/shared-responsibility-model.html):
    Oracle-managed DBMS lifecycle versus customer-owned application, identity, network, and
    data responsibilities.
- Findings:
  - Treat co-managed versus Autonomous as the first decision boundary; `Dedicated` describes
    resource isolation, not who operates the DBMS.
  - Include ExaDB-XS alongside Base and dedicated Exadata. It is a shared-infrastructure
    Exadata service with customer-managed guest/database layers, not an Autonomous tier.
  - ExaDB-XS storage differs materially by database generation: 26ai uses Exascale Smart
    Storage without database-file ASM, while 19c uses Exascale block storage with ASM.
  - Model public cloud versus Cloud@Customer separately from the operational model. Both
    co-managed and Autonomous offerings can use customer-data-center Exadata.
  - Treat globally distributed services as sharded application/data architectures rather
    than ordinary cross-region standby options.
- Verification:
  - Opened every official documentation URL listed in the article on 2026-07-07.
  - `npx prettier --check content/cloud/oracle/database/services/oci-oracle-database-services.md content/cloud/oracle/index.md`
    passed.
  - `npx quartz build` parsed 110 Markdown inputs and emitted 424 files successfully.
- Open questions:
  - ExaDB-XS and multicloud regional availability and feature matrices are time-sensitive;
    verify them at design time rather than copying a static region list into content.

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
