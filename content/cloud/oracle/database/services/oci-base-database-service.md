---
title: OCI Base Database Service
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-base-database-service
  - cloud/oracle/database/oci-base-database-service
description: Base Database Service の共同管理モデル、VM DB System、更新、可用性、バックアップ、選定条件を整理する。
---

## 概要

Doc: [About Oracle Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/about/)

- Base Database Service は、Oracle AI Database を OCI の仮想マシンと Block Volume 上で実行する共同管理型サービス
- 利用者は Guest VM、Grid Infrastructure、Database Home、Database を管理し、Oracle は物理基盤、ハイパーバイザ、OCI の制御機能を管理する
- Single-node DB System と Multi-node RAC DB System を選択できる
- Exadata 固有機能を必要とせず、OS や`SYSDBA`へアクセスする必要がある Oracle Database ワークロードに向く

## 責任範囲

| 管理対象 | Oracle | 利用者 |
| --- | --- | --- |
| 物理サーバー、ネットワーク接続ストレージ、ハイパーバイザ | 管理 | 構成を選択 |
| DB System の作成、スケール、更新、バックアップの自動化 | OCI API と制御機能を提供 | 実行条件、時期、検証、失敗時対応を管理 |
| Guest OS、Grid Infrastructure、Database Home | 基本イメージと更新機能を提供 | 更新、設定、監視、追加ソフトウェアを管理 |
| Database、PDB、スキーマ、SQL、権限 | 自動化機能を提供 | 設計、運用、性能、監査を管理 |
| アプリケーション、接続、業務継続 | 対象外 | 管理 |

OCI コンソールや Database CLI（`dbcli`）に操作がある場合は、制御機能を優先する。Guest VM 内だけで構成を変更すると、OCI が保持するリソース状態と実際の状態がずれ、後続の更新やバックアップが失敗する可能性がある。

## リソースモデル

Doc: [About DB Systems](https://docs.oracle.com/en/cloud/paas/base-database/about-dbs/index.html)

| リソース | 役割 |
| --- | --- |
| DB System | VM、ネットワーク、ストレージ、Database をまとめる管理単位 |
| DB Node | Oracle Linux、Grid Infrastructure、Database software を実行する VM |
| Database Home | Oracle Database software のバージョンと更新レベルを持つ単位 |
| Database | CDB と PDB、TDE 鍵、バックアップ設定を持つデータベース |
| Data Guard Group／Association | Primary Database と 1 つ以上の Standby Database の関係 |

- Standard Edition、Enterprise Edition、High Performance、Extreme Performance から機能とライセンス範囲を選ぶ
- Multi-node RAC には Enterprise Edition - Extreme Performance が必要になる
- Enterprise Edition - Developer は非本番向けであり、Single Instance、対応シェイプ、容量などに制約がある
- 対応バージョン、エディション、シェイプ、ストレージ管理方式は変更されるため、作成時点のドキュメントを確認する

## 更新と運用

Doc: [Update a DB System](https://docs.oracle.com/en/cloud/paas/base-database/update-dbs/index.html)

- 利用者は OS、Grid Infrastructure、Database の更新時期を計画する
- 更新前にバックアップ、空き容量、Data Guard の状態、アプリケーション互換性を確認する
- RAC のローリング更新であっても、セッションの再接続、サービス配置、非ローリング対象の確認が必要になる
- One-off patch や追加エージェントを導入できるが、OCI 自動化との互換性とサポート条件を確認する
- Database Home を分けると、同じ DB System 内で更新レベルや保守時期を分離できる

更新とアップグレードの違いは [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]を参照。

## 可用性とデータ保護

Doc: [About Oracle Data Guard](https://docs.oracle.com/en/cloud/paas/base-database/data-guard/index.html)

- Single-node DB System はノード障害時に Database を別ノードへ無停止で引き継ぐ構成ではない
- Multi-node RAC は同一 DB System 内のインスタンスやノード障害に対する可用性を高める
- Data Guard は別の DB System に Standby Database を作成し、Availability Domain やリージョンをまたぐ障害に備える
- RAC と Data Guard は対象とする障害範囲が異なり、どちらも論理破損や過去時点への復旧を担うバックアップの代替にはならない

Doc: [Backup and Recovery](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)

- 自動バックアップの保存先として Autonomous Recovery Service または Object Storage を使用する構成がある
- 保存先の選択可否は、リージョン、テナンシー作成時期、作成方法などで変わるため、構成時点のコンソールとドキュメントを確認する
- Recovery Service、Object Storage、自己管理 RMAN、ローカル FRA は、保持、改ざん耐性、復旧点、運用負荷が異なる

バックアップ方式は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]を参照。

## セキュリティ

- OCI IAM は DB System などの制御リソースを管理し、Database user と role は Database 内のデータアクセスを管理する
- Guest VM へ SSH 接続できるため、SSH 鍵、`sudo`、OS user、エージェント、ホスト上のファイルも利用者の管理対象になる
- Cloud Database では TDE を使用し、顧客管理鍵を選ぶ場合は Vault の IAM、鍵の無効化、ローテーション、リージョン間復旧を可用性依存関係として設計する
- Database への接続は VCN、Subnet、NSG、DNS、SQL\*Net／TLS を組み合わせて制御する

## 選定条件

### 向く条件

- Oracle Database の OS、Grid Infrastructure、`SYSDBA`、初期化パラメータ、ファイル、追加エージェントを管理する必要がある
- Exadata Smart Scan や Exadata Storage Server を必要としない
- 既存の DBA 運用を維持しながら、作成、更新、バックアップ、Data Guard を OCI API で自動化したい
- Standard Edition を含むエディション選択が必要になる

### 比較が必要な条件

- 大量 I/O、大規模統合、Exadata 固有機能が必要なら [[cloud/oracle/database/services/oci-exadata-database-service|Exadata Database Service]]と比較する
- OS と DBMS の運用を Oracle へ委ねられるなら [[cloud/oracle/database/services/oci-autonomous-ai-database|Autonomous AI Database]]と比較する
- 世界規模の水平分割やデータ所在が要件なら [[cloud/oracle/database/services/oci-globally-distributed-database|Globally Distributed Database]]と比較する

## 参照リンク

- [Oracle Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/)
- [About Oracle Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/about/)
- [Security Guide for Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/security-guide/)
- [Backup and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
