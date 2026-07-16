---
title: OCI Oracle Database の RMAN バックアップ
date: 2026-07-15
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup-rman
  - cloud/oracle/database/oci-oracledb-backup-rman
description: OCI Base Database Service で利用者管理の RMAN バックアップ、復元、物理移行を設計する際の要点。
---

Recovery Manager（RMAN）は、Oracle Database の物理バックアップとリカバリを管理する標準ユーティリティ。OCI Base Database Service では、Oracle Database Cloud Backup Module の SBT インターフェースを介して、利用者が管理する Object Storage バケットへバックアップできる。

バックアップ方式全体の比較は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照。

## RMAN を選ぶ場面

- 独自のバックアップ・スケジュール、保持、コピー数、圧縮、暗号化、チャネル並列度が必要。
- 利用者が所有する Object Storage バケットや Recovery Catalog を使う必要がある。
- マネージド自動バックアップとは異なる復旧先や運用手順を維持する必要がある。
- オンプレミスと OCI の間で、既存の RMAN 運用や物理移行手順を再利用する必要がある。

標準的な OCI Database の運用バックアップだけが目的なら、まずマネージド自動バックアップを評価する。RMAN は自由度が高い一方、バックアップ・ストレージ、認証、監視、削除、復旧試験まで利用者の責任になる。

## Object Storage への構成

Base Database Service から Object Storage へ直接 RMAN バックアップを送る基本要素は次のとおり。

1. DB システムから Object Storage へ到達するネットワークを用意する。同一リージョンでは Service Gateway が推奨される。
2. バックアップ先の Object Storage バケットと、必要最小限の IAM policy を用意する。
3. OCI の認証トークンを発行し、Oracle Database Cloud Backup Module を DB システムへ導入する。
4. RMAN の SBT channel から backup module の library と構成ファイルを参照する。
5. 暗号化を有効にし、Level 0、Level 1、アーカイブ REDO ログ、制御ファイル、SPFILE をバックアップする。

`dbcli` の Object Storage バックアップは、backup module を直接設定して RMAN を実行する方法の代替となる。どちらも非管理バックアップとして、自分のバケットと運用を管理する。

> [!warning] 認証情報
>
> 認証トークン、パスワード、wallet、キーストア、backup module の資格情報をスクリプト、ログ、Git、シェル履歴へ残さない。権限は専用バケットに限定し、管理者グループへの追加で代用しない。

## バックアップ設計

### 物理バックアップの構成要素

- **Level 0**：後続の増分バックアップの基点となり、使用済みブロックをバックアップする。
- **Level 1 differential / cumulative**：前回の増分または Level 0 から変更されたブロックをバックアップする。
- **Archived REDO log**：Level 0／1 の取得時点より後へ Database を進める。要求 RPO に合わせてバックアップ頻度を決める。
- **Control file と SPFILE**：Database 構造と起動設定を復元するため、autobackup を有効にする。
- **TDE keystore / wallet**：暗号化済みデータファイルとバックアップを復号するため、Database バックアップとは別の障害領域へ保護する。

Object Storage への RMAN バックアップは暗号化が必須。暗号化方式と鍵の保管を決めずにバックアップ・ジョブだけを作ると、障害時に復号できない可能性がある。

### 保持と削除

RMAN の retention policy、archived log deletion policy、backup optimization を設計し、Object Storage の lifecycle rule と二重管理しない。Object Storage 側だけでバックアップ・ピースを削除すると、RMAN repository の記録と実体がずれる。

`CROSSCHECK` で記録と実体を同期し、`REPORT OBSOLETE` で保持ポリシー外のバックアップを確認してから、RMAN の `DELETE OBSOLETE` で削除する。長期保管用バックアップは通常の recovery window と分け、依存するアーカイブ REDO ログ、制御ファイル、暗号鍵も同じ期間利用できるようにする。

### Recovery Catalog

RMAN metadata は target Database の control file に保存される。複数 Database の集中管理、長期履歴、control file を失った場合の復元性が必要なら Recovery Catalog を検討する。Catalog 自体も別 Database なので、可用性、バックアップ、権限、接続障害時の運用を設計する。

## コマンド例の読み方

次は運用設計を説明するための最小例であり、backup module、channel、暗号化、保持、並列度を含む完成した手順ではない。

```sql
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 35 DAYS;

BACKUP INCREMENTAL LEVEL 0 DATABASE PLUS ARCHIVELOG;
BACKUP INCREMENTAL LEVEL 1 DATABASE PLUS ARCHIVELOG;
```

アーカイブ REDO ログのバックアップをデータファイルの日次バックアップだけに依存させると、RPO が 1 日単位になり得る。アーカイブ REDO ログは要求 RPO に応じて別スケジュールで頻繁に取得する。

## 復元で必要になる情報

Object Storage 上の RMAN バックアップから新しい DB システムへ復元するには、少なくとも次を再現できる必要がある。

- 元 Database の DBID、DB_NAME、必要に応じて DB_UNIQUE_NAME
- 互換性のある Database Home と、DATA／RECO／REDO のストレージ
- backup module と Object Storage への接続設定
- SPFILE、control file、datafile、archived REDO log のバックアップ
- TDE keystore / wallet、暗号鍵、バックアップ暗号化パスワード
- RAC、CDB/PDB、block change tracking、ファイル配置など元構成の情報

最後にバックアップされたアーカイブ REDO ログより後の更新は復元できない。バックアップ成功を RPO 達成とみなさず、最終アーカイブ REDO ログ、復元可能 SCN／時刻、バックアップ・ピースの可用性を監視する。

## 検証と復旧試験

- `CROSSCHECK` は RMAN repository と保存先の整合を確認するが、すべてのブロックを読んで復旧可能性を保証する検査ではない。
- `VALIDATE` や restore validation で破損と必要なバックアップを確認する。
- 本番とは別の DB システムへ定期的に restore / recover し、Database の open、PDB、TDE、アプリケーション接続、所要時間を確認する。
- バックアップ・ジョブ、アーカイブ REDO ログ、Object Storage 容量、認証期限、失敗通知を監視する。

## 物理移行での利用

RMAN は backup / restore、active duplicate、restore from service により、source Database の物理構造を target へ複製できる。

### RMAN Duplicate

- **Active database duplication**：source Database から network 経由で datafile を image copy または backup set として target auxiliary instance へ送る。事前 backup を必要としない。
- **Backup-based duplication**：既存 backup set と archived REDO log を target へ移し、restore / recover して duplicate Database を作る。
- **Standby duplication**：Data Guard の standby を作り、online physical migration の初期化に使う。

source Database を online のまま複製できても、application cutover まで自動的に差分同期し続けるとは限らない。低停止の移行では [[cloud/oracle/database/migration/oracledb-data-guard|Data Guard]] で redo を同期するか、[[cloud/oracle/database/migration/oci-zero-downtime-migration|ZDM]] の physical online migration を使う。

### 互換性

RMAN の物理移行は datafile block を保持するため、source / target の platform、endianness、Database version、edition、CDB / PDB、storage、TDE の互換性制約が強い。Schema 名、table 構造、character set、non-CDB / PDB を自由に変換する方式ではない。

異なる endian や tablespace 単位の高速移行では RMAN `CONVERT` と [[cloud/oracle/database/migration/oracledb-transportable-tablespaces|Transportable Tablespaces]]、論理変換では [[cloud/oracle/database/migration/oracledb-data-pump|Data Pump]] を検討する。

### OCI target の準備

- target Database Home と auxiliary instance、static listener を準備する。
- DATA / RECO / REDO の storage と file name conversion を設計する。
- source から target の listener / SQL\*Net、必要に応じて SSH / Object Storage / NFS の network を開通する。
- TDE keystore / wallet と master key を target で利用できるようにする。
- duplicate 後の DBID、DB_NAME、DB_UNIQUE_NAME、service、RAC instance、PDB を整理する。
- managed OCI Database の初期 Database を削除・置換する手順が service で support されるか確認する。

RMAN で複製できることと、OCI Database Service がその作成手順を support することは別。ZDM や OCI の公式 migration workflow を優先する。

## マネージド自動バックアップとの関係

OCI のマネージド自動バックアップは内部で RMAN を利用する。自動化が管理する RMAN 設定を標準 RMAN コマンドで変更すると、バックアップ失敗の原因になる。

`RMAN` / `dbcli` の非管理バックアップからコンソール／API のマネージド方式へ切り替えると、新しいバックアップ構成が Database に関連付けられる。旧方式が継続して利用できると仮定せず、切り替え前に復旧元、保持、ジョブ停止、アーカイブ REDO ログ削除ポリシーを整理する。

## 公式ドキュメント

- [Back Up a Database to Object Storage Using RMAN](https://docs.oracle.com/en/cloud/paas/base-database/backup-rman/index.html)
- [Recover a Database from Object Storage Using RMAN Backup](https://docs.oracle.com/en/cloud/paas/base-database/recover-rman/index.html)
- [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
- [Oracle AI Database Backup and Recovery User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/)
- [Maintaining RMAN Backups and Repository Records](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/maintaining-rman-backups.html)
- [RMAN DUPLICATE](https://docs.oracle.com/en/database/oracle/oracle-database/26/rcmrf/DUPLICATE.html)
- [Introduction to Zero Downtime Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
