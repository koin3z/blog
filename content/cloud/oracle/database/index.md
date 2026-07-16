---
title: OCI データベースサービス概要
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-database-services
description: OCI のマネージドデータベースと用途特化データストアを、データモデル、運用責任、拡張方式、整合性から比較する。
---

## 概要

- OCI のデータベースサービスは、データモデルを選ぶ層と、同じエンジンの運用モデルや基盤を選ぶ層に分かれる
  - PostgreSQL、MySQL、NoSQL、OpenSearch、Valkey／Redis は互換性とデータモデルが異なる
  - Oracle AI Database は同じエンジンを Base、Exadata、Autonomous、Globally Distributed の各サービスで提供する
- 最初にアプリケーションが必要とするプロトコル、SQL 互換性、トランザクション、問い合わせ方法を決め、その後で運用責任、可用性、配置場所、コストを比較する
- 高可用性、災害対策、バックアップは別の障害を扱う
  - レプリカやクラスタがあっても、誤削除、論理破損、過去時点への復旧に備えるバックアップは別途必要になる

Doc: [Oracle Cloud Infrastructure](https://www.oracle.com/cloud/)

## サービス体系

| サービス | 主なデータモデル | 管理単位 | 主な用途 | 詳細 |
| --- | --- | --- | --- | --- |
| Oracle AI Database | リレーショナル、JSON、ベクトル、グラフ、空間など | Database、PDB、VM Cluster、Exadata Infrastructure | Oracle Database 互換アプリケーション、基幹 OLTP、分析、統合 | [[cloud/oracle/database/services/oci-oracle-database-services\|Oracle Database サービス]] |
| OCI Database with PostgreSQL | PostgreSQL 互換リレーショナル | Database System、Node、Configuration、Backup | PostgreSQL アプリケーション、マネージド運用、読み取り拡張 | [[cloud/oracle/database/services/oci-database-with-postgresql\|OCI Database with PostgreSQL]] |
| MySQL HeatWave | MySQL リレーショナル、HeatWave 分析基盤 | DB System、MySQL Instance、HeatWave Cluster | MySQL OLTP、分析、Lakehouse、AutoML、生成 AI | [[cloud/oracle/database/services/mysql-heatwave\|MySQL HeatWave]] |
| Oracle NoSQL Database Cloud Service | 表、JSON、キー値 | Table、Index、Read Unit、Write Unit | 予測可能なキーアクセス、大量イベント、低遅延の水平拡張 | [[cloud/oracle/database/services/oci-nosql-database\|Oracle NoSQL Database Cloud Service]] |
| OCI Cache | インメモリのキー値 | Cluster、Shard、Node | キャッシュ、セッション、レート制御、一時状態 | [[cloud/oracle/database/services/oci-cache\|OCI Cache]] |
| OCI Search with OpenSearch | 転置索引、ドキュメント、集計 | Cluster、Index、Shard、Node | アプリケーション検索、ログ分析、検索用索引 | [[cloud/oracle/database/services/oci-search-with-opensearch\|OCI Search with OpenSearch]] |

OCI Cache と Search with OpenSearch は、永続的な業務データの正本をそのまま置き換えるサービスではない。キャッシュの消失や索引の再作成を前提に、正本となるデータベースや Object Storage から復元できる構成を取る。

## Oracle Database の配置

Oracle AI Database では、SQL 互換性だけでなく、DBMS の運用主体と基盤の配置を選ぶ。

| サービス | DBMS の運用主体 | 基盤 | 向く条件 | 詳細 |
| --- | --- | --- | --- | --- |
| Base Database Service | 利用者と Oracle の共同管理 | 汎用 VM、Block Volume | OS、Grid Infrastructure、`SYSDBA`を利用者が管理する | [[cloud/oracle/database/services/oci-base-database-service\|Base Database Service]] |
| Exadata Database Service | 利用者と Oracle の共同管理 | Exascale、専有 Exadata、Cloud@Customer | Exadata のストレージ処理、RAC、大規模統合が必要 | [[cloud/oracle/database/services/oci-exadata-database-service\|Exadata Database Service]] |
| Autonomous AI Database | Oracle が DBMS ライフサイクルを管理 | Serverless、Dedicated Exadata、Cloud@Customer | パッチ、バックアップ、障害修復をサービスへ委ねる | [[cloud/oracle/database/services/oci-autonomous-ai-database\|Autonomous AI Database]] |
| Globally Distributed Database | Autonomous または ExaDB-XS に従う | 複数の Shard と Catalog | 水平分割、データ所在、地域ごとの低遅延が必要 | [[cloud/oracle/database/services/oci-globally-distributed-database\|Globally Distributed Database]] |

`Dedicated`は基盤の分離を表し、DBMS の運用主体を表さない。Exadata Database Service on Dedicated Infrastructure では利用者が Guest VM と Database を管理し、Autonomous AI Database on Dedicated Exadata Infrastructure では Oracle が DBMS を管理する。

## 選択軸

### 互換性と問い合わせ

- 既存アプリケーションを移行する場合は、ドライバ、SQL 方言、ストアドプログラム、データ型、拡張機能の互換性を最初に確認する
- 複雑な結合と複数行トランザクションが中心なら、Oracle AI Database、PostgreSQL、MySQL を比較する
- 主キーを使う単純な読み書きを大規模に水平拡張する場合は、Oracle NoSQL Database を比較する
- 全文検索、ファセット、ログ集計が中心なら Search with OpenSearch を使い、業務データの正本は別に保持する
- マイクロ秒から低ミリ秒の一時データアクセスが中心なら OCI Cache を使い、消失時の再生成経路を用意する

### 運用責任

| 管理対象 | 共同管理型の Oracle Database | フルマネージド型 |
| --- | --- | --- |
| 物理基盤、ハイパーバイザ | Oracle | Oracle |
| Guest OS、DBMS の更新 | 利用者が計画・実行 | Oracle が実行し、利用者が時期やポリシーを指定する場合がある |
| スキーマ、SQL、データ | 利用者 | 利用者 |
| IAM、DB ユーザー、ネットワーク | 利用者 | 利用者 |
| アプリケーションの可用性と性能 | 利用者 | 利用者 |

`fully managed`や`Autonomous`は、データモデル、SQL 性能、アプリケーションの復旧まで Oracle が所有することを意味しない。利用者は接続、権限、スキーマ、クエリ、業務監視、災害対策の選択と試験を管理する。

### 可用性と復旧

- 単一ノード、複数ノード、読み取りレプリカ、RAC、Data Guard、Global Active Table は、障害時の動作と整合性が異なる
- フェイルオーバー後もアプリケーションが再接続できるように、エンドポイント、DNS、接続プール、再試行、トランザクション再実行を設計する
- リージョン障害では、データベースだけでなくアプリケーション、鍵、シークレット、ネットワーク、名前解決、運用権限も復旧先へ用意する
- サービスが提供するバックアップ方式、保持期間、Point-in-Time Recovery、リージョン間コピー、削除保護を個別に確認する

## 範囲外と関連サービス

- OCI Compute へデータベースを手動導入する構成は、OCI のデータベースサービスではなく IaaS 上の自己管理構成として扱う
- Oracle AI Database@AWS、Oracle AI Database@Azure、Oracle AI Database@Google Cloud は Oracle のマルチクラウド配置であり、このメモでは OCI リージョン内の選択肢と分ける
- Autonomous Recovery Service、Database Migration、GoldenGate、Data Safe、Database Management、Operations Insights は、保護、移行、複製、セキュリティ、監視を担う周辺サービスとして扱う
- OpenSearch や OCI Cache を正本として利用できるかは、必要な永続性、整合性、復旧方法をアプリケーション要件と照合して判断する

## 関連メモ

- [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]
- [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]]
- [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]
- [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]]

## 参照リンク

- [Database](https://docs.oracle.com/en-us/iaas/Content/Database/home.htm)
- [OCI Database with PostgreSQL](https://docs.oracle.com/en-us/iaas/Content/postgresql/)
- [MySQL HeatWave](https://docs.oracle.com/en-us/iaas/mysql-database/index.html)
- [Oracle NoSQL Database Cloud Service](https://docs.oracle.com/en-us/iaas/nosql-database/index.html)
- [OCI Cache](https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm)
- [OCI Search with OpenSearch](https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm)
