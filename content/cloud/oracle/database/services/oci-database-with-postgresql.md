---
title: OCI Database with PostgreSQL
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-database-with-postgresql
  - cloud/oracle/database/oci-database-with-postgresql
description: OCI Database with PostgreSQL のリソースモデル、ストレージ、読み取り拡張、可用性、バックアップ、制約を整理する。
---

## 概要

Doc: [Overview of OCI Database with PostgreSQL](https://docs.oracle.com/en-us/iaas/Content/postgresql/overview.htm)

- OCI Database with PostgreSQL は、PostgreSQL 互換のフルマネージドデータベースサービス
- Compute とストレージを分離し、データ量に応じてストレージを停止せずに拡張する
- 1 つの Primary Node と、必要に応じて Read Replica Node を持つ Database System を作成する
- PostgreSQL の互換性を維持しながら、プロビジョニング、更新、バックアップ、監視、フェイルオーバーを OCI で管理したいワークロードに向く

## 責任範囲

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| Compute、OS、PostgreSQL サーバー、ストレージ基盤 | 構成、更新、監視 | Shape、Node 数、Storage Performance Tier を選択 |
| Database System の作成、バックアップ、フェイルオーバー | OCI 機能を提供・実行 | Policy、時期、復旧点を指定 |
| Database、Schema、Table、Index、SQL | PostgreSQL 互換エンジンを提供 | 設計、性能、データを管理 |
| PostgreSQL user、IAM、Vault Secret | 機能を提供 | 権限、資格情報、ローテーションを管理 |
| VCN、Subnet、NSG、接続元 | Private Endpoint を提供 | 経路とアクセス制御を管理 |
| アプリケーションの可用性と再接続 | 対象外 | 管理 |

サポートされる PostgreSQL 拡張機能と構成変数にはサービス上の範囲がある。自己管理 PostgreSQL で使っている拡張、スーパーユーザー操作、ファイルシステム、バックアップツールをそのまま利用できるとは限らない。

## リソースモデル

| リソース        | 役割                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| Database System | PostgreSQL Cluster、Node、Endpoint、Storage、Management Policy をまとめる単位 |
| Node            | PostgreSQL Instance を実行する OCI VM                                         |
| Primary Node    | 読み書き Endpoint を提供する Node                                             |
| Read Replica    | 読み取り Endpoint から Query を処理し、必要に応じて Primary へ昇格できる Node |
| Configuration   | PostgreSQL の変数と、Shape に応じた計算式を保持する設定                       |
| Backup          | Database System を復元または新規作成するためのバックアップ                    |

Read Replica は分離された Database のコピーではなく、共有ストレージを使う Node である。Node を追加すると読み取り Compute を拡張できるが、書き込み処理とストレージ I/O の特性は別に計測する。

## ストレージと拡張

Doc: [Managing OCI Database with PostgreSQL Database System](https://docs.oracle.com/en-us/iaas/Content/postgresql/manage-databases.htm)

- OCI Database Optimized Storage は Compute と分離され、Table の作成と削除に合わせて使用容量を動的に変更する
- Flexible Shape を使って OCPU と Memory を変更できる
- Read Replica を追加して読み取り処理を水平方向に拡張できる
- Configuration では固定値だけでなく、OCPU や Memory に応じて変わる式を設定できる
- ストレージ容量、Node 数、対応 Shape、Performance Tier は Service Limits と制約を確認する

2026 年 7 月時点の管理ドキュメントでは、1 Database System の最大ストレージは 32 TB、Read Replica は最大 7 Node とされる。上限は変更されるため、設計時点のドキュメントとテナンシーの Service Limits を確認する。

## 可用性

- 1 Node 構成では Primary Node の Compute 障害に対する別 Node への即時フェイルオーバーを持たない
- 複数 Node 構成では、Read Replica を Primary へ昇格してフェイルオーバーできる
- Multi-Availability Domain Region では Regional Volume が複数 Availability Domain へ同期複製され、ストレージの耐久性を提供する
- 読み書き Endpoint と読み取り Endpoint を分け、アプリケーションが役割に応じて接続する
- フェイルオーバー時の接続切断、トランザクション再実行、DNS または Endpoint の切替をアプリケーションで検証する

ストレージの複製と Node の冗長化は別の層である。Regional Volume を使っていても、単一 Primary Node の Compute 障害に対する復旧動作は複数 Node 構成と同じにはならない。

## バックアップと保守

Doc: [OCI Database with PostgreSQL Database System Backups](https://docs.oracle.com/en-us/iaas/Content/postgresql/backups.htm)

- 自動バックアップを日次、週次、月次でスケジュールできる
- 2026 年 7 月時点の概要では、自動バックアップの保持期間は最大 35 日
- 長期間保持する場合は手動バックアップを作成する
- バックアップから新しい Database System を作成できる
- Management Policy で別 Region への Backup Copy を有効にできる
- Maintenance Window を指定し、ピーク時間を避けてサービス更新を実行する

バックアップ保持期間だけで復旧設計を決めず、Point-in-Time Recovery の範囲、リージョン障害、削除操作、資格情報、アプリケーションの復旧順序を確認する。

## ネットワークと資格情報

Doc: [Connecting to OCI Database with PostgreSQL](https://docs.oracle.com/en-us/iaas/Content/postgresql/connect-to-db.htm)

- Database Endpoint はインターネットから直接到達できず、VCN 内の Private Subnet から接続する
- オンプレミスからは Site-to-Site VPN または FastConnect、管理端末からは OCI Bastion などの経路を使う
- PostgreSQL の既定 Port は`5432`
- Database Administrator の Password は OCI Vault Secret として準備し、IAM で参照権限を制御する
- OCI IAM は Database System の管理操作を制御し、PostgreSQL role は Database 内のアクセスを制御する

## 選定条件

### 向く条件

- PostgreSQL のプロトコル、SQL、ドライバ、エコシステムとの互換性が必要
- OS と PostgreSQL サーバーの更新、ストレージ拡張、バックアップを OCI へ委ねる
- 読み取り Node を追加して参照処理を拡張する
- Private Network 内で Database を提供する

### 確認が必要な条件

- 必須 Extension、PostgreSQL Version、Configuration Parameter、Logical Replication の対応範囲
- Superuser 権限、OS ファイル、独自 Backup Agent、`pg_hba.conf`などへの依存
- Multi-Node Failover 時の RPO、RTO、接続 Endpoint、長時間 Transaction の動作
- 対応リージョン、最大 Storage、Node 数、Performance Tier、Service Limits

## 参照リンク

- [OCI Database with PostgreSQL](https://docs.oracle.com/en-us/iaas/Content/postgresql/)
- [Overview of OCI Database with PostgreSQL](https://docs.oracle.com/en-us/iaas/Content/postgresql/overview.htm)
- [Managing Database Systems](https://docs.oracle.com/en-us/iaas/Content/postgresql/manage-databases.htm)
- [Connecting to a Database](https://docs.oracle.com/en-us/iaas/Content/postgresql/connect-to-db.htm)
