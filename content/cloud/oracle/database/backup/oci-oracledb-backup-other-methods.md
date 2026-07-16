---
title: OCI Oracle Database のその他のバックアップ方法
date: 2026-07-15
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup-other-methods
  - cloud/oracle/database/oci-oracledb-backup-other-methods
description: マネージド Object Storage、ローカル FRA、Data Pump、スタンバイからのバックアップの役割と制約。
---

このメモでは、Autonomous Recovery Service と利用者管理の RMAN 以外に、OCI Base Database Service で利用できるバックアップ手段と補助方式を整理する。

バックアップ方式全体の比較は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照。

## 方式の使い分け

| 方式 | 主な用途 | Database 全体の PITR | 管理主体 | 主な制約 |
| --- | --- | --- | --- | --- |
| マネージド Object Storage | 標準的な自動物理バックアップ | 対応 | OCI | Recovery Service 固有のリアルタイム保護、Virtual Level 0、Retention Lock はない |
| ローカル FRA | 高速な短期復元、クラウド保存の補助 | RMAN 構成による | 利用者 | DB システム喪失時に同時に利用不能になり得る |
| Data Pump | Schema／table 単位の論理退避と移行 | 非対応 | 利用者 | 物理 Database 全体の復旧には使えない |
| スタンバイからの自動バックアップ | Primary のバックアップ負荷軽減 | 保存先の機能による | OCI | Data Guard と同じ障害領域・切替動作を含めて設計する |

## マネージド Object Storage バックアップ

OCI コンソールまたは API で構成するマネージド自動バックアップでは、利用可能な場合に Object Storage を保存先として選択できる。OCI がスケジュール、バックアップ作成、保持期間に基づく削除、コンソールからの復元を管理する。

Object Storage を保存先にした自動バックアップは、継続的に次を作成する。

- 週 1 回の Level 0 バックアップ
- Level 0 の翌日から 6 日間に作成する日次 Level 1 増分バックアップ
- 最低 60 分ごとのアーカイブ REDO ログ・バックアップ

保持期間は 7、15、30、45、60 日から選択し、デフォルトは 30 日。最新、時刻、SCN を指定した復元や、バックアップから新しい DB システムを作成する用途に使える。

Recovery Service と Object Storage のどちらを選べるかは、テナンシ作成日、リージョン、Database バージョン、シェイプ、Service Limits、リージョン容量によって変わる。一部条件では Recovery Service がコンソール上の唯一の選択肢になるため、固定したリージョン一覧ではなく、構成時点のコンソールと公式ドキュメントを確認する。

### 向いている場面

- Recovery Service のサポート条件を満たさない Database やシェイプを保護する。
- 既存のマネージド Object Storage バックアップを継続する。
- Recovery Service 固有機能を必要とせず、OCI 管理の標準的な PITR が要件を満たす。

### 注意点

- アーカイブ REDO ログの最小バックアップ頻度は 60 分であり、固定の RPO を保証する表現ではない。最終成功時刻と復元可能範囲を監視する。
- Retention Lock は Recovery Service の保護ポリシー機能であり、マネージド Object Storage バックアップに同じ機能があるとは扱わない。
- 自動バックアップ中に patching や Data Guard 操作など、Database の可用性へ影響する処理を重ねない。

## オンデマンド・バックアップ

自動バックアップとは別に、OCI コンソールからオンデマンド・バックアップを作成できる。保存先が Object Storage の場合は full backup、Recovery Service の場合は incremental backup として作成される。

オンデマンド・バックアップはアップデート／アップグレード、移行、大きな変更の前に復元点を明示するために有効。ただし、取得しただけで切り戻しが保証されるわけではなく、対象バージョンへ復元できるか、in-place restore か新規 DB システム作成か、TDE 鍵を利用できるかを確認する。

Recovery Service の Long-Term Retention（LTR）は長期保管用のオンデマンド・バックアップだが、通常のオンデマンド・バックアップと保持・復元条件が異なる。詳細は [[cloud/oracle/database/backup/oci-oracledb-backup-zrcv|OCI Oracle Database Autonomous Recovery Service（RCV / ZRCV）]] を参照。

## ローカル FRA

ローカル・バックアップは DB システムの Fast Recovery Area（FRA）へ保存する。ネットワーク転送が不要で、バックアップと Point-in-Time Recovery が速い一方、耐久性は低い。DB システムが利用不能になると、バックアップも利用できなくなる可能性がある。

ローカル FRA は、クラウド側の運用バックアップを置き換えるのではなく、短期的な高速復元の補助として使う。FRA 容量、アーカイブ REDO ログ削除、領域枯渇時の Database 停止リスクを監視する。

Base Database Service では、DB システムへ block volume を追加して network attached backup volume として使う方式は提供されていない。共有ファイルシステムを前提にしたオンプレミスのバックアップ設計をそのまま持ち込まない。

## Data Pump による論理退避

Oracle Data Pump Export（`expdp`）は、Database の data と metadata を dump file set へ unload する。Schema / table 単位の論理退避や選択的な復元に使えるが、`FULL=YES` でも datafile、control file、SPFILE、online / archived REDO log を含む物理 recovery image ではない。

dump file を Object Storage など別の障害領域へ移し、暗号化、保持、import 試験を管理する。移行 mode、性能、整合性、TDE、検証は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] を参照。

## スタンバイ Database からのバックアップ

Data Guard association では、スタンバイ Database に自動バックアップを構成し、Primary のバックアップ負荷を軽減できる。これは新しいバックアップ形式ではなく、Recovery Service または Object Storage へ送るバックアップの実行場所を変える機能。

- Primary と standby のバックアップ保存先は同じ方式にそろえる。
- 保存先を変更する場合は、Primary または standby のバックアップを一度無効化する必要がある。
- switchover / failover 後にどちら側でバックアップが継続し、どちらで無効になるかを事前に確認する。
- Data Guard broker、redo transport、standby lag、バックアップ・ウィンドウを含めて試験する。

Data Guard は高可用性と災害対策の機能であり、誤削除や論理破損が standby へ反映される可能性がある。履歴を保持するバックアップを別途維持する。

## 公式ドキュメント

- [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
- [Back Up a Database Using the Console](https://docs.oracle.com/en/cloud/paas/base-database/backup-db/index.html)
- [Configure Automatic Backups for a Standby Database](https://docs.oracle.com/en/cloud/paas/base-database/backup-db/index.html)
