---
title: Oracle AI Database の AI 機能
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - cloud/oci/database
description: Oracle AI Database 26ai の Vector Search、Select AI、Machine Learning、Private Agent Factory を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

Oracle AI Database は、relational、JSON、graph、spatial、text、vector などの data を同じ security / transaction boundary で扱い、business data の近くで AI processing を実行する。OCI Generative AI が model / agent runtime を提供するのに対し、Oracle AI Database は trusted enterprise data、検索、SQL、transaction を担当する。

## AI Vector Search

AI Vector Search は `VECTOR` data type、vector index、distance function、similarity search を Database に統合する。

- embedding と relational business data を同じ Database に保存する。
- semantic search と SQL filter / join / row-level security を組み合わせる。
- approximate / exact search と index の精度、latency、memory を要件に応じて選ぶ。
- text search と vector search を組み合わせた hybrid search を構成する。

vector を Database に置けばすべての data movement がなくなるわけではない。document ingestion、chunking、embedding generation、source update、deletion、re-embedding の pipeline は別途必要になる。

## Select AI

Select AI は natural language と LLM を SQL / PL/SQL interface から利用する機能である。

- natural language から SQL を生成、実行、説明する。
- vector store を使った RAG を構成する。
- LLM との chat、narration、synthetic data generation を行う。
- AI profile に provider、credential、object list、attribute を定義する。

SQL generation では schema metadata が LLM へ渡される。action によっては query result や retrieved content も LLM provider へ送られるため、provider、region、data classification、masking、retention を確認する。生成 SQL は誤りや危険な処理を含み得るため、read-only schema、object allowlist、resource limit、audit、human review を使う。

## Oracle Machine Learning

Oracle Machine Learning は Database 内の data に対して classification、regression、clustering、anomaly detection、feature extraction などを実行する。大量 data を外部 notebook へ複製せず SQL / Python interface から処理できる点が強みである。

[[cloud/oracle/ai/oci-data-science|OCI Data Science]] と競合するだけでなく、Database で feature / prediction を実行し、Data Science で experiment、pipeline、external model を扱う組合せもある。

## Private Agent Factory と agent 関連機能

Oracle AI Database Private Agent Factory は、prebuilt agent、custom agent、workflow を構築・deploy する no-code platform である。knowledge agent、structured data analysis、deep research など、Database と enterprise repository を組み合わせる use case を対象にする。

利用可否は Database version / RU、deployment model、region、license / subscription に依存する。product announcement だけを根拠にせず、target Database と tenancy の current documentation で確認する。

Oracle AI Agent Memory は agent context / memory を Oracle AI Database で管理する関連製品である。対応 release、deployment、license は current documentation で確認する。

OCI Database Tools MCP Server を使うと、MCP client / agent から Oracle AI Database へ接続し、OAuth 2.0 と Database authorization を使って SQL / PL/SQL tool を公開できる。詳細は [[articles/qiita/oci-database-tools-mcp-server|OCI Database Tools MCP Server]] を参照。

## OCI での deployment

AI Database feature と Database infrastructure は別の選択軸である。

| Deployment                                  | 運用モデル                         | AI workload での主な位置付け                           |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Autonomous AI Database Serverless           | Oracle が DBMS lifecycle を管理    | 新規 RAG / analytics / application、運用負荷の削減     |
| Autonomous AI Database on Dedicated Exadata | Autonomous + 専有基盤              | 強い分離、fleet / maintenance control                  |
| Base Database Service                       | co-managed VM Database             | OS / DB parameter / agent を詳細に制御                 |
| Exadata Database Service                    | co-managed Exadata                 | 大規模 vector / relational / analytics workload        |
| Exadata Cloud@Customer                      | 顧客 site の Exadata cloud service | data residency、on-premises application との低 latency |

全体の責任境界は [[cloud/oracle/database/services/oci-oracle-database-services|OCI Oracle Database サービス概要]]を参照。AI feature は Database version、RU、`COMPATIBLE`、deployment model によって差があるため、product name だけで利用可否を判断しない。

MySQL application を中心に検討する場合は、[[cloud/oracle/ai/mysql-heatwave-ai|MySQL HeatWave AI]] と engine、SQL compatibility、operation model を含めて比較する。

## RAG architecture の要点

1. source document の owner、classification、更新・削除 event を定義する。
2. document を parse / chunk し、source ID と access metadata を保持する。
3. embedding model と dimension を固定し、model change 時の re-embedding を計画する。
4. vector similarity に tenant / department / ACL の SQL filter を必ず組み合わせる。
5. retrieved chunk と source citation を response に残す。
6. source deletion、retention expiration、user access revoke を vector store に反映する。

## 公式ドキュメント

- [Oracle AI Database 26ai — AI, ML, and Analytics](https://docs.oracle.com/en/database/oracle/oracle-database/26/ai.html)
- [Overview of Oracle AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/overview-ai-vector-search.html)
- [About Select AI](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/select-ai-about.html)
- [Oracle AI Database Private Agent Factory](https://docs.oracle.com/en/database/oracle/agent-factory/index.html)
