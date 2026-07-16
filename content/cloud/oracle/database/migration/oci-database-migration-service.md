---
title: OCI Database Migration Service
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-database-migration-service
  - cloud/oracle/database/oci-database-migration-service
description: OCI Database Migration の offline / online 論理移行、Data Pump転送方式、GoldenGate同期、ZDMとの違い。
---

OCI Database Migration は、Oracle Database を OCI の target Database へ移行するマネージド・サービス。Data Pump による initial load と、必要に応じて GoldenGate による online replication を OCI コンソールまたは API から構成・実行する。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## Offline と online

| Migration | Initial load | 差分同期 | Source 更新 | 停止時間 |
| --- | --- | --- | --- | --- |
| Offline | Data Pump | なし | export 前に停止 | export、transfer、import、検証の全期間 |
| Online | Data Pump | GoldenGate | initial load 中も継続 | 最終同期、application cutover、検証 |

online migration でも source が完全無停止になるわけではない。cutover 時には source write を停止し、GoldenGate の最終 apply と target 検証を行う。

## 向いている場面

- OCI コンソール中心で Oracle Database の論理移行を構成する。
- Schema / object の選択、offline / online、Data Pump transfer medium を管理サービス上で指定する。
- target が Autonomous AI Database、Base Database Service、Exadata Database Service などの対応 OCI Database。
- Data Pump と GoldenGate の infrastructure を個別に構築する作業を減らす。
- migration resource、job、phase、metric、log を OCI で一元管理する。

物理移行、Data Guard switchover、RMAN、hybrid XTTS、詳細な response file 制御が必要なら [[cloud/oracle/database/migration/oci-zero-downtime-migration|Oracle Zero Downtime Migration]] を比較する。

## Initial load の transfer medium

| Medium | 仕組み | 向く場面 | 注意点 |
| --- | --- | --- | --- |
| Object Storage | source で dump、bucket 経由で target import | 標準的な Database | source の staging path、bucket、network、暗号化が必要。Oracle の推奨方式 |
| Database link | target から source を直接読み取る | 小規模 Database、dump staging を避ける | parallelism と長時間接続の制約。SQL\*Net connectivity が必要 |
| OCI File Storage / NFS | source / target で共有 mount | 大容量 dump、共有 filesystem が使える | mount target、export、権限、両 host の path を準備 |

source / target、Autonomous、Amazon RDS などの組合せで利用可能な medium は異なる。migration 作成画面と公式 support matrix を確認する。

## Online migration の仕組み

1. Data Pump export 開始前から GoldenGate capture を準備する。
2. Data Pump で source の一貫した initial data と metadata を target へ load する。
3. initial load 後に GoldenGate Replicat が source の差分 transaction を target へ適用する。
4. replication lag が収束するまで source application を稼働させる。
5. cutover 時に source write を停止し、最終 transaction の capture / apply を確認する。
6. target application を開始し、migration job を完了する。

online migration では source / target に force logging、supplemental logging、GoldenGate user / privilege、archive log retention などの準備が必要。詳細は [[cloud/oracle/database/migration/oracledb-goldengate|Oracle GoldenGate によるオンライン移行]] を参照。

## Migration resource と job

- **Connection**：source / target Database への接続情報と network path。
- **Migration**：source、target、job mode、initial load、replication、object selection、validation の定義。
- **Job**：migration 定義を実行する instance。phase、status、metric、log を持つ。

同じ migration 定義で評価と実行を繰り返せるが、source data、target object、dump、GoldenGate checkpoint が前回の実行から残っていないか確認する。

## 基本フロー

1. source / target connection と private network / agent / SSH 条件を準備する。
2. migration を作成し、full または Schema mode、offline / online、transfer medium を選ぶ。
3. Cloud Premigration Advisor Tool と validation を実行する。
4. target、directory、bucket / NFS、Data Pump、GoldenGate 設定を確認する。
5. migration job を開始し、phase、work request、log、metric を監視する。
6. online の場合は指定 phase で pause し、cutover window まで replication を継続する。
7. source 更新を停止し、最終同期を確認して target へ切り替える。
8. target を検証し、不要な user、dump、bucket object、GoldenGate resource を cleanup する。

## Object selection と変換

job mode は full または Schema を選び、advanced settings で include / exclude、Data Pump parameter、validation、GoldenGate parameter を調整できる。

サービスが default parameter を設定しても、次は利用者が確認する。

- source / target character set、timezone、version、edition、CDB / PDB
- user、role、quota、tablespace、TDE、Database option
- unsupported data type / object / DDL
- external table、BFILE、directory、Database link、scheduler、credential
- target-only trigger、constraint、sequence、application user

Data Pump の詳細は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] を参照。

## Snapshot standby からの export

対応する online migration では、Data Pump export の source に snapshot standby を使える。production primary ではなく snapshot standby へ export 負荷を逃がし、大きな parallelism を使い、long-running export の `ORA-01555` リスクを下げられる。

これは自動的に作られる通常機能ではない。physical standby を利用者が snapshot standby へ変換し、primary / standby で同じ export directory 名と path、shared filesystem などの前提を準備する。

## ZDM との違い

| 観点 | OCI Database Migration | ZDM |
| --- | --- | --- |
| 管理 | OCI managed service | 利用者が ZDM を実行 |
| 主な操作 | Console / API | CLI / response file |
| 移行種別 | logical offline / online | physical / logical / hybrid / PDB clone |
| underlying technology | Data Pump、GoldenGate | RMAN、Data Guard、Data Pump、GoldenGate、TTS、PDB clone |
| 向く場面 | OCI への標準的な論理移行 | 詳細な方式選択、大容量物理移行、特殊 target |

どちらも precheck と automation を提供するが、移行対象の support、object 互換性、cutover、fallback、application validation を保証するものではない。

## Security と権限

- connection credential、private key、wallet、GoldenGate user を OCI Vault またはサービスが指定する安全な保管方法で管理する。
- Data Pump directory、Object Storage bucket、File Storage export、GoldenGate privilege を必要最小限にする。
- online migration は supplemental logging と強い Database privilege を必要とする。移行専用 user を使い、完了後に revoke / drop する。
- dump、log、CPAT report、trail、temporary bucket object の保持と削除を確認する。
- target が Autonomous の場合は ACL、TLS、credential object など service 固有の接続前提を満たす。

## 停止時間と fallback

service が online replication を構成しても、application cutover と fallback は利用者が設計する。target で write を開始した後に source へ戻すには、reverse replication または target 更新を破棄する判断が必要。OCI Database Migration の標準 online flow に、安全な双方向 fallback が自動で含まれると仮定しない。

## 利用料金

Database Migration の service charge、GoldenGate の移行用途、Object Storage、File Storage、network、target Database の費用は別々に確認する。無償期間、idle 条件、課金開始条件は変更され得るため、最新の price list を使う。

## 公式ドキュメント

- [OCI Database Migration overview](https://docs.oracle.com/en-us/iaas/database-migration/doc/overview.html)
- [Migration Type](https://docs.oracle.com/en-us/iaas/database-migration/doc/migration.html)
- [Creating Oracle Migrations](https://docs.oracle.com/en-us/iaas/database-migration/doc/creating-migrations.html)
- [Managing Jobs](https://docs.oracle.com/en-us/iaas/database-migration/doc/manage-jobs.html)
- [Preparing the Source Database](https://docs.oracle.com/en-us/iaas/database-migration/doc/preparing-source-database-offline-migration.html)
- [Using a Snapshot Standby Database](https://docs.oracle.com/en-us/iaas/database-migration/doc/configuring-snapshot-standby.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
