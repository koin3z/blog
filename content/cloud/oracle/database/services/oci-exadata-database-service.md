---
title: OCI Exadata Database Service
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-exadata-database-service
  - cloud/oracle/database/oci-exadata-database-service
description: Exadata Database Service の Exascale、Dedicated、Cloud@Customer を、責任境界、リソース階層、拡張方式から比較する。
---

## 概要

- Exadata Database Service は、Oracle AI Database を Exadata のデータベースサーバー、ストレージサーバー、RDMA ネットワーク上で実行する共同管理型サービス
- Oracle は物理 Exadata 基盤を管理し、利用者は Guest VM、Grid Infrastructure、Database Home、Database を管理する
- 共有基盤で小さく始める Exascale、OCI リージョン内で物理基盤を専有する Dedicated、顧客データセンターへ配置する Cloud@Customer を選択できる
- `Exadata`は性能基盤を表し、`Autonomous`を意味しない

## 配置モデル

| 配置モデル | 物理基盤 | 配置場所 | 容量管理 | 向く条件 |
| --- | --- | --- | --- | --- |
| Exadata Database Service on Exascale Infrastructure | Oracle 管理の共有 Exadata | OCI リージョン | ECPU、VM、Storage Vault を弾力的に拡張 | 専有ラックより小さく開始し、Exadata Smart Storage を使う |
| Exadata Database Service on Dedicated Infrastructure | テナント専有 Exadata | OCI リージョン | DB Server、Storage Server、VM Cluster、CPU を管理 | 大規模統合、専有性能境界、長期的な基盤容量を確保する |
| Exadata Database Service on Cloud@Customer | 顧客専用の Oracle 所有 Exadata | 顧客データセンター | 設置基盤と VM Cluster を管理 | データ所在、既存システムとの低遅延、規制要件を満たす |

## 責任範囲

Doc: [Security Guide for Exadata Database Service on Dedicated Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/doc/ecs-security-guide.html)

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| 物理 DB Server、Storage Server、スイッチ、Exadata Storage software | 管理 | 容量と配置を選択 |
| ハイパーバイザと制御機能 | 管理 | OCI API を使って操作 |
| Guest VM、Grid Infrastructure、ASM、Database software | イメージと自動化を提供 | 設定、更新、監視、障害対応を管理 |
| Database、PDB、SQL、データ、権限 | 自動化機能を提供 | 設計、運用、性能、監査を管理 |
| アプリケーション、接続、DR | 対象外 | 管理 |

Cloud@Customer では、顧客が設置場所、電源、冷却、物理セキュリティ、クライアントネットワーク、バックアップネットワークを用意する。Oracle の制御プレーンへ接続するための DNS、NTP、帯域、アウトバウンド通信も必要になり、隔離ネットワークだけで完結するオンプレミス製品とは異なる。

## Exascale Infrastructure

Doc: [Exadata Database Service on Exascale Infrastructure Overview](https://docs.oracle.com/en-us/iaas/exadb-xs/doc/overview-exadb-xs-service.html)

- Oracle 管理のマルチテナント物理基盤上に、利用者ごとの VM Cluster と Exascale Database Storage Vault を作成する
- 物理 DB Server と Storage Server の増設を利用者が管理せず、ECPU とストレージ容量をサービス単位で拡張する
- Oracle AI Database 26ai は Exascale Smart Storage を直接使い、Database ファイル用 ASM を必要としない
- Oracle Database 19c は Exascale Block Storage と ASM の`DATA`、`RECO`、`LOG`ディスクグループを使う
- 19c と 26ai の差は Database バージョンだけでなく、ストレージ、ASM、容量管理、監視、移行方式へ影響する
- Redirect-on-write による PDB の Thin Clone を開発環境や検証環境へ利用できる

## Dedicated Infrastructure

Doc: [Exadata Database Service on Dedicated Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/exacs/exadata-cloud-service-overview.html)

リソースは、Exadata Infrastructure、Cloud VM Cluster、Database Home、Database、PDB の順に階層化される。

- Exadata Infrastructure は物理 DB Server、Storage Server、RDMA fabric の容量単位
- Cloud VM Cluster は Guest VM、割当 CPU、ネットワーク、Grid Infrastructure、ASM の運用境界
- 1 つの基盤に複数の VM Cluster と Database を配置できるが、CPU、メモリ、Flash、Disk、I/O、保守時間の競合を設計する必要がある
- DB Server と Storage Server を増設できる構成では、計算資源とストレージ資源を別々に拡張する
- Infrastructure を残したまま VM Cluster や Database を停止または削除しても、基盤の課金が継続する場合がある

専有基盤は他テナントとの物理分離を提供するが、Database 間の性能分離を自動的に保証しない。PDB、Database、VM Cluster、Storage Server の各層でリソース管理と容量余力を決める。

## Cloud@Customer

Doc: [Exadata Database Service on Cloud@Customer Overview](https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-exadata-cloud-at-customer-overview.html)

- Oracle 所有の Exadata を顧客データセンターへ設置し、OCI コンソールと API から管理する
- データとクライアント接続を顧客サイト内に置きながら、OCI のライフサイクル自動化を利用する
- 利用者は Guest VM の`root`、Grid Infrastructure、ASM、Database を管理する
- 物理導入、サイト準備、ネットワーク接続、増設には OCI リージョン内の論理リソース作成より長い準備期間が必要になる
- DBMS 運用を Oracle へ委ねることが目的なら、同じ配置場所を選べる [[cloud/oracle/database/services/oci-autonomous-ai-database|Autonomous AI Database on Exadata Cloud@Customer]]と比較する

## 可用性とデータ保護

- Exadata の冗長 DB Server、Storage Server、RDMA network は基盤障害に備えるが、リージョン障害や論理破損への対策を置き換えない
- RAC は同一 Database の複数インスタンスを使い、インスタンスやノード障害への可用性を高める
- Data Guard は別の Exadata または対応 Database Service へ Standby Database を作り、サイトやリージョン障害に備える
- Autonomous Recovery Service、Object Storage、RMAN などのバックアップは、保持期間と過去時点への復旧を担う
- Cloud@Customer ではバックアップ先へのネットワーク到達性、データ所在、帯域、復旧時の依存関係を顧客サイトの設計へ含める

## ライセンスとコスト

- License Included では Exadata のサービスエディションに含まれる機能を利用する
- BYOL では保有する Oracle Database のライセンスとオプションの権利が上限になる
- RAC、Active Data Guard、In-Memory、Partitioning、Diagnostics Pack、Tuning Pack などを、Primary、Standby、Clone、検証環境ごとに確認する
- Exascale は VM と Storage の利用量、Dedicated と Cloud@Customer は物理基盤と割当 CPU を含むリソース階層ごとに課金を確認する

## 選定条件

- Exadata Smart Scan、Storage Index、Smart Flash Cache、RDMA fabric を使う大規模 OLTP、分析、混合ワークロードに向く
- 共有 Exadata で小さく開始したい場合は Exascale を最初に比較する
- 専有基盤、複数 Database の大規模統合、物理レベルの分離が必要なら Dedicated を比較する
- データを顧客サイトから移動できない場合は Cloud@Customer を比較する
- Exadata 固有機能を必要としない場合は [[cloud/oracle/database/services/oci-base-database-service|Base Database Service]]の方が単純なリソースモデルになる
- Guest VM や`SYSDBA`を管理する必要がない場合は [[cloud/oracle/database/services/oci-autonomous-ai-database|Autonomous AI Database]]と比較する

## 参照リンク

- [Exadata Database Service on Exascale Infrastructure](https://docs.oracle.com/en-us/iaas/exadb-xs/doc/overview-exadb-xs-service.html)
- [Exadata Database Service on Dedicated Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/exacs/exadata-cloud-service-overview.html)
- [Exadata Database Service on Cloud@Customer](https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-exadata-cloud-at-customer-overview.html)
- [Manage Databases on Exadata Cloud Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/exacs/manage-databases.html)
