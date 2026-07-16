---
title: Oracle AI Agent Platform 比較
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - ai/agent
description: OCI Enterprise AI、AI Data Platform、Oracle AI Database、Fusion、Digital Assistant の agent platform を比較する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

Oracle の agent platform は、同じ LLM agent でも data、runtime、business action、governance の境界が異なる。製品名ではなく、agent が「どこで動き、何を読み、何を変更するか」で選ぶ。

## 比較

| Platform                                                                                  | Runtime / 開発方式                                  | 主な data / tool                                             | 向く用途                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| [[cloud/oracle/ai/oci-enterprise-ai\|OCI Enterprise AI Agents]]                           | Responses API、hosted container、hybrid             | File / Vector Store、Code Interpreter、Function、MCP、NL2SQL | OCI / third-party を横断する custom agent application     |
| OCI Generative AI Agents service                                                          | Agent / Knowledge Base / Tool / Endpoint resource   | RAG、SQL、API endpoint、Function、agent-as-a-tool            | OCI resource として managed agent を構成する既存 workload |
| [[cloud/oracle/ai/oracle-ai-data-platform\|AI Data Platform agents]]                      | Workbench の low-code / code-first agent            | Master Catalog、lakehouse、semantic context、MCP / A2A       | governed enterprise data を分析・処理する agent           |
| [[cloud/oracle/ai/oracle-ai-database\|Private Agent Factory]]                             | no-code agent / workflow                            | Oracle AI Database、enterprise repository、LLM               | Database data に近い private knowledge / analysis agent   |
| [[cloud/oracle/ai/oracle-application-ai\|Oracle AI Agent Studio for Fusion Applications]] | template、visual flow、custom tool、multiagent flow | Fusion object、API、knowledge、approval、role                | ERP / HCM / SCM / CX の業務 action                        |
| [[cloud/oracle/ai/oci-ai-services\|Oracle Digital Assistant]]                             | intent、entity、skill、dialog flow                  | REST、SQL dialog、channel、human transfer                    | task-oriented chatbot と対話 channel                      |

## 選定順序

### 1. System of record を決める

- Oracle Database 内で SQL / RAG を完結：Select AI
- Database 中心の no-code agent / workflow：Private Agent Factory
- custom UX、複数 SaaS、独自 tool を横断：OCI Enterprise AI Agents + Database Tools MCP Server
- Fusion Applications が中心：Fusion AI Agent Studio
- lakehouse / cross-source analytics が中心：Oracle AI Data Platform
- 複数 cloud / SaaS / custom API を横断：OCI Enterprise AI Agents
- channel と定型会話が中心：Oracle Digital Assistant

### 2. Answer と Action を分ける

Knowledge Agent が回答するだけなのか、record update、approval、payment、deployment まで実行するのかで risk が変わる。action agent では次を必須にする。

- tool allowlist と operation allowlist
- user / workload identity の propagation
- resource-level authorization
- typed input と schema validation
- duplicate execution を防ぐ idempotency key
- high-impact operation の human approval
- before / after value と actor を残す audit log
- timeout、partial failure、compensation / rollback

### 3. Memory の境界を決める

conversation history、long-term preference、business record、retrieved document を同じ「memory」として扱わない。

| Data                 | 推奨する扱い                                              |
| -------------------- | --------------------------------------------------------- |
| Conversation context | retention と project / user isolation を設定              |
| User preference      | consent、purpose、update / delete interface を用意        |
| Business transaction | system of record に保存し、memory を正本にしない          |
| Retrieved document   | source ID、version、ACL、citation を保持                  |
| Tool result          | request ID、authorization result、execution status を記録 |

### 4. Model と orchestration を分離する

agent framework、model provider、embedding model、vector store、tool protocol を交換できる境界にする。model ID を application logic 全体へ埋め込まず、configuration と evaluation policy で管理する。

## 主な architecture pattern

### OCI-native custom agent

Client → OCI Responses API → File Search / MCP / Function → OCI / third-party system という構成。managed primitive を使いながら application 側で UX と business rule を持つ。

### Database-grounded agent

要件に応じて 3 系統に分ける。

- Database 内の SQL / RAG interface が中心：Client → Select AI → Oracle AI Database
- Database 中心の no-code workflow：Client → Private Agent Factory → Oracle AI Database / enterprise repository
- custom UX と外部 tool が必要：Client → Enterprise AI Agent → NL2SQL / Database Tools MCP Server → Oracle AI Database

いずれも SQL generation と execution authorization を分離し、Database user / role、object allowlist、resource limit、audit を適用する。

### Fusion business agent

Fusion UI → AI Agent Studio agent team → Fusion business object / approval / external tool という構成。Fusion 内の object と API には Fusion role と business logic を適用し、重要 action に checkpoint を置く。external connector / tool は Fusion の外に runtime や data plane を持つ場合があるため、接続先でも authentication、authorization、retention、audit を強制する。

### Governed data agent

AI Data Platform Workbench → catalog / semantic layer → lakehouse / Autonomous AI Database → analytics / agent response という構成。business term と policy definition を agent ごとに再実装しない。ただし実行時 authorization は source、serving endpoint、connector、tool 側でも強制する。

## 評価項目

- unsupported request を拒否できるか
- source のない回答を識別できるか
- outdated / revoked document を検索しないか
- user ごとの row / object access を守るか
- malicious document や prompt injection で tool が逸脱しないか
- same request の再送で action が重複しないか
- model / prompt / tool version を含む trace が残るか
- human escalation と safe stop が機能するか

## 公式ドキュメント

- [Enterprise AI Agents in OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/agents.htm)
- [OCI Generative AI Agents](https://docs.oracle.com/en-us/iaas/Content/generative-ai-agents/home.htm)
- [Oracle AI Data Platform](https://www.oracle.com/ai-data-platform/)
- [Oracle AI Database Private Agent Factory](https://docs.oracle.com/en/database/oracle/agent-factory/index.html)
- [Fusion AI Agent Studio](https://docs.oracle.com/en/cloud/saas/fusion-ai/26b/aiaas/overview.html)
- [Oracle Digital Assistant](https://docs.oracle.com/en-us/iaas/digital-assistant/doc/overview-digital-assistants-skills.html)
