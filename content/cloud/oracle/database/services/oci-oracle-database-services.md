---
title: OCI Oracle Database サービス概要
date: 2026-07-07
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracle-database-services
  - cloud/oracle/database/oci-oracle-database-services
description: OCI が提供する Oracle AI Database サービスを、運用責任、基盤の分離、配置場所、拡張方式から比較する。
---

## 概要

- OCI の Oracle AI Database サービスは、利用者が Guest VM と DBMS を管理する共同管理型と、Oracle が DBMS ライフサイクルを管理する Autonomous 型に分かれる
- 同じ Exadata 基盤でも、Exadata Database Service と Autonomous AI Database では利用者の管理範囲が異なる
- Public Cloud、Cloud@Customer、Dedicated Region、Multicloud は配置場所の選択であり、DBMS の運用モデルとは別に決める
- RAC、Data Guard、Backup、Globally Distributed Database は異なる障害または拡張要件を扱うため、サービス名だけから可用性を判断しない

← [[cloud/oracle/database/index|OCI データベースサービス概要]]

## 運用モデル

Doc: [Security for Core Services](https://docs.oracle.com/en-us/iaas/Content/Security/Concepts/security_core_services.htm)

| 運用モデル | 利用者が管理する主な範囲 | Oracle が管理する主な範囲 |
| --- | --- | --- |
| 共同管理型 | Guest VM、OS 更新、Grid Infrastructure、Database Home、Database、Patch 計画、性能設計、HA／DR | Control Plane、自動化、Hypervisor、物理サーバー、物理ストレージ |
| Autonomous | Data、Schema、SQL、Application、IAM、DB User、接続経路、業務監視 | OS、Grid Infrastructure、DBMS、Patch、Backup、基盤監視、障害修復 |
| Compute 上の自己管理 | OS から Database まですべて | Compute、Block Volume、VCN などの IaaS |

共同管理型の`managed service`は、Oracle が Database 運用を全面的に引き受けることを意味しない。OCI は作成、更新、バックアップ、Data Guard などを自動化するが、実行時期、事前確認、アプリケーション試験、失敗時対応は利用者が管理する。

Autonomous でも、SQL 性能、データモデル、権限、ネットワーク、アプリケーション可用性は利用者が管理する。

## サービス比較

| サービス | 運用モデル | 基盤と分離 | 向く条件 | 詳細 |
| --- | --- | --- | --- | --- |
| Base Database Service | 共同管理型 | 汎用 VM、Block Volume | OS、Grid Infrastructure、`SYSDBA`を管理し、Exadata を必要としない | [[cloud/oracle/database/services/oci-base-database-service\|Base Database Service]] |
| Exadata Database Service on Exascale Infrastructure | 共同管理型 | 共有 Exadata、分離 VM、Storage Vault | Exadata を小さく開始し、ECPU と Storage を弾力的に拡張する | [[cloud/oracle/database/services/oci-exadata-database-service\|Exadata Database Service]] |
| Exadata Database Service on Dedicated Infrastructure | 共同管理型 | テナント専有 Exadata | 大規模統合、専有性能境界、Exadata 全体の容量を管理する | [[cloud/oracle/database/services/oci-exadata-database-service\|Exadata Database Service]] |
| Exadata Database Service on Cloud@Customer | 共同管理型 | 顧客データセンター内の専有 Exadata | データ所在と既存システムとの低遅延を満たし、DBA 運用を継続する | [[cloud/oracle/database/services/oci-exadata-database-service\|Exadata Database Service]] |
| Autonomous AI Database Serverless | Autonomous | Oracle 管理の共有基盤 | DBMS 運用を委ね、Database 単位で弾力的に利用する | [[cloud/oracle/database/services/oci-autonomous-ai-database\|Autonomous AI Database]] |
| Autonomous AI Database on Dedicated Exadata Infrastructure | Autonomous | テナント専有 Exadata | 物理分離、Fleet 統合、保守ポリシーを管理する | [[cloud/oracle/database/services/oci-autonomous-ai-database\|Autonomous AI Database]] |
| Autonomous AI Database on Exadata Cloud@Customer | Autonomous | 顧客データセンター内の専有 Exadata | Autonomous 運用とデータ所在を両立する | [[cloud/oracle/database/services/oci-autonomous-ai-database\|Autonomous AI Database]] |
| Globally Distributed Database | 基盤サービスに従う | 複数 Shard と Catalog | 水平拡張、地域配置、データ所在をアプリケーションへ組み込む | [[cloud/oracle/database/services/oci-globally-distributed-database\|Globally Distributed Database]] |

> [!NOTE] `Dedicated`が示す範囲
>
> Exadata Database Service on Dedicated Infrastructure では、専有 Exadata 上の Guest VM と Database を利用者が管理する。Autonomous AI Database on Dedicated Exadata Infrastructure では、専有 Exadata 上の DBMS を Oracle が管理する。 `Dedicated`は基盤の分離を示し、Database の管理主体を示さない。

## 選定軸

### 管理権限

- OS、Grid Infrastructure、`SYSDBA`、初期化パラメータ、One-off Patch、任意 Agent が必須なら Base または Exadata Database Service を選ぶ
- DBMS の Patch、Backup、基盤監視、障害修復を Oracle へ委ねられるなら Autonomous AI Database を最初に評価する
- 自己管理構成では OCI Database Service の自動化と責任境界を利用できないため、必要な OS または Database 制約がある場合に限って比較する

### 性能基盤

- 汎用 VM と Block Volume で要件を満たせる場合は Base Database Service を比較する
- Exadata Smart Scan、Storage Index、Smart Flash Cache、RDMA fabric、大規模 RAC が必要なら Exadata Database Service を比較する
- Exadata の物理基盤を専有する必要がなければ Exascale を最初に比較し、専有容量と強い分離が必要なら Dedicated を比較する
- Database 単位の弾力性と運用標準化を優先する場合は Autonomous Serverless を比較する

### 配置場所

- OCI Region 内に配置できる場合は Public Cloud の Serverless、Base、Exascale、Dedicated を比較する
- データ所在、既存システムとの低遅延、規制上の物理境界により Public Cloud へ配置できない場合は Cloud@Customer を比較する
- Dedicated Region Cloud@Customer は Database 専用製品ではなく、OCI Region 全体を顧客サイトへ配置する選択肢
- Oracle AI Database@AWS、Oracle AI Database@Azure、Oracle AI Database@Google Cloud は、各 Cloud の Network、IAM、Console、Billing と統合する別の配置モデル

### 水平拡張

- RAC は複数 Instance で同じ Database を使い、Instance と Node の可用性および処理能力を高める
- Data Guard は Primary Database の物理 Standby を維持し、Site または Region 障害に備える
- Globally Distributed Database は Data を複数 Shard へ分割し、単一 Database の容量上限、データ所在、地域ごとの低遅延に対応する
- Globally Distributed Database では Sharding Key、複数 Shard Transaction、Global Service、再配置を Application Architecture として設計する

## 可用性と復旧

| 障害または要求 | 主な対策 | 残る設計 |
| --- | --- | --- |
| Process、Instance | Restart、RAC、Autonomous の自動修復 | Client の再接続と Transaction 再実行 |
| VM、DB Server、Fault Domain | RAC、冗長 Exadata Infrastructure | Service 配置と容量余力 |
| Availability Domain、Site | Data Guard、Autonomous Data Guard | Protection Mode、Transport Lag、Failover 手順 |
| Region | Cross-Region Standby、Cross-Region Backup | Application、DNS、Secret、Network の切替 |
| 誤削除、論理破損、Ransomware | Backup、Point-in-Time Recovery、Retention Lock | 復旧点、保持、隔離、定期試験 |
| 水平拡張、地理的 Data 配置 | Globally Distributed Database | Sharding Key、整合性、複数 Shard 処理 |

RPO と RTO は、通常障害、計画保守、Site Loss、Region Loss、論理破損を分けて定義する。Database の切替だけでは、Application、DNS、Wallet、Secret、Vault Key、Batch、Object Storage、運用権限は切り替わらない。

バックアップは [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]を参照。

## セキュリティ

| 管理面              | 主な管理対象                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| OCI Control Plane   | IAM Policy、Compartment、Tag、Quota、Work Request、Audit Log              |
| Database Data Plane | Database User、Role、`SYSDBA`または`ADMIN`、Database Audit、SQL\*Net／TLS |
| Guest OS Plane      | 共同管理型の SSH Key、`sudo`、OS User、Agent、File、Host Firewall         |

OCI IAM で Database Resource の削除を禁止しても、強い Database 権限を持つ利用者による`DROP`は防げない。Database Role を制限しても、OCI 管理権限があれば Resource の終了、Network、Key を変更できるため、各管理面で職務分離を行う。

Cloud Database では TDE を使う。顧客管理鍵を選ぶ場合は、Vault Policy、Key Replication、Rotation、Disable／Delete Protection、DR Region での利用可否を Database の可用性依存関係として扱う。

## ライセンスとコスト

- License Included は Service Edition に応じた Oracle Database License と Option を料金に含む
- BYOL は既存 License と有効な Support を利用し、保有していない Option の利用権は Cloud 移行によって増えない
- RAC、Active Data Guard、Partitioning、In-Memory、Diagnostics Pack、Tuning Pack を、Primary、Standby、Clone、検証環境ごとに確認する
- Infrastructure、VM、ECPU／OCPU、Storage、Backup、Standby、Network、License をリソース階層ごとに見積もる
- Database を停止しても Infrastructure、Storage、Standby、Backup の課金が残る構成がある

## 関連メモ

- [[cloud/oracle/database/index|OCI データベースサービス概要]]
- [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]
- [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]]
- [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]
- [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]]

## 参照リンク

- [Database](https://docs.oracle.com/en-us/iaas/Content/Database/home.htm)
- [About Oracle Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/about/)
- [Exadata Database Service on Exascale Infrastructure](https://docs.oracle.com/en-us/iaas/exadb-xs/doc/overview-exadb-xs-service.html)
- [Exadata Database Service on Dedicated Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/exacs/exadata-cloud-service-overview.html)
- [Exadata Database Service on Cloud@Customer](https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-exadata-cloud-at-customer-overview.html)
- [Autonomous AI Database Serverless](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/)
- [Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/about-autonomous-ai-database-on-dedicated-exadata.html)
- [Globally Distributed Autonomous AI Database](https://docs.oracle.com/en/cloud/paas/globally-distributed-autonomous-database/user/overview-distributed-adb1.html)
