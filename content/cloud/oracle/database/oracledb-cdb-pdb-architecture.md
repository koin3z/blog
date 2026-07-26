---
title: Oracle Database CDB／PDB アーキテクチャ
date: 2026-07-26
modified: 2026-07-26
draft: true
tags:
  - cloud/oci/database
aliases: []
description: Oracle Multitenant で instance、制御ファイル、REDO、datafile、UNDO、TDE keystore が共有または分離される境界を整理する。
---

Oracle Multitenant は、複数の Pluggable Database（PDB）を一つの Container Database（CDB）へ集約するアーキテクチャである。アプリケーションから見ると各 PDB は独立した Database に見えるが、OS から見ると CDB が一つの Database であり、PDB ごとの instance、control file、online REDO log は存在しない。

[Re:Q の解説記事](https://www.reqtc.com/blog/oracle-pdb-cdb.html)が使う「CDB は管理人、PDB は入居者」という捉え方は、集約の入口として分かりやすい。ただし、物理境界を理解するときは CDB と `CDB$ROOT` を区別し、ファイルごとに共有単位を確認する必要がある。

このメモでは、単一 instance の標準的な CDB を中心に、どの資源が CDB 全体で共有され、どのファイルが container ごとに分離されるのかを整理する。Application Container、Data Guard、PDB 移行の具体的な手順は範囲外とし、RAC は共有単位が変わる箇所だけ補足する。

## 先に結論：回復基盤は共有し、業務データのファイルは分離する

Doc: [Database System Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_dbfiles.html)、[Multitenant Container Database](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_cdb.html)、[Logical Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/logical-storage-structures.html)

PDB の独立性は、すべての物理資源を PDB ごとに複製することで実現しているわけではない。CDB は実行基盤と回復基盤を共有し、各 container は自分の表領域と datafile を持つ。UNDO と TDE keystore の境界だけは構成によって変わる。

![[oracledb-cdb-pdb-file-boundaries.png|CDB全体で共有されるDatabase instance、control file、online REDO log、SPFILEと、CDB$ROOT、PDB$SEED、各PDBが個別に持つdatafileとtempfileを色分けし、UNDOとTDE keystoreは構成依存であることを示す図|900]]

| 資源 | 物理的な作成・所有単位 | PDB 固有の実体 | 境界を理解する要点 |
| --- | --- | --- | --- |
| Database instance | instance 単位 | なし | 同じ instance で開く PDB は SGA と background process を共有する |
| PGA | server／background process 単位 | 常設の PDB 専用領域はなし | PGA 自体は共有メモリではないが、PDB の処理は同じ instance の process と PGA 予算を使う |
| Control file | CDB に一つの論理的な file set | なし | multiplex した複数コピーは同内容の冗長化であり、PDB 別の control file ではない |
| Online REDO log | CDB の REDO thread 単位 | なし | 複数 PDB の変更が同じ REDO stream に入る |
| Archived REDO log | REDO thread の archive 単位 | なし | CDB の外部 destination に置かれるが、内容は CDB-wide の REDO である |
| SPFILE／PFILE | CDB の instance 起動用に一つ | file はなし | 一部の parameter は PDB 固有値を持てるが、PDB 専用 SPFILE が作られるわけではない |
| Permanent datafile | container の tablespace 単位 | あり | `CDB$ROOT`、`PDB$SEED`、各 PDB がそれぞれ `SYSTEM`／`SYSAUX` と必要な user tablespace を持つ |
| Tempfile | container の temporary tablespace 単位 | あり | root、seed、各 PDB の一時領域は分かれる |
| Undo datafile | CDB の undo mode に依存 | local undo ならあり | local undo と shared undo を PDB ごとに混在させることはできない |
| Data dictionary | root と各 PDB に論理分散 | PDB 固有 metadata はあり | Oracle 提供の定義は root に一度だけ置き、PDB は自分の object metadata を持つ |
| TDE keystore | united／isolated mode に依存 | mode に依存 | united mode でも PDB ごとに TDE master key set は分かれる |
| Service | PDB に関連付ける論理単位 | あり | 接続先 container を分けるが、listener や instance まで PDB 専用になるわけではない |

> [!NOTE] 説明モデル
>
> CDB は「共有エンジンと回復履歴」、PDB は「分離された業務データのファイル集合」と捉えると全体像をつかみやすい。このモデルは設計の入口であり、UNDO、TDE、RAC の例外は個別に確認する。

## CDB と CDB$ROOT は同じものではない

Doc: [Introduction to the Multitenant Architecture](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/introduction-to-the-multitenant-architecture.html)

**CDB** は `CDB$ROOT`、`PDB$SEED`、通常の PDB、共有する control file と online REDO log を含む Database 全体である。OS は CDB を一つの Database として認識し、Database instance は CDB に関連付く。

**`CDB$ROOT`** は CDB 内の root container である。Oracle 提供の共通 metadata、common user、CDB 全体の管理情報を持つが、業務アプリケーションの user data を置く場所ではない。`CDB$ROOT` は PDB を動かす別の管理 process ではない。

**`PDB$SEED`** は新しい PDB のひな型となる読み取り専用の seed container である。通常の PDB と同様に固有の `SYSTEM`／`SYSAUX` datafile を持つが、業務 PDB として変更して使うものではない。

**通常の PDB** は schema、schema object、PDB 固有の data dictionary metadata、`SYSTEM`／`SYSAUX`／user tablespace の datafile、tempfile をまとめた管理単位である。アプリケーションは PDB に関連付けた service を介して接続し、session の current container が対象 PDB になる。

## CDB 全体で共有する基盤

### Control file：全 container の物理構造を一つの file set で追跡する

Doc: [Database System Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_dbfiles.html)、[Managing Control Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/managing-control-files.html)

一つの CDB には一つの論理的な control file があり、root、seed、全 PDB の datafile、REDO log group、checkpoint、log sequence など、CDB の物理構造と整合性を保つための情報を記録する。PDB は固有の control file を持たない。

可用性のために control file を複数の storage へ multiplex できるが、各 copy は同じ CDB の同じ情報を保持する。したがって「copy 1 は PDB A、copy 2 は PDB B」という分離ではない。すべての copy を失って CDB を mount できなくなれば、その CDB に属する全 PDB が影響を受ける。

PDB を unplug したときに作られる XML metadata file や archive file は、PDB を別 CDB へ plug するための記述であり、PDB 専用 control file ではない。

### Online／Archived REDO：複数 PDB の変更を一つの時系列へ集約する

Doc: [Physical Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/physical-storage-structures.html)、[Managing Archived Redo Log Files](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/managing-archived-redo-log-files.html)、[Oracle LogMiner Utility](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-logminer-utility.html)

PDB A と PDB B の transaction が生成した REDO record は、共有 SGA 内の REDO log buffer に集まり、LGWR が CDB の online REDO log へ書き込む。PDB ごとに online REDO log group が分かれるわけではない。

log switch が起きると、ARCH は満杯になった online REDO log を archived REDO log として保存する。このため、一つの archived REDO log file に複数 PDB の REDO record が含まれ得る。`ARCHIVELOG` mode や通常の archive destination も CDB の回復基盤であり、PDB 専用 archive file を生成する機能ではない。

![[oracledb-cdb-pdb-redo-flow.png|PDB AとPDB Bの更新が共有SGAのREDO log bufferへ集まり、LGWRによってCDB共通のonline REDO logへ書き込まれ、ARCHによってarchived REDO logになる。PDB回復時は共有REDOから対象PDBの記録を選び、対象PDBのdatafileへ適用する流れを示す図|900]]

REDO record には生成元 container を識別する情報があり、たとえば LogMiner は `SRC_CON_ID` で source PDB を示せる。PDB 単位の recovery は、物理 log file を PDB ごとに分けるのではなく、共有 REDO から対象 PDB に必要な変更を選び、対象 PDB の datafile へ適用することで成立する。

### Instance、SGA、background process：PDB 専用の runtime はない

Doc: [Database Instance](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_dbinstance.html)、[Program Global Area](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_pga.html)

単一 instance 構成では、CDB 内の全 PDB が一つの SGA と一組の background process を共有する。LGWR、DBWn、SMON などは PDB ごとに起動しない。PDB の open／close は container の状態変更であり、独立した instance の startup／shutdown ではない。

PGA は SGA のような共有領域ではなく、server process や background process ごとに割り当てられる。それでも PDB が専用 process 群を常設するわけではなく、複数 PDB の workload は同じ instance の process、CPU、I/O、PGA aggregate の制約下で動く。PDB 単位の resource limit は競合を制御する仕組みであり、物理 runtime の完全分離ではない。

### SPFILE：物理 file は共有し、許可された値だけ PDB ごとに上書きする

Doc: [Administering PDBs with SQL\*Plus](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/administering-pdbs-with-sql-plus.html)、[SPFILE](https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/SPFILE.html)

CDB の instance は一つの SPFILE または PFILE から起動し、PDB ごとの parameter file は持たない。`ISPDB_MODIFIABLE='TRUE'` の initialization parameter だけは PDB で固有値を設定でき、未設定の PDB は root の値を継承する。

SPFILE を使う場合、許可された PDB override は同じ SPFILE の管理情報として永続化される。これは「共有 file の中に PDB 固有値を保持できる」という hybrid な境界であり、PDB 専用 SPFILE が作られるという意味ではない。PFILE は PDB 固有値を保持できない。

## Container ごとに分離する datafile と tempfile

Doc: [Tablespaces](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_tablespaces.html)、[Database Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_datafiles.html)、[Data Dictionary and Dynamic Performance Views](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/data-dictionary-and-dynamic-performance-views.html)

`CDB$ROOT`、`PDB$SEED`、各 PDB は、それぞれ固有の permanent tablespace と datafile を持つ。各 PDB の file set には業務データ用の user tablespace だけでなく、PDB 自身の `SYSTEM` と `SYSAUX` も含まれる。一つの datafile が PDB A と PDB B の tablespace に同時に属することはない。

各 container は自分の default temporary tablespace と tempfile も持つ。RAC の用語にある shared temporary tablespace は instance 間で storage を共有する意味であり、異なる PDB が同じ temporary tablespace を所有するという意味ではない。

Data dictionary は完全共有でも完全複製でもない。Oracle が提供する dictionary definition や PL/SQL package は root に一度だけ保持され、各 PDB は内部 link を介して参照する。一方、local user、schema、table など PDB 固有 object の metadata は、その PDB の `SYSTEM`／`SYSAUX` に置かれる。

この datafile の分離が、PDB を clone、unplug／plug、backup、recovery の対象にできる土台になる。ただし、PDB を可搬にしても、共有する control file、REDO、instance への依存が消えるわけではない。

## 構成によって境界が変わるもの

### UNDO：local と shared のどちらかを CDB 全体で選ぶ

Doc: [Administering a CDB](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/administering-a-cdb-with-sql-plus.html)、[Creating and Configuring an Oracle Database](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/creating-and-configuring-an-oracle-database.html)

| Undo mode | 物理境界 | PDB 運用への影響 |
| --- | --- | --- |
| local undo | 各 container が固有の undo tablespace と datafile を持つ | PDB の hot clone、relocate、PDB 単位の Point-in-Time Recovery などを独立して扱いやすい |
| shared undo | 単一 instance CDB では一つの active undo tablespace を全 container が使う | PDB 単位の回復時に root の `SYSTEM`／`SYSAUX` や shared undo を auxiliary destination へ復元する場合がある |

Undo mode は CDB 全体の属性であり、PDB A だけ local、PDB B だけ shared という混在はできない。DBCA は local undo を既定にするが、`CREATE DATABASE` で undo clause を省略する作成経路は shared undo になるため、「常に local undo がデフォルト」とは扱わない。

### TDE keystore：鍵の論理分離と keystore の物理分離は別である

Doc: [Configuring United Mode](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/configuring-united-mode2.html)、[Configuring Isolated Mode](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/configuring-isolated-mode2.html)

| TDE mode | Keystore の境界 | Key の境界 |
| --- | --- | --- |
| united mode | root と united PDB が一つの keystore を共有する | 共有 keystore 内で各 PDB が固有の TDE master encryption key set を持つ |
| isolated mode | PDB が固有の keystore と password を持つ | key の管理も PDB 側へ分離する |

暗号化 PDB の datafile だけを移しても、復号に必要な key が移行先で利用できなければ open できない。したがって、datafile の所有境界と keystore／key の管理境界を別々に設計する必要がある。

### Resource Manager：共有資源の配分を論理的に制限する

Doc: [Managing Resources with Oracle Database Resource Manager](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/managing-resources-with-oracle-database-resource-manager.html)

CPU、parallel server、SGA 使用量、PGA aggregate、I/O などには PDB 単位の配分や上限を設定できる。ただし、上限を設定しても instance、SGA、background process、control file、REDO の物理的な所有境界は CDB のままである。Resource Manager は共有資源の干渉を抑える仕組みであり、PDB を別の障害 domain に変える仕組みではない。

## PDB 単位の recovery と共有基盤は両立する

Doc: [RECOVER](https://docs.oracle.com/en/database/oracle/oracle-database/26/rcmrf/RECOVER.html)、[Performing Flashback and Database Point-in-Time Recovery](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-performing-flashback-dbpitr.html)

PDB 単位の recovery では、RMAN が対象 PDB の datafile を restore し、CDB の archived REDO などから必要な変更を適用する。回復対象の datafile が PDB ごとに分かれ、REDO record の source container を識別できるため、共有 log を使いながら対象 PDB の状態だけを戻せる。

ただし、回復処理の入力まで PDB 専用になるわけではない。Control file、archived REDO、Flashback log、RMAN repository などの回復基盤は CDB に依存する。特に shared undo mode の PDB Point-in-Time Recovery では、root の `SYSTEM`／`SYSAUX` と shared undo を auxiliary destination へ復元して整合性を組み立てる場合がある。Local undo mode は、この依存を減らして PDB 単位の処理を行いやすくする。

> [!NOTE] 設計上の帰結
>
> 「PDB 単位で recovery できる」と「PDB が専用の REDO と control file を持つ」は同義ではない。回復の粒度は対象 datafile と container metadata で作られ、回復履歴の file は CDB で共有される。

## 障害と管理操作の影響範囲

| 事象・操作 | 主な影響範囲 | 理由 |
| --- | --- | --- |
| CDB instance の停止 | 同じ instance で開く全 PDB | PDB は専用 instance を持たない |
| Control file set の全損失 | CDB 全体 | CDB を mount する共有 metadata を失う |
| Online REDO の障害や log 管理 | CDB／REDO thread | REDO は PDB ではなく CDB の stream である |
| 特定 PDB の datafile 障害 | 主に対象 PDB | Permanent datafile は container ごとに分離される |
| PDB の open／close | 対象 PDB | container の open mode を変更し、instance 自体は停止しない |
| Oracle Home の binary patch と instance restart | 同じ Oracle Home／CDB の PDB | Multitenant は binary や instance を PDB ごとに複製しない |
| PDB clone、unplug／plug、PDB recovery | 対象 PDB が中心 | PDB 固有の file set と metadata を操作対象にできる |
| 一つの PDB の高負荷 | 同居 PDB に波及し得る | CPU、memory、I/O、background process を共有する |

PDB は論理的・管理的な分離境界であり、CDB は実行・回復・障害の共有境界でもある。強い障害分離や patch 時期の完全分離が必要なら、PDB を分けるだけでなく、CDB、Oracle Home、host、cluster、region のどの層まで分けるかを要件から決める。

## RAC では instance 単位が加わる

Doc: [Physical Storage Structures](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/physical-storage-structures.html)

RAC では一つの CDB を複数 instance が開き、各 instance が自分の SGA、background process、REDO thread を持つ。Shared undo mode の active undo tablespace も instance ごとになり、local undo mode では PDB が開く instance ごとに必要な local undo tablespace を持つ。

ここでも分離単位は PDB ではない。REDO thread が複数あっても、それは instance ごとの stream であり、PDB A 専用 thread、PDB B 専用 threadにはならない。Control file は全 RAC instance と全 PDB で共有する。

## ユーザーと接続の論理境界

Doc: [Users, Roles, and Objects in a Multitenant Environment](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/introduction-to-the-multitenant-architecture.html)、[Overview of the Oracle Net Listener](https://docs.oracle.com/en/database/oracle/oracle-database/26/netag/overview-oracle-net-listener.html)

Common user は root と PDB に共通する identity を持ち、local user は作成した PDB だけに存在する。同じ common user でも権限は container ごとに異なり得るため、identity の共有と privilege の scope は別に考える。

PDB に関連付けた service は client session の接続先 container を決める。一方、listener は instance の外で動く process であり、一つの listener が複数 PDB service や複数 CDB を受け付けられる。「service は PDB に紐付くが、listener は PDB 専用ではない」という境界である。

## 関連する深掘り

- [[cloud/oracle/database/migration/oracledb-pdb-migration|PDB clone、unplug／plug、relocate を使う移行]]
- [[cloud/oracle/database/backup/oci-oracledb-backup|CDB／PDB の backup と recovery]]
- [[cloud/oracle/database/security/oracledb-tde|PDB 移行時の TDE key と keystore]]
- Application Container と Application PDB による SaaS 向けの共通 metadata 管理
- Oracle Resource Manager による PDB 間の資源配分

## References

- [Database Instance, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_dbinstance.html)（2026-07-26 確認）
- [Database System Files, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbiad/db_dbfiles.html)（2026-07-26 確認）
- [Physical Storage Structures, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/physical-storage-structures.html)（2026-07-26 確認）
- [Logical Storage Structures, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/logical-storage-structures.html)（2026-07-26 確認）
- [Data Dictionary and Dynamic Performance Views, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/cncpt/data-dictionary-and-dynamic-performance-views.html)（2026-07-26 確認）
- [Administering a CDB with SQL\*Plus, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/administering-a-cdb-with-sql-plus.html)（2026-07-26 確認）
- [Administering PDBs with SQL\*Plus, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/multi/administering-pdbs-with-sql-plus.html)（2026-07-26 確認）
- [Managing Archived Redo Log Files, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/admin/managing-archived-redo-log-files.html)（2026-07-26 確認）
- [Performing Flashback and Database Point-in-Time Recovery, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/bradv/rman-performing-flashback-dbpitr.html)（2026-07-26 確認）
- [Configuring United Mode, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/configuring-united-mode2.html)（2026-07-26 確認）
- [Configuring Isolated Mode, Oracle AI Database 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbtde/configuring-isolated-mode2.html)（2026-07-26 確認）
- [いまさら遅い？Oracle Database のコンテナ技術, Re:Q](https://www.reqtc.com/blog/oracle-pdb-cdb.html)（2023-06-28 公開、概念導入の補足資料）
