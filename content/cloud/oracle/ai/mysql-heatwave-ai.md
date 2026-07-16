---
title: MySQL HeatWave AI
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - cloud/oci/mysql
description: MySQL HeatWave GenAI、AutoML、Lakehouse と Oracle AI Database との選択を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

MySQL HeatWave は、MySQL transaction、analytics、lakehouse、machine learning、generative AI を同じ managed service で提供する。Oracle AI Database とは別の database engine / service family であり、既存 application、SQL compatibility、operation model から選ぶ。

## HeatWave の構成

MySQL HeatWave DB System に HeatWave cluster を追加し、次の機能を利用する。

| 機能                       | 役割                                                           |
| -------------------------- | -------------------------------------------------------------- |
| HeatWave Query Accelerator | MySQL analytical / mixed query を HeatWave node へ offload     |
| HeatWave Lakehouse         | Object Storage の open file data を MySQL から query           |
| HeatWave AutoML            | Database data を使った model training、explanation、prediction |
| HeatWave GenAI             | LLM、vector store、natural-language conversation、RAG          |

application は MySQL endpoint へ接続し、対応 query が HeatWave cluster へ offload される。利用者は HeatWave node に直接接続しない。

## HeatWave GenAI

HeatWave GenAI は、Database 内の data と vector store を使い、natural-language conversation と RAG を実装する。in-database LLM と OCI Generative AI を通じた外部 model を use case に応じて選択できる。

- document ingestion、embedding、vector store、retrieval を MySQL workflow に近づけられる。
- SQL application から GenAI function を利用できる。
- source row と vector / document を一貫した access boundary で管理しやすい。
- model ごとの region、availability、data handling、cost を確認する。

## HeatWave AutoML

HeatWave AutoML は、classification、regression、forecasting、anomaly detection、recommendation などの model lifecycle を Database service に統合する。data movement を減らせる一方、target leakage、sampling、business metric、deployment threshold の責任は利用者に残る。

Data Science と比較し、MySQL data 上で standard ML を早く実装するなら AutoML、custom Python environment、特殊 library、複雑な pipeline が必要なら OCI Data Science を選ぶ。

## HeatWave Lakehouse

Lakehouse は Object Storage の data を HeatWave format へ変換・load し、MySQL SQL から query する。AI 用 corpus や training data を扱う場合も、file format、schema evolution、refresh、load time、memory capacity を設計する。

Oracle AI Data Platform の organization-wide catalog / governance と、HeatWave Lakehouse の MySQL-centric query acceleration は目的が異なる。

## Oracle AI Database との選択

| 観点                 | MySQL HeatWave                     | Oracle AI Database                                   |
| -------------------- | ---------------------------------- | ---------------------------------------------------- |
| Engine / application | MySQL protocol / ecosystem         | Oracle Database / SQL / PL/SQL ecosystem             |
| AI search            | HeatWave GenAI vector store / RAG  | AI Vector Search、hybrid search、Select AI           |
| ML                   | HeatWave AutoML                    | Oracle Machine Learning                              |
| Agent                | GenAI / external agent integration | Private Agent Factory、Select AI、DBTools MCP Server |
| Analytics            | HeatWave accelerator / Lakehouse   | converged Database、Autonomous、Exadata analytics    |
| 運用                 | fully managed MySQL DB System      | Autonomous または co-managed Database service を選択 |

engine migration を AI feature だけで決めない。transaction semantics、SQL compatibility、HA / DR、backup、security、driver、operation skill、license を含めて判断する。

## 設計チェック

- DB System version と HeatWave feature compatibility を確認する。
- source table / Object Storage data の load と refresh SLA を測る。
- vector / model artifact と source data の deletion / retention を同期する。
- private network、MySQL user、dynamic privilege、encryption、audit を設計する。
- HeatWave node、storage、backup、replica、GenAI / model consumption を含む cost を見積もる。
- external LLM を使う場合、送信 data と provider terms を確認する。

## 公式ドキュメント

- [MySQL HeatWave User Guide](https://dev.mysql.com/doc/heatwave/en/)
- [About MySQL HeatWave GenAI](https://dev.mysql.com/doc/heatwave/en/mys-hw-genai-overview.html)
- [About MySQL HeatWave AutoML](https://dev.mysql.com/doc/heatwave/en/mys-hwaml-features.html)
- [About MySQL HeatWave Lakehouse](https://dev.mysql.com/doc/heatwave/en/mys-hw-lakehouse-overview.html)
- [MySQL HeatWave](https://docs.oracle.com/en-us/iaas/mysql-database/index.html)
- [Overview of DB System](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-db-system.html)
- [Overview of HeatWave Cluster](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-heatwave.html)
