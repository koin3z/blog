---
title: Oracle NoSQL Database Cloud Service
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-nosql-database
  - cloud/oracle/database/oci-nosql-database
description: Oracle NoSQL Database Cloud Service の表モデル、容量単位、整合性、トランザクション、Global Active Table を整理する。
---

## 概要

Doc: [Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en-us/iaas/nosql-database/index.html)

- Oracle NoSQL Database Cloud Service は、Table、JSON Document、Key-Value のデータモデルを提供するフルマネージドサービス
- 利用者は Database Cluster や Server を作成せず、Table ごとに Throughput と Storage を割り当てる
- 主キーを使う予測可能な低遅延アクセス、大量イベント、IoT、セッション、ユーザー属性などの水平拡張に向く
- Join、複数行 Transaction、整合性、問い合わせ方法はリレーショナル Database と異なるため、SQL という名称だけで互換性を判断しない

## 責任範囲

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| Server、Storage、Partition、Replication、更新 | 管理 | 直接管理しない |
| Table の容量と拡張 | On-Demand または Provisioned Capacity を提供 | Mode、Read、Write、Storage を選択 |
| Schema、Primary Key、Shard Key、Index | DDL と API を提供 | 設計、変更、性能を管理 |
| Data、Query、Consistency | Engine と SDK を提供 | Access Pattern と保証を選択 |
| IAM、Application Credential、Region | 機能を提供 | 権限、接続、Secret を管理 |
| Multi-Region Application | Global Active Table を提供 | Region Routing、Conflict、Failover を設計 |

## データモデル

Doc: [Features of Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en/cloud/paas/nosql-cloud/mmmmq/index.html)

- Table は Primary Key を持ち、Primary Key の一部を Shard Key として Partition へ配置する
- JSON Column は Row ごとに異なる属性を持つ Document を格納できる
- Secondary Index は Primary Key 以外の属性を使う Query を高速化する
- Parent-Child Table は同じ Shard Key を共有する Row を同じ Partition に配置し、Table Hierarchy 内の処理を効率化する
- Time-to-Live（TTL）は Table または Row に期限を設定し、期限後の Data を自動的に削除する
- Oracle NoSQL SQL は Table と JSON を問い合わせるが、PostgreSQL、MySQL、Oracle SQL と同じ SQL 方言ではない

Primary Key と Shard Key は、Data の分布、単一操作の遅延、Transaction 範囲を決める。特定の Shard Key に Access が集中すると、全体容量に余裕があっても Hot Partition が発生する。

## 容量モデル

Doc: [Plan Your Service](https://docs.oracle.com/en-us/iaas/nosql-database/doc/plan-your-service.html)

| 単位             | 定義                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| Read Unit（RU）  | 最大 1 KB の Eventually Consistent Read を 1 秒に 1 回実行する Throughput |
| Write Unit（WU） | 最大 1 KB の Data を 1 秒に 1 回書き込む Throughput                       |
| Storage Capacity | Table が使う Data と Index の Storage 容量                                |

- Provisioned Capacity は Table ごとに RU、WU、Storage を予約する
- On-Demand Capacity は実際の Read と Write に合わせてサービスが容量を管理する
- 1 KB を超える Row は KB 単位で切り上げて複数 Unit を消費する
- Absolutely Consistent Read は同じ Size の Eventually Consistent Read の 2 倍の RU を消費する
- Secondary Index の更新は追加の WU を消費する
- Query が複数 Row や Index を読むと、返却 Row だけでなく読み取った Data に応じて RU を消費する

平均 Request 数だけでなく、Row Size、Consistency、Index 数、Peak Throughput、Hot Key を使って容量を見積もる。

## 整合性とトランザクション

- Absolutely Consistent Read は、読取りを実行した Region 内で最新の確定値を返す
- Eventually Consistent Read は古い値を返す可能性があるが、低い Cost と Latency で読み取れる
- 1 つの Data Operation は ACID Transaction として実行される
- 同じ Shard Key を持つ複数 Row は、対応 API を使って 1 つの Atomic Operation にまとめられる
- 異なる Shard Key にまたがる任意の複数操作を、リレーショナル Database と同じ 1 Transaction にまとめる設計はできない

整合性を弱める場合は、古い値を読んでも成立する業務条件、Read-Modify-Write の競合、冪等性をアプリケーション側で定義する。

## Global Active Table

Doc: [Global Active Tables](https://docs.oracle.com/en-us/iaas/nosql-database/doc/global-active-tables.html)

- 1 つの Table を複数 Region へ複製し、各 Region で Local Read と Local Write を受け付ける
- Region 間の変更は非同期に複製される
- 複数 Region が同じ Primary Key を更新した場合は、最新 Timestamp の更新を採用する競合解決を使う
- ACID Transaction と Absolute Consistency は書き込みを実行した Region 内に限定される
- 別 Region から複製中の Data に対する Read は Eventually Consistent になる
- Global Active Table を作成する前に Schema を Frozen にする必要がある
- Regional Replica を残したまま Global Active Table を削除できない

Global Active Table は Region 障害時の Active-Active 構成と地域内低遅延を提供するが、同期 Transaction を Region 間へ拡張しない。時計、競合解決、Replica Lag、Application Routing を監視する。

## 移行とデータ保護

Doc: [Oracle NoSQL Database Migrator](https://docs.oracle.com/en-us/iaas/nosql-database/doc/using-oracle-nosql-data-migrator.html)

- Oracle NoSQL Database Migrator は、NoSQL Database On-Premises、Cloud Service、File、Object Storage などの間で Table Data を移動する
- JSON、MongoDB 形式 JSON、DynamoDB 形式 JSON、CSV、Parquet などは Source と Sink の対応範囲が異なる
- Export した Data を再投入する処理は、継続的な Point-in-Time Recovery と同じではない
- Global Active Table の Replica は Region 障害に備えるが、Application Error による論理的な更新も複製する
- 必要な復旧点、保持期間、誤削除対策を定義し、利用可能な Export、Replica、Application-level History を組み合わせる

## 選定条件

### 向く条件

- Primary Key を中心とする単純な Access Pattern を大規模に水平拡張する
- Row ごとの JSON Schema 差、TTL、自動期限切れを利用する
- Throughput を RU と WU で明示的に割り当てる、または On-Demand で吸収する
- 複数 Region で Local Read／Write を受け付け、非同期の結果整合性を許容する

### 向かない条件

- 複雑な Join、Ad Hoc Analysis、複数 Shard にまたがる Transaction が中心
- PostgreSQL、MySQL、Oracle Database の SQL、Driver、Stored Procedure 互換性が必要
- Region 間で同期した強い整合性をすべての操作に要求する
- Data Access Pattern を事前に決められず、Primary Key と Shard Key を安定して設計できない

## 参照リンク

- [Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en-us/iaas/nosql-database/index.html)
- [Features of Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en/cloud/paas/nosql-cloud/mmmmq/index.html)
- [Plan Your Service](https://docs.oracle.com/en-us/iaas/nosql-database/doc/plan-your-service.html)
- [Global Active Tables](https://docs.oracle.com/en-us/iaas/nosql-database/doc/global-active-tables.html)
