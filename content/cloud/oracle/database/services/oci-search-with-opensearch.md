---
title: OCI Search with OpenSearch
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-search-with-opensearch
  - cloud/oracle/database/oci-search-with-opensearch
description: OCI Search with OpenSearch の Node 役割、Private Endpoint、Shard、拡張、保守、検索用索引としての責任境界を整理する。
---

## 概要

Doc: [About Search with OpenSearch](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm)

- OCI Search with OpenSearch は、OpenSearch を使う検索と分析のマネージドサービス
- Oracle は Cluster の Security Update、Upgrade、Resize、Scheduled Backup などの基盤運用を管理する
- 利用者は Index、Mapping、Shard、Replica、Ingestion、Query、Retention、Application を管理する
- Application Search、Log Analysis、全文検索、集計、検索用索引に向く

## 責任範囲

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| Compute、Storage、Cluster 基盤、Patch | 管理 | Shape と Node 数を選択 |
| OpenSearch と Dashboard の Endpoint | Private Endpoint を作成 | VCN、Subnet、NSG、接続元を管理 |
| Index、Mapping、Analyzer、Shard、Replica | Engine と API を提供 | 設計、変更、性能を管理 |
| Data Ingestion と Source Data | Pipeline 機能を提供 | 正本、再送、変換、順序を管理 |
| Query、Dashboard、Alert | 機能を提供 | 内容、権限、運用を管理 |
| Backup と Restore | Scheduled Backup と操作を提供 | 保持、復旧手順、正本からの再構築を管理 |

OpenSearch の Index は、検索に最適化した派生データとして扱う。Index だけを正本にすると、Mapping Error、誤削除、Ingestion Failure、Retention による削除から再構築できない。

## Node と Cluster

| Node                      | 役割                                                       |
| ------------------------- | ---------------------------------------------------------- |
| Leader Node               | Cluster State、Node 状態、Index 作成、Shard 配置を管理する |
| Data Node                 | Data を保持し、Index、Search、Aggregation を実行する       |
| OpenSearch Dashboard Node | OpenSearch Dashboards を提供する                           |
| Search Node               | Searchable Snapshot などの検索処理を担当する               |
| Coordinator Node          | Data を保持せず、Request Routing と結果集約を行う          |
| Machine Learning Node     | ML Commons Plugin の Model と Task を実行する              |

- Leader Node と Data Node の役割を分けると、Cluster State 管理と Search／Indexing の負荷を分離できる
- 大規模 Cluster では Coordinator Node を使い、Client Request と Bulk Indexing を Data Node へ分配する
- Shard 数は並列性を上げる一方で、Cluster State、Memory、Recovery、Merge の Overhead を増やす
- Replica Shard は Node 障害への可用性と Read Throughput を高めるが、Primary Shard と同じ論理的な誤更新を保持する

## ネットワーク

- Cluster と OpenSearch Dashboards は VCN 内の Private Endpoint から接続する
- Client、Ingestion Pipeline、Dashboard 利用者が Endpoint へ到達できる Route、DNS、NSG を構成する
- OCI IAM は Cluster などの制御リソースを管理し、OpenSearch の Security 機能は Index と API の Data Plane Access を管理する
- Dashboard の公開範囲と認証を Application Endpoint とは分けて設計する

## Index と Data Flow

1. 正本の Database、Application Log、Object Storage などから Event または Document を取得する
2. Parser と Processor で Field、Timestamp、Identifier、Access Metadata を整える
3. Index Template と Mapping に従って OpenSearch へ書き込む
4. Search、Aggregation、Dashboard から Index を参照する
5. Retention または Index Lifecycle に従って古い Index を移動または削除する

正本の Identifier と更新 Version を Index に保持すると、Ingestion の再実行、重複排除、削除反映を確認できる。At-least-once の Pipeline では同じ Event が再送されるため、Document ID と更新規則を冪等にする。

## 可用性と保守

Doc: [Connecting to a Search with OpenSearch Cluster](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/ingestingociopensearchdata.htm)

- Leader Node と Data Node を冗長にし、Replica Shard を異なる Node へ配置する
- Availability Domain と Fault Domain の配置は Region と Cluster 構成を確認する
- Patch または Resize 中は Search を Read-only で提供し、Maintenance Window では Write が無効になる場合がある
- Client と Ingestion Pipeline は Write 停止、`429`、接続断、Node 変更に対する Retry と Backoff を実装する
- Scheduled Backup と正本からの Reindex を組み合わせ、Cluster 全体を失った場合の復旧時間を測定する

Replica と Snapshot は目的が異なる。Replica は Node 障害から Search を継続するために使い、Snapshot と正本からの Reindex は過去状態や Cluster Loss から復旧するために使う。

Doc: [Search with OpenSearch Cluster Backup and Restoration](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/backup-restoration.htm)

- OCI-managed Backup には日次の Automated Backup と利用者が作る Manual Backup がある
- Snapshot API は利用者の Object Storage Bucket を Repository として使い、対象 Index や Restore 方法を制御する
- Searchable Snapshot は Object Storage に置いた古い Index を Search Node から参照する機能であり、Managed Backup とは異なる

## 容量と性能

- Indexing Throughput、Search Latency、Aggregation、Storage、Retention から Data Node を Size する
- Leader Node の Heap は Cluster State、Index 数、Shard 数の影響を受ける
- 1 Index あたりの Primary Shard 数を過剰に増やさず、Shard Size と Recovery 時間を計測する
- Mapping Explosion を防ぐため、Dynamic Field と高 Cardinality Field の扱いを決める
- Refresh Interval を短くすると検索への反映は速くなるが、Segment 作成と Merge の負荷が増える
- Hot-Warm 構成、Searchable Snapshot、Retention は、利用できる OpenSearch Version と OCI 機能を確認する

## 選定条件

### 向く条件

- 全文検索、Faceting、Log Search、Time-series Aggregation を実装する
- Database の正本から検索用 Index を作り、検索 Query を分離する
- OpenSearch API と Dashboard の互換性が必要
- Shard と Replica を使って検索処理を水平方向に拡張する

### 向かない条件

- 複数行 ACID Transaction と厳密な参照整合性が中心
- Index を再生成する正本や Replay 可能な Event を持たない
- Patch、Resize、Failover 中の一時的な Write 停止を吸収できない
- OpenSearch Version、Plugin、API の完全な自己管理が必要

## 参照リンク

- [About Search with OpenSearch](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm)
- [Connecting to a Search with OpenSearch Cluster](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/ingestingociopensearchdata.htm)
- [Resizing a Search with OpenSearch Cluster](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/resizingacluster.htm)
- [Search with OpenSearch Cluster Backup and Restoration](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/backup-restoration.htm)
