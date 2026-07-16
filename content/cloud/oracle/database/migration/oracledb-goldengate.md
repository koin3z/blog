---
title: Oracle GoldenGate によるオンライン移行
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oracledb-goldengate
  - cloud/oracle/database/oracledb-goldengate
description: GoldenGate の初期ロード、差分同期、cutover、双方向同期、制約、検証を整理する。
---

Oracle GoldenGate は、source Database の transaction log から変更を取得し、target Database へ論理的に適用する Change Data Capture（CDC）製品。移行では initial load 後の差分を継続同期し、アプリケーション切替時の停止を短縮する。

移行方式全体の比較は [[cloud/oracle/database/migration/oci-oracledb-migration|OCI Oracle Database 移行概要]] を参照。

## 構成要素

```text
Source Database
  └─ Extract ─> Trail ─> Distribution Path ─> Trail ─> Replicat
                                                        └─ Target Database
```

- **Extract**：source redo / archive log から対象 transaction を capture する。
- **Trail**：capture した変更を GoldenGate の中間形式で保持する。
- **Distribution Path**：source から target の Receiver Service へ trail を転送する。
- **Replicat**：target へ DML / DDL を適用する。
- **Checkpoint**：capture / apply の位置を記録し、再開時の整合性を維持する。

GoldenGate は非同期レプリケーション。lag と転送停止中の trail 容量を監視し、同期状態を確認してから切り替える。

## 向いている場面

- source の更新を継続しながら target を作り、停止時間を極小化する。
- Database、Schema、table、partition など object 単位で段階移行する。
- Database version、OS、endianness、CDB / PDB、Schema 構成が異なる論理移行を行う。
- initial load は Data Pump、RMAN、Transportable Tablespaces で高速化し、GoldenGate は差分同期に使う。
- 切替後に reverse replication を維持し、一定期間の fallback を準備する。

すべての object / data type / DDL を無条件に複製できるわけではない。移行前に support matrix と assessment を実施する。

## オンライン移行の流れ

1. source / target の object、data type、key、DDL、transaction、version を評価する。
2. archive log、force logging、supplemental logging、GoldenGate user と権限を準備する。
3. Extract を登録・開始し、initial load 開始後の変更を trail に保持する。
4. Data Pump などで一貫した SCN の initial data を target へ移す。
5. initial load の基準 SCN から Replicat を開始し、差分を適用する。
6. capture / apply lag、discard、error、row count、data comparison を確認する。
7. source の更新を停止し、長時間 transaction を完了または中断する。
8. target が最終 source SCN まで追従したことを確認し、アプリケーション接続を切り替える。
9. 必要に応じて reverse replication を開始し、fallback 期間を維持する。

initial load の詳細は [[cloud/oracle/database/migration/oracledb-data-pump|Oracle Data Pump による Database 移行]] を参照。

## Initial load

GoldenGate の CDC は変更分を運ぶ機能であり、既存 Database 全量を最も速く移す方式とは限らない。target の initial load には次を選べる。

| Initial load | 向く場面 | 注意点 |
| --- | --- | --- |
| Data Pump | 論理変換、Schema／table 選択 | export SCN と capture / apply SCN を合わせる |
| GoldenGate Initial Load | 小規模 table、変換を伴う初期化 | 大容量 Database では Data Pump / RMAN と比較する |
| RMAN / Data Guard split | 同種構成の大容量 Database | target を論理 apply へ移行できる構成か確認 |
| Transportable Tablespaces | 大容量 user tablespace | metadata と datafile、増分同期の整合を管理する |

Oracle GoldenGate の precise instantiation では、Extract registration SCN、oldest open transaction、instantiation SCN、Replicat 開始位置の関係を正しく保つ。SCN がずれると transaction の欠損または重複につながる。

## 対象 object と key

- table に primary key または一意な識別列があると、Replicat が target row を効率的かつ一意に特定できる。
- key がない table は全列比較や substitute key が必要になり、性能と一意性に影響する。
- supplemental logging を対象 table / column に合わせて構成する。
- LOB、XML、spatial、user-defined type、compressed object、partition、sequence、materialized view、DDL の対応を version ごとに確認する。
- `NOLOGGING` / direct path、bulk load、Database option 固有の操作が capture 対象になるか検証する。
- target-only trigger、scheduler job、constraint が Replicat と競合しないよう制御する。

## DDL と移行中の変更

DDL replication を有効にしても、すべての DDL と edition / version 差を自動変換できるわけではない。移行期間中の Schema change を凍結するか、許可する DDL と適用手順を定める。

initial load 中に constraint や table 定義を変更すると、Data Pump と GoldenGate の target 定義がずれる。OCI Database Migration でも、Data Pump Export 中の constraint DDL に制約がある。

## Cutover

cutover では単に lag が `0` に見えることだけでなく、次を確認する。

- source への新規 write が停止している。
- open transaction と batch が完了または明示的に中断されている。
- Extract が source の最終 commit を capture 済み。
- trail が target へ転送済み。
- Replicat が最終 checkpoint まで apply 済みで error / discard がない。
- target の sequence、scheduler、trigger、service、read / write role が切替状態になっている。
- row count と重要データの比較が完了している。

アプリケーションの DNS、connection pool、transaction retry、cache、message queue、外部連携も同じ runbook で切り替える。

## 双方向同期と fallback

GoldenGate は bidirectional / active-active replication を構成できるが、同じ row を両側から更新すると conflict が発生する。parallel run や fallback のために双方向化する場合は次を設計する。

- loop detection と transaction origin
- primary key と key collision
- insert / update / delete conflict の detection / resolution
- sequence range、identity、timestamp、clock skew
- DDL の所有側と適用方向
- 切替前後に write 可能な Database を 1 つに限定する fencing

「reverse replication を構成した」だけでは安全な fallback にならない。target で発生した全変更が source へ戻り、source application がその Schema / data を処理できることを試験する。

## 監視と検証

- Extract / Replicat status、checkpoint、lag、trail disk usage、network
- long-running transaction、archive log retention、LogMiner / integrated capture health
- apply error、discard file、collision 処理、abended process
- source / target row count、checksum、business key、LOB、aggregate
- DDL、grant、sequence、scheduler、trigger、invalid object
- target SQL performance、index、statistics、batch、application transaction

GoldenGate Veridata などの data comparison を使う場合も、比較対象、許容差、修復方針を決める。

## OCI GoldenGate と自己管理型

- **OCI GoldenGate**：deployment、patching、scaling、monitoring を OCI service として管理する。
- **自己管理型 GoldenGate**：host、software、patch、HA、trail、monitoring を利用者が管理する。
- **ZDM / OCI Database Migration**：移行期間中の GoldenGate 構成をオーケストレーションする。

操作性だけでなく、接続可能な source / target、GoldenGate version、plugin、network、private endpoint、ライセンス、移行後も CDC を継続するかで選ぶ。

## ライセンス

GoldenGate の製品ライセンス、OCI GoldenGate の service charge、ZDM / OCI Database Migration の移行用途に適用される条件は異なる。無償期間や移行用途の特例は変更され得るため、source / target、利用期間、移行後の継続利用を含めて最新条件を確認する。

## 公式ドキュメント

- [Oracle GoldenGate Microservices Architecture Documentation](https://docs.oracle.com/en/middleware/goldengate/core/23/coredoc/)
- [Precise Instantiation for Oracle](https://docs.oracle.com/en/middleware/goldengate/core/23/coredoc/instantiate-precise-instantiation-oracle.html)
- [Initial Load Extract](https://docs.oracle.com/en/middleware/goldengate/core/23/coredoc/instantiate-add-initial-load-extract-using-admin-client.html)
- [Bidirectional Replication Using Active-Active Configuration](https://docs.oracle.com/en/middleware/goldengate/core/23/ggsol/active-active.html)
- [Oracle Database Objects and Operations Support](https://docs.oracle.com/en/middleware/goldengate/core/23/coredoc/reference-oracle-details-support-objects-and-operations-oracle-dml.html)

## 補足資料

- [Oracle AI Databaseのアップグレードと移行](https://speakerdeck.com/oracle4engineer/oracle-database-upgrade-migration-jp)
