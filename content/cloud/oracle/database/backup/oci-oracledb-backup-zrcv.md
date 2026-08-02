---
title: Oracle Database Zero Data Loss Autonomous Recovery Service（RCV / ZRCV）
date: 2026-07-15
modified: 2026-07-24
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup-zrcv
  - cloud/oracle/database/oci-oracledb-backup-zrcv
description: Recovery Serviceの増分バックアップとリアルタイムREDO保護、復旧点、復旧先、Cloud Protect、保持、監視を整理する。
---

## Overview

Doc: [About Oracle Database Autonomous Recovery Service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-recovery-service.html)

- **Oracle Database Zero Data Loss Autonomous Recovery Service**（以下、Recovery Service）は、Oracle Zero Data Loss Recovery Appliance（ZDLRA）の技術を基にしたフルマネージドのデータ保護サービス
- OCI、Oracle Database@AWS、Oracle Database@Azure、Oracle Database@Google CloudのOracle Databaseを保護する
- オンプレミスのOracle Databaseは**Oracle Database Zero Data Loss Cloud Protect**を介して保護する
- Oracle管理の自動バックアップでは、Recovery Serviceをバックアップ先として指定する
- Zero Data Loss保護は、Recovery ServiceでReal-Time Protectionを有効にしたプレミアム機能
- バックアップ方式全体の比較は[[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Databaseバックアップ概要]]を参照する

## RCVとZRCV

Doc: [Real-time Data Protection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-real-time.html)

`RCV`と`ZRCV`は別のOCIリソース種別ではない。どちらもRecovery ServiceのProtected Databaseを使い、Real-Time Protectionの有無によって転送するデータと復旧点が変わる。

2026年7月時点の公式資料は製品全体をOracle Database Zero Data Loss Autonomous Recovery Serviceと呼び、Real-Time ProtectionをZero Data Lossのプレミアム機能として区別している。実際の構成判定では略称ではなく、OCIコンソールのReal-time protectionまたはAPIの`isRedoLogsShipped`を確認する。

| 観点 | RCVと呼ばれる構成 | ZRCVと呼ばれる構成 |
| --- | --- | --- |
| Recovery Service | 使用する | 使用する |
| Real-Time Protection | 無効 | 有効 |
| ブロックの保護 | RMAN Level 0とLevel 1増分 | 同左 |
| REDOの保護 | 完成済みArchived REDO LogをRMANとSBT Libraryでバックアップ | 同左に加えて、REDOデータをData Guard REDO transportで継続転送 |
| 復旧点の基準 | 最後に正常転送されたRMANバックアップ | Recovery Serviceが最後に受信したREDOデータ |
| 公式のRPO表現 | 最終バックアップに依存 | 直近のサブ秒に近いRPO |
| `Protected`と判定されるData Loss Exposure | 120分未満 | 10秒未満 |
| 料金 | Zero Data Loss保護なし | Real-Time Protectionは追加料金 |

`Protected`の10秒という閾値はHealthの分類条件であり、サブ秒RPOの保証値ではない。要求RPOへの適合は`DataLossExposure`と実際のリストア試験で判断する。

## 構成要素

Doc: [Recovery Service Terminology](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-concepts.html)

| 構成要素 | 責任 |
| --- | --- |
| Protected Database | RMANバックアップと、Real-Time Protection有効時のREDO変更を送信する |
| Protected Databaseリソース | `DB_UNIQUE_NAME`、保護ポリシー、Recovery Service subnet、Real-Time Protection、Healthを関連付ける |
| Recovery Service subnet | DatabaseとRecovery Serviceのprivate endpoint間のネットワーク経路を定義する |
| VPC user | Protected DatabaseからRecovery ServiceのRMAN recovery catalogへ接続する資格情報を提供する |
| Recovery Service Catalog | バックアップ、Virtual Level 0、復旧可能範囲のメタデータを管理する |
| Protection Policy | 通常バックアップの保持期間、Retention Lock、Multicloudの保存先を定義する |
| Recovery Service | 増分バックアップの索引化、REDO受信、検証、保持、リージョン内冗長化、リストア配信を担う |

Recovery Service subnetはバックアップ保存領域ではない。DatabaseからOracle管理テナンシ内のRecovery Serviceへ接続するprivate endpointの配置と経路を表す。

## バックアップとREDOの経路

Doc: [Process Architecture](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/process-architecture.html)

Doc: [Managing Archived Redo Log Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/managing-archived-redo-log-files.html)

Doc: [Backup Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_backupfiles.html)

Doc: [Real-time Data Protection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-real-time.html)

RCVとZRCVは、DatafileのブロックとREDOを組み合わせてDatabaseを復旧する。両者の差はREDOを生成する仕組みではなく、生成されたREDOがRecovery Serviceへ届く経路と時点にある。

### Online REDO LogとArchived REDO Log

Databaseの変更はREDO recordを生成する。LGWRはRedo Log BufferにあるREDOをOnline REDO Logへ書き、`COMMIT`ではtransactionのcommit recordとSCNを含む残りのREDOを書き込む。複数transactionのREDOを1回のI/Oで書くgroup commitが行われる場合もあるため、1つのtransactionが1つのファイルや1回の転送に対応するわけではない。

Online REDO Logは、LGWRが書き込みながら循環利用するロググループである。ログスイッチが発生すると、ARCnが書き込み対象から外れたロググループをArchived REDO Logとして保存する。

| 観点 | Online REDO Log | Archived REDO Log |
| --- | --- | --- |
| 用途 | 実行中Databaseの変更を継続記録する | 過去のREDOを復旧用に保持する |
| 状態 | 現在も書き込まれる可能性がある | ログスイッチ後の内容が確定している |
| 再利用 | ロググループを循環利用する | `thread`、`sequence`、SCN範囲を持つ履歴として扱う |
| RMAN backup | 直接バックアップできない | Backup Setへ格納できる |

RMANがOnline REDO Logを通常のバックアップ入力にしない理由は、ログの終端が確定しておらず、バックアップ中にも内容が変わり得るためである。復旧にはREDOを順番どおりに適用できる確定済みの範囲が必要になるため、RMANはログスイッチとアーカイブが完了したArchived REDO Logを扱う。

### コンポーネントの責任

| コンポーネント | 責任 |
| --- | --- |
| LGWR | Redo Log BufferのREDOをOnline REDO Logへ書く |
| ARCn | ログスイッチ後のOnline REDO LogをArchived REDO Logとして保存する |
| RMAN | Datafile、Archived REDO Logなどを選択し、Backup SetとBackup Pieceを作成する |
| SBT Library | RMANのSBT channelとRecovery Serviceの間でBackup Pieceを読み書きする |
| Data Guard REDO transport | Real-Time Protection有効時に生成中のREDOデータを継続転送する |
| Recovery Service | RMANバックアップとReal-Time REDOを受信し、復旧可能範囲として管理する |

RMANは、transactionを監視してREDOを継続転送するagentではない。Archived REDO LogをSQLや論理データへexportするのではなく、物理バックアップ用のRMAN固有形式であるBackup Setへ格納する。Backup Setは1つ以上のBackup Pieceからなり、設定に応じて圧縮や暗号化を適用できる。

SBT Libraryは、RMANがSBT deviceへBackup Pieceを書き込み、同じBackup Pieceをrestore時に読み戻すためのmedia management interfaceである。バックアップ対象と復旧順序はRMANが管理し、SBT LibraryはRecovery Serviceとのデータ入出力を担う。

### RCVのRMANバックアップ経路

Real-Time Protectionを無効にしたRCVでは、REDOがRecovery Serviceへ届くまでに次の段階を通る。

```text
Databaseの変更
  → REDOを生成
  → LGWRがOnline REDO Logへ書き込む
  → ログスイッチ後にARCnがArchived REDO Logを作る
  → RMANがBackup SetとBackup Pieceへ格納する
  → SBT LibraryがRecovery Serviceへ書き込む
```

1つのArchived REDO Logを1回ずつ単純にファイルコピーするとは限らない。RMANは1つ以上のArchived REDO LogをBackup Setへ格納し、SBT Libraryを介してBackup Pieceを送る。

RCVのRecovery Serviceにおける復旧点は、最後に正常転送されたRMANバックアップに依存する。ログスイッチ、RMAN backup job、Backup Pieceの転送完了を待つため、その間に生成されたREDOがRecovery Serviceへ届いていない時間帯がData Loss Exposureになる。

### ZRCVで追加するReal-Time REDO経路

ZRCVはRCVのRMANバックアップ経路を置き換えない。同じ経路を残したまま、Data Guard REDO transportによる継続転送を追加する。

```text
                         ┌→ ARCn → Archived REDO Log → RMAN → SBT Library
Databaseが生成するREDO ─┤
                         └→ Data Guard REDO transport
```

Data Guard REDO transportが送るのはBackup SetやOnline REDO Logファイルのコピーではなく、生成中のREDOデータである。Recovery Serviceはログスイッチと次のRMAN backup jobを待たずにREDOを受信できるため、RCVに存在する転送待ちのData Loss Exposureを縮小できる。

Data Guardと共通するのはREDO transportの仕組みである。ZRCVのRecovery ServiceはREDOを適用した稼働中のstandby Databaseではなく、障害後のrestoreとrecoverに使うデータ保護サービスである。そのため、ZRCV単独ではData Guardのswitchoverやfailoverを代替しない。

復旧時は、RMANバックアップから構成したVirtual Level 0を基点に、Archived REDO LogとReal-Time REDOを適用する。最新、時刻、またはSCNで指定した復旧点まで進めるため、ZRCVでもRMANによるDatafileとArchived REDO Logのバックアップが必要になる。

2つのデータ経路がRecovery Serviceで管理され、復旧時に合流する構造を次の図で確認できる。

![[zrcv-protection-flow.png|RMAN増分バックアップとリアルタイムREDOをRecovery Serviceで保護し、Virtual Level 0とREDOから指定時点へ復旧する流れ|820]]

### Incremental Forever

1. 最初のRMAN Level 0バックアップが使用済みブロックをRecovery Serviceへ送る
2. 以後のLevel 1増分バックアップが前回までのバックアップから変更されたブロックを送る
3. Recovery Serviceが受信ブロックを索引化する
4. 複数の増分バックアップに含まれるブロックから、特定時点の完全なDatabaseイメージであるVirtual Level 0を構成する

最初にLevel 0を取得することは、datafileのバックアップがその一度で完了するという意味ではない。Level 0は変更されていないブロックを含む復元の土台になり、以後のLevel 1が最新の変更ブロックを継続して取り込む。

```text
T0: Level 0  [A0][B0][C0][D0]
T1: Level 1  [A1]    [C1]
T2: Level 1      [B2]

T2のVirtual Level 0
               [A1][B2][C1][D0]
```

REDOは既存のDatabase blockへ加えた変更履歴であり、変更されなかったブロックの完成形を繰り返し保持するものではない。最初のLevel 0と、それ以降のREDOを欠けることなく保持すれば理論上は復旧できる場合もあるが、時間の経過とともに適用するREDOチェーンが長くなる。

復旧処理では、RMANバックアップからdatafileを戻す`RESTORE`と、戻したdatafileへREDOを順番に適用する`RECOVER`を区別する。REDOチェーンが長い場合に主に増えるのは`RECOVER`の処理時間である。

| 処理 | 入力 | 役割 |
| --- | --- | --- |
| `RESTORE` | RMAN Level 0、Level 1から構成したVirtual Level 0 | 復旧の出発点となるdatafileを戻す |
| `RECOVER` | Archived REDOとReal-Time REDO | 出発点のSCNから目的のSCNまでdatafileを進める |

Level 1を継続して最新に近いVirtual Level 0を構成すると、復旧時に適用するREDO量を抑えられる。また、最初のLevel 0と全REDOを永久に保持する必要がなくなり、リカバリ・ウィンドウを進めながら古いバックアップとREDOを保持ポリシーに従って管理できる。

この方式では、本番Databaseのdatafile全体を定期的に読み直さないため、バックアップ時のCPU、メモリ、I/O、バックアップ時間を抑えられる。ただし、Virtual Level 0は任意のPITR時点までREDO適用が不要という意味ではない。Virtual Level 0のSCNから指定した復旧時点までのREDOは引き続き必要になる。

> [!note] Delta Storeという用語
>
> `Delta Store`はオンプレミス製品ZDLRAの内部構造を説明する資料で使われる。Recovery Serviceの公開ドキュメントは`Virtual Level 0`を中心用語としているため、クラウドサービスの公開されたリソースや実装名として扱わない。

### Real-Time REDO

Recovery ServiceはOracle Data GuardのREDO transportを使い、Protected Databaseが生成するREDO変更を継続的に受信する。オンラインREDOログ・ファイルを短い間隔で繰り返しバックアップする方式ではない。

REDOストリームが予期せず終了すると、Recovery Serviceは受信済みのREDOから部分アーカイブREDOログのバックアップを作成する。これにより、通常のログスイッチを待たず、最後に受信した変更までを復旧対象へ含められる。

ストリーム再開後は、Protected Databaseから不足するアーカイブREDOログを自動取得し、REDOギャップを補完する。一時的な通信断が直ちにリカバリ・ウィンドウ全体の欠損になるとは限らない。

中断時に受信済みREDOを確定し、再接続後に不足ログを取得する流れを次の図で確認できる。

![[zrcv-redo-gap-recovery.png|REDOストリーム中断時に部分アーカイブログを作成し、再接続後のGap Fetchで不足ログを補う流れ|820]]

> [!NOTE] 要確認
>
> Gap Fetchが必要とするアーカイブREDOログをProtected Database側ですでに失った場合の詳細な回復経路は、Recovery Serviceの公開ドキュメントだけでは確認できない。FRAの容量、アーカイブログ削除条件、通信断の想定継続時間を含む設計はOracle Supportへ確認する。

## 復旧点とRPO

Doc: [Using the OCI Console to View Protected Database Details](https://docs.oracle.com/en-us/iaas/recovery-service/doc/using-oci-console-view-protected-database-details.html)

| 指標 | 意味 | 判断に使う場面 |
| --- | --- | --- |
| Real-time protection | REDOの継続転送が構成されているか | ZRCV構成の有無 |
| `DataLossExposure` | 最後の有効なバックアップまたはREDO受信以降の潜在的なデータ損失時間 | 現在のRPO逸脱 |
| Health | `Protected`、`Warning`、`Alert`による保護状態 | アラームと一次切り分け |
| Current recovery window | 現在からどこまで過去へ復旧できるか | 保持要件への適合 |
| Last completed backup | 最後に成功したバックアップの時刻 | 増分バックアップ経路の確認 |
| Last failed backup | 最後に失敗したバックアップの時刻 | 継続障害の確認 |

- Real-Time Protection有効時
  - `DataLossExposure`が10秒未満なら`Protected`
  - 10秒を超えると、リカバリ・ウィンドウ内の復旧可能性を維持していても`Warning`
- Real-Time Protection無効時
  - `DataLossExposure`が120分未満なら`Protected`
  - 120分を超えると`Warning`
- 最新バックアップが失敗し、現在のリカバリ・ウィンドウ内へ復旧できない場合は`Alert`

`Protected`は「RPOが常に0」を意味しない。Real-Time Protectionが有効でも、10秒未満のData Loss Exposureを含む状態が`Protected`に分類される。

Recovery Serviceの通常バックアップは、次の方法でin-place restoreできる。

- Restore to the latest
- Restore to timestamp
- Restore to SCN

復旧時点を指定できることと、アプリケーションがその時点で整合していることは別の条件である。Databaseのリストア後に、アプリケーション接続、外部システムとの整合性、TDE keystore、RTOを検証する。

## 復旧先

Doc: [Oracle Database Autonomous Recovery Service Technical Architecture](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-architecture.html)

Doc: [Recovering a Database](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovering-database.html)

2026年7月24日時点の復旧先は、Recovery Service単体ではなく、バックアップ元を管理するOracle Database serviceのrestoreまたはcreate-from-backup機能によって決まる。Recovery Serviceは復旧データとCatalogを提供し、Base Database Service、Exadata Database Service、Multicloud Databaseなどのcontrol planeが復旧先resourceを作成または選択する。

この節はRecovery Serviceをbackup destinationにした構成とCloud Protectを対象にする。利用者管理のRMANまたはObject Storage backupからの移行、Data Pump、ZDM、Autonomous AI Database Serverless固有のbackup、Exadata Cloud@Customerのlocal backup destinationは対象外とする。

> [!NOTE] RCVとZRCVで復旧先は変わらない
>
> Real-Time Protectionは、Recovery Serviceが受信するREDOを増やし、選択できる最新の復旧点を障害直前へ近づける。RCVとZRCVで、同じバックアップ元から作成できるtarget service、region、Database versionのsupport matrixが別になるわけではない。

### 復旧方式の分類

| 復旧方式                       | 復旧先                                                                 | 元Database          | 用途                                   |
| -------------------------- | ------------------------------------------------------------------- | ------------------ | ------------------------------------ |
| In-place restore           | バックアップ元として登録された既存Database                                           | 指定時点の状態で上書きする      | 障害、誤操作、論理破損から元Databaseを戻す            |
| Out-of-place restore       | 新しいDB system、既存VM cluster内の新しいDatabase、または新しいAutonomous AI Database | 残せる                | 復旧試験、複製、元resource喪失、別AD・別regionでの再作成 |
| Peer restore               | Data Guard association内のprimaryまたはstandby                           | 対象peerを上書きする       | primaryとstandbyのbackupを相互利用する        |
| Cloud Protect RMAN restore | 利用者が準備したオンプレミスDatabase環境                                            | RMAN commandと構成による | 利用者がhost、storage、鍵、切替を管理する           |

In-place restoreは、元のDatabase resourceを復旧点の状態へ戻す。復旧試験で本番Databaseを上書きしたくない場合は、対応するserviceのout-of-place restoreを選ぶ。

### Service別の復旧先matrix

Doc: [Create a DB System from a Backup](https://docs.oracle.com/en/cloud/paas/base-database/create-dbs-from-backup/index.html)

Doc: [Manage Databases on Exadata Database Service on Dedicated Infrastructure](https://docs.oracle.com/en-us/iaas/exadatacloud/doc/manage-databases.html)

Doc: [Cross-Service Data Guard Between ExaDB-D and ExaDB-XS](https://docs.oracle.com/en-us/iaas/exadatacloud/doc/cross-service-data-guard.html)

Doc: [Multicloud Oracle Database Backup Support](https://docs.oracle.com/en-us/iaas/recovery-service/doc/azure-multicloud-recoveryservice.html)

次の記号を使う。

- `○`：現在の公式手順で確認できる
- `△`：Recovery Serviceの概要では可能と読めるが、対象を確定できる公開手順または条件が不足している
- `—`：該当するcreate-from-backup workflowが非対応、またはRecovery Service backupの手順として確認できない

| バックアップ元 | In-place | Out-of-place | 別AD・別region・別tenancy | 主な境界 |
| --- | --- | --- | --- | --- |
| OCI Base Database | ○ CDBはlatest、timestamp、SCN。PDBはlatest、timestamp | ○ 新しいBase DB system | ○ 別AD・別region。同一tenancy | 同じnode type、同じか新しいDatabase version、target storage、network、鍵の条件を満たす |
| OCI ExaDB-D | ○ CDB、PDB | ○ 新しいExaDB-DまたはExaDB-XS Database | ○ 任意のAD・region。同一tenancy | Target Exadata VM clusterとDatabase Homeが必要 |
| OCI ExaDB-XS | ○ CDB、PDB | ○ 新しいExaDB-XSまたはExaDB-D Database | ○ 任意のAD・region。別tenancyは（要確認） | Target serviceが提供するDatabase versionに制限される |
| OCI Autonomous AI Database on Dedicated Exadata | ○ backup、timestamp、SCN | ○ 新しいAutonomous AI DatabaseまたはAutonomous Container Databaseへclone | ○ 別region。Autonomous AI Databaseは条件付きで別tenancyも可 | 別tenancy cloneはCLIまたはAPIのみで、sourceがcustomer-managed keyを使う場合は非対応 |
| Oracle AI Database@Azure Base Database | ○ CDB、PDB | ○ 新しいBase DB system | ○ target Subscription、region、ADを選択 | Azure integration内のBase Databaseとして作成する |
| Oracle AI Database@Azure ExaDB-D / ExaDB-XS | ○ CDB、PDB | ○ target VM clusterの新しいDatabase | ○ target regionを選択 | Azure integration内の同じDatabase service familyへ作成する |
| Oracle AI Database@Google Cloud Base Database | ○ CDB、PDB | — 公式資料がcreate-from-backup非対応と明記 | — | 既存DatabaseのPITRに限定される |
| Oracle AI Database@Google Cloud ExaDB-D | ○ CDB、PDB | ○ target VM clusterの新しいDatabase | ○ target regionを選択 | Google Cloud integration内のExaDB-Dとして作成する |
| Oracle AI Database@Google Cloud ExaDB-XS | ○ CDB、PDB | ○ target VM clusterの新しいDatabase | △ 現在の手順にtarget regionの選択がない | Cross-region restoreは（要確認） |
| Oracle AI Database@AWS ExaDB-D | ○ CDB、PDB | ○ 新しいExadata Database | ○ 同一region。△ Recovery Service backupのcross-region | 公開されたcross-region手順はAmazon S3 automatic backupを前提にする |
| Oracle AI Database@AWS Autonomous AI Database on Dedicated Exadata | ○ backup、timestamp、SCN | ○ 新しいAutonomous AI Databaseへclone | ○ 同一region。△ Recovery Service backupのcross-region | 公開されたcross-region手順はAmazon S3 backupを前提にする |
| Cloud ProtectのオンプレミスDatabase | ○ 手動RMAN | △ alternate hostまたはcluster | △ 公式Overviewの「any location」を満たす詳細条件は未公開 | OCI Consoleがtarget DB systemをprovisionする方式ではない |

Matrixの`○`は、すべてのshape、version、key manager、region、tenancy間で無条件に復旧できるという意味ではない。復旧時にtarget serviceの画面またはAPIへ候補が現れ、target resource、network、software image、暗号鍵の条件を満たす必要がある。

### OCI Base DatabaseとExadata

Doc: [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)

Doc: [Manage Database Backup and Recovery on ExaDB-D](https://docs.oracle.com/en-us/iaas/exadatacloud/doc/ecs-managing-db-backup-and-recovery.html)

OCI Base Databaseでは、Recovery Service backupから新しいDB systemを作成し、同じAD、同一regionの別AD、別regionへ配置できる。Recovery Serviceを使うcross-region restoreは同一tenancy内に限定され、source regionのRecovery Service subnet、VCN remote peering、DNS peering、TCP `8005`と`2484`の経路を必要とする。Backupが別regionへ自動複製されるのではなく、target regionのDatabaseがsource regionのRecovery Serviceへ接続して読み出す。

ExaDB-DとExaDB-XSでは、同じservice内のout-of-place restoreに加え、Recovery Service backupからExaDB-DとExaDB-XSの間を相互にrestoreできる。

```text
ExaDB-D backup ─→ 新しいExaDB-D Database
              └→ 新しいExaDB-XS Database

ExaDB-XS backup ─→ 新しいExaDB-XS Database
               └→ 新しいExaDB-D Database
```

この相互restoreはOCI Exadata service間の対応である。Cloud Protectで保護した任意のオンプレミスDatabaseを、同じcreate-from-backup操作でOCI Exadataへ直接作成できることを意味しない。

### Multicloud

Doc: [Restore Base Database on Oracle AI Database@Azure](https://docs.oracle.com/en-us/iaas/Content/database-at-azure/azurs-restore-base-database-restore.html)

Doc: [Restore Exascale Database on Oracle AI Database@Azure](https://docs.oracle.com/en-us/iaas/Content/database-at-azure/azubr-backup-and-restore-restore-exascale-database.html)

Doc: [Restore Base Database on Oracle AI Database@Google Cloud](https://docs.oracle.com/en-us/iaas/Content/database-at-gcp/gcpbr-backup-and-restore-restore-base-database.html)

Doc: [Restore Exascale Database on Oracle AI Database@Google Cloud](https://docs.oracle.com/en-us/iaas/Content/database-at-gcp/gcpbr-backup-and-restore-restore-exascale-database.html)

Doc: [Restore Exadata Database on Oracle AI Database@AWS](https://docs.oracle.com/en-us/iaas/Content/database-at-aws-exadata-awsbr/awsbr-backup-and-restore-restore-exadata-database.html)

MulticloudのProtection Policyでは、backupをOCIに置くか、Databaseと同じcloud providerに置くかを選べる。これはbackup locationの選択であり、restore先providerを切り替える機能ではない。

公式手順で確認できるのは、Oracle AI Database@Azure、Oracle AI Database@Google Cloud、Oracle AI Database@AWSの各service内で既存Databaseをrestoreするか、対応するtarget DB systemまたはVM clusterへ新しいDatabaseを作る範囲である。AzureのbackupからOCI Base Databaseを作る、Google CloudのbackupからAWS Exadataを作るといったcross-provider create-from-backupの公開support matrixは確認できない（要確認）。

Oracle AI Database@AWSのcross-region restore手順はAmazon S3 backupを明示的な前提にする。Recovery Serviceへ保存したbackupを使うcross-region restoreは、同じ画面にregion選択が見えても、現在の公開手順だけではsupport対象と確定できない（要確認）。

### Autonomous AI Database on Dedicated Exadata

Doc: [Backup and Restore Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/backup-and-restore-autonomous-ai-database-on-dedicated.html)

Doc: [Clone an Autonomous AI Database on Dedicated Exadata](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/clone-an-autonomous-ai-database-on-dedicated-exadata.html)

Oracle Public Cloudでは、Autonomous Container Database（ACD）の通常backup destinationにRecovery Serviceを選べる。既存Autonomous AI Databaseのin-place restoreに加えて、backupから新しいAutonomous AI DatabaseまたはACDをcloneできる。

Autonomous AI Databaseのbackup cloneは別regionを選べる。Oracle Public Cloudでは別tenancyへのcloneにも対応するが、CLIまたはREST APIだけを使い、sourceがcustomer-managed keyを使う場合は利用できない。Target ACDはsourceと同じか新しいDatabase versionである必要がある一方、19cと26aiの相互cloneはできないため、実質的には同じmajor version内のversion差として判断する。

ACDのcross-region remote backup copyは別の仕組みである。通常backup destinationがRecovery Serviceであってもremote copyはObject Storageへ置かれ、新しいACDへのcloneにだけ使い、in-place restoreには使えない。Autonomous Data GuardまたはMulticloudのACDではcross-region backup copyを有効化できない。

このserviceの公開資料はRecovery Serviceによるdaily virtual fullを説明するが、Real-Time Protectionを選べるとは説明していない。この行をZRCV相当のsub-second RPOが利用できるという意味に読まない（要確認）。

### Database versionの差

Doc: [Create a DB System from a Backup](https://docs.oracle.com/en/cloud/paas/base-database/create-dbs-from-backup/index.html)

Doc: [Restoring Backups Created Using Older Versions of RMAN](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-recovery-advanced.html#GUID-428D15E8-4A80-4F17-836A-8364A6CD55A8)

| 復旧方式 | Versionの原則 | 注意点 |
| --- | --- | --- |
| In-place restore | 現在のDatabase resourceとDatabase Homeへ戻す | Restore操作自体でtarget versionを選ぶworkflowではない |
| OCI Base Database / Exadataのout-of-place restore | Targetはsourceと同じか新しいDatabase version | 古いversionへのrestoreは不可。Target serviceが提供するsoftware imageとRUに制限される |
| Autonomous AI Database on Dedicated Exadataのclone | Target ACDは同じか新しいversion | 19cと26aiの相互cloneは非対応 |
| Cloud Protectの手動RMAN restore | 同じversion、またはsupported upgrade pathを持つ新しいOracle Home | Cloud Protect固有のalternate hostとversion matrixは公開されていない |
| OCI Base Database / ExadataのRecovery Service LTRから新規Databaseを作成 | Supported major versionなら同じmajorの最新RUへrestore | Unsupported majorならsupported majorへrestoreした後にDatabase upgradeが必要 |

RMANは古いbackup pieceを新しいversionのbackup形式へ変換してから送るわけではない。新しいOracle Homeへ古いversionのdatafileをrestoreしてrecoverし、supported upgrade pathがある場合に`OPEN RESETLOGS UPGRADE`とDatabase upgradeを実行する。

したがって、managed create-from-backup画面の「same or later version」は、任意のmajor version差を無条件に自動upgradeするという意味ではない。たとえば19c backupから26ai targetを作る場合に、restore、upgrade、post-upgrade処理のどこまでを各Database serviceが自動化するかは公開手順だけでは確定できないため、実際のsoftware image、RU、upgrade pathとservice固有のsupportを確認する（要確認）。

### Backup種別とData Guard

Doc: [Backup Retention](https://docs.oracle.com/en-us/iaas/recovery-service/doc/backup-retention.html)

| Backup種別 | In-place restore | Out-of-place restore | 復旧点 |
| --- | --- | --- | --- |
| Operational backup | ○ | Target serviceがcreate-from-backupに対応する場合は○ | latest、timestamp、SCN |
| Standalone backup | — | ○ 新しいDatabaseだけ | 選択したbackup、またはserviceが提供するPITR |
| Recovery Service LTR backup | 非対応 | ○ 新しいDatabaseだけ | LTRが表す単一時点 |

Recovery Serviceの一般資料がLTRの対象として挙げるのはOCI Databases、Oracle AI Database@Azure、Oracle AI Database@Google Cloudである。Oracle AI Database@AWSとCloud Protectは含まれない。Google Cloud Base Databaseはcreate-from-backup自体が非対応のため、LTRを作成できることだけからBase DB systemへの復旧が可能とは判断できない（要確認）。

Autonomous AI Database on Dedicated ExadataのLTRはservice固有の仕組みである。Oracle Public Cloudでは通常backup destinationがRecovery ServiceでもLTRをObject Storageへ作るため、Base DatabaseやExadataのRecovery Service LTRと同一視しない。AWSのAutonomous AI Database on Dedicated Exadataはservice固有資料とRecovery Serviceの一般資料でLTRの範囲が一致しないため（要確認）とする。

Doc: [Backup and Restore from a Standby Database in a Data Guard Association](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)

Recovery Serviceをbackup destinationにしたBase DatabaseのData Guard associationでは、primaryとstandbyのbackupを相互に使ってpeerをrestoreできる。ExaDB-DとExaDB-XSでも、同じservice内または両service間のData Guard peer restoreをRecovery Service backupで行える。

```text
Primaryのbackup ─→ PrimaryまたはStandbyをrestore
Standbyのbackup ─→ StandbyまたはPrimaryをrestore
```

これはData Guard association内のpeerを関連付ける機能であり、任意の無関係なDatabaseへbackupを適用できるという意味ではない。

## 暗号化と鍵管理

Doc: [Security and Availability](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-backup-encryption.html)

Doc: [Configuring RMAN Client for Advanced Backup](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/configuring-rman-client-advanced.html)

Doc: [Managing Keystores and TDE Master Encryption Keys](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/managing-keystore-and-tde-master-encryption-key.html)

Recovery Serviceは暗号化されていないバックアップを拒否し、operational backupとLong-Term Retention backupをライフサイクル全体で暗号化したまま保持する。暗号鍵はDatabase serviceまたは利用者が管理し、Recovery Serviceは鍵へアクセスしない。

ここでいう暗号化は、「TDEかRMAN暗号化か」という二者択一ではない。TDEはDatabaseのdatafileを暗号化する機能であり、RMANはRecovery Serviceへ送るbackup setを暗号化する。RMANのtransparent encryptionは、DatabaseのTDE keystoreにあるmaster encryption keyを使ってbackup encryption keyを保護する。暗号化対象は異なるが、鍵管理はTDE keystoreへつながっている。

| 対象 | 暗号化する場所 | 主な仕組み | 復号に必要な鍵を管理する場所 |
| --- | --- | --- | --- |
| Databaseのdatafile | Database host | TDE | DatabaseのTDE keystoreまたは外部key manager |
| RMAN backup set | RMANを実行するDatabase側 | RMAN transparent encryption | DatabaseのTDE keystoreにあるmaster encryption key |
| Real-Time REDO | Protected Database側 | REDO transport時の暗号化（Recovery Applianceの説明モデル） | Protected DatabaseのOracle Wallet |
| RMAN backupの通信経路 | DatabaseとRecovery Serviceのprivate endpoint間 | 暗号化channel | Recovery ServiceがDatabaseのTDE keyを取得する仕組みではない |
| Recovery Service内のbackup | 暗号化されたbackupをそのまま保存 | backup encryption | Database serviceまたは利用者が管理する鍵 |

概念的な鍵の関係は次のようになる。

```text
TDE keystore
└─ Database master encryption key
   └─ RMAN backup encryption keyを保護
      └─ Backup Set / Backup Pieceを暗号化
```

リストア時は、Recovery Serviceが暗号化されたバックアップを返し、復元先のRMANがTDE keystoreのmaster encryption keyを使ってbackup encryption keyを取り出して復号する。Recovery ServiceがDatabase hostのTDE keystoreへ接続したり、鍵を預かったりするわけではない。

この設計では、Recovery Service側の侵害だけでバックアップを復号されにくい一方、TDE keystoreを失うと保持中のバックアップも復号できなくなる。RMANのDatabase backupにはTDE wallet自体が含まれないため、walletと過去のmaster encryption keyをバックアップ本体とは別に保全する。Database hostと同時に失う構成を避けるには、Oracle Key Vaultなどの外部key managerも検討する。

> [!NOTE] Recovery Applianceを使った説明モデル
>
> Recovery ServiceはZero Data Loss Recovery Applianceの技術を基にしているが、現在のRecovery Serviceが内部で使う暗号化形式と検証アルゴリズムの全詳細は公開されていない。したがって、次の説明はRecovery Appliance 23.1の公開仕様を使った理解モデルであり、Recovery Service内部の実装契約ではない。
>
> Recovery Applianceでは、Database側のRMANとSBT moduleがTDEで暗号化されたdatafile blockをDatabaseの鍵で復号し、圧縮後に新しいdata encryption keyで再暗号化する。そのdata encryption keyをTDE master encryption keyで包み、backupへ格納する。この形式により、Recovery ApplianceはDatabaseの鍵を保有せず、block dataを復号せずにバックアップのライフサイクル検証とpurgeを実行できる。
>
> Real-Time REDOも、Recovery Applianceの公開仕様ではProtected Database側で暗号化してから転送し、暗号化されたまま保存する。復元時のRMANがProtected Databaseのwalletを使って復号する。この仕組みは、REDO transportがREDOデータそのものを送ることと、その通信・保存内容を暗号化することが両立する例である。

## 導入条件

Doc: [Onboarding Oracle Database to Recovery Service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/getting-started-recovery-service.html)

### Databaseバージョン

2026年7月時点でReal-Time Protectionを利用できるOracle Cloud DatabaseとOracle Multicloud Databaseのバージョンは次のとおり。導入時には更新後のRU要件を公式ドキュメントで再確認する。

| Database                | Real-Time Protectionの最小バージョン |
| ----------------------- | ------------------------------------ |
| Oracle Database 19c     | 19.18                                |
| Oracle Database 21c     | 21.8                                 |
| Oracle AI Database 26ai | 23.4                                 |

Recovery Service自体を利用できる最小RUと、Real-Time Protectionを利用できる最小RUは同じとは限らない。たとえば、Oracle Database 19cではRecovery Serviceの最小RUは19.16だが、Real-Time Protectionには19.18以降が必要になる。

### ネットワーク

- Recovery ServiceはIPv4-onlyのRecovery Service subnetを使用する
- 推奨subnet sizeは`/24`
- IP addressに制約がある場合の最小sizeは`/27`
- TCP `8005`
  - DatabaseからRecovery ServiceへRMANバックアップを転送する
- TCP `2484`
  - RMAN recovery catalog接続とReal-Time ProtectionのREDO転送に使用する
- OCI Databaseでは、自動バックアップ有効化時にDatabase subnetまたはbackup subnetをRecovery Service subnetとして自動登録できる
- 独自のRecovery Service subnetを登録する場合は、Databaseと同じVCNに配置し、security listまたはNSGへstateful ruleを設定する

Network経路が開いていることだけではZRCVの正常性を判定できない。TCP接続、RMAN catalog接続、バックアップ転送、REDO転送、`DataLossExposure`を分けて監視する。

### バックアップ運用

- Recovery Serviceを有効にする前に、別の保存先へ送る手動のoperational backupを停止する
  - Oracleは2つの保存先へoperational backupを実行すると、双方のバックアップへ問題を起こし、データ損失シナリオを作る可能性があると警告している
  - Compliance用の独立コピーや`KEEP` backupまで一律に禁止する意味ではなく、運用バックアップの役割とRMAN metadataの所有者を分けて設計する

## Cloud Protect

Doc: [Protecting On-premises Databases using Oracle Database Zero Data Loss Cloud Protect](https://docs.oracle.com/en-us/iaas/recovery-service/doc/protecting-premises-databases-using-recovery-service.html)

Cloud Protectは、オンプレミスのOracle DatabaseをRecovery ServiceのProtected Databaseとして登録し、バックアップとReal-Time Protectionを管理する方式。別のバックアップ保存サービスではなく、Cloud Protect Fleet Agent、SQLclの`rcv` command、SBT library、OCI API認証を組み合わせる。

### 前提

| 項目         | 条件                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| Platform     | Linux x86-64                                                                |
| `COMPATIBLE` | 19.0.0以降                                                                  |
| Database     | Oracle Database 19.18以降、またはOracle AI Database 26ai RU 23.4以降        |
| Fleet Agent  | SQLcl interfaceから`rcv` commandを実行                                      |
| SBT library  | `libra.so`                                                                  |
| 暗号化       | TDEをDatabaseへ適用していない場合もTDE walletを構成してopenにする           |
| OCI認証      | API signing keyとOCI configuration file                                     |
| DNS          | オンプレミスからRecovery Service backup endpointを解決するDNS listener      |
| Network      | Protected DatabaseからRecovery Service subnetのTCP `2484`と`8005`へ到達可能 |

Oracle Database 19.27以降とOracle AI Database 26ai RU 23.8以降では`$ORACLE_HOME/lib/libra.so`を使用できる。それより前の対応バージョンではMy Oracle SupportのPatch 37855779からSBT libraryを取得する。

### 登録とReal-Time REDO

Doc: [Add On-Premises Database to Recovery Service Using Cloud Protect](https://docs.oracle.com/en-us/iaas/recovery-service/doc/add-premises-database-recovery-service-using-cloud-protect.html)

Cloud Protect Fleet Agentは、Databaseの検出、Protected Databaseリソースの作成、接続情報の取得、RMAN catalogへの登録、バックアップ設定を行う。Real-Time ProtectionはDatabase登録後に追加し、反映のためDatabaseを再起動する。

```text
-- OCI API認証
rcv configure authentication -method api_key -oci_config <oci_config_file>

-- 検出結果から登録用JSONを生成
rcv add database -auto_discover -generate_config_only -compartment_id <compartment_ocid> -recovery_service_subnets <recovery_service_subnet_ocid>

-- JSONを確認してDatabaseを登録
rcv add database -config <add_database_json>

-- Real-Time Protectionを追加
rcv add realtime_redo
```

登録後は`rcv show database`でHealth、Real-time Redo、Protection Policy、Unprotected Windowを確認する。

### 復元

Doc: [Restore On-Premises Database Using Backups from Recovery Service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/restore-premises-database-using-backups-recovery-service.html)

1. `rcv show restore_range`で復旧可能範囲を確認する
2. `rcv configure rman_env`でRMAN環境と`rcv_restore_template.rman`を生成する
3. RMAN scriptへ`RESTORE`と`RECOVER`の条件を記述する
4. 生成した環境を読み込み、target DatabaseとRecovery Service catalogへ接続してRMANを実行する

Cloud Protectのrestoreは、OCI Consoleが新しいDB systemをprovisionするmanaged out-of-place restoreではない。利用者が復旧先のhost、Oracle Home、initialization parameter、control fileとdatafileの配置、password file、TDE keystore、Fleet AgentまたはCatalogの接続、RMAN script、アプリケーション切替を準備する。

Oracle公式Overviewは「任意のlocationへのPoint-in-Time Recovery」を掲げる。一方、公開された詳細手順は、登録済みDatabaseの`<DB_UNIQUE_NAME>_rcv_conn`で接続し、そのDatabase用のRMAN環境を生成するところまでである。Alternate hostまたはclusterへFleet Agent、VPC user、Catalog接続、DBID、keystoreを設定する手順や、Cloud Protect backupからOCI managed Databaseを直接作成するworkflowは公開されていない（要確認）。

> [!NOTE] Cloud Protectの復元先
>
> [Configuring Cloud Protect](https://www.bryangrenn.com/2025/10/configuring-cloud-protect.html)は、2025年10月時点のVersion 1では元のhostまたはRAC clusterへの復元に制限されたという検証結果を記録している。これはGA直後のVersion 1に関する二次情報であり、現在もalternate hostが非対応であるという公式仕様には使えない。別host、別cluster、別data centerへの復元を要件にする場合は、Fleet AgentとSQLclのversion、target platform、Database version、DBID、storage mapping、TDE keystoreを提示し、Oracle Supportへ現在のsupport範囲を確認する。

同記事は、専用OCI userとAPI key、DNS、TCP `2484`と`8005`、RMAN暗号化、`rcv show database`の出力を含む実機例として参照できる。ただし、Version 1固有の制約や出力例を現在のサービス契約として扱わない。

## 保持と耐改ざん

### Protection Policy

Doc: [About Protection Policies](https://docs.oracle.com/en-us/iaas/recovery-service/doc/overview-protection-policy.html)

各Protected Databaseは1つのProtection Policyへ関連付ける。通常バックアップのリカバリ・ウィンドウは、現在から過去へ遡る保持期間として管理される。

| Oracle定義Policy | 保持期間 |
| ---------------- | -------: |
| Bronze           |     14日 |
| Silver           |     35日 |
| Gold             |     65日 |
| Platinum         |     95日 |

Custom Policyは14日から95日で設定できる。

### Long-Term Retention

Doc: [Backup Retention](https://docs.oracle.com/en-us/iaas/recovery-service/doc/backup-retention.html)

Long-Term Retention（LTR）backupは90日から10年まで保持できる。新しい本番full backupを取得せず、通常のリカバリ・ウィンドウ内にある既存バックアップから作成する。

Recovery Serviceの一般資料がLTRの対象として挙げるのはOCI Databases、Oracle AI Database@Azure、Oracle AI Database@Google Cloudである。Oracle AI Database@AWSとCloud Protectは含まれず、Autonomous AI Database on Dedicated Exadataのservice固有LTRは別の保存経路として扱う。

- 通常のautomatic backupとは独立して保持する
- LTR backupから新しいDatabaseを作成できる
- LTR backupのin-place restoreはできない
- DB system終了時に`Retain backups for 72 hours, then delete`を選ぶとLTRも72時間後に削除される
- 長期保持する場合は`Retain backups according to the retention period`を選ぶ

### Retention Lock

Doc: [Retention Lock](https://docs.oracle.com/en-us/iaas/recovery-service/doc/protection-policy-locking.html)

- Protection PolicyへRetention Lockを設定する
- Lockの発効には最低14日の猶予期間がある
- 猶予期間中は無効化、保持期間の短縮、保持期間の延長ができる
- 発効後はLockを解除できない
- 発効後の保持期間は延長だけが可能
- 保持期間が終わるまで、tenancy administratorを含む全userにバックアップの変更と削除を禁止する

Oracle管理テナンシへの分離だけで、利用者が設定した保持期間を永久に固定するわけではない。誤操作や悪意ある管理操作に対する削除防止が必要ならRetention Lockを有効にする。

## 分離と検証

Doc: [Security and Availability](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-backup-encryption.html)

- Recovery Service infrastructureはOracle管理テナンシに配置され、Databaseのtenancyから直接アクセスできないlogical air gapを作る
- private endpointはRMAN backup dataの送受信だけを許可する暗号化channelを提供する
- バックアップはリージョン内の2つの物理locationへ配置する
  - 同一リージョン内の高可用性であり、cross-region backupを意味しない
- Recovery Serviceは暗号鍵へアクセスしない

Doc: [Immutability and Anomaly Detection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-fault-tolerance.html)

Recovery Serviceは次の段階でバックアップの異常を検知する。

- Source Databaseから送信する前
- Recovery Serviceに到着したとき
- バックアップを複製するとき
- リカバリ・ウィンドウ内で定期的に

「Recovery Serviceは復号鍵を持たない」と「暗号化されたデータの異常を検知する」は矛盾しない。検証する層が異なるためである。

| 検証する層 | 主な検証対象 | Databaseの復号鍵 | そこで分かること |
| --- | --- | --- | --- |
| Source Database側 | RMANが読み取るOracle blockと送信前のbackup stream | 使用できる | 送信元で読めるblockからbackupを生成できたか |
| Recovery Serviceへの到着時 | 受信したbackup stream、構造、metadata | 保有しない | 転送中の欠落や破損を検知できるか |
| 複製時と定期検証 | 保存した暗号文、複製、backup chain、復旧に必要なdataとREDO | 保有しない | 保存後のbit corruption、欠落、chainの異常を検知できるか |
| RESTORE / RECOVER試験 | backupの復号、blockの復元、REDO適用 | 復元先で必要 | 保持していた鍵を使って実際に復旧できるか |
| アプリケーション試験 | 接続、業務データ、外部systemとの整合性、RTO | 復元先で必要 | 業務として利用可能な状態へ戻せるか |

暗号文の保存整合性は、平文を読むことと同じではない。一般的な説明モデルでは、保存前の暗号文`C`から検査値`H(C)`を作り、後で保存中の暗号文から再計算した値と比較すれば、復号鍵を使わずにbit corruptionや欠落を検知できる。

```text
保存時: H(受信した暗号文 C) ─┐
                              ├─ 一致するか比較
検証時: H(保存中の暗号文 C') ─┘
```

これは暗号文に対する一般的な整合性検査の説明であり、Recovery Serviceが使用するchecksum、hash、認証tagの具体的な組み合わせを示すものではない。公式ドキュメントは異常検知を行う段階を公開しているが、内部の検査値とアルゴリズムの全詳細は公開していない。

Recovery Applianceの公開仕様では、受信前後のbackup stream、virtual full backup、REDO log blockを検証し、暗号化されたbackupもDatabaseの鍵やblock dataの復号なしでライフサイクル検証できる。Recovery Serviceについては、この仕様を「Source Database側で平文のOracle blockを確認し、サービス側で暗号文とbackup chainが保存時の状態を保っているか確認する」という理解モデルとして使う。

ただし、サービス側の異常検知だけでは、将来もTDE keystoreを利用できること、実際に復号できること、アプリケーションの論理整合性、復旧手順、RTOを保証できない。これらは鍵を用意した別環境で定期的に`RESTORE`と`RECOVER`を実行し、アプリケーションまで試験して確認する。

## 監視

Doc: [Available Metrics: oci_recovery_service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/available-recovery-service-metrics.html)

| Metric | 単位 | 用途 |
| --- | --- | --- |
| `ProtectedDatabaseHealth` | Count | `0`は`Protected`、`1`は`Warning`、`2`は`Alert` |
| `DataLossExposure` | 秒 | 最後の有効なバックアップまたはREDO受信以降の潜在的なデータ損失 |
| `SpaceUsedForRecoveryWindow` | GB | 現在のリカバリ・ウィンドウを満たす保存容量 |
| `ProtectedDatabaseSize` | GB | Recovery Serviceで保護するDatabase size |

Protected Database details pageはActive状態のHealthとData Loss Exposureを1分間隔で更新する。OCI Monitoringの`ProtectedDatabaseHealth`は30分間隔のMax、`DataLossExposure`は30分間隔のMeanとして公開されるため、画面表示とMonitoring queryの値を同じ更新粒度とみなさない。

次の事象をalarmとDatabase側の監視へ接続する。

- `ProtectedDatabaseHealth`が`Warning`または`Alert`へ変化
- `DataLossExposure`が要求RPOを超過
- RMAN backup failure
- REDO transport error
- Recovery Service subnetまたはprivate endpointへの到達失敗
- Protection PolicyまたはReal-Time Protectionの意図しない変更
- 保持容量の増加傾向

ZRCVはData Guard standbyではない。Databaseやsiteの障害後にバックアップから復旧するサービスであり、自動failoverと短いRTOが必要な場合はData Guardなどの可用性構成を併用する。

## References

- [About Oracle Database Autonomous Recovery Service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-recovery-service.html)
- [Recovery Service Terminology](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-concepts.html)
- [Real-time Data Protection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-real-time.html)
- [Onboarding Oracle Database to Recovery Service](https://docs.oracle.com/en-us/iaas/recovery-service/doc/getting-started-recovery-service.html)
- [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
- [Protecting On-premises Databases using Oracle Database Zero Data Loss Cloud Protect](https://docs.oracle.com/en-us/iaas/recovery-service/doc/protecting-premises-databases-using-recovery-service.html)
- [Security and Availability](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-backup-encryption.html)
- [Immutability and Anomaly Detection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-fault-tolerance.html)
- [Space-Efficient Encrypted Backup Lifecycle on Recovery Appliance](https://docs.oracle.com/en/engineered-systems/zero-data-loss-recovery-appliance/23.1/amagd/recovery-appliance-storage.html)
- [Data Encryption Techniques on Recovery Appliance](https://docs.oracle.com/en/engineered-systems/zero-data-loss-recovery-appliance/23.1/amagd/data-encryption-techniques.html)
- [Configuring Cloud Protect](https://www.bryangrenn.com/2025/10/configuring-cloud-protect.html)
