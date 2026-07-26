---
title: OCI Oracle Database の RMAN バックアップ
date: 2026-07-15
modified: 2026-07-24
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup-rman
  - cloud/oracle/database/oci-oracledb-backup-rman
description: OCI Base Database Service で利用者管理の RMAN バックアップ、復元、物理移行を設計する際の要点。
---

**Recovery Manager**（RMAN）は、Oracle Database のデータファイルをコピーするだけのツールではない。RMAN は、バックアップの作成、復旧に必要なメタデータの記録、利用可能なバックアップの選択、ファイルの復元、REDO の適用を一つの復旧経路として管理する。

OCI Base Database Service では、Oracle Database Cloud Backup Module の SBT インターフェースを介して、利用者が管理する Object Storage バケットへ RMAN バックアップを送信できる。バックアップ方式全体の比較は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照する。

## RMAN の責任範囲

Doc: [Getting Started with RMAN](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/getting-started-rman.html)

RMAN の中心的な役割は、次の四つを関連付けることにある。

- **復旧対象**：datafile、archived REDO log、control file、SPFILE
- **バックアップ実体**：backup set、backup piece、image copy
- **復旧メタデータ**：DBID、SCN、checkpoint、database incarnation、保存先、バックアップ状態
- **復旧処理**：`RESTORE` でファイルを戻し、`RECOVER` で増分バックアップと REDO を適用する

RMAN は Database 外のすべてを保護するものではない。Oracle Home、ネットワーク構成、password file、block change tracking file などは RMAN `BACKUP` の対象外なので、再構築手順または別の構成バックアップが必要になる。

標準的な OCI Database の運用バックアップだけが目的なら、まずマネージド自動バックアップを評価する。利用者管理の RMAN は自由度が高い一方、保存先、認証、暗号化、保持、監視、削除、復旧試験まで利用者が管理する。

## 構成要素

Doc: [Configuring the RMAN Environment](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/configuring-rman-client-basic.html)

| 構成要素 | 役割 |
| --- | --- |
| RMAN client | コマンドを解釈し、target Database、Recovery Catalog、auxiliary Database への接続を調整する |
| Target Database | バックアップまたは復旧の対象となる Database |
| Channel | Database server session への接続であり、ファイルの読取り、backup piece の作成、保存先との I/O を実行する |
| RMAN repository | control file と、任意の Recovery Catalog に保存されるバックアップ・メタデータ |
| Media management layer | SBT を介して RMAN とテープ装置またはクラウド・バックアップ・モジュールを接続する |
| Backup destination | Disk、FRA、Object Storage など、バックアップ実体を保持する領域 |
| Auxiliary Database | `DUPLICATE`、standby 作成、表や PDB の時点復旧などで使う補助インスタンス |

RMAN channel は単なる論理的なキューではなく、Database server session として動く。並列度を上げると server session、Database I/O、CPU、ネットワーク、保存先への同時要求も増えるため、チャネル数だけを増やしても処理時間が比例して短くなるとは限らない。

## バックアップのデータ構造

Doc: [RMAN Backup Concepts](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-backup-concepts.html)

### Backup set と image copy

| 観点 | Backup set | Image copy |
| --- | --- | --- |
| 形式 | RMAN 固有形式 | 単一ファイルの物理的な完全コピー |
| 最小の物理ファイル | backup piece | datafile、control file、archived REDO log のコピー |
| 未使用ブロック | backup set の Level 0 または full では未使用ブロックを省略できる | datafile の全ブロックを保持する |
| 圧縮 | `AS COMPRESSED BACKUPSET` を利用できる | RMAN の backup set 圧縮は使わない |
| 複数ファイルの格納 | 一つの backup set に複数ファイルを格納できる | 一つの image copy は一つの元ファイルに対応する |
| 増分 Level 1 | 作成できる | Level 1 自体は image copy にできない |
| 主な保存先 | Disk または SBT | Disk |
| 復元 | backup piece から元ファイルを再構成する | コピーを戻すか、条件を満たせば `SWITCH` して直接使う |

**Backup set** は一つ以上の Database ファイルを論理的にまとめた単位で、**backup piece** は保存先に実際に作成されるバイナリ・ファイルである。一つの backup set が複数の backup piece に分かれることも、複数の入力ファイルが一つの backup piece に多重化されることもある。

OCI Object Storage へ SBT で送る対象は backup piece である。Object Storage の object 一覧だけでは、どの datafile、SCN、incarnation、暗号化方式に属するかを十分に判断できないため、RMAN repository と組み合わせて管理する。

### Full と Level 0 の違い

Backup set 形式の **full backup** と **incremental Level 0 backup** は、どちらも使用済みブロックを広く取得する。ただし、full backup は後続の Level 1 の基点にならず、Level 0 だけが増分戦略の親になる。

「毎週 full、毎日 Level 1」という表現では、Level 1 の基点が存在しない可能性がある。増分バックアップを使う場合は、基点を `BACKUP INCREMENTAL LEVEL 0` として明示する。

### Level 1 differential と cumulative

| 方式 | 変更ブロックの起点 | バックアップ量 | 復旧時に適用する増分 |
| --- | --- | --- | --- |
| Differential | 直近の Level 1 または Level 0 | 小さくなりやすい | Level 0 以降の複数 Level 1 が必要になりやすい |
| Cumulative | 直近の Level 0 | 日を追うほど大きくなりやすい | 目標時点に対応する一つの Level 1 で済みやすい |

Level 1 の既定は differential である。Differential はバックアップ時間と転送量を抑えやすく、cumulative は復旧時に読み込む増分の数を減らしやすい。選択基準はバックアップ時間だけではなく、要求 RTO、保存容量、Object Storage への転送量、復旧試験の実測値になる。

### Block Change Tracking

**Block Change Tracking**（BCT）は、各 datafile で変更されたブロックを追跡し、Level 1 の取得時に全ブロックを走査する処理を避ける。BCT は変更ブロックそのものを減らす機能ではなく、RMAN が変更ブロックを探すための読取りを減らす機能である。Level 0 は全使用済みブロックを対象にするため、BCT による走査短縮の対象ではない。

### Multisection backup

大きな一つの datafile が並列処理のボトルネックになる場合は、`SECTION SIZE` で datafile を連続したブロック範囲へ分け、複数 channel で同時に処理できる。チャネル数を増やしても datafile 数が少なければ並列性を使い切れないため、ファイル構成と `SECTION SIZE` を一緒に検討する。

一方、`FILESPERSET` と `MAXOPENFILES` は一つの backup piece へ複数 datafile のブロックを多重化する度合いに影響する。過度な多重化は復元時の読取り特性にも影響するため、バックアップの速度だけで調整しない。

## 復旧可能性を作る連鎖

Doc: [Performing Complete Database Recovery](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-complete-database-recovery.html)

Database の復旧には、datafile の基点、基点を進める増分と REDO、復旧経路を選ぶ repository、暗号化を解除する鍵が必要になる。いずれか一つを失うと、Object Storage に backup piece が残っていても目標時点へ復旧できない。

次の図は、バックアップ作成時のデータ経路と、復旧時に必要な情報が合流する関係を示す。

![[rman-recovery-chain.png|DatabaseファイルをRMANチャネルとSBTモジュールを介してObject Storageへ保存し、RMAN repositoryと暗号鍵を組み合わせてRESTOREとRECOVERを実行する流れ|820]]

### RESTORE と RECOVER

**RESTORE** は、backup set または image copy から datafile、control file、SPFILE などの物理ファイルを所定の場所へ戻す処理である。 **RECOVER** は、復元した datafile へ Level 1 incremental backup と archived REDO log を適用し、目標 SCN または時刻まで前進させる処理である。

新しい Level 0 を取得しても、それ以後の archived REDO log がなければ、Level 0 の時点より先へ進めない。反対に REDO が残っていても、適用を開始できる datafile backup がなければ復旧経路を構成できない。

### Complete recovery と point-in-time recovery

**Complete recovery** は、必要な archived REDO log と online REDO log が揃う範囲で、失われた datafile を最新のコミットまで進める。 **Point-in-time recovery**（PITR）は、誤操作や論理破損より前の SCN、時刻、ログ・シーケンスを目標にし、それより後の変更を捨てる不完全リカバリである。

Database 全体を PITR して `OPEN RESETLOGS` すると、新しい database incarnation が作成される。RMAN repository は incarnation の親子関係を保持し、どの RESETLOGS 分岐に属するバックアップかを識別する。

### Control file と SPFILE の autobackup

Control file autobackup は、既知の命名形式を使って control file と SPFILE を保存する。現在の control file、SPFILE、Recovery Catalog をすべて失った場合でも、DBID と autobackup の探索に必要な SBT 構成があれば、SPFILE、control file、datafile の順に復旧経路を再構成できる。

DBID は Database に接続できる平常時に記録し、バックアップと同じ障害で失わない場所へ保管する。 `DB_NAME` と `DB_UNIQUE_NAME` は構成識別に重要だが、control file autobackup の探索で `SET DBID` に使う値とは区別する。

## RMAN repository

Doc: [Maintaining RMAN Backups and Repository Records](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/maintaining-rman-backups.html)

RMAN は常に target Database の control file へバックアップ・メタデータを記録する。Recovery Catalog を使う場合は、control file の情報を catalog Database の表へ同期し、複数 Database と長期履歴を集中管理する。

Control file 内の一部の記録は循環利用され、`CONTROL_FILE_RECORD_KEEP_TIME` より古い記録が再利用の候補になる。保持中の backup piece より先に repository 記録が上書きされると、実体が残っていても RMAN から見えない孤立バックアップになる。Control file だけを repository にする場合は、保持期間、バックアップ頻度、control file の拡張余地、alert log の上書き警告を一緒に監視する。

Recovery Catalog はこの履歴消失リスクを減らし、stored script、複数 Database、Data Guard 環境のメタデータ管理を補助する。ただし、Catalog 自体も Database なので、Catalog のバックアップ、可用性、権限、バージョン、接続障害時の `NOCATALOG` 運用が必要になる。

## Object Storage へのデータ経路

Doc: [Back Up a Database to Object Storage Using RMAN](https://docs.oracle.com/en/cloud/paas/base-database/backup-rman/index.html)

Base Database Service から利用者管理の Object Storage へ送る基本経路は次のとおり。

1. DB システムから Object Storage へ到達するネットワークを用意する。同一リージョンでは Service Gateway が推奨される。
2. 専用の Object Storage bucket と、bucket に限定した IAM policy を用意する。
3. OCI の認証トークンを用意し、Oracle Database Cloud Backup Module を DB システムへ導入する。
4. RMAN の SBT channel から module library と構成ファイルを参照する。
5. RMAN channel が作成した暗号化済み backup piece を、SBT module が Object Storage へ送信する。
6. RMAN repository に backup set、backup piece、SCN、保存先、状態を記録する。

`dbcli` の Object Storage バックアップは、backup module を直接構成して RMAN を実行する方法の代替になる。どちらも非管理バックアップであり、利用者が bucket と復旧手順を管理する点は同じである。

> [!warning] 認証情報
>
> 認証トークン、パスワード、wallet、keystore、backup module の資格情報をスクリプト、ログ、Git、シェル履歴へ残さない。IAM policy は専用 bucket に限定し、管理者 group への追加で代用しない。

## 暗号化と鍵

Doc: [Configuring RMAN Backup Encryption](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/configuring-rman-client-advanced.html)

OCI Object Storage へ Cloud Backup Module で送る RMAN backup は暗号化が必須である。暗号化された datafile をバックアップすることと、backup set 自体を暗号化することは別の層なので、復元時に何を用意するかを暗号化方式ごとに確認する。

| Backup 暗号化方式 | 復号に使うもの | 主な性質 |
| --- | --- | --- |
| Transparent mode | Oracle keystore | keystore が利用できれば RMAN が透過的に復号する |
| Password mode | 作成時の password | keystore を必要としないが、password を失うと復元できない |
| Dual mode | Oracle keystore または password | 通常は keystore、別サイトでは password という二つの復号経路を持てる |

Password mode の設定は RMAN session を越えて永続化されない。ジョブごとに安全な secret 取得経路から設定し、コマンド・ファイルへ平文で固定しない。

TDE で暗号化された tablespace を media recovery する場合は、対応する TDE keystore と master key も必要になる。Backup 暗号化 password、TDE keystore、keystore password、OCI 認証トークンは役割が異なるため、一つの「バックアップ用パスワード」として混同しない。

## 保持と削除

Doc: [Configuring the RMAN Environment](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/configuring-rman-client-basic.html)

**Retention policy** は、どのバックアップを復旧要件のために残す必要があるかを RMAN が判断する規則である。 `RECOVERY WINDOW OF n DAYS` は直近 n 日間の任意時点へ復旧するために必要な Level 0、Level 1、control file、archived REDO log を保持対象として評価する。ポリシーを設定しただけでは、obsolete になったバックアップは自動削除されない。

| 状態または判定 | 意味 | 代表操作 |
| --- | --- | --- |
| `AVAILABLE` | Repository が保存先で利用可能と認識している | `LIST BACKUP` |
| `EXPIRED` | `CROSSCHECK` で実体を確認できなかった | 原因確認後に `DELETE EXPIRED` |
| `OBSOLETE` | Retention policy を満たすために不要と判定された | `REPORT OBSOLETE`、`DELETE OBSOLETE` |
| `DELETED` | RMAN が削除済みとして repository を更新した | `LIST` や repository view で履歴を確認 |

`EXPIRED` は「古い」、`OBSOLETE` は「存在しない」という意味ではない。前者は repository と実体の不一致、後者は復旧ポリシー上の不要判定である。

Object Storage の lifecycle rule だけで backup piece を削除すると、RMAN repository は実体が消えたことを認識しない。削除は原則として RMAN の `DELETE` から SBT module へ指示し、repository と保存先を同時に更新する。

通常の recovery window を越えて保持する監査用または節目用バックアップは、`KEEP` と依存する archived REDO log、control file、暗号鍵の保管期間を一体で設計する。長期 backup piece だけを残しても、復旧に必要なメタデータと鍵が失われれば利用できない。

### Archived REDO log deletion policy

Archived REDO log のローカル削除条件は、backup の保持条件とは別に設計する。 `BACKED UP n TIMES TO DEVICE TYPE SBT`、Data Guard standby への適用条件、FRA 容量を組み合わせ、SBT への一回の転送失敗がローカル REDO の早期削除につながらないようにする。

`PLUS ARCHIVELOG` を日次 datafile backup だけで実行すると、archived REDO log の外部保護間隔も日次になり得る。要求 RPO が短い場合は、archived REDO log を別ジョブでより頻繁に取得する。

### Backup optimization

`CONFIGURE BACKUP OPTIMIZATION ON` は、同一と判定できるファイルが同じ device type に十分な数だけ存在する場合に再取得を省略する。「前回のジョブが成功したから常にスキップする」単純なキャッシュではなく、DBID、checkpoint SCN、RESETLOGS 情報、retention policy、copy 数などを考慮する。長期保管や複数 copy の要件がある場合は、最適化によって意図した copy が作られたかを `LIST` と復旧試験で確認する。

## 性能設計

RMAN の処理時間は、Database の読取り、ブロック選別、圧縮と暗号化の CPU、SBT module、VCN、Object Storage、復元先の書込みのうち、最も遅い区間に制約される。

- **Channel parallelism**：複数 server session で同時処理する。CPU、I/O、network、保存先の上限も同時に消費する。
- **Section size**：一つの大きな datafile を複数 channel へ分割する。
- **Compression**：転送量と保存量を減らす代わりに CPU を使う。`BASIC` 以外の algorithm は利用ライセンスも確認する。
- **Encryption**：CPU と鍵管理を追加する。Object Storage backup では無効化できない前提で測定する。
- **Multiplexing**：複数 datafile のブロックを一つの piece へ混在させる。backup と restore の双方で測定する。
- **Piece size**：保存先や media manager の制約、再送単位、並列性に影響する。

本番への影響はバックアップ所要時間だけでは判断できない。Database の read latency、CPU、待機イベント、archived REDO 生成量、SBT throughput、Object Storage error、復元 throughput を同じ試験で測定する。

## 構成例の読み方

次の例は、設計要素の関係を示す最小例であり、SBT channel、暗号化資格情報、圧縮、並列度、通知を含む完成した手順ではない。

```sql
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 35 DAYS;
CONFIGURE BACKUP OPTIMIZATION ON;

BACKUP INCREMENTAL LEVEL 0 SECTION SIZE 512M DATABASE PLUS ARCHIVELOG;
BACKUP INCREMENTAL LEVEL 1 SECTION SIZE 512M DATABASE PLUS ARCHIVELOG;
BACKUP ARCHIVELOG ALL NOT BACKED UP 2 TIMES;
```

`NOT BACKED UP 2 TIMES` は copy 数の意図を示すが、実際の削除条件、device type、retention policy、利用可能な Object Storage copy を別途確認する。固定した `SECTION SIZE 512M` がすべての Database に適するわけではなく、datafile size、channel 数、CPU、SBT throughput から調整する。

## 復旧手順の依存関係

Doc: [Recover a Database from Object Storage Using RMAN Backup](https://docs.oracle.com/en/cloud/paas/base-database/recover-rman/index.html)

Object Storage 上の RMAN backup から別の DB システムへ復旧する場合は、次の順に依存関係を再構成する。

1. 互換性のある Database Home、Oracle SID、password file、listener、DATA／RECO／REDO storage を準備する。
2. Oracle Database Cloud Backup Module、Object Storage endpoint、認証、SBT channel を再構成する。
3. Backup 暗号化 password または keystore と、TDE keystore を利用可能にする。
4. DBID を指定し、必要なら SPFILE autobackup を復元して instance を `NOMOUNT` で起動する。
5. Control file を復元して Database を `MOUNT` し、RMAN repository を利用可能にする。
6. `RESTORE ... PREVIEW` または `RESTORE ... VALIDATE` で必要な backup piece と archived REDO log を確認する。
7. Datafile を `RESTORE` し、Level 1 と archived REDO log で `RECOVER` する。
8. Complete recovery なら通常 open、PITR なら復旧点を確認して `OPEN RESETLOGS` する。
9. CDB／PDB、TDE、service、application 接続、外部システムとの整合性を確認する。

復旧先では元 Database の次の情報が必要になる。

- DBID、DB_NAME、必要に応じて DB_UNIQUE_NAME
- Database version、RU、edition、COMPATIBLE、platform、endianness
- RAC、CDB／PDB、database incarnation、RESETLOGS 履歴
- SPFILE、control file、datafile、archived REDO log の backup
- ASM disk group、OMF、file name conversion、DATA／RECO／REDO 配置
- Backup 暗号化 password、Oracle keystore、TDE master key
- Backup module、Object Storage bucket、endpoint、認証方式

最後に保護された archived REDO log より後の更新は復旧できない。バックアップ・ジョブの成功時刻ではなく、最後に復旧へ使える archived REDO sequence、SCN、時刻を RPO の根拠にする。

## 検証の段階

Doc: [Validating Database Files and Backups](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/validating-database-files-backups.html)

| 検証 | 確認するもの | 確認できないもの |
| --- | --- | --- |
| `CROSSCHECK` | Repository の記録に対応する disk file または SBT object の存在 | 全ブロックの可読性、復旧手順、RTO |
| `RESTORE ... PREVIEW` | Repository 上で選択される backup と必要 SCN | Backup piece の内容が読めること |
| `RESTORE ... VALIDATE HEADER` | 必要 backup の一覧と header の対応 | 全内容の可読性 |
| `VALIDATE BACKUPSET` | 指定した backup set の内容 | RMAN が実際の restore で別の set を選ぶ経路 |
| `RESTORE ... VALIDATE` | RMAN が選択する backup を読み、対象を restore できること | 新しい host での構成再現、Database open、application 接続 |
| 別 DB システムへの restore drill | 認証、鍵、repository、storage、restore、recover、open、RTO の連鎖 | 次回も同じ条件で成功する保証 |

`VALIDATE CHECK LOGICAL` は、物理破損検査を通過した data block と index block の論理的な整合も検査する。検出結果は `V$DATABASE_BLOCK_CORRUPTION` とジョブ・ログで追跡する。

最終的な復旧可能性は、Object Storage の object 存在確認ではなく、隔離した DB システムでの restore、recover、open、PDB open、TDE、application 接続までの試験で確認する。試験では開始から業務再開判定までを計測し、データ転送時間だけを RTO としない。

## 監視

- RMAN job の開始、終了、status、入力 bytes、出力 bytes、throughput
- Level 0 と Level 1 の最終成功、次回 Level 0 までの依存 chain
- Archived REDO log の最終保護 sequence、SCN、時刻、thread ごとの欠落
- Control file と SPFILE autobackup の最終成功
- SBT channel error、Cloud Backup Module log、Object Storage request error
- 認証トークン、keystore、証明書、資格情報の有効期限
- Repository record の上書き警告、Catalog resync、`CROSSCHECK` 差異
- Recovery window を満たす backup chain と、`REPORT OBSOLETE` の変化
- Database I/O、CPU、network、Object Storage throughput
- Restore validation と restore drill の最終成功、実測 RTO

## 物理移行での利用

Doc: [RMAN DUPLICATE](https://docs.oracle.com/en/database/oracle/oracle-database/26/rcmrf/DUPLICATE.html)

RMAN は backup／restore、active duplicate、restore from service により、source Database の物理構造を target へ複製できる。

| 方式 | 初期データの経路 | 事前 backup | 主な用途 |
| --- | --- | --- | --- |
| Active database duplication | Source から auxiliary へ network 転送 | 不要 | 稼働中 source から直接複製 |
| Backup-based duplication | 既存 backup set と archived REDO log | 必要 | Object Storage や共有保存先を介した複製 |
| Standby duplication | Active または backup-based | 方式による | Data Guard standby の初期化 |

Source Database を online のまま複製しても、application cutover まで差分を自動同期し続けるとは限らない。低停止の移行では [[cloud/oracle/database/migration/oracledb-data-guard|Data Guard]] で REDO を同期するか、[[cloud/oracle/database/migration/oci-zero-downtime-migration|ZDM]] の physical online migration を使う。

RMAN の物理移行は datafile block を保持するため、platform、endianness、Database version、edition、CDB／PDB、storage、TDE の互換性制約が強い。Schema 名、table 構造、character set、non-CDB／PDB を自由に変換する方式ではない。

異なる endian や tablespace 単位の移行では RMAN `CONVERT` と [[cloud/oracle/database/migration/oracledb-transportable-tablespaces|Transportable Tablespaces]]、論理変換では [[cloud/oracle/database/migration/oracledb-data-pump|Data Pump]] を検討する。RMAN で技術的に複製できることと、OCI Database Service がその作成手順を support することは別なので、ZDM または OCI の公式 migration workflow を優先する。

## マネージド自動バックアップとの関係

Doc: [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)

OCI のマネージド自動バックアップは内部で RMAN を利用する。自動化が管理する RMAN configuration、retention、archived REDO log deletion policy を標準 RMAN command で変更すると、マネージド・バックアップと復旧の前提を壊す可能性がある。

`RMAN` または `dbcli` の非管理バックアップから Console／API のマネージド方式へ切り替えると、新しいバックアップ構成が Database に関連付けられる。旧方式が継続すると仮定せず、切替前に復旧元、保持、ジョブ停止、archived REDO log の削除条件、repository の所有者を整理する。

## 関連する深掘り

- Incrementally updated image copy と `RECOVER COPY`
- Data Guard 環境での backup association と `DB_UNIQUE_NAME`
- CDB／PDB 単位の restore、PITR、preplugin backup
- Block media recovery と `V$DATABASE_BLOCK_CORRUPTION`
- Recovery Catalog の schema、resync、virtual private catalog
- RMAN compression algorithm とライセンス

## 公式ドキュメント

- [Back Up a Database to Object Storage Using RMAN](https://docs.oracle.com/en/cloud/paas/base-database/backup-rman/index.html)
- [Recover a Database from Object Storage Using RMAN Backup](https://docs.oracle.com/en/cloud/paas/base-database/recover-rman/index.html)
- [Back Up and Recovery in Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/backup-recover/index.html)
- [Oracle AI Database Backup and Recovery User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/)
- [RMAN Backup Concepts](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-backup-concepts.html)
- [Configuring the RMAN Environment](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/configuring-rman-client-basic.html)
- [Maintaining RMAN Backups and Repository Records](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/maintaining-rman-backups.html)
- [Performing Complete Database Recovery](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-complete-database-recovery.html)
- [Validating Database Files and Backups](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/validating-database-files-backups.html)
- [RMAN DUPLICATE](https://docs.oracle.com/en/database/oracle/oracle-database/26/rcmrf/DUPLICATE.html)
