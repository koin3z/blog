---
title: Oracle Multitenant PDB 移行
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-pdb-migration
  - cloud/oracle/database/oracledb-pdb-migration
description: PDB unplug/plug、hot clone、refreshable clone、relocate、non-CDB clone の違いと移行設計。
---

Oracle Multitenant では、Database 全体ではなく Pluggable Database（PDB）単位で clone、refresh、relocate、unplug / plug できる。source / target が CDB / PDB の前提を満たす場合、Data Pump で全行を unload / load せずに移行できる。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## 方式の比較

| 方式 | Source 状態 | 差分同期 | 主な停止 | 向く場面 |
| --- | --- | --- | --- | --- |
| Unplug / Plug | unplug 時に close | なし | close、file transfer、plug、open | PDB を確実に別 CDB へ移す |
| Cold clone | PDB を close | なし | clone 全期間 | test / dev、停止可能な小〜中規模 PDB |
| Hot clone | PDB を online のまま clone | clone 中の整合を Database が管理 | 最終切替 | source を稼働したまま一時 copy を作る |
| Refreshable clone | source PDB を online、target は read only / refresh 時 close | 定期／手動 refresh | 最終 refresh と read write 化 | online migration、test copy の追従 |
| Relocate | source online で hot clone と redo / undo 適用 | relocation workflow 内で同期 | target open と session drain | 最小停止で別 CDB へ PDB を移す |
| Non-CDB clone | source non-CDB を read only など方式依存 | 方式依存 | conversion と target open | non-CDB を PDB 化して移行 |

利用可能な方式は source / target release、CDB 構成、undo mode、network、cloud service によって異なる。資料の最小 version を固定値として使わず、対象 release の Multitenant guide を確認する。

## Unplug / Plug

1. source PDB と target CDB の互換性を確認する。
2. source PDB を close し、unplug して XML metadata file または PDB archive を作る。
3. datafile と metadata を target host / storage へ移す。
4. target CDB で compatibility check を行い、PDB を plug する。
5. 必要な upgrade / conversion script、TDE key、service を適用する。
6. PDB を open し、backup を取得する。

datafile copy の間は source PDB が停止する。大容量 PDB では transfer 時間が停止になるため、hot clone、refreshable clone、relocate、incremental copy と比較する。

## Hot clone

hot clone は source PDB を read write で稼働させたまま、Database link または storage copy を使って target PDB を作る。Database は clone 開始時点の一貫性を保つために必要な block と redo を扱う。

clone 完了後は source と独立した PDB になり、その後の変更は自動では反映されない。production migration では、clone 完了後から cutover までの差分を別方式で同期するか、refreshable clone / relocate を使う。

## Refreshable clone

refreshable clone PDB は read only clone として source の変更を定期または手動で取り込む。

1. Database link と refresh mode / interval を指定して clone を作る。
2. target clone を read only で検証し、定期 refresh を継続する。
3. cutover 前に source write を停止する。
4. target PDB を close し、最終 refresh を実行する。
5. refresh mode を解除して read write にし、application を切り替える。

refreshable clone を read write にすると通常は source からの refresh 関係を終了する。切替後の reverse sync は自動ではないため、fallback 方針を別途設計する。

## Relocate

PDB relocate は target CDB から `CREATE PLUGGABLE DATABASE ... RELOCATE` を実行し、source PDB を online のまま target へ移す。

- 最初に hot clone と同様に datafile、undo、redo を target へ copy する。
- source application は copy 中も source PDB を利用する。
- target PDB を open すると、最終 media recovery、source session drain、service 登録、source close、target read write open が行われる。
- source / target の listener network に応じて connection forwarding と service 設計が変わる。

relocate は copy ではなく move。完了後に source と target の両方を primary として開き続ける方式ではない。source PDB と target PDB の service name collision、transaction rollback、session drain、Application Continuity を試験する。

## Non-CDB から PDB

non-CDB を PDB へ変換する主な方式は次のとおり。

- AutoUpgrade で Database upgrade と non-CDB→PDB conversion を一連で実行する。
- target CDB から Database link を使って non-CDB clone を作る。
- non-CDB を unplug 相当の手順で PDB として plug し、`noncdb_to_pdb.sql` など必要な変換を行う。
- Data Pump full export / import で論理的に PDB へ再作成する。

source version、target version、CDB character set、option、component、TDE、downtime により選ぶ。AutoUpgrade は [[cloud/oracle/database/maintenance/oracledb-autoupgrade|Oracle Database AutoUpgrade]]、Data Pump は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] を参照。

## 前提条件

- source / target CDB の Database release、`COMPATIBLE`、patch level
- local undo mode、`ARCHIVELOG`、source PDB open mode
- Database link user と `CREATE PLUGGABLE DATABASE` privilege
- source / target listener、service、DNS、network throughput
- character set、national character set、timezone、option、component
- file location、ASM / ACFS、OMF、storage capacity
- TDE keystore、master key、wallet password、key import / merge
- common user / local user、role、Database link、directory、external file

PDB compatibility check が成功しても、アプリケーションの接続、service、performance、外部依存まで保証しない。

## TDE

encrypted PDB を別 CDB へ移す場合、source の PDB key を target keystore へ export / import または merge し、target で open できるようにする。united keystore / isolated PDB keystore、OCI Vault、auto-login wallet など構成によって手順が異なる。

key を移さず datafile だけを copy すると PDB を open できない。詳細は [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]] を参照。

## Cutover と fallback

- source write を停止する時点と長時間 transaction の扱いを決める。
- target PDB の最終 SCN、refresh / recovery 完了、read write open を確認する。
- service、connection string、DNS、wallet、application pool を切り替える。
- source PDB を drop せず、fallback 期間は read only / closed で保持するか決める。
- target で write を開始した後の変更を source へ戻す方法を決める。

relocate や unplug / plug 完了後に source へそのまま戻せると仮定しない。reverse operation、backup restore、GoldenGate などの fallback 手段を事前に試験する。

## 検証

- PDB `OPEN_MODE`、`STATUS`、restricted state、saved state
- component、invalid object、timezone、character set、service
- user、role、grant、directory、Database link、scheduler
- datafile、tempfile、tablespace、TDE wallet / key
- application connection、session drain、transaction retry
- clone / refresh / relocate の所要時間と network throughput
- target PDB の最初の backup

PDB relocate 後は新しい PDB を backup しないと recover できないため、target の backup policy へ直ちに組み込む。

## ZDM による自動化

ZDM 26.1 は cold、hot、refreshable PDB cloning workflow を提供する。source / target、Database link、temporary user、service migration をオーケストレーションできるが、対応 platform と release は変化する。詳細は [[cloud/oracle/database/migration/oci-zero-downtime-migration|Oracle Zero Downtime Migration]] を参照。

## 公式ドキュメント

- [Relocating a PDB](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/relocating-a-pdb.html)
- [Cloning a PDB](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/cloning-a-pdb.html)
- [Plugging In an Unplugged PDB](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/plugging-in-a-pdb.html)
- [Introduction to Multitenant Administration](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/introduction-to-the-multitenant-architecture.html)
- [AutoUpgrade Unplug-Plug Upgrades](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/using-autoupgrade-oracle-database-upgrades.html)
- [ZDM 26.1](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
