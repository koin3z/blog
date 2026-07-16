---
title: Oracle Data Guard による Database 移行
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-data-guard
  - cloud/oracle/database/oracledb-data-guard
description: Data Guard の物理オンライン移行、switchover、互換性、監視、fallback の設計を整理する。
---

Oracle Data Guard は、primary Database の redo を standby Database へ転送・適用し、Database の可用性、データ保護、災害対策を提供する機能。互換構成間の移行では、target を physical standby として同期し、switchover で役割を入れ替えることで切替停止を短縮できる。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## 向いている場面

- Database 全体を物理構造のまま移し、Schema や table を再作成しない。
- source と target の platform、endianness、Database version、edition、architecture が Data Guard の対応条件を満たす。
- 大容量 Database を事前同期し、最終切替を switchover の時間に近づけたい。
- target 検証後も旧 primary を standby として保持し、計画的な switchback を可能にしたい。
- ZDM の physical online migration で underlying technology として利用する。

Schema 再編、cross-endian、異なる data type、異種 Database への移行には向かない。これらが必要なら [[cloud/oracle/database/migration/oracledb-data-pump|Data Pump]] または [[cloud/oracle/database/migration/oracledb-goldengate|GoldenGate]] を比較する。

## 移行の仕組み

```text
Source primary
  └─ redo transport ─> Target physical standby
                         └─ Redo Apply

Cutover: switchover

Former source standby <─ redo transport ─ New target primary
```

一般的な移行は次の順序で進む。

1. target Database 環境と network、listener、service、TDE keystore を準備する。
2. RMAN backup / restore、active duplicate、restore from service などで standby を作成する。
3. Data Guard Broker を構成し、redo transport と Redo Apply を開始する。
4. transport lag / apply lag を収束させ、target の file、parameter、service、性能を検証する。
5. アプリケーション更新を停止または drain し、最終 redo が適用済みであることを確認する。
6. `VALIDATE DATABASE` と switchover readiness を確認し、役割を切り替える。
7. new primary で service とアプリケーションを開始する。
8. former primary を standby として同期し、fallback 期間後に廃止または DR として再利用する。

## Switchover と failover

- **Switchover**：計画された primary / standby の役割交換。移行で使用する。両 Database が正常で同期している状態で実行する。
- **Failover**：primary 障害時に standby を primary へ昇格する障害対応。保護 mode と同期状態によって data loss が発生し得る。

移行では failover ではなく switchover を使う。Data Guard Broker は role transition、redo transport、apply、Clusterware service を連携するが、アプリケーションの接続先、DNS、connection pool、batch、external service まで自動的に切り替えるとは限らない。

## 停止時間

Database の datafile は事前に同期済みなので、停止時間の中心は次になる。

- source への新規更新停止と session drain
- 最終 redo transport / apply
- switchover と Database / PDB open
- service、listener、DNS、connection string の切替
- アプリケーション smoke test と業務再開判断

Data Guard Broker の `SWITCHOVER ... WAIT` は Clusterware service の session drain と連携できるが、timeout 後に残る session の扱いを試験する。`Zero Downtime` と表現される移行でも、transaction と application connection の切替時間は残る。

## 互換性とアップグレード

通常の physical standby は同じ Database の block と redo を適用するため、source / target の物理互換性が強く求められる。単純な physical Data Guard 移行で、OS endianness、Schema、CDB / PDB 構成、Database major version を自由に変更しない。

Database major upgrade の停止を短縮する場合は、logical standby または transient logical standby と `DBMS_ROLLING` を使う rolling upgrade という別方式がある。対応 object、option、version、Active Data Guard のライセンスを確認し、通常の physical switchover と混同しない。

アップグレード全体は [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]] を参照。

## 構成と監視

- `FORCE LOGGING`、standby redo log、archive destination、Flashback Database を設計する。
- protection mode（Maximum Protection / Availability / Performance）と SYNC / ASYNC transport を RPO、network latency、性能で決める。
- `transport lag`、`apply lag`、apply rate、archive gap、standby health を監視する。
- primary / standby の SPFILE、datafile、tempfile、password file、TDE keystore、service、PDB open state を比較する。
- Broker の `VALIDATE DATABASE VERBOSE` / `STRICT` で role transition の前提を確認する。
- target が primary になった後の backup、monitoring、patching、Data Guard association を準備する。

## Fallback

switchover 後に former primary を standby として維持すれば、target で問題が見つかった場合に switchback できる。ただし、次を満たす必要がある。

- new primary から former primary へ redo を転送・適用できる。
- target 側の TDE key と redo を former source が利用できる。
- application が source 側へ再接続できる。
- target で実施した不可逆な構成変更や `COMPATIBLE` 変更がない。
- switchback 前に data loss と service 切替を再評価する。

移行直後に former primary を削除すると、物理的な fallback 経路を失う。保持期間と廃止条件を移行計画に含める。

## バックアップとの違い

Data Guard は最新の変更を standby へ複製する。誤った `DELETE`、論理破損、悪意ある変更も伝播し得るため、過去時点を保持するバックアップの代替ではない。バックアップは [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照。

## ライセンス

Data Guard、Active Data Guard、`DBMS_ROLLING`、real-time query、backup offload などは利用する feature、edition、cloud service、BYOL 条件で権利が異なる。source と target の並行稼働、standby、移行後の DR 利用を含め、最新の Licensing Information と契約を確認する。

## 公式ドキュメント

- [Oracle Data Guard Concepts and Administration](https://docs.oracle.com/en/database/oracle/oracle-database/26/sbydb/oracle-data-guard-concepts.html)
- [Data Guard Broker Switchover](https://docs.oracle.com/en/database/oracle/oracle-database/26/dgbkr/switchover.html)
- [VALIDATE DATABASE](https://docs.oracle.com/en/database/oracle/oracle-database/26/dgbkr/validate-database.html)
- [Using DBMS_ROLLING to Perform a Rolling Upgrade](https://docs.oracle.com/en/database/oracle/oracle-database/26/sbydb/using-DBMS_ROLLING-to-perform-rolling-upgrade.html)
- [Introduction to Zero Downtime Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
