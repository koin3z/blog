---
title: Oracle Data Pump による Database 移行
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-data-pump
  - cloud/oracle/database/oracledb-data-pump
description: Oracle Data Pump の移行単位、構成変更、性能、整合性、暗号化、検証上の注意を整理する。
---

Oracle Data Pump は、Database のデータと metadata を dump file set へ export し、target Database へ import する論理データ移動ユーティリティ。行とオブジェクトを target 側で再作成するため、物理構成を保つ RMAN より変換自由度が高い。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## 向いている場面

- Database、Schema、table、tablespace の一部または全部を選択して移す。
- non-CDB から PDB、異なる Database バージョン、異なる OS / endianness へ移す。
- `REMAP_SCHEMA`、`REMAP_TABLESPACE`、`REMAP_TABLE`、`TRANSFORM` などで target 構成を変更する。
- 不要な Schema／object を除外し、Database を整理しながら移行する。
- OCI Database Migration や ZDM の論理移行で initial load として利用する。

大容量 Database、停止時間が極端に短い移行、物理構成をそのまま保持する移行では、Transportable Tablespaces、RMAN、Data Guard、GoldenGate と比較する。

## Export / Import の単位

| Mode | 主な用途 | 注意点 |
| --- | --- | --- |
| Full | Database 全体の論理移行 | Oracle 管理 Schema や物理ファイルを含む完全な recovery image ではない |
| Schema | Schema 単位の統合、分割、段階移行 | Schema 間依存、共通 user、権限、Database link を別途確認 |
| Table | table／partition 単位の選択移行 | FK、trigger、sequence、関連 object の包含範囲を確認 |
| Tablespace | 指定 tablespace 内の table を論理 unload / load | object が複数 tablespace にまたがる場合の扱いを確認 |
| Transportable | metadata は Data Pump、データは datafile を転送 | [[cloud/oracle/database/migration/oracledb-transportable-tablespaces\|Transportable Tablespaces]] の前提が適用される |

## 基本的な移行フロー

1. source と target の version、character set、timezone、option、data type、object 数、容量を評価する。
2. target の CDB / PDB、tablespace、TDE、user、quota、directory、network を準備する。
3. export の一貫性を保つ基準時点を決め、dump file と log を作成する。
4. dump file を Object Storage、File Storage、NFS などを介して target へ転送する。
5. metadata と data を import し、失敗 object を修正して再実行する。
6. object 数、row count、constraint、invalid object、statistics、権限、業務データを検証する。
7. アプリケーション更新を停止し、必要な最終差分を反映して接続先を切り替える。

Data Pump job は再接続、停止、再開が可能だが、実行中に dump file や master table を移動・削除しない。

## 停止時間とデータ整合性

オフライン論理移行では、export の基準時点以降に source が更新されないよう停止する。更新を続ける場合は、`FLASHBACK_SCN` または `FLASHBACK_TIME` で一貫した export 時点を定義し、その後の差分を GoldenGate などで適用する。

Data Pump 単独では export 開始後の変更を target へ継続反映しない。オンライン移行では次の組合せを使う。

1. GoldenGate capture を開始し、変更を保持する。
2. capture 開始後の一貫した SCN で Data Pump export / import を実行する。
3. initial load 後に GoldenGate Replicat で差分を適用する。
4. lag が収束したら更新を停止し、最終差分を確認して切り替える。

この流れは [[cloud/oracle/database/migration/oracledb-goldengate|Oracle GoldenGate によるオンライン移行]]、自動化は [[cloud/oracle/database/migration/oci-zero-downtime-migration|Oracle Zero Downtime Migration]] と [[cloud/oracle/database/migration/oci-database-migration-service|OCI Database Migration]] を参照。

## 性能を決める要素

- `PARALLEL` と `%U` を含む複数 dump file により worker を並列化する。
- Data Pump は可能な場合に direct path を使い、条件を満たさない object は external table または conventional path に切り替える。
- `COMPRESSION` は転送量を減らす一方、CPU、ライセンス、圧縮対象を確認する。
- `ESTIMATE_ONLY` または export estimate で dump 容量と所要時間の見積り材料を取得する。
- index、constraint、statistics の作成時間を data load と分けて測定する。
- `NETWORK_LINK` は dump file を作らず直接移行できるが、帯域、長時間接続、並列 metadata、障害時再開の制約がある。OCI Database Migration は小規模 Database 以外では Object Storage を推奨している。

`PARALLEL` の値だけを増やしても、source I/O、target CPU、PGA、dump file 数、Object Storage、network、index 作成が bottleneck なら短縮しない。本番相当データで測る。

## 構成変更

Data Pump は target で object を再作成するため、次を変更できる。

- Schema 名、tablespace、table 名
- storage 句、segment attribute、一部の DDL transform
- source / target の Database version と CDB / PDB 構成
- OS と endianness

ただし、すべての object と data type を任意に変換できるわけではない。source より古い release へ import する場合、`VERSION`、互換性、対象 object を確認する。11g から 12c 以降へ full / full transportable で移す場合など、明示的な `VERSION` 指定が必要な組合せがある。

## セキュリティと TDE

- dump file は server process が Database directory object の path へ書き込む。directory object の `READ` / `WRITE` を必要最小限にする。
- dump file を暗号化する場合、`ENCRYPTION`、`ENCRYPTION_MODE`、`ENCRYPTION_PASSWORD` と keystore の組合せを決める。
- password や認証 token を parfile、process list、log、Git へ残さない。
- target tablespace が TDE 暗号化されていれば、import された data block は target の暗号化方針に従う。dump file の暗号化とは別の制御。
- Object Storage へ置く dump file は bucket policy、retention、削除、監査を管理する。

TDE の詳細は [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]] を参照。

## Parfile の例

次は設計要素を示す最小例。対象 object、version、暗号化、FLASHBACK、exclude / include、network、resource plan を環境に合わせて追加する。

```text
DIRECTORY=DP_DIR
DUMPFILE=app_%U.dmp
LOGFILE=app_export.log
SCHEMAS=APP
PARALLEL=4
METRICS=YES
LOGTIME=ALL
```

認証情報は parfile に書かず、接続時に安全な方法で渡す。

## 検証

- process exit code `0`、`5`、`1` を区別し、`completed successfully with errors` を成功として扱わない。
- export / import log の `ORA-`、`UDI-`、skipped object、processing object type を確認する。
- `SQLFILE` で target に適用される DDL を事前確認する。
- Schema、table、partition、row、LOB、constraint、index、trigger、sequence、grant、synonym、Database link、scheduler job、directory、external file を比較する。
- invalid object を再コンパイルし、statistics、SQL plan、batch、アプリケーション性能を検証する。
- import の再実行で既存 object と衝突するため、`TABLE_EXISTS_ACTION` などの再実行方針を決める。

`FULL=YES` の export も、datafile、control file、SPFILE、online / archived REDO log を含む物理バックアップではない。バックアップ用途では [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照。

## 公式ドキュメント

- [Oracle Data Pump](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-data-pump.html)
- [Overview of Oracle Data Pump](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-data-pump-overview.html)
- [Starting Oracle Data Pump Export](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/starting-oracle-data-pump.export.html)
- [Oracle Data Pump Import](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-datapump-import-utility.html)
- [Overview of Oracle Data Pump（process exit codes を含む）](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-data-pump-overview.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
