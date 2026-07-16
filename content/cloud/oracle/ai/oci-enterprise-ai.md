---
title: OCI Enterprise AI・Generative AI
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
description: OCI Enterprise AI と OCI Generative AI の model、agent、tool、memory、hosting、guardrail を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

OCI Enterprise AI は、model の選択から agent application の構築、deployment、governance までを扱う現在の product umbrella である。OCI documentation では、これらの中心 service を **OCI Generative AI** として説明している。

## 名称と resource の階層

| レベル            | 名称                                        | 実装上の読み方                                                        |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Product umbrella  | OCI Enterprise AI                           | Oracle が model、agent、data、infrastructure をまとめる呼称           |
| OCI service       | OCI Generative AI                           | endpoint、project、model、application などを作成する service          |
| Capability family | Enterprise AI Models / Enterprise AI Agents | OCI Generative AI 内の model / agent 機能                             |
| 別の OCI service  | OCI Generative AI Agents service            | Agent、Knowledge Base、Tool、Endpoint resource を持つ managed service |

設計資料と IAM policy では umbrella 名だけでなく、実際に作成する service resource と API を記載する。

## 2 つの plane

### Enterprise AI Models

OCI Generative AI は次の model usage を提供する。

- Oracle が提供する pretrained model の on-demand inference
- dedicated AI cluster による分離された model hosting
- Hugging Face または Object Storage からの対応 model import
- chat、reasoning、embedding、rerank などの API
- endpoint と private endpoint
- model endpoint へ適用する guardrail

on-demand は capacity 管理を減らして検証を始めやすい。dedicated mode は performance isolation や custom endpoint が必要な production workload に向くが、minimum commitment、capacity planning、endpoint lifecycle を確認する。imported model は runtime compatibility だけでなく、model license と third-party terms を利用者が管理する。

### Enterprise AI Agents

Enterprise AI Agents には 2 つの作り方がある。

1. **OCI Responses API**：OCI-managed execution 上で model、conversation、tool、memory を組み合わせる。
2. **Hosted Agentic Applications**：独自 agent runtime を container image として package し、OCI Generative AI の application / deployment resource で運用する。

両者を組み合わせ、Responses API で model orchestration と tool use を行い、独自処理だけを hosted application に配置する hybrid architecture も取れる。

## Responses API と resource

OCI Responses API は OpenAI-compatible な request pattern を使う。これは OpenAI API 全体との完全互換を意味せず、対応 field、model、tool、streaming、error、SDK の差を current documentation で確認する。実行先は OCI endpoint、認証は OCI authentication、data plane は選択した OCI region である。

| Resource / capability         | 役割                                                                       |
| ----------------------------- | -------------------------------------------------------------------------- |
| Project                       | response、conversation、file、container、memory などを workload 単位に分離 |
| Conversations / Memory        | multi-turn context、short-term / long-term memory                          |
| Files / Vector Stores         | document ingestion、semantic / keyword retrieval                           |
| Containers / Code Interpreter | isolated environment での code execution                                   |
| Function Calling              | application が定義した local tool の呼出し                                 |
| MCP Calling                   | remote MCP server が公開する tool の利用                                   |
| File Search                   | vector store から関連 document を取得                                      |
| SQL Search（NL2SQL）          | semantic store を使い natural language から SQL を生成                     |

NL2SQL は SQL を生成する機能と、Database で SQL を実行する権限を分離している。実行には DBTools MCP Server などを使い、Database 側の identity、role、allowlist、audit を適用する。

## Hosted Agentic Applications

hosted application は、scaling、managed storage、network、authentication を application resource に定義し、container image を deployment として実行する。

- public / private endpoint と egress restriction
- OAuth 2.0 と OCI IAM Identity Domains の integration
- request rate、concurrency、CPU、memory に基づく autoscaling
- Autonomous Database、OCI PostgreSQL、OCI Cache などの managed state store
- HTTP、SSE、WebSocket など agent server に応じた transport

container 内の framework や agent logic は利用者が作成する。platform が scale と endpoint を管理しても、dependency、container vulnerability、prompt、tool、data access、application error は利用者が管理する。

## OCI Generative AI Agents service との関係

OCI には、Knowledge Base と RAG / SQL / API Endpoint / Function Calling / Agent-as-a-tool を構成する **OCI Generative AI Agents service** の documentation もある。一方、[2026 年 3 月 31 日に GA となった Enterprise AI Agents](https://docs.oracle.com/en-us/iaas/releasenotes/generative-ai/enterprise-ai.htm) は Responses API と composable resource を中心とする。

このメモでは、新規 custom agent application は current documentation が primary API とする Responses API を先に評価する。これは Generative AI Agents service の廃止や一律移行を示すものではない。既存 resource を利用している場合は、名称だけから移行を判断せず、region、tool、knowledge base、endpoint、API compatibility と service announcement を確認する。

## Security と governance

- production workload は workload identity と IAM policy を使い、long-lived key を減らす。
- public egress を許可する tool、MCP server、URL を allowlist 化する。
- prompt injection guardrail だけに依存せず、tool parameter と authorization を実行直前に検証する。
- conversation、memory、file、vector store、container の retention と削除手順を決める。
- input / output、tool call、model、latency、token、error を correlation ID で追跡する。
- model response を data や action の正しさと同一視せず、schema validation と human approval を置く。

## 他サービスとの選択

- custom ML lifecycle が中心なら [[cloud/oracle/ai/oci-data-science|OCI Data Science]]。
- governed lakehouse と catalog が中心なら [[cloud/oracle/ai/oracle-ai-data-platform|Oracle AI Data Platform]]。
- Oracle Database 内の SQL / vector / RAG が中心なら [[cloud/oracle/ai/oracle-ai-database|Oracle AI Database]]。
- Fusion business process の action が中心なら [[cloud/oracle/ai/oracle-application-ai|Fusion AI Agent Studio]]。

## 公式ドキュメント

- [OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/)
- [Enterprise AI Models](https://docs.oracle.com/en-us/iaas/Content/generative-ai/models.htm)
- [Enterprise AI Agents](https://docs.oracle.com/en-us/iaas/Content/generative-ai/agents.htm)
- [Hosted Applications](https://docs.oracle.com/en-us/iaas/Content/generative-ai/applications.htm)
- [Guardrails for OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/guardrails.htm)
- [OCI Generative AI Agents](https://docs.oracle.com/en-us/iaas/Content/generative-ai-agents/home.htm)
