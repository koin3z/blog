---
title: OCI における Oracle Database のアップデート／アップグレード
date: 2026-01-09
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-update
  - cloud/oracle/database/oci-oracledb-update
description: OCI Base Database Service の更新とメジャーアップグレードの違い、実施方法、移行との境界を整理する。
---

## 概要

- Oracle Database の変更作業は、Database Home、Database release、DB システム基盤、配置先のどれを変えるかで分類する
- OCI Base Database Service では、同じメジャーリリース内の RU 適用を主に Update、メジャーリリースの変更を Upgrade と呼ぶ
- 複数の変更を同時に実施する場合も、互換性、停止時間、切替条件、切り戻し条件、検証項目は変更対象ごとに分ける

Doc: [Update a Database - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/update-db/index.html)

Doc: [Upgrade a Database - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/upgrade-db/index.html)

## 変更作業の分類

| 作業 | 何が変わるか | 例 | 主な手段 |
| --- | --- | --- | --- |
| パッチ／アップデート | 同じメジャーリリース内の RU、MRP、one-off | 19.27 → 19.28 | OCI コンソール／API、カスタム Database Software Image、OPatch、AutoUpgrade Patching |
| Database アップグレード | Database のメジャーリリース | 19c → 26ai | OCI コンソール／API、AutoUpgrade |
| DB システムの更新／アップグレード | OS、Grid Infrastructure などの基盤 | Oracle Linux 更新、GI 19c → 26ai | OCI コンソール／API、`dbcli` |
| 移行 | Database の配置先、プラットフォーム、構成 | オンプレミス → Base Database Service | [[cloud/oracle/database/migration/oci-oracledb-migration\|OCI Oracle Database 移行概要]] |

## 選択順序

1. セキュリティ修正や不具合修正だけが目的なら、同じリリース内のアップデートを選ぶ
2. 現行リリースのサポート終了や新機能が理由なら、Database アップグレードを検討する
3. OS、GI、ハードウェア、クラウド、エディション、CDB／PDB 構成も変えるなら、[[cloud/oracle/database/migration/oci-oracledb-migration|移行]]として設計する
4. 停止時間を短縮する必要がある場合は、Data Guard、GoldenGate、ZDM などのオンライン方式を検討する
5. バージョン変更と移行を同時に行う場合も、互換性、データ転送、切替、フォールバックを別々に検証する

## 同一リリース内のアップデート

### Release Update

- Release Update（RU）は、Oracle Database と Grid Infrastructure に対して四半期ごとに提供される累積的な修正集合
- RU にはセキュリティ修正だけでなく、回帰、不具合、オプティマイザ、機能上の修正などが含まれる
- MRP、one-off、OJVM、GI、Client を含むパッチ種別と対象判断は[[cloud/oracle/database/maintenance/patch|Oracle Database パッチ種別]]を参照する

### Base Database Service の更新フロー

1. 対象の DB システム、GI、Database、OJVM、one-off、クライアントの現行パッチを棚卸しする
2. 原則として DB システムを先に更新し、その後に Database を更新する
3. OCI コンソールの`Precheck`を実行し、失敗条件と one-off の競合を解消する
4. オンデマンドフルバックアップを取得し、復元可能範囲を確認する
5. RU を適用し、Database、PDB、リスナー、アプリケーション接続を確認する
6. `DBA_REGISTRY_SQLPATCH`、`opatch lsinventory`、無効オブジェクト、アラートログを確認する
7. 自動バックアップが再開し、更新後のバックアップが成功したことを確認する

### 提供世代と追加パッチ

- Base Database Service の OCI コンソール／APIでは、Oracle 提供アップデートの直近4世代（N〜N-3）を選択できる
- Oracle は最新のアップデートを推奨している
- 既存の interim update（one-off）は、Oracle 提供アップデートの前に自動でロールバックされる場合がある
  - 対象 RU に修正が含まれない場合は、one-off の再適用が必要になる
  - one-off を含むカスタム Database Software Image の利用を検討する

> [!WARNING] OJVM
>
> Base Database Service の公式手順では、OJVM update は OPatch で手動適用する必要があると記載されている。
>
> RU だけを適用して完了とせず、OJVM の利用有無とパッチ状態を確認する。

## Database のメジャーアップグレード

### 実行条件

- OCI コンソールまたは API からアップグレードできるが、Database のダウンタイムが発生する
- Database は`ARCHIVELOG`モードで、Flashback Database が有効である必要がある
- 対象 Database が要求する OS と Grid Infrastructure のバージョンを先に満たす
- 現行の公式手順では、19c または 21c から 26ai にアップグレードできる
  - それより前のリリースは先に 19c へ上げる
  - 対応経路は変わり得るため、実施時点のサポート表を確認する
- 事前にアップグレードプリチェックを実行し、テスト環境で同じ手順を再現する
- 自動バックアップの実行中はアップグレードできない
  - Oracle は自動バックアップを止め、手動バックアップを取得してから実行することを推奨している

### 切り戻し境界

- アップグレード後は、アップグレード前の自動バックアップを使って旧バージョンの時点へ戻せない
- 切り戻しに使うバックアップ、Guaranteed Restore Point、クローン、移行元の保持方針を事前に決める
- アップグレード後に業務更新を開始する場合は、切り戻しによって失われる更新データの扱いを決める
- TDE を使う Database では、旧環境と復旧環境が必要なキーストアとマスター鍵を利用できることを確認する

バックアップ方式と Recovery Service の詳細は[[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]を参照する。

### 影響調査

Doc: [Oracle Database Changes, Desupports, and Deprecations](https://docs.oracle.com/en/database/oracle/oracle-database/19/upgrd/oracle-database-changes-deprecations-desupports.html)

- ターゲットリリースの動作変更、非推奨機能、サポート終了機能、初期化パラメータの変更
- Database、GI、OS、クライアント、ドライバ、ORDS、監視製品、バックアップ製品の互換性
- タイムゾーンファイル、文字セット、CDB／PDB、コンポーネント、無効オブジェクト
- SQL 実行計画、バッチ時間、接続数、メモリ、統計情報、アプリケーション回帰
- TDE キーストアと鍵、バックアップ、Data Guard、GoldenGate の扱い
- 切替判定、切り戻し可能時間、アップグレード後に発生した更新データの扱い

Changes、Desupports、Deprecations の資料では、非推奨機能だけでなく、デフォルト値やセキュリティ動作の変更も確認する。

## 実行と評価の手段

Doc: [Using AutoUpgrade for Oracle Database Upgrades](https://docs.oracle.com/en/database/oracle/oracle-database/26/upgrd/using-autoupgrade-oracle-database-upgrades.html)

| 手段 | 役割 | 主な境界 |
| --- | --- | --- |
| OCI コンソール／API | Database と DB システムの更新、アップグレードを OCI 管理ワークフローで実行する | 利用可能なバージョン、プリチェック、履歴、失敗時のロールバック可否を OCI が管理する。一般提供リリースの Database アップグレードでは原則としてこの経路を使う |
| [[cloud/oracle/database/maintenance/oracledb-autoupgrade\|AutoUpgrade]] | 事前解析、fixup、upgrade、post-upgrade 検証、non-CDB→PDB、unplug-plug upgrade、patching を自動化する | OCI 管理ワークフローの外で実行できることと、Base Database Service でその操作がサポートされることは別 |
| Real Application Testing（RAT） | Database Replay と SQL Performance Analyzer で更新前後の回帰を評価する | 契約形態、機能、キャプチャ元、リプレイ先に応じて利用権を確認する |

### Real Application Testing のライセンス

Doc: [Oracle AI Database Licensing Information](https://docs.oracle.com/en/database/oracle/oracle-database/26/dblic/Licensing-Information.html)

- 2026年7月時点の Oracle AI Database Licensing Information では、RAT は Base Database Service の EE、EE-HP、EE-EP に含まれる
- オンプレミス Enterprise Edition では追加費用オプションになる
- BYOL には別の特別ライセンス条件がある
- Database Replay は、キャプチャ側とリプレイ側の両方で利用権が必要になる
- 比較レポートなど一部の機能には Diagnostics Pack も必要になる

「Base Database Service の EE 以上なら常に自由に使える」と一般化せず、契約形態、実行する機能、キャプチャ元、リプレイ先を最新の Licensing Information で確認する。

## 移行との境界

- upgrade は、同じ Database の data dictionary と software release を変更する
- migration は、データまたは Database の配置先を変更する
- Data Pump、Transportable Tablespaces、RMAN、PDB、Data Guard、GoldenGate と、それらを自動化する ZDM／OCI Database Migration は[[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]]で比較する
- 移行と upgrade を同時に実施できる方式でも、互換性、データ転送、cutover、rollback、application test を別々に検証する
- 「Zero Downtime」という名称だけで停止時間0を前提にしない
- 移行時の表領域暗号化、キーストア、マスター鍵は[[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]]を参照する

## 補足資料

- [Oracle Database Upgrade / Migration](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
- [Oracle Database アップグレードに関する推奨事項](https://www.oracle.com/jp/technical-resources/article/recommendations-for-upgrading.html)
