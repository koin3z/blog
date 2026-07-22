---
title: Oracle AI Data Platform
date: 2026-07-16
modified: 2026-07-22
draft: false
tags:
  - cloud/oci/ai
  - data/platform
description: Oracle AI Data Platform の lakehouse、catalog、Workbench、AI/ML、agent governance を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

Oracle AI Data Platform は、enterprise data を収集・整理し、analytics、ML、AI agent から安全に利用するための統合 data platform である。単なる LLM endpoint ではなく、data lakehouse、metadata、semantic context、development workspace、governance をまとめる。

## 主な構成

### Data lakehouse

Object Storageと[[data/open-table-formats|オープンテーブルフォーマット]]を使い、raw dataからcurated dataまでを[[data/index|レイクハウス]]のmedallion architectureで管理する。

- **Bronze**：source に近い raw / landed data
- **Silver**：clean、standardize、join、quality check 済み data
- **Gold**：analytics、ML、agent が利用する curated data product

[Workbenchのtable](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/tables.html)はDelta Lakeを主なtransactional table formatとして使う。
Delta Uniformは、Delta tableからIceberg／Hudi互換metadataを生成する。
Platform全体が外部Iceberg／Delta tableを参照する経路とは、metadataとcommitのownerが異なる。

Spark による分散処理と、Autonomous AI Database / SQL による serving を組み合わせる。すべての data を一か所へ copy することが目的ではなく、external catalog、zero-copy query、replication を要件に応じて使い分ける。

### Master Catalog と semantic context

[Master Catalog](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/manage-master-catalog.html)はstandard catalogとexternal catalogを収容する最上位containerであり、table、file、model、feature、knowledge base、agentなどのassetを登録し、technical metadataとbusiness meaningを結び付ける。

- standard catalogは、配下assetのmetadata lifecycleを管理する
- external catalogでは外部sourceがmetadata lifecycleを管理し、Master Catalogは同期したmetadataを保持する

- Autonomous AI Database、Object Storage、third-party source の external catalog
- business glossary、taxonomy、ontology、synonym
- lineage、ownership、tag、custom property
- asset種別に応じたdiscovery、versioning、access control

agent が column name だけでなく business term、metric、relationship を理解するには、prompt engineering より先に catalog と semantic definition の品質を上げる必要がある。

### AI Data Platform Workbench

Workbench は data engineer、data scientist、AI developer が共同作業する development environment である。

- Spark-powered notebook
- data preparation と workflow orchestration
- [Machine Learning](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/machine-learning.html)と[Models](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/models.html)によるexperiment、model training、model registry（Preview）
- low-code / code-first の agent development
- catalog asset を利用する RAG、SQL、MCP、prompt 管理
- workspace と role による分離

## Agent と AI asset の管理

Workbench では、catalog asset と semantic context を使う low-code / code-first agent を構築できる。agent、model、knowledge base、tool を data asset と同じ governance boundary で扱う方向性が示されている。

[Workbench User Guide](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/toc.htm)には、remote MCP tool、A2A deployment、agent deployment、monitoringの手順がある。
[Product page](https://www.oracle.com/ai-data-platform/)で`coming soon`とされるAgent Hubの統合UIや一部機能、PreviewのML／Modelsとはavailabilityを分ける。
Target tenancyとcurrent documentationで各機能の状態を確認し、roadmap itemをcurrent GA capabilityとして設計に組み込まない。

Catalog で access policy や ownership を定義しても、実行時の authorization は source Database、serving endpoint、connector、MCP server、tool 側でも必ず強制する。catalog で見えることと、agent が実 data を読み書きできることを同一視しない。

## OCI Data Science との違い

| 観点       | Oracle AI Data Platform                                      | OCI Data Science                                                             |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 主目的     | enterprise data と AI asset の統合・governance               | model の実験、学習、deployment、MLOps                                        |
| Data scope | lakehouse、catalog、external source、semantic layer          | project / notebook が接続する data source                                    |
| 主な利用者 | data engineer、steward、analyst、AI developer、business user | data scientist、ML engineer                                                  |
| Agent      | catalog / semantic context と統合して構築・管理              | custom code や model deployment を構築可能だが agent registry が中心ではない |
| 導入単位   | organization-wide data / AI platform                         | project / workload 単位から開始しやすい                                      |

両者は排他ではない。AI Data Platform で governed data product を作り、OCI Data Science で specialized model を開発し、OCI Enterprise AI で agent application から利用する構成も取れる。

## 導入時の注意

- source system、owner、data classification、refresh SLA を catalog 登録前に決める。
- Bronze / Silver / Gold を単なる folder 名にせず、quality と access policy の contract として定義する。
- zero-copy と replication の判断を、latency、source load、consistency、egress、residency から行う。
- workspace role と catalog asset role を分け、data discovery と data use の権限を明確にする。
- notebook の package、secret、external network access、generated artifact を管理する。
- agent が利用する semantic definition と source data の変更を versioning し、evaluation を再実行する。

## 公式ドキュメント

- [Oracle AI Data Platform](https://www.oracle.com/ai-data-platform/)
- [Overview of Oracle AI Data Platform and Workbench](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/overview-oracle-ai-data-platform.html)
- [Oracle AI Data Platform Workbench Guides](https://docs.oracle.com/en/cloud/paas/ai-data-platform/books.html)

## 関連ページ

- [[data/index|データ基盤の構成要素]]
- [[data/open-table-formats|オープンテーブルフォーマット]]
- [[data/apache-iceberg|Apache Iceberg]]
