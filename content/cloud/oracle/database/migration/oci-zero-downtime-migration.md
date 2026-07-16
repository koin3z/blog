---
title: Oracle Zero Downtime Migration（ZDM）
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-zero-downtime-migration
  - cloud/oracle/database/oci-zero-downtime-migration
description: ZDM 26.1 の物理・論理・ハイブリッド・PDB移行方式、内部ツール、選択基準、運用上の注意。
---

Oracle Zero Downtime Migration（ZDM）は、Oracle Database の移行を評価、準備、データ転送、同期、cutover、後処理までオーケストレーションするツール。RMAN、Data Guard、Data Pump、GoldenGate、Transportable Tablespaces、PDB cloning などの実績ある機能を組み合わせる。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## ZDM はデータ移動エンジンではない

ZDM 自体が新しい backup format や replication protocol を提供するのではない。source / target と停止要件に応じて underlying technology を構成し、phase と checkpoint を持つ再開可能な workflow として実行する。

| ZDM migration | Initial load | 差分同期 | 主な用途 |
| --- | --- | --- | --- |
| Physical offline | RMAN backup / restore、active duplicate、restore from service | なし | 同種構成の物理移行、停止を許容 |
| Physical online | RMAN で standby 作成 | Data Guard | 同種構成の大容量 Database、極小停止 |
| Logical offline | Data Pump | なし | Schema 変換、異なる構成、停止を許容 |
| Logical online | Data Pump | GoldenGate | 異なる構成、極小停止 |
| Hybrid offline | RMAN incremental XTTS ＋ Data Pump metadata | RMAN incremental | 大容量 tablespace の変換を伴う移行 |
| PDB cloning | cold / hot / refreshable clone | refreshable clone | PDB 単位の物理移行 |

ZDM 26.1 の hybrid migration は、現時点では NFS を transfer medium とする offline XTTS が中心。PDB cloning と Instant Deploy など新しい workflow もあるため、導入時点の release notes と source / target matrix を確認する。

## 向いている場面

- OCI Base Database Service、Exadata Database Service、Exadata Cloud@Customer、Exadata on-premises、Oracle Database Appliance、Autonomous、multicloud など、ZDM 対応 target へ移行する。
- RMAN / Data Guard / Data Pump / GoldenGate の構成を個別に手作業で連結せず、標準化された phase と precheck で実行する。
- CLI と response file で詳細な migration method、transfer medium、pause phase、parameter を制御する。
- 1 Database だけでなく fleet 単位の移行を管理する。
- physical、logical、hybrid の候補を同じ orchestration model で比較する。

単純な小規模論理移行を OCI コンソール中心で実行する場合は [[cloud/oracle/database/migration/oci-database-migration-service|OCI Database Migration]]、特殊な GoldenGate topology や変換が必要なら underlying tool の直接利用も比較する。

## Physical migration

### Offline

1. source Database を RMAN で backup する。
2. backup を Object Storage、NFS、ZDLRA などの対応 medium へ置くか、direct data transfer を使う。
3. target Database を backup から restore / recover する。
4. source 更新を停止した状態で target を open し、アプリケーションを切り替える。

target と source に同期関係は残らず、Data Guard を使った fallback はない。Standard Edition は Data Guard を使えないため、physical migration では offline method を使う。

### Online

1. RMAN backup / restore、active duplicate、restore from service で target standby を作る。
2. Data Guard を Maximum Performance / ASYNC で構成し、redo を同期する。
3. cutover 時に application write を停止し、lag を解消する。
4. switchover で target を new primary、source を standby にする。

詳細は [[cloud/oracle/database/migration/oracledb-data-guard|Oracle Data Guard による Database 移行]] を参照。

## Logical migration

### Offline

source への更新を停止し、Data Pump で export / transfer / import する。source / target の物理構成を変えられる一方、data unload / load と object 作成が停止時間になる。

### Online

Data Pump で initial load を行い、その間の変更を GoldenGate で capture / apply する。ZDM job を replication 開始後に pause し、cutover まで target を追従させることもできる。

詳細は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] と [[cloud/oracle/database/migration/oracledb-goldengate|Oracle GoldenGate によるオンライン移行]] を参照。

## Hybrid migration

hybrid migration は、RMAN incremental backup / restore で user tablespace の data block を移し、Data Pump で metadata を移行する。論理移行の変換自由度と、物理 block transfer の速度を組み合わせる。

ZDM 26.1 の supported hybrid method は `OFFLINE_XTTS` と NFS の組合せ。対応 target、source version、tablespace、TDE、endianness、`COMPATIBLE` を公式 matrix で確認する。

詳細は [[cloud/oracle/database/migration/oracledb-transportable-tablespaces|Oracle Database Transportable Tablespaces 移行]] を参照。

## PDB cloning

ZDM 26.1 は Database link を使った PDB cloning workflow を提供する。

- **Cold clone**：source PDB を停止して clone する。
- **Hot clone**：source PDB を online のまま clone する。
- **Refreshable clone**：clone 後も定期的に refresh し、cutover 前の差分を減らす。

詳細は [[cloud/oracle/database/migration/oracledb-pdb-migration|Oracle Multitenant PDB 移行]] を参照。

## Workflow と phase

ZDM job は migration method に応じた複数 phase で構成される。名称は release と方式によって異なるが、概念的には次の順序になる。

1. source / target と response file を検証する。
2. Cloud Premigration Advisor Tool、Data Pump、RMAN、GoldenGate の precheck を実行する。
3. source / target user、wallet、network、storage、module を準備する。
4. initial backup / export / clone と target instantiation を実行する。
5. online method では redo または change data を同期する。
6. 指定 phase で pause し、利用者が業務停止と cutover 判断を行う。
7. switchover または最終 apply、target open、postcheck、cleanup を行う。

`zdmcli migrate database ... -eval` で実行前評価を行い、job ID と phase status を監視する。resume 可能でも、失敗後に underlying RMAN / Data Pump / GoldenGate の状態を理解せず再開しない。

## ZDM service host と Instant Deploy

従来は専用 Linux host に ZDM を導入し、source / target へ SSH 接続する。ZDM 26.1 の Instant Deploy は、source または target Database server 上から一時的に実行する no-install option を提供する。

Instant Deploy はすべての topology で専用 host を不要にするものではない。logical migration は response file が必要で、hybrid や source / target platform に制約がある。security policy、SSH、software placement、監査要件で選ぶ。

## 停止時間

ZDM は停止を短縮するが、次は利用者の runbook に残る。

- application write の停止と transaction drain
- 最終 redo / trail / incremental の適用確認
- DNS、listener、service、connection pool、secret の切替
- application と業務データの検証
- cutover / fallback の判断

`Zero Downtime` を停止時間 0 の保証として扱わない。実データ、実帯域、実トランザクションで phase ごとの所要時間を測定する。

## Security と資格情報

- response file、command line、log に password、token、private key、wallet password を平文で残さない。
- ZDM wallet と非対話的な credential mechanism を使う。
- source / target の SSH、SQL\*Net、Object Storage、NFS、GoldenGate endpoint を必要最小限に限定する。
- temporary user、bucket、dump、backup、GoldenGate deployment の cleanup と監査を確認する。
- TDE keystore と master key を migration method に応じて移行・merge・再暗号化する。

## ZDM と利用料金

ZDM tool 自体、GoldenGate の移行用途、OCI Compute、Object Storage、File Storage、network、target Database の費用とライセンス条件は別々に確認する。資料に記載された無償期間や特例を恒久条件として扱わず、最新の price list、licensing、Marketplace 条件を確認する。

## 公式ドキュメント

- [Introduction to Zero Downtime Migration 26.1](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html)
- [Migrating with Zero Downtime Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/migrating-with-zero-downtime-migration.html)
- [Preparing for a Physical Database Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/preparing-for-database-migration.html)
- [ZDM Hybrid Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/overview.html)
- [Performing Migration Using Instant Deploy](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/performing-migration-using-instant-deploy-feature.html)
- [ZDM 26.1 Release Notes](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmrn/index.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
- [Zero Downtime Migration 技術詳細](https://speakerdeck.com/oracle4engineer/zero-downtime-migration-tech-detail)
