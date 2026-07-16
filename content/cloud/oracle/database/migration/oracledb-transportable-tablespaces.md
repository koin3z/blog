---
title: Oracle Database Transportable Tablespaces 移行
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-transportable-tablespaces
  - cloud/oracle/database/oracledb-transportable-tablespaces
description: Transportable Tablespaces、Full Transportable、RMAN transport の違いと移行上の制約を整理する。
---

Transportable Tablespaces（TTS）は、table data を Data Pump で unload / load せず、ユーザー tablespace の datafile を target Database へ転送し、Data Pump で metadata を取り込む移行方式。大容量 Database で Data Pump の全行再ロードを避けたい場合に使う。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## 方式の違い

| 方式 | 移行範囲 | metadata | data | 主な特徴 |
| --- | --- | --- | --- | --- |
| Transportable Tablespaces | 選択した user tablespace | Data Pump | datafile copy | tablespace 単位で段階移行できる |
| Full Transportable export / import | Database 全体に近い範囲 | Data Pump | user tablespace の datafile ＋管理 tablespace の論理移行 | PL/SQL など Database-level metadata もまとめて移す |
| Cross-platform TTS | tablespace | Data Pump | RMAN などで endian 変換した datafile | 異なる platform 間で大容量 datafile を移す |
| RMAN `TRANSPORT TABLESPACE` | tablespace | Data Pump dump / import script を RMAN が生成 | backup set から datafile を作成 | source tablespace を即時 read only にせず transport set を作成できる |
| Incremental XTTS | tablespace | Data Pump | full copy ＋ RMAN incremental | 事前転送と差分適用で最終停止を短縮する |

## 向いている場面

- data の大半が少数の user tablespace にあり、行単位の unload / load を避けたい。
- index を target で再作成する時間を短縮したい。
- source / target の Database release と datafile 互換性を満たす。
- Schema 名や object 構造を大きく変更せず、tablespace 単位で移行できる。
- 大容量 Database の停止時間を、事前コピーまたは incremental backup で短縮したい。

Schema 再編、table 単位の選択、異なる data type への変換、Database edition の大きな変更が必要なら [[cloud/oracle/database/migration/oracledb-data-pump|Data Pump]] を比較する。

## 基本的な TTS の流れ

1. 移行する tablespace set が self-contained であることを検査する。
2. target Database に必要な user、role、tablespace 以外の metadata を準備する。
3. source の対象 tablespace を read only にする。
4. Data Pump `TRANSPORT_TABLESPACES` で metadata dump を作成する。
5. metadata dump と datafile を target へ転送する。
6. cross-platform の場合は、必要に応じて RMAN で endian を変換する。
7. Data Pump Import で datafile を target の dictionary に登録する。
8. tablespace を read write に戻し、object、constraint、TDE、アプリケーションを検証する。

read only へ切り替えてから転送と import が完了するまでが主な停止区間になる。増分 XTTS では、full copy を事前転送し、source 更新分の RMAN incremental を繰り返し適用して、最終 read only 区間を短縮する。

## Self-contained の考え方

transport set 内の table と index、LOB、partition などの segment が、set 外の tablespace に依存すると transport できない。`DBMS_TTS.TRANSPORT_SET_CHECK` と `TRANSPORT_SET_VIOLATIONS` で違反を確認する。

次のような依存を事前に調べる。

- table と index が別 tablespace にある。
- partition / subpartition が set 内外に分かれる。
- LOB segment、nested table、XML、spatial などが別 tablespace にある。
- FK や metadata が set 外の object を参照する。
- type owner、user、role、PL/SQL、directory、Database link など datafile 外の object が必要。

TTS は user tablespace を主対象とし、`SYSTEM`、`SYSAUX`、`TEMP`、`UNDO` などの管理 tablespace をそのまま transport する方式ではない。Full Transportable は管理 tablespace 内の必要な user metadata / data を論理的に移す。

## Version、platform、endianness

- target Database release は source と同じか、原則としてより新しい release を使う。下位 release への transport はできない。
- `COMPATIBLE`、block size、character set、timezone、option、data type の互換性を確認する。
- `V$TRANSPORTABLE_PLATFORM` で source / target platform と endian format を確認する。
- 同じ endian なら datafile をそのまま転送できる組合せがある。異なる endian では RMAN `CONVERT TABLESPACE` / `CONVERT DATAFILE` などで変換する。
- `RMAN CONVERT DATABASE` は同一 endian が前提であり、異なる endian の Database 全体変換と混同しない。

実施時点の Oracle support matrix と対象 release の手順を使う。資料に記載された最小バージョンを固定要件として再利用しない。

## Full Transportable export / import

Full Transportable は `FULL=YES` と `TRANSPORTABLE=ALWAYS` を使い、user tablespace の datafile は物理転送し、`SYSTEM` / `SYSAUX` にある user object と Database-level metadata は Data Pump で論理移行する。

通常の full Data Pump より table data の unload / load と index 再構築を減らせる。non-CDB から PDB への移行や Database upgrade にも使えるが、source / target version、`VERSION` parameter、対象外 object、TDE を確認する。

## RMAN と増分バックアップ

RMAN `TRANSPORT TABLESPACE` は backup から transportable tablespace set を作り、metadata dump と import script を生成する。既存 backup を活用し、source の稼働中に transport set を準備できる。

Incremental XTTS は、最初の datafile copy 後に発生した変更 block を RMAN incremental backup として繰り返し target copy へ適用する。最終同期時には source の更新停止または tablespace read only が必要で、完全な無停止ではない。

RMAN の基礎は [[cloud/oracle/database/backup/oci-oracledb-backup-rman|OCI Oracle Database の RMAN バックアップ]]、ZDM での自動化は [[cloud/oracle/database/migration/oci-zero-downtime-migration|Oracle Zero Downtime Migration]] を参照。

## TDE

- encrypted tablespace を transport する場合、target keystore で source の key を利用できるようにするか、Data Pump の `ENCRYPTION_PASSWORD` を使う手順を選ぶ。
- keystore / wallet の copy、merge、key import、password-protected transport は release と構成によって手順が異なる。
- target の暗号化要件を満たすだけでなく、移行中の datafile、dump、incremental backup、staging storage を保護する。

詳細は [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]] を参照。

## 検証

- self-contained check と transportable platform / endian の結果
- datafile 数、size、checksum、file name、ASM / ACFS 配置
- Schema、table、partition、index、LOB、constraint、grant、PL/SQL、scheduler job
- invalid object、statistics、timezone、character set、Database option
- TDE keystore、master key、encrypted tablespace の open / read / write
- source read only から target open までの実測停止時間
- incremental 適用 SCN と最終同期後の data 差分

## 公式ドキュメント

- [Transporting Data](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/transporting-data.html)
- [Oracle Data Pump Transportable Tablespace Mode](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/starting-oracle-data-pump.export.html)
- [Overview of Oracle Data Pump](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-data-pump-overview.html)
- [RMAN TRANSPORT TABLESPACE](https://docs.oracle.com/en/database/oracle/oracle-database/26/rcmrf/TRANSPORT-TABLESPACE.html)
- [About Upgrading Platforms for a New Oracle AI Database Release](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/upgrading-platforms-new-oracle-database-release.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
