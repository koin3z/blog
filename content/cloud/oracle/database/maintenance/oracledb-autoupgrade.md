---
title: Oracle Database AutoUpgrade
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-autoupgrade
  - cloud/oracle/database/oracledb-autoupgrade
description: AutoUpgrade の analyze、fixups、deploy、upgrade、PDB変換、patching、rollback設計を整理する。
---

## 概要

- AutoUpgrade は、Oracle Database upgrade の事前分析、修正、実行、post-upgrade 処理、構成移行を自動化する Oracle 推奨ユーティリティ
- AutoUpgrade は、Database software と data dictionary を新しい release へ上げるライフサイクルツールであり、データを別形式で転送する移行ツールではない
- host や platform も変える場合は、PDB unplug／plug、clone、Data Pump、RMAN、GoldenGate、Data Guard などの移行方式と組み合わせる

Doc: [Using AutoUpgrade for Oracle Database Upgrades](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/using-autoupgrade-oracle-database-upgrades.html)

アップグレード全体は[[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]、移行方式との関係は[[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]]を参照する。

## 適用範囲

- single instance／RAC Database の major upgrade を自動化する
- 複数 Database を1つの構成ファイルで並行管理する
- non-CDB を upgrade しながら既存 CDB の PDB へ変換する
- PDB を古い release の CDB から unplug し、新しい release の CDB へ plug／upgrade する
- pre-upgrade／post-upgrade check と自動 fixup を実行する
- AutoUpgrade Patching で out-of-place software maintenance を実行する

Data Pump、RMAN、GoldenGate、Data Guard の代わりにデータを転送するものではない。

## OCI Base Database Service の責任境界

- 一般提供の Database upgrade では、利用可能な経路、precheck、Work Request、サービスサポートを管理する OCI コンソール／APIを原則として使う
- AutoUpgrade は、OCI ワークフローの内部または自己管理環境、特殊な移行ワークフローで使われる場合がある
- `autoupgrade.jar`を実行できることと、OCI 管理下の Database でその操作がサポートされることは別
- Base Database Service で直接実行する場合は、サービスドキュメントと Oracle Support の指示を確認する

## 処理モード

Doc: [About AutoUpgrade Processing Modes](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/about-autoupgrade-processing-modes.html)

| モード | 役割 | Database への主な影響 |
| --- | --- | --- |
| `analyze` | target release への readiness check | AutoUpgrade 自体は SELECT 中心。通常業務中にも実行できる |
| `fixups` | source で実行可能な pre-upgrade 修正 | Database を変更する。自動化されない項目は手動対応する |
| `deploy` | analyze、fixup、upgrade、post-upgrade を一連で実行 | Database upgrade、再起動、downtime が発生する |
| `upgrade` | upgrade stage を実行 | 事前条件を満たした Database の data dictionary を upgrade する |

AutoUpgrade の release によってコマンド構文、stage、parameter が変わる。

Oracle Home 同梱版を固定使用せず、My Oracle Support から利用可能な最新の`autoupgrade.jar`を取得することが推奨される。

## 構成ファイル

Doc: [AutoUpgrade Command-Line Parameters](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/autoupgrade-command-line-parameters.html)

構成ファイルは、source／target Home、SID、target version、log directory、upgrade window、PDB inclusion／exclusion、custom script、TDE、rollback などを Database ごとに定義する。

```text
global.autoupg_log_dir=/u01/app/oracle/autoupg

upg1.sid=ORCL
upg1.source_home=/u01/app/oracle/product/19c/dbhome_1
upg1.target_home=/u01/app/oracle/product/26ai/dbhome_1
upg1.start_time=NOW
```

- この例は構成項目だけを示す
- 対応 release、parameter name、path、Java、permission、CDB／PDB 構成は最新ガイドで確認する
- password を構成ファイルへ平文で書かない

## 実行ライフサイクル

1. source Database、target release、Oracle Home、OS、GI、option、CDB／PDB を棚卸しする
2. 最新の AutoUpgrade を`analyze`モードで実行し、HTML、log、`status.json`、`upgrade.xml`を確認する
3. automatic fixup と manual action を分け、`fixups`を実行する
4. target Oracle Home、patch、timezone、TDE、network、listener、service を準備する
5. test clone で`deploy`を反復し、downtime、error、SQL performance、application regression を測る
6. backup と rollback point を準備し、本番`deploy`を実行する
7. post-upgrade check、invalid object、registry、timezone、statistics、backup、application を確認する

## ワークフローの差分

| ワークフロー | 変更対象 | 主な用途 | 主な追加条件 |
| --- | --- | --- | --- |
| Major upgrade | Database software、data dictionary | single instance／RAC Database の release 変更 | target Home、互換性、停止時間、rollback point |
| Non-CDB→PDB | Database release、Multitenant 構成 | non-CDB を upgrade して既存 CDB へ収容する | target CDB の互換性、file 配置、TDE、正本の切替 |
| Unplug-plug upgrade | PDB と所属 CDB | PDB 単位で新しい release の CDB へ段階移行する | PDB XML／archive、datafile、TDE、service 切替 |
| AutoUpgrade Patching | Oracle Home と Database の使用 Home | out-of-place software maintenance | restart、topology、Database Home 外のコンポーネント、OCI サポート境界 |

### Non-CDB から PDB

- source／target release と`COMPATIBLE`
- target CDB の character set、timezone、option、component
- PDB 名、service、listener、file location
- common user／local user、role、Database link、directory
- TDE keystore、master key、wallet path
- source datafile を copy するか、元の file を利用するか
- rollback 時に non-CDB と target PDB のどちらを正とするか

### Unplug-plug upgrade

PDB を source CDB から unplug し、新しい release の target CDB へ plug して upgrade する。

Database 全体ではなく PDB 単位に段階移行できるが、source／target CDB の互換性、PDB XML／archive、datafile transfer、TDE、service 切替が必要になる。

PDB の移行方式は[[cloud/oracle/database/migration/oracledb-pdb-migration|Oracle Multitenant PDB 移行]]を参照する。

### AutoUpgrade Patching

AutoUpgrade Patching は、Oracle Home 作成、patch download／apply、Database move、`datapatch`、postcheck などの software maintenance を out-of-place で自動化する。

- Database restart と downtime は残る
- RAC rolling patch や Data Guard topology に適さない組み合わせがある
- GI、OJVM、one-off、client、ORDS など Database Home 外のコンポーネントは別管理になる場合がある
- OCI Base Database Service では、OCI コンソール／APIの管理ワークフローを優先し、サービスが管理する Home を独自の AutoUpgrade で変更できるか確認する

## ロールバック境界

AutoUpgrade は restore／rollback 機能と Guaranteed Restore Point（GRP）を利用できるが、次の前提を満たす必要がある。

- `ARCHIVELOG`、Flashback Database、FRA 容量
- source Home と構成ファイルの保持
- upgrade 後に発生した application data の扱い
- `COMPATIBLE`を不可逆に上げていないこと
- target PDB へ切替後の service／connection を戻せること
- external system、queue、batch、file の整合を戻せること

upgrade 後に業務更新を開始した場合、Database を戻すだけではロールバックが完了しない。

復旧点以降の transaction を破棄するか、別手段で戻すかを事前に決める。

## 検証

- AutoUpgrade report の error、warning、manual fixup
- `DBA_REGISTRY`、`DBA_REGISTRY_SQLPATCH`、invalid object、PDB open mode
- timezone file、dictionary statistics、fixed object statistics
- listener、service、wallet、Database link、directory、scheduler
- application driver、SQL plan、batch、LOB、NLS、security behavior
- source／target backup と upgrade 後最初の backup
- test と production の phase ごとの実測時間

## 公式ドキュメント

- [Choose an Upgrade Method for Oracle Database](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/choose-an-upgrade-method-for-oracle-database.html)
- [Known Restrictions for AutoUpgrade](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/known-restrictions-autoupgrade.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
