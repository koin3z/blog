---
title: OCI・Oracle AI サービス全体像
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
aliases:
  - cloud/oracle/oci-ai-services
description: OCI と関連する Oracle AI サービスを、基盤、モデル、エージェント、データ、Database、業務アプリの層で整理する。
---

Oracle の AI は、単一の「AI サービス」ではなく、GPU infrastructure から業務 application までを覆う portfolio である。このメモでは、OCI の core service と、Oracle Database、MySQL HeatWave、Fusion Applications などの隣接製品を分けて整理する。内容は 2026 年 7 月時点。

## まず結論

- 大規模な学習・推論用 compute は **OCI AI Infrastructure** が担当する。
- model API と汎用 agent application の開発・実行は **OCI Enterprise AI / OCI Generative AI** が中心になる。
- lakehouse、catalog、semantic context、data/AI governance を一体化するのが **Oracle AI Data Platform** である。
- custom ML の実験、学習、pipeline、model deployment は **OCI Data Science** が担当する。
- business data の近くで Vector Search、Select AI、RAG、agent を実装するのが **Oracle AI Database** である。
- OCR、音声、画像、自然言語などを API で組み込む場合は **OCI AI Services** を使う。
- Fusion ERP / HCM / SCM / CX の業務 action を自動化する agent は **AI Agent Studio for Fusion Applications** の領域であり、OCI の汎用 agent platform とは分けて考える。

## 全体像

次の表は厳密な上下依存 stack ではなく、主な責任範囲を見渡すための service map である。実際の system では、例えば Oracle AI Database、OCI Generative AI、OCI Data Science を同じ構成で組み合わせる。

| 層                    | 主なサービス                                                           | 提供するもの                                                                | 詳細                                                                  |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| AI infrastructure     | GPU Compute、OCI Supercluster、RDMA Cluster Network、OKE               | model の学習・fine-tuning・推論を動かす compute / network                   | [[cloud/oracle/ai/oci-ai-infrastructure\|OCI AI Infrastructure]]      |
| Model / agent runtime | OCI Generative AI の Models / Enterprise AI Agents                     | model API、Responses API、tool、memory、agent hosting、guardrail            | [[cloud/oracle/ai/oci-enterprise-ai\|OCI Enterprise AI]]              |
| Data / AI platform    | Oracle AI Data Platform、Workbench                                     | lakehouse、catalog、semantic layer、notebook、agent / model registry        | [[cloud/oracle/ai/oracle-ai-data-platform\|Oracle AI Data Platform]]  |
| ML platform           | OCI Data Science、Data Labeling                                        | notebook、job、pipeline、model catalog / deployment、MLOps                  | [[cloud/oracle/ai/oci-data-science\|OCI Data Science]]                |
| Database AI           | Oracle AI Database 26ai、Autonomous AI Database                        | AI Vector Search、Select AI、Oracle Machine Learning、Private Agent Factory | [[cloud/oracle/ai/oracle-ai-database\|Oracle AI Database の AI 機能]] |
| Prebuilt AI           | Language、Speech、Vision、Document Understanding、Digital Assistant    | text、音声、画像、document、会話を処理する managed API                      | [[cloud/oracle/ai/oci-ai-services\|OCI AI Services]]                  |
| Application AI        | Oracle AI Agent Studio for Fusion Applications、組込み AI、Code Assist | 業務 process や開発作業に埋め込まれた AI                                    | [[cloud/oracle/ai/oracle-application-ai\|Oracle Application AI]]      |
| MySQL AI              | MySQL HeatWave GenAI / AutoML / Lakehouse                              | MySQL 上の transaction、analytics、ML、GenAI                                | [[cloud/oracle/ai/mysql-heatwave-ai\|MySQL HeatWave AI]]              |

### OCI core と隣接領域

| 区分                          | このメモで扱うサービス                                                       | 位置付け                                                     |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| OCI core                      | AI Infrastructure、OCI Generative AI、OCI Data Science、OCI AI Services      | OCI tenancy 内で直接構成する cloud service                   |
| OCI 上の Oracle data service  | Oracle AI Database、Autonomous AI Database、MySQL HeatWave                   | database / data service に統合された AI                      |
| Oracle platform / application | Oracle AI Data Platform、Fusion Applications、Digital Assistant、Code Assist | OCI と連携するが、OCI の単一 service family とは限らない領域 |

## 「AI Agent Platform」を区別する

Oracle の agent 製品は対象範囲が異なる。名称だけで選ばず、agent が扱う data と実行する action から決める。

| Platform                                       | 主な対象                                              | 特徴                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| OCI Enterprise AI Agents                       | OCI と third-party をまたぐ custom agent application   | OpenAI-compatible Responses API、MCP、Function Calling、File Search、Code Interpreter、memory、hosted runtime |
| OCI Generative AI Agents service               | RAG、SQL、API、agent-as-a-tool を組み合わせる managed agent | Knowledge Base と tool を OCI resource として構成                                                              |
| Oracle AI Data Platform agents                 | catalog 済み data を使う分析・data workflow               | lakehouse、semantic context、catalog、governance と統合                                                       |
| Oracle AI Database Private Agent Factory       | Database data を中心とする private agent                | prebuilt / custom agent、workflow、Database の security と data processing                                  |
| Oracle AI Agent Studio for Fusion Applications | Fusion Applications の業務 process                   | Fusion business object、API、knowledge、role、approval と統合                                                  |
| Oracle Digital Assistant                       | 対話 flow と channel を重視する chatbot                   | intent、entity、skill、明示的な dialog flow、Teams / Slack / Web / mobile channel                               |

詳細な比較は [[cloud/oracle/ai/oracle-ai-agent-platforms|Oracle AI Agent Platform 比較]]を参照。

> [!note] 製品名の変化
>
> Oracle の Web page には `OCI AI Agent Platform` という名称も残っているが、現在の製品 page は OCI Enterprise AI へ遷移し、現行 documentation は Enterprise AI Agents を OCI Generative AI の機能として説明している。既存の OCI Generative AI Agents service の documentation も残るため、採用時は target region / tenancy で利用する resource type と API を確認する。

### 現行名称の階層

| レベル                  | 名称                                        | このメモでの意味                                                            |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Product umbrella        | OCI Enterprise AI                           | model、agent、data、infrastructure をまとめる製品群の呼称                   |
| OCI service             | OCI Generative AI                           | model と agent capability を提供する OCI service                            |
| Capability / API family | Enterprise AI Models / Enterprise AI Agents | OCI Generative AI 内の model / agent 機能                                   |
| 別系統の OCI service    | OCI Generative AI Agents service            | Agent、Knowledge Base、Tool、Endpoint resource を持つ managed agent service |

したがって、architecture diagram や IAM policy では umbrella 名だけを書かず、利用する OCI service、resource type、API endpoint まで記載する。

## 選定の入口

1. 既存 model を API から呼びたい場合は OCI Generative AI の on-demand model を評価する。
2. tool、memory、RAG、multi-step processing が必要なら OCI Enterprise AI Agents を加える。
3. 自社 data の catalog、quality、lineage、semantic definition が未整備なら、agent より先に Oracle AI Data Platform または既存 data platform を整備する。
4. Oracle Database の current data を SQL と vector search で組み合わせる場合は Oracle AI Database を中心に置く。
5. 独自 model の学習、評価、batch job、MLOps が中心なら OCI Data Science、Database 内の ML は Oracle Machine Learning、MySQL 内の標準 ML は HeatWave AutoML、組織横断の data / AI 開発環境は AI Data Platform Workbench を評価する。
6. OCR、音声認識、画像分類など単一 capability で足りる場合は prebuilt AI service を直接利用する。
7. Fusion の承認や業務 object を更新する場合は Fusion AI Agent Studio を優先する。

## 共通して設計するもの

### Identity と権限

人、application、agent、tool、Database connection を別の principal として扱い、OCI IAM、Identity Domains、Database role、Fusion role を重ねて最小権限にする。agent が model を呼べる権限と、業務 data を読み書きできる権限は分離する。

### Data boundary

prompt に含める schema metadata、検索結果、添付 file、会話履歴、tool response を棚卸しする。data retention、model provider、region、private endpoint、encryption key、log への出力範囲を service ごとに確認する。

### Agent action

回答生成と更新 action を分ける。支払、発注、account 変更、production operation などは、allowlist、parameter validation、human approval、idempotency、timeout、rollback、audit trail を実装する。

### Evaluation と運用

正答率だけでなく、grounding、citation、tool selection、権限逸脱、prompt injection、latency、token / compute cost を測る。model や service version の変更に備え、固定した evaluation set で regression test を行う。

### Network、capacity、supply chain

private endpoint、VCN / subnet、service gateway、DNS、egress allowlist、cross-region / cross-cloud data transfer を service 間の data flow として設計する。GPU、dedicated endpoint、Database、model は region ごとに availability と capacity が異なるため、quota だけでなく capacity reservation、fallback region、model / container / package の provenance と license も確認する。

### Resilience と cost

agent の一部が失敗したときの retry、timeout、idempotency、partial result、safe stop を定義する。multi-region が必要な場合は、model、vector、memory、Database、tool の replication と failover を個別に設計する。cost は token だけでなく、GPU / endpoint の idle time、Database、storage、data transfer、logging、人手 review まで含めて測る。

## 関連ページ

- [[cloud/oracle/ai/oci-ai-infrastructure]]
- [[cloud/oracle/ai/oci-enterprise-ai]]
- [[cloud/oracle/ai/oracle-ai-data-platform]]
- [[cloud/oracle/ai/oci-data-science]]
- [[cloud/oracle/ai/oracle-ai-database]]
- [[cloud/oracle/ai/oci-ai-services]]
- [[cloud/oracle/ai/oracle-ai-agent-platforms]]
- [[cloud/oracle/ai/oracle-application-ai]]
- [[cloud/oracle/ai/mysql-heatwave-ai]]

## 公式ドキュメント

- [OCI Enterprise AI](https://www.oracle.com/artificial-intelligence/enterprise-ai/)
- [OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/)
- [Oracle AI Data Platform](https://www.oracle.com/ai-data-platform/)
- [OCI Data Science](https://docs.oracle.com/en-us/iaas/Content/data-science/using/overview.htm)
- [OCI AI Services](https://www.oracle.com/artificial-intelligence/ai-services/)
- [Oracle AI Database 26ai — AI, ML, and Analytics](https://docs.oracle.com/en/database/oracle/oracle-database/26/ai.html)
