---
title: OCI Globally Distributed Database
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-globally-distributed-database
  - cloud/oracle/database/oci-globally-distributed-database
description: Globally Distributed Autonomous AI Database と Distributed ExaDB-XS の Shard、ルーティング、複製、選定条件を整理する。
---

## 概要

- Globally Distributed Database は、Oracle AI Database のデータを複数の独立した Shard へ水平分割し、単一のサービスとして管理する
- 単一 Database の垂直拡張、RAC、Cross-Region Data Guard では満たせない規模、データ所在、地域ごとの低遅延を対象にする
- Autonomous AI Database を基盤にするサービスと、Exadata Database Service on Exascale Infrastructure を基盤にするサービスがある
- 導入するとデータ配置とトランザクション境界がアプリケーション設計へ入るため、通常の Standby Database の別名として選ばない

## サービス

| サービス | DBMS の運用モデル | 基盤 | 主な差 |
| --- | --- | --- | --- |
| Globally Distributed Autonomous AI Database | Oracle が DBMS を管理 | Dedicated Autonomous AI Database | DBMS のパッチ、バックアップ、障害修復を Oracle へ委ねる |
| Globally Distributed Exadata Database on Exascale Infrastructure | ExaDB-XS の共同管理 | 共有 Exascale Infrastructure 上の分離 VM | Guest VM、Grid Infrastructure、Database の管理自由度を残す |

## 構成要素

Doc: [Globally Distributed Autonomous AI Database Overview](https://docs.oracle.com/en/cloud/paas/globally-distributed-autonomous-database/user/overview-distributed-adb1.html)

| 構成要素       | 役割                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| Shard          | 分散データの一部を保持する独立した Database                               |
| Catalog        | Shard の配置、スキーマの正本、複数 Shard 問い合わせを管理する Database    |
| Shard Director | Sharding Key とトポロジーに基づいて接続を適切な Shard へ転送する Listener |
| Global Service | 複数 Shard を対象にする接続サービス                                       |
| Shardspace     | 指定したキー範囲またはリストのデータとレプリカをまとめる配置単位          |
| Chunk          | Shard 間で移動できるデータ配置の単位                                      |

アプリケーションが Sharding Key を接続または SQL へ渡せると、Shard Director は対象データを持つ Shard へ処理を転送できる。Sharding Key を使わない複数 Shard 問い合わせは Catalog の Query Coordinator を経由し、単一 Shard 問い合わせより多くのネットワークと調整処理を使う。

## データ配置

- Sharding Key は、データの所在、同時アクセス、トランザクション境界、将来の再配置を決める
- 同じ Shard に置く必要がある行は、共通の Sharding Key を使うデータモデルにする
- 複数 Shard Transaction と複数 Shard Join は利用できる機能と制約を確認し、通常経路に多用しない
- 地理的な配置では、利用者や法域を Shardspace へ対応付け、データ移動とフェイルオーバーが所在要件を破らないようにする
- Shard の追加と削除では Chunk の再配置が発生するため、データ量、ネットワーク、ピーク時間、レプリカ状態を監視する

## 複製と整合性

Doc: [Globally Distributed Exadata Database on Exascale Infrastructure Overview](https://docs.oracle.com/en/cloud/paas/globally-distributed-exascale-database/user/overview-distributed-exadb-xs.html)

- Data Guard は Shard または Catalog の物理 Standby を維持し、ローカルまたはリモートの障害に備える
- Raft Replication は Chunk の複製を複数 Shard へ分散し、Shard の追加、削除、障害時にレプリカ数と配置を自動調整する
- 利用できる複製方式は Database バージョンとサービスによって異なる
- `zero data loss`などの表現は、指定した複製構成が正常に稼働し、アプリケーションが適切なサービスへ再接続できる条件で評価する
- 複製は誤削除や論理破損も伝播する可能性があるため、バックアップと復旧試験を別に設計する

## 運用境界

- Autonomous 版では Oracle が各 Shard の DBMS ライフサイクルを管理し、利用者はデータモデル、Sharding Key、配置、SQL、アプリケーションを管理する
- ExaDB-XS 版では利用者が各 VM Cluster、Grid Infrastructure、Database の更新と運用も管理する
- どちらでも Catalog、Shard Director、Private Endpoint、Global Service、レプリケーション遅延、再配置を分散 Database 全体として監視する
- IAM と OCI リソース権限だけでなく、各 Database の user、role、接続資格情報、監査を統一する

## 選定条件

### 向く条件

- 単一 Database の垂直拡張上限を超える書き込み量またはデータ量がある
- 法域、テナント、顧客ごとにデータを配置し、所在要件を守る必要がある
- 世界各地から地域内の Shard へ接続し、ネットワーク遅延を抑える必要がある
- Sharding Key を安定して定義でき、主要トランザクションを単一 Shard に閉じられる

### 向かない条件

- 必要なのが単一 Database のリージョン障害対策だけなら、Data Guard または Autonomous Data Guard の方が単純になる
- Sharding Key を決められず、ほぼすべての処理が全 Shard を横断する場合は、分散による調整コストが増える
- アプリケーションを変更できず、接続時のルーティング、再試行、複数 Shard の制約へ対応できない場合は導入が難しい

## 確認事項

- 対応リージョン、Database バージョン、Shard 数、ECPU、Storage、Private Endpoint の Service Limits
- Autonomous 版と ExaDB-XS 版で利用できる複製方式、保守機能、バックアップ、監視の差
- Sharding Method、Sharding Key、Duplicated Table、複数 Shard Transaction の制約
- Shard 追加、削除、障害、リージョン切替時のアプリケーション接続と整合性
- Globally Distributed Database SKU と、基盤となる Autonomous または ExaDB-XS リソースの課金

## 参照リンク

- [Globally Distributed Autonomous AI Database](https://docs.oracle.com/en/cloud/paas/globally-distributed-autonomous-database/user/overview-distributed-adb1.html)
- [Globally Distributed Exadata Database on Exascale Infrastructure](https://docs.oracle.com/en/cloud/paas/globally-distributed-exascale-database/user/overview-distributed-exadb-xs.html)
- [Oracle Globally Distributed AI Database Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/shard/)
