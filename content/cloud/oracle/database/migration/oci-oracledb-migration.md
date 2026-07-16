---
title: OCI Oracle Database 移行概要
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-migration
  - cloud/oracle/database/oci-oracledb-migration
description: Oracle Database を OCI へ移行する方式とツールを、データ変換、停止時間、互換性、運用責任から比較する。
---

このメモでは、オンプレミスや他のクラウドで稼働する Oracle Database を OCI Database へ移行する方式を比較する。移行方式と、それらを自動化するツール／サービスを分けて考える。

アップデートとアップグレードの違いは [[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]] を参照。

## 要点

- **論理移行**はデータと metadata を読み出してターゲットで再作成する。構成変更や cross-platform に強いが、全量の unload / load とオブジェクト再作成に時間がかかる。
- **物理移行**は datafile や backup set をブロック単位で移す。大容量 Database に向くが、プラットフォーム、endianness、Database バージョン、物理構成の互換性制約が強い。
- **オンライン移行**は初期ロード後の差分を Data Guard または GoldenGate で同期し、切替時の停止を短縮する。名称に `Zero Downtime` が含まれても、更新停止、最終同期、接続切替、検証の停止時間は残る。
- AutoUpgrade、Zero Downtime Migration（ZDM）、OCI Database Migration は移行方式そのものではなく、複数の Database 機能やツールを組み合わせるオーケストレーション層。

## 主な移行方式

| 方式 | データ移動 | 主な移行単位 | 構成変更 | 停止時間の傾向 | 向く場面 |
| --- | --- | --- | --- | --- | --- |
| [[cloud/oracle/database/migration/oracledb-data-pump\|Data Pump]] | 論理 unload / load | Database、Schema、table、tablespace | 大 | 大〜中 | Schema 再編、non-CDB から PDB、cross-platform、選択移行 |
| [[cloud/oracle/database/migration/oracledb-transportable-tablespaces\|Transportable Tablespaces]] | datafile ＋ metadata | tablespace、Database | 中 | 中〜小 | 大容量のユーザー表領域を高速に移行 |
| [[cloud/oracle/database/backup/oci-oracledb-backup-rman\|RMAN restore・duplicate]] | 物理 backup / restore | Database | 小 | 中〜小 | 互換構成間の大容量物理移行 |
| [[cloud/oracle/database/migration/oracledb-pdb-migration\|PDB clone・relocate・unplug-plug]] | PDB datafile、redo | PDB | 小 | 中〜極小 | Multitenant 間で PDB 単位に移行 |
| [[cloud/oracle/database/migration/oracledb-data-guard\|Data Guard]] | 物理 redo transport / apply | Database | 小 | 極小 | 互換構成間のオンライン物理移行 |
| [[cloud/oracle/database/migration/oracledb-goldengate\|GoldenGate]] | 論理 change data capture | Database、Schema、table | 大 | 極小 | 異なる構成間のオンライン移行、段階移行 |

停止時間はデータ量、変更量、帯域、再作成するオブジェクト、切替手順によって変わる。方式名だけから具体的な時間を決めず、実データで反復検証する。

## 効率化ツールとサービス

| ツール／サービス | 主な役割 | 内部で利用する方式 | 操作モデル |
| --- | --- | --- | --- |
| [[cloud/oracle/database/maintenance/oracledb-autoupgrade\|AutoUpgrade]] | Database upgrade、non-CDB→PDB、unplug-plug upgrade、patching | Database upgrade、PDB 操作 | CLI / 構成ファイル |
| [[cloud/oracle/database/migration/oci-zero-downtime-migration\|Zero Downtime Migration]] | 物理／論理／ハイブリッド移行の自動化 | RMAN、Data Guard、Data Pump、GoldenGate、TTS、PDB clone | CLI / response file |
| [[cloud/oracle/database/migration/oci-database-migration-service\|OCI Database Migration]] | OCI への論理移行をマネージド化 | Data Pump、GoldenGate | OCI コンソール / API |

直接ツールを使うと設計自由度が高い。ZDM は詳細な移行方式を選びながら一連の処理を自動化し、OCI Database Migration は論理移行を OCI の管理サービスとして実行する。どちらを使っても、対象オブジェクト、互換性、権限、ネットワーク、アプリケーション切替の判断は利用者に残る。

## 初期ロードと差分同期を分ける

オンライン移行は、通常、次の 2 層で設計する。

1. **初期ロード**：Data Pump、RMAN、Transportable Tablespaces、PDB clone などで既存データを移す。
2. **差分同期**：初期ロード開始後に発生した更新を Data Guard または GoldenGate で追従させる。

大容量 Database で GoldenGate のみを使って初期ロードすると、時間と負荷が増える場合がある。物理 backup や Data Pump で初期データを移し、GoldenGate は差分同期に使う構成を検討する。初期ロードの基準 SCN と GoldenGate の capture / apply 開始点が一致しないと、欠損または重複が発生する。

## 方式を絞り込む観点

### ソースとターゲット

- OS とプラットフォーム、endianness
- Database バージョン、edition、RU、`COMPATIBLE`
- single instance / RAC、non-CDB / CDB / PDB
- 文字セット、national character set、timezone file
- TDE、keystore / wallet、暗号化表領域
- 利用する option、data type、LOB、external table、Database Vault

### データと停止要件

- datafile と index を含む総量、日次変更量、最大 transaction
- 許容停止時間、要求 RPO、切替可能時間帯
- FastConnect / VPN / Internet の実効帯域と遅延
- Object Storage、File Storage、NFS など staging 容量
- 全体移行か、Schema／table／PDB 単位の段階移行か

### 運用とライセンス

- GoldenGate、Active Data Guard、Partitioning などの利用権
- 移行中に並行稼働する source / target / standby / test 環境の費用
- rollback / fallback の成立期間と、切替後更新を戻す方法
- 事前評価、性能試験、データ比較、業務検証、切替判断の所有者

[Oracle Migration Methods Advisor](https://apexadb.oracle.com/ords/r/dbexpert/migration-methods/home) で候補を絞り、最新の source / target matrix と実機検証で最終決定する。

## アップグレードを同時に行うか

- **移行前にアップグレード**：移行ツールの対応範囲や Multitenant 機能を利用しやすくなるが、現行基盤で先に変更リスクを負う。
- **移行と同時にアップグレード**：Data Pump、AutoUpgrade、ZDM の論理／ハイブリッド方式などで工程を統合できるが、障害原因の切り分けが難しくなる。
- **移行後にアップグレード**：同一バージョンで物理移行し、OCI の管理ワークフローで後から上げられるが、二段階の試験と停止が必要。

互換性上必要な場合を除き、プラットフォーム移行、Database upgrade、non-CDB→PDB、TDE 変更を一度に重ねすぎない。統合する場合も、それぞれの rollback 条件と検証結果を分けて記録する。

## 共通の移行サイクル

1. source / target とアプリケーション依存関係を棚卸しする。
2. 候補方式を複数選び、所要時間、互換性、ライセンス、運用負荷を比較する。
3. 本番相当データで全工程を反復し、初期ロード、差分同期、切替、fallback の時間を測る。
4. 切替前に更新を停止し、未適用差分がないことを確認する。
5. target で Database、PDB、Schema、件数、制約、無効オブジェクト、性能、バッチ、接続を検証する。
6. source の再開条件と廃止時期を決め、切替後のバックアップと監視を開始する。

## 公式ドキュメント

- [Choose an Upgrade Method for Oracle Database](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/choose-an-upgrade-method-for-oracle-database.html)
- [Oracle Data Pump](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-data-pump.html)
- [Transporting Data](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/transporting-data.html)
- [Introduction to Zero Downtime Migration](https://docs.oracle.com/en/database/oracle/zero-downtime-migration/26.1/zdmug/introduction-to-zero-downtime-migration.html)
- [OCI Database Migration overview](https://docs.oracle.com/en-us/iaas/database-migration/doc/overview.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
