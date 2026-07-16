---
title: MySQL HeatWave
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/mysql-heatwave
  - cloud/oracle/database/mysql-heatwave
description: MySQL HeatWave の DB System、可用性、Read Replica、HeatWave Cluster、バックアップ、互換性を整理する。
---

## 概要

Doc: [Overview of MySQL HeatWave Service](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-mysql-heatwave-service.html)

- MySQL HeatWave は、Oracle の MySQL Team が開発、運用、サポートするフルマネージド MySQL サービス
- Oracle は OS と MySQL Server の更新、バックアップ、リカバリ、基盤監視を管理する
- 利用者はデータ、スキーマ、SQL、MySQL user、IAM、ネットワーク、アプリケーションを管理する
- MySQL DB System へ HeatWave Cluster を追加すると、分析、Lakehouse、AutoML、生成 AI の処理を同じ MySQL Endpoint から利用できる

## リソースモデル

Doc: [Overview of DB System](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-db-system.html)

| リソース | 役割 |
| --- | --- |
| DB System | MySQL Instance、Endpoint、Configuration、Storage、Backup Policy をまとめる単位 |
| MySQL Instance | Oracle Linux、MySQL Enterprise Edition、VNIC、Block Volume で構成する実行 Node |
| Read Replica | Primary DB System から複製し、読み取りを分散する Instance |
| Configuration | MySQL Server の Parameter を保持する設定 |
| Backup | DB System の復元または新規作成に使う物理バックアップ |
| HeatWave Cluster | 対応 Query、Lakehouse、AutoML、GenAI を実行する HeatWave Node の集合 |

- Standalone DB System は 1 MySQL Instance で構成する
- High Availability DB System は 3 MySQL Instance で構成する
- 利用者は MySQL Instance の OS へアクセスせず、DB System の Endpoint から MySQL へ接続する
- Storage は Network-attached Block Volume に置かれ、DB System の Data と Log を保持する

## MySQL と HeatWave の関係

Doc: [Overview of HeatWave Cluster](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-heatwave.html)

アプリケーションは MySQL DB System へ接続する。DB System の HeatWave Plugin が対応 Query を HeatWave Cluster へ転送し、HeatWave Cluster は結果を DB System 経由でアプリケーションへ返す。

| 機能 | 役割 |
| --- | --- |
| HeatWave Query Accelerator | 対応する分析 Query と混合ワークロードを In-Memory Node へ転送する |
| HeatWave Lakehouse | Object Storage の CSV、Parquet などを HeatWave 形式へ変換し、MySQL SQL から問い合わせる |
| HeatWave AutoML | MySQL Data を使って機械学習モデルを学習、評価、推論する |
| HeatWave GenAI | LLM、Vector Store、自然言語処理を MySQL ワークフローへ統合する |

HeatWave Cluster は MySQL DB System の代替ではない。MySQL が Transaction と接続 Endpoint を担い、HeatWave Node が対応する処理をオフロードする。

AI 機能の詳細は [[cloud/oracle/ai/mysql-heatwave-ai|MySQL HeatWave AI]]を参照。

## 可用性と読み取り拡張

Doc: [Overview of High Availability](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-high-availability.html)

- High Availability DB System は 1 Primary Instance と 2 Secondary Instance を持つ
- MySQL Group Replication を使って Primary から Secondary へデータを複製する
- Primary 障害時は Secondary の 1 つを自動昇格する
- Multi-Availability Domain Region では Instance を Availability Domain に分散し、Single-Availability Domain Region では Fault Domain に分散する
- Read Replica は読み取り処理の拡張に使い、High Availability の Secondary と役割が異なる
- アプリケーションはフェイルオーバー時の切断、再接続、Transaction の再実行を実装する

High Availability を有効にすると Instance 数とリソース消費が増え、Standalone と同じ Shape でも性能特性が変わる。冗長化後の書き込み遅延と Throughput を実測する。

## バックアップとレプリケーション

- 自動バックアップと手動バックアップを作成し、Backup から新しい DB System を復元できる
- Point-in-Time Recovery を使う場合は、自動バックアップ、保持期間、Binary Log の条件を確認する
- Inbound Replication は外部 MySQL から HeatWave へ変更を取り込む
- Outbound Replication は HeatWave から外部 MySQL へ変更を送る
- Logical Dump を使う移行では MySQL Shell から Object Storage へ Export し、DB System へ Import できる

High Availability、Read Replica、Inbound／Outbound Replication、Backup は異なる目的を持つ。レプリカがあっても、誤削除、論理破損、過去時点への復旧に備えるバックアップは別に必要になる。

## 互換性と制約

Doc: [Features of MySQL HeatWave Service](https://docs.oracle.com/en-us/iaas/mysql-database/doc/features-mysql-heatwave-service.html)

- MySQL Enterprise Edition 8.0 以降と InnoDB Storage Engine をサポートする
- InnoDB 以外の Storage Engine を使う Database は、移行前に InnoDB へ変換する
- MySQL Version、HeatWave Version、Shape、Region によって利用できる Lakehouse、AutoML、GenAI、High Availability の機能が異なる
- 利用できる MySQL System Variable と Plugin はマネージドサービスの範囲に制限される
- HeatWave へオフロードできない Query は MySQL DB System で実行されるため、Explain Plan と Offload 状態を確認する
- Lakehouse は Object Storage の Data を HeatWave 形式へ変換して読み込むため、形式、Schema Evolution、Refresh、Memory Capacity を設計する

## セキュリティ

- OCI IAM は DB System、Backup、Configuration などの制御リソースを管理する
- MySQL user と Dynamic Privilege は Database 内のアクセスを管理する
- DB System は VCN の Subnet へ接続し、NSG と Route で接続元を制御する
- Block Volume と Backup は保存時に暗号化され、顧客管理鍵を選択できる
- Client から MySQL への通信は TLS を使い、必要に応じて`REQUIRE SSL`を User に設定する
- OCI Audit は制御プレーン API を記録し、MySQL Enterprise Audit は Database 内の接続と操作を記録する

## 選定条件

### 向く条件

- MySQL の Protocol、Driver、SQL、運用ツールとの互換性が必要
- MySQL OLTP と分析を同じサービスで扱い、ETL による複製を減らす
- Object Storage の Data を MySQL SQL から分析する
- MySQL Data の近くで AutoML、Vector Store、生成 AI を利用する

### 確認が必要な条件

- Storage Engine、Plugin、System Variable、Character Set、Collation、MySQL Version の互換性
- High Availability、Read Replica、Inbound／Outbound Replication の組合せと Region 対応
- HeatWave へオフロードされる Query、必要 Node 数、Data Load 時間、Memory 使用量
- Backup Retention、Point-in-Time Recovery、Cross-Region Disaster Recovery の要件

## 参照リンク

- [MySQL HeatWave](https://docs.oracle.com/en-us/iaas/mysql-database/index.html)
- [Overview of MySQL HeatWave Service](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-mysql-heatwave-service.html)
- [Overview of DB System](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-db-system.html)
- [Overview of HeatWave Cluster](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-heatwave.html)
- [Overview of High Availability](https://docs.oracle.com/en-us/iaas/mysql-database/doc/overview-high-availability.html)
