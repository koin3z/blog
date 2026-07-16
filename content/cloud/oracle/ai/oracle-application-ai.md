---
title: Oracle Application AI・Oracle AI Agent Studio for Fusion Applications
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - oracle/fusion
description: Fusion Applications の組込み AI、AI Agent Studio、OCI AI Accelerator Packs、Code Assist を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

Oracle は OCI の developer platform だけでなく、Fusion Applications などの application に AI と agent を組み込んでいる。この層では model API を作ることより、既存の business object、role、workflow、approval の中で outcome を実現することが中心になる。

## Oracle AI Agent Studio for Fusion Applications

Oracle AI Agent Studio for Fusion Applications（以下、AI Agent Studio）は、Fusion Applications 用 agent を作成、構成、validate、deploy する design-time environment である。

- Oracle が提供する agent template の拡張
- custom agent と multiagent flow の作成
- Fusion knowledge store、business object、API、tool の利用
- user approval を含む workflow orchestration
- Fusion role / security configuration の適用
- test、validation、traceability
- third-party agent / system との integration

Fusion data を OCI の汎用 agent から単純に REST access する構成と異なり、AI Agent Studio は application の business logic と role を理解した場所で agent を動かす。請求、採用、調達、在庫、受注など Fusion transaction を更新する場合の第一候補になる。

## 設計時の注意

- agent が利用する Fusion family、business object、role、data access を明確にする。
- standard agent / template の update と customer customization の差分を管理する。
- external connector と custom tool に user context が伝播するか確認する。接続先 runtime が Fusion の外にある場合は、接続先でも authentication、authorization、retention、audit を強制する。
- approval 前後の state、retry、duplicate action、long-running process を試験する。
- generated recommendation と system-of-record update を別の step にする。
- quarterly update 前後に evaluation と regression test を実行する。

## Fusion 組込み AI

Fusion ERP、HCM、SCM、CX には predictive、generative、agentic AI が feature として組み込まれる。利用者が OCI Generative AI endpoint を直接構築しなくても利用できるが、feature enablement、role、data usage、supported language、release readiness を Fusion の documentation で確認する。

`AI feature included` と `unlimited model usage` は同義ではない。subscription、consumption、custom agent SKU、external model / connector の条件は契約時点で確認する。

## OCI AI Accelerator Packs

AI Accelerator Packs は、特定 use case に必要な AI service、data store、application component をまとめた full-stack solution である。generic platform を一から組み立てる前に、対象 use case と一致する pack があれば prototype の起点にできる。

ただし one-click deployment でも、作成される OCI resource、IAM policy、public endpoint、sample credential、data retention、upgrade path を確認する。solution template は business control と production operation を自動的に完成させるものではない。

## Oracle Code Assist

Oracle Code Assist は Java、PL/SQL、SuiteScript、OCI application development を重視する coding assistant である。code generation、explanation、test、documentation、upgrade / migration support などを対象にする。

2026 年 7 月時点の [Oracle Code Assist product page](https://www.oracle.com/europe/application-development/code-assist/) は Limited Availability と案内している。一般提供を前提にせず、current product page、IDE plugin、tenant entitlement、source code retention、telemetry、supported language を確認する。

## OCI Enterprise AI との違い

| 項目        | Oracle AI Agent Studio for Fusion Applications  | OCI Enterprise AI                                      |
| ----------- | ----------------------------------------------- | ------------------------------------------------------ |
| 主な利用者  | Fusion administrator、business application team | application developer、AI engineer                     |
| Runtime     | Fusion Applications 内                          | OCI の API / hosted runtime                            |
| Data / tool | Fusion object、knowledge、approval              | OCI / third-party data、MCP、Function、File、SQL       |
| Security    | Fusion role と application security             | OCI IAM、Identity Domains、target system authorization |
| 主な成果    | business process の自動化                       | custom AI product / agent application                  |

製品横断比較は [[cloud/oracle/ai/oracle-ai-agent-platforms|Oracle AI Agent Platform 比較]]を参照。

## 公式ドキュメント

- [Overview of AI Agent Studio](https://docs.oracle.com/en/cloud/saas/fusion-ai/26b/aiaas/overview.html)
- [Oracle AI for Fusion Applications](https://www.oracle.com/applications/fusion-ai/)
- [OCI AI Accelerator Packs](https://www.oracle.com/artificial-intelligence/ai-accelerator-packs/)
- [Oracle Code Assist](https://www.oracle.com/europe/application-development/code-assist/)
