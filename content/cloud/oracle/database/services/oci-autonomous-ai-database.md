---
title: OCI Autonomous AI Database
date: 2026-07-16
modified: 2026-07-27
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-autonomous-ai-database
  - cloud/oracle/database/oci-autonomous-ai-database
description: Autonomous AI Database の責任モデル、ワークロード、Serverless、Dedicated、Cloud@Customer の差を整理する。
---

## 概要

Doc: [Oracle Autonomous Database FAQ](https://www.oracle.com/database/technologies/datawarehouse-bigdata/adb-faqs.html)

- **Oracle Autonomous AI Database**（公式資料では Autonomous Database、ADB とも表記）は、Oracle が OS、Grid Infrastructure、DBMS、パッチ、バックアップ、基盤監視、障害修復を管理する Oracle AI Database サービス
- 利用者はデータ、スキーマ、SQL、Database user、IAM、ネットワーク、アプリケーションの性能と可用性を管理する
- 基盤選択は Serverless と Dedicated に大別できる
- `Autonomous`は DBMS の運用モデルを表し、SQL、データモデル、権限、アプリケーション運用が不要になることを意味しない

このページは OCI Public Cloud の Serverless／Dedicated と、Dedicated を顧客サイトへ配置する Exadata Cloud@Customer を扱う。Dedicated Region Cloud@Customer と Multicloud 配置は対象外とする。

## 責任モデル

Doc: [Autonomous AI Database Responsibility Model](https://docs.oracle.com/en/cloud/paas/autonomous-database/shared-responsibility-model.html)

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| OS、Grid Infrastructure、DBMS | 構成、監視、更新、障害修復 | 直接アクセスしない |
| バックアップとリカバリ | バックアップを取得し、要求に応じて復旧処理を実行 | 復旧要求、復旧点、追加保護を選択 |
| Compute と Storage のスケール | 処理を実行 | 基準容量、自動スケール、上限を指定 |
| スキーマ、SQL、索引、Database user | 自動化と組込み機能を提供 | 設計、性能、権限、監査を管理 |
| IAM、ネットワーク、接続情報 | サービス機能を提供 | Policy、Private Endpoint、NSG、Secret を管理 |
| アプリケーション | 対象外 | 可用性、性能、再接続、業務監視を管理 |

利用者は OS と`SYSDBA`へアクセスせず、`ADMIN`などの Database user を使う。OS ファイル、任意エージェント、未対応の初期化パラメータ、`SYS`操作、外部接続に依存するワークロードは、移行前に制約と代替方法を確認する。

## Serverless のワークロード

Doc: [Autonomous AI Database Serverless](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/)

| ワークロード                               | 主な用途                                      |
| ------------------------------------ | ----------------------------------------- |
| Autonomous AI Transaction Processing | OLTP、混合ワークロード、アプリケーションバックエンド              |
| Autonomous AI Lakehouse              | データウェアハウス、分析、Object Storage を含む Lakehouse |
| Autonomous AI JSON Database          | JSON 中心のアプリケーション                          |
| APEX Service                         | APEX を使うローコードアプリケーション                     |

ワークロード種別は、同じ Oracle AI Database の構成とサービス設定を用途別に最適化する。別のデータベースエンジンを選ぶ項目ではない。

Doc: [Create an Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbba/)

Dedicated Exadata Infrastructure で選択できるワークロードは Autonomous AI Lakehouse と Autonomous AI Transaction Processing であり、Autonomous AI JSON Database と APEX Service は Dedicated のワークロード種別としてサポートされない。

## 基盤の分離と配置場所

| 運用・分離モデル                                                    | 分離             | 配置場所      | 利用者が管理する上位リソース                       | 向く条件                           |
| ----------------------------------------------------------- | -------------- | --------- | ------------------------------------ | ------------------------------ |
| Autonomous AI Database Serverless                           | Oracle 管理の共有基盤 | OCI リージョン | Database の Compute、Storage、Network   | Database 単位で弾力的に利用し、基盤管理を減らす   |
| Autonomous AI Database on Dedicated Exadata Infrastructure  | テナント専有 Exadata | OCI リージョン | Exadata、AVMC、ACD、Database の容量と保守ポリシー | 物理分離、複数 Database の統合、保守統制を両立する |
| Autonomous AI Database on Exadata Cloud@Customer（Dedicated） | 顧客専用 Exadata   | 顧客データセンター | Dedicated と同様の階層に加えてサイトと接続           | データ所在と Autonomous 運用を両立する      |

Exadata Cloud@Customer は第三の自律レベルではなく、Dedicated のリソース階層と運用モデルを顧客データセンターへ配置する形態である。Public Cloud と Cloud@Customer では画面表記、バックアップ先、基盤保守の統制に差があるため、配置後の手順はそれぞれの公式資料で確認する。

## Serverless

Doc: [Key Features of Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-key-features.html)

- Database 単位で ECPU と Storage を割り当て、専有 Exadata を先に確保せずに作成する
- Compute と Storage を停止せずに個別に拡張できる
- Compute Auto Scaling は需要に応じて基準 ECPU の最大 3 倍の Compute と I/O を使う
- Storage Auto Scaling は有効化すると基準 Storage の最大 3 倍まで拡張できる
- Compute を停止して非本番の計算資源コストを抑えられるが、Storage やバックアップなどの費用は残る
- Database Actions、APEX、ORDS、Data Studio、Oracle Machine Learning などの組込み機能を利用できる

Auto Scaling を有効にした場合は、基準 ECPU だけで費用と性能を見積もらない。通常時、ピーク時、自動拡張後の課金とアプリケーション応答を計測する。

## Dedicated Exadata Infrastructure

Doc: [About Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/about-autonomous-ai-database-on-dedicated-exadata.html)

| リソース                              | 役割                                              |
| ------------------------------------- | ------------------------------------------------- |
| Exadata Infrastructure                | 専有する物理 Exadata とネットワークの単位         |
| Autonomous Exadata VM Cluster（AVMC） | VM、Compute、Memory、Network、保守の境界          |
| Autonomous Container Database（ACD）  | Database version、patch、backup、DR policy の境界 |
| Autonomous AI Database                | アプリケーションが使う Database                   |

- Fleet Administrator は Exadata Infrastructure、AVMC、ACD の容量と保守を管理する
- Database Administrator は Autonomous AI Database と Database user を管理する
- 複数部門へ Database を提供する場合は、ACD の保守ポリシー、予備 ECPU、障害時の容量余力、集約率を決める
- Serverless より強い分離と保守統制を得る代わりに、上位リソースの容量と課金を継続的に管理する

## Exadata Cloud@Customer

Doc: [Autonomous AI Database on Exadata Cloud@Customer](https://docs.oracle.com/en-us/iaas/exadata/doc/adb-intro-to-adb.html)

- Autonomous の責任モデルを維持しながら、Exadata とデータを顧客データセンターへ配置する
- 顧客は設置場所、電源、冷却、物理セキュリティ、クライアントネットワーク、OCI 制御プレーンへの接続を準備する
- Public Cloud の Dedicated と同じリソース階層を基本とするが、バックアップ、DR、鍵管理、対応機能の差を確認する
- 既存アプリケーションとの低遅延接続、データ所在、規制上の物理境界が必要な場合に比較する

## 可用性とデータ保護

- Oracle は Autonomous AI Database の基盤冗長化、日常的なバックアップ、パッチ、障害修復を管理する
- Autonomous Data Guard を追加すると、Local または Cross-Region の Standby Database を使った災害対策を構成できる
- Backup-based Disaster Recovery は Standby を常時稼働させる構成より低コストにできるが、復旧時間が長くなる
- アプリケーション、DNS、接続文字列、Wallet、Secret、外部連携は Database のフェイルオーバーだけでは切り替わらない
- バックアップ保持期間、長期保持、リージョン間コピー、削除保護は配置モデルと構成時点の機能を確認する

## 選定条件

### 向く条件

- DBMS のパッチ、バックアップ、基盤監視、障害修復を Oracle へ委ねられる
- Oracle SQL、PL/SQL、JSON、Vector Search、APEX などの Oracle AI Database 機能を使う
- ワークロードの増減に合わせて Compute と Storage を弾力的に変更する
- 新規アプリケーションで OS や`SYSDBA`への依存を作らず、標準化した Database を提供する

### 比較が必要な条件

- OS、Grid Infrastructure、任意エージェント、`SYSDBA`、または利用者が任意の One-off patch を選定・直接適用する必要があるなら [[cloud/oracle/database/services/oci-base-database-service|Base Database Service]]または [[cloud/oracle/database/services/oci-exadata-database-service|Exadata Database Service]]と比較する
- 専有基盤が不要なら Serverless を最初に評価し、物理分離や Fleet 単位の保守統制が必要な場合に Dedicated を評価する
- 単一 Database の拡張では足りず、水平分割やデータ所在が必要なら [[cloud/oracle/database/services/oci-globally-distributed-database|Globally Distributed Autonomous AI Database]]と比較する

## 関連メモ

- [[cloud/oracle/ai/oracle-ai-database|Oracle AI Database の AI 機能]]
- [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]
- [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]]

## 参照リンク

- [Autonomous AI Database Serverless](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/)
- [Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/about-autonomous-ai-database-on-dedicated-exadata.html)
- [Autonomous AI Database on Exadata Cloud@Customer](https://docs.oracle.com/en-us/iaas/exadata/doc/adb-intro-to-adb.html)
- [Autonomous AI Database Responsibility Model](https://docs.oracle.com/en/cloud/paas/autonomous-database/shared-responsibility-model.html)
