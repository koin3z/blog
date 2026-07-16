---
title: Oracle Database TDE
date: 2026-01-09
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
  - security/cryptography
aliases:
  - cloud/oracle/oracledb-tde
  - cloud/oracle/database/oracledb-tde
description: Oracle Database の Transparent Data Encryption と OCI 移行時の暗号化に関するメモ。
---

## 要点

- Transparent Data Encryption（TDE）は、データファイル上のデータを透過的に暗号化する。
- OCI Base Database Service では、ユーザー作成表領域はデフォルトで暗号化される。
- 暗号化の安全性と復旧可能性は、マスター暗号化鍵とキーストアの管理に依存する。
- `ENCRYPT_NEW_TABLESPACES` と `TABLESPACE_ENCRYPTION` は別の初期化パラメータ。
- 新規表領域の暗号化設定は、既存の未暗号化表領域を自動変換しない。
- 物理移行でも、RMAN や ZDM の方式によってリストア時に暗号化できる。

## TDE の鍵構造

TDE では、表領域または列を暗号化するデータ暗号化鍵を、マスター暗号化鍵が保護する。マスター暗号化鍵は Database の外部にあるキーストアで保護する。暗号化済みデータファイルと鍵の両方を失うと復旧できないため、バックアップと移行ではキーストアの扱いを必ず設計する。

OCI Base Database Service の鍵管理方式は大きく次の 2 つ。

| 方式 | 概要 | 注意点 |
| --- | --- | --- |
| Oracle-managed key | デフォルト。Oracle が暗号化鍵を管理する | 利用者が独自の Vault key lifecycle を管理しない |
| Customer-managed key | OCI Vault に利用者管理の鍵を置く | IAM、Vault 到達性、鍵の無効化・削除・ローテーションが DB 可用性に影響する |

既存 Database は Oracle-managed key から customer-managed key へ変更できるが、Base Database Service の公式ドキュメントでは逆方向はサポートされない。変更前に CDB/PDB、鍵バージョン、バックアップ、クローン、クロスリージョン復旧への影響を確認する。

## 新規表領域の暗号化パラメータ

### `ENCRYPT_NEW_TABLESPACES`

主に 12.2 以降および 19c の従来構成で、新規ユーザー表領域のデフォルト動作を制御する。

| 値 | 動作 |
| --- | --- |
| `CLOUD_ONLY` | クラウドでは暗号化し、オンプレミスでは `CREATE TABLESPACE` の指定に従う。デフォルト値 |
| `ALWAYS` | クラウド／オンプレミスを問わず、暗号化指定を省略しても暗号化する |
| `DDL` | `CREATE TABLESPACE` の `ENCRYPTION` 句に従う。省略時は暗号化しない |

### `TABLESPACE_ENCRYPTION`

Oracle Database 19c RU 19.16 で `ENCRYPT_NEW_TABLESPACES` の代替として導入された。両方の設定が競合する場合は `TABLESPACE_ENCRYPTION` が優先される。

| 値 | 動作 |
| --- | --- |
| `AUTO_ENABLE` | 新規表領域を暗号化する。クラウド Database のデフォルト |
| `MANUAL_ENABLE` | `CREATE TABLESPACE ... ENCRYPT` で明示した場合に暗号化する。オンプレミスのデフォルト |
| `DECRYPT_ONLY` | 新規表領域を暗号化せず、既存未暗号化表領域の暗号化も許可しない。オンプレミス専用 |

クラウド Database では `MANUAL_ENABLE` または `DECRYPT_ONLY` を設定しても無視され、 `AUTO_ENABLE` として動作する。これは「既存の未暗号化表領域も即座に暗号化される」という意味ではなく、既存表領域には別途オンライン／オフライン変換が必要。

## 移行時の暗号化

### 論理移行（Data Pump）

Data Pump はオブジェクトとデータをターゲット側で再作成する。インポート先表領域が TDE で暗号化されていれば、そこへ書き込まれるデータブロックも暗号化される。

ただし、Data Pump dump file 自体の暗号化は別の論点。Object Storage、転送経路、dump file の暗号化オプションとパスワード／鍵管理を別途確認する。

移行全体は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] を参照。

### 物理移行（RMAN / Data Guard / ZDM）

物理移行はデータファイルのブロックを扱うが、「ソースが未暗号化ならターゲットも必ず未暗号化」とは限らない。

- RMAN は `RESTORE ... AS ENCRYPTED` により、互換性要件を満たす未暗号化バックアップを暗号化してリストアできる。ターゲットの wallet / keystore を作成し、open しておく必要がある。
- クラウドへの ZDM 物理移行では、Oracle Database 12.2 以降のソースに TDE 構成が必要。ソース表領域を事前に暗号化する必要はないが、CDB と全 PDB のキーストアを open にし、マスター鍵を設定する。
- ZDM の backup/restore または restore from service を使う方式では、ターゲット表領域を暗号化できる。active duplicate など、方式によって暗号化動作が異なるため、使用する ZDM バージョンの手順を確認する。
- Data Guard でスイッチオーバー後に旧ソースへフォールバックする場合は、クラウド側から返る暗号化 REDO を旧ソースが扱えるよう、ソース側の TDE 構成と鍵を維持する。

物理移行の詳細は [[cloud/oracle/database/backup/oci-oracledb-backup-rman|RMAN]]、[[cloud/oracle/database/migration/oracledb-data-guard|Data Guard]]、[[cloud/oracle/database/migration/oci-zero-downtime-migration|ZDM]] を参照。

## 状態の確認

```sql
show parameter encrypt_new_tablespaces
show parameter tablespace_encryption

select con_id,
       wrl_type,
       status,
       wallet_type,
       keystore_mode,
       fully_backed_up
from   v$encryption_wallet
order  by con_id;
```

`V$ENCRYPTION_WALLET` は CDB と全 PDB のキーストア状態、キーストア種別、バックアップ状態を確認するために使う。マスター暗号化鍵の有無、既存表領域の暗号化状態、バックアップ／Data Guard／クローン／移行先での鍵の利用可否は別途確認する。OCI Vault を使う場合は、IAM とネットワークに加え、鍵の無効化や削除が Database の可用性へ与える影響も考慮する。

関連する作業全体は [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]、バックアップと鍵の関係は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]を参照。

## 公式ドキュメント

- [Transparent Data Encryption - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/tde/index.html)
- [Manage Encryption Keys - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/encryption-keys/index.html)
- [`ENCRYPT_NEW_TABLESPACES`](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ENCRYPT_NEW_TABLESPACES.html)
- [`TABLESPACE_ENCRYPTION`](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/TABLESPACE_ENCRYPTION.html)
- [RMAN `RESTORE`](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/RESTORE.html)
- [ZDM: Preparing for a Physical Database Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/21.5/zdmug/preparing-for-database-migration.html)
- [Oracle AI Database Licensing Information](https://docs.oracle.com/en/database/oracle/oracle-database/26/dblic/Licensing-Information.html)
