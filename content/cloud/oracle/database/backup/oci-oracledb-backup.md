---
title: OCI Oracle Database バックアップ概要
date: 2026-01-09
modified: 2026-07-15
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup
  - cloud/oracle/database/oci-oracledb-backup
description: OCI 上の Oracle Database バックアップ方式、保存先、RPO・RTO・保持要件による選択ガイド。
---

このメモでは、主に Oracle Base Database Service のバックアップ方式を比較し、詳細ページへの入口を提供する。サービス、リージョン、Database バージョンによって利用できる機能は異なるため、構成時点の公式ドキュメントと OCI コンソールを確認する。

## 要点

- Oracle は、OCI Database ではコンソールまたは API で構成する**マネージド自動バックアップ**を推奨している。
- マネージド自動バックアップの保存先は **Autonomous Recovery Service** が推奨で、条件を満たす場合は **Object Storage** も選択できる。テナンシ作成日、リージョン、Database バージョン、シェイプ、Service Limits、リージョン容量によって選択肢が変わる。
- Recovery Service でリアルタイム・データ保護を有効にした構成は `ZRCV`、無効の構成は `RCV` と呼ばれることがある。これは別製品というより、同じサービスの保護レベルの違いとして捉える。
- `RMAN` は保存先ではなく Oracle Database の物理バックアップ／リカバリ・ユーティリティ。独自要件がある場合は、利用者管理の Object Storage バケットなどへバックアップできる。
- Data Guard、RAC、バックアップは代替関係ではない。バックアップは誤操作、論理破損、ランサムウェア、過去時点への復旧を担当する。

## バックアップ方式の選択

| 方式 | 管理主体 | 主な用途 | 主な注意点 |
| --- | --- | --- | --- |
| Recovery Service（RCV / ZRCV） | OCI | 標準の運用バックアップ、Point-in-Time Recovery、長期保持、耐改ざん | VCN、サブネット、Database バージョンなどの前提がある。リアルタイム・データ保護は追加料金 |
| マネージド Object Storage バックアップ | OCI | Recovery Service を利用できない構成、標準的な自動バックアップ | Recovery Service 固有の Virtual Level 0、リアルタイム・データ保護、Retention Lock はない |
| RMAN / `dbcli` による非管理バックアップ | 利用者 | 独自の保存先、スケジュール、保持、リカバリ手順 | バケット、認証、暗号化、保持、監視、復旧試験を利用者が管理する |
| ローカル FRA | 利用者 | 高速な短期リストアの補助 | DB システム障害時にバックアップも利用不能になり得るため、単独の保護先には向かない |
| Data Pump | 利用者 | スキーマ／表単位の論理退避、選択的な移行や復元 | 物理 Database 全体を復旧する RMAN バックアップの代替ではない |

### まず Recovery Service を評価する

通常の Base Database Service では、運用負荷、復旧可能性、耐改ざんを含めて Recovery Service を最初に評価する。リアルタイム・データ保護を有効にするかは、要求 RPO、追加料金、Database バージョン、ネットワークと REDO 転送の監視体制で決める。

Recovery Service の仕組み、RCV と ZRCV、保護ポリシー、Retention Lock は [[cloud/oracle/database/backup/oci-oracledb-backup-zrcv|OCI Oracle Database Autonomous Recovery Service（RCV / ZRCV）]] を参照。

### 独自要件がある場合に RMAN を選ぶ

保存先、バックアップ・セット、世代、暗号化、Recovery Catalog、複製先などを利用者が制御する必要がある場合は RMAN を検討する。自由度と引き換えに、バックアップの成功だけでなく、制御ファイル、SPFILE、アーカイブ REDO ログ、TDE キーストアを含む復旧手順全体を利用者が維持する。

構成と運用上の注意は [[cloud/oracle/database/backup/oci-oracledb-backup-rman|OCI Oracle Database の RMAN バックアップ]] を参照。

### 補助方式の役割を限定する

マネージド Object Storage、ローカル FRA、Data Pump、スタンバイ Database からのバックアップには、それぞれ適した用途がある。どの方式も名称だけで採用せず、どの障害から何をどの時点へ戻すのかを明確にする。

各方式の役割は [[cloud/oracle/database/backup/oci-oracledb-backup-other-methods|OCI Oracle Database のその他のバックアップ方法]] を参照。

## 選定の順序

1. 誤操作、論理破損、DB システム喪失、リージョン障害など、復旧対象となる障害を分ける。
2. 障害ごとに RPO、RTO、通常保持期間、長期保持期間、復旧先を決める。
3. Recovery Service、Object Storage、RMAN、ローカル FRA、Data Pump の役割を割り当てる。
4. バックアップと TDE キーストア／暗号鍵を同時に失わない配置と権限分離を設計する。
5. 保護状態、最終成功時刻、復元可能範囲、容量、異常検知を監視する。
6. 別 DB システムへのリストアと、アプリケーションを含む復旧を定期的に試験する。

## マネージド方式と非管理方式の併用

Recovery Service を有効にする前に、Oracle は別の保存先へ送る手動の運用バックアップを停止するよう案内している。また、`RMAN` や `dbcli` で構成した非管理バックアップからコンソール／API のマネージド方式へ切り替えると、新しいバックアップ構成が Database に関連付けられる。

複数方式を併用する場合は、OCI 自動化が管理する RMAN 設定を手動で変更しない。各方式の目的、所有者、スケジュール、保持、アーカイブ REDO ログ削除、障害時の復旧元を分け、切り替え後も旧方式が動作すると仮定しない。

アップデート／アップグレード前後の注意点は [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]、暗号鍵との関係は [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]] を参照。

## 公式ドキュメント

- [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
- [Back Up a Database Using the Console](https://docs.oracle.com/en/cloud/paas/base-database/backup-db/index.html)
- [Configure Recovery Service](https://docs.oracle.com/en/cloud/paas/base-database/recovery-service/index.html)
- [Back Up a Database to Object Storage Using RMAN](https://docs.oracle.com/en/cloud/paas/base-database/backup-rman/index.html)
