---
title: Apache Iceberg
date: 2026-07-22
modified: 2026-07-22
draft: false
tags:
  - data/platform
  - data/lakehouse
aliases: []
description: Apache Icebergのcatalog、metadata、snapshot、manifest、commitと、複数エンジンで共有する際の運用境界を整理する。
---

← [[data/open-table-formats|オープンテーブルフォーマット]]

## 概要

Doc: [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)

- Apache Icebergは、大規模な分析データ向けのオープンテーブルフォーマット
- Netflixで、巨大なHive tableをクラウドストレージ上で安全かつ効率的に管理するために開発され、2018年にApache Incubatorへ寄贈された
- Parquetなどのデータファイルを置き換える形式ではない
  - catalog、table metadata、snapshot、manifestで、どのデータファイルが表を構成するかを管理する
- readerはディレクトリ内の全ファイルではなく、選択したsnapshotから到達できるファイルだけを読む
- writerはデータとmetadataを先に書き、最後にcatalogへcurrent metadataの原子的な切替を要求する
  - 選択したcatalogまたはcommit schemeがcompare-and-swapかatomic renameを正しく提供することが前提になる
  - 読み手からは更新前または更新後の状態だけが見える

## 責任範囲

| Icebergが定義するもの     | Icebergだけでは定義しないもの             |
| ------------------------- | ----------------------------------------- |
| table schemaとfield ID    | SQLの完全な方言                           |
| partition specとtransform | 実行用のCPU、memory、cluster              |
| sort order                | table ownerとbusiness glossary            |
| snapshotとtable history   | 組織全体のRBACとIAM設計                   |
| data／delete fileの所属   | 任意の複数table transaction               |
| file-level metrics        | backupと別障害domainへの複製              |
| commitと競合検証の規則    | small fileや古いsnapshotの自動maintenance |

Iceberg tableを利用するには、storage、catalog、FileIO、実行engineを組み合わせる。
マネージド製品はこれらを一体化する場合があるが、テーブル形式と製品の責任を分けて確認する。

## メタデータ構造

Spec: [Apache Iceberg specification](https://iceberg.apache.org/spec/)

```text
table identifier
└── catalog／commit coordinator
    └── current table metadata JSON
        └── selected snapshot
            └── manifest list
                └── manifest files
                    ├── data files
                    └── delete files／deletion vectors
```

table identifierからdata fileへ到達するには、catalogからmanifest filesまでを1段ずつ経由する必要があり、途中の段を飛ばして直接ファイル集合を特定することはできない。

![[attachments/iceberg-metadata-hierarchy.png|560]]

### Catalog

- `catalog.namespace.table`のようなtable identifierを解決する入口
- namespaceとtableの作成、load、rename、drop、commitを扱う
- Hive Metastore、JDBC、AWS Glue、Nessie、REST Catalogなどの実装がある
- metastore型のcatalogは、table名からcurrent metadata fileのlocationを引き、commit時にmetadata pointerをcompare-and-swapする
- HadoopCatalogは、warehouse内のpathとversion fileを使うため、すべての実装が同じ形でRDBMS上のpointerを保持するわけではない

Catalogはデータ行を保存しない。
ただし、実装によっては認可、credential vending、監査などを追加する。

### Table metadata

- JSON fileとして保存する
- 主に次の状態を持つ
  - table UUIDとlocation
  - schema一覧とcurrent schema ID
  - partition spec一覧とdefault spec ID
  - sort order一覧とdefault sort order ID
  - table property
  - snapshot一覧と`current-snapshot-id`
  - snapshot log、metadata log、branch／tagのref
- table metadataを変更するたびに新しいmetadata JSONを作り、古いfileをその場で上書きしない
- schemaやpropertyだけを変更した場合、新しいmetadata JSONを作っても新しいsnapshotを必ず作るわけではない

### Snapshot

- ある時点のtable stateを表すtable metadata内のrecord
- `snapshot-id`と作成時刻を持ち、format versionに応じてsequence number、operation summary、manifest list locationなどを持つ
- 親snapshotとschema IDはoptional fieldとして持ち得る
- data全体のcopyではなく、manifestとdata fileを他のsnapshotと共有できる参照状態
- 一般的な`metadata/snap-<id>.avro`はsnapshot本体ではなくmanifest list

### Manifest list

- 1つのsnapshotが参照するmanifest fileの一覧をAvroで保持する
- manifest path、content種別、partition spec ID、sequence number、file件数、partition範囲のsummaryを持つ
- readerはpartition summaryを使い、関係しないmanifestを開く前に除外する
- commit retryでは既存manifestを再利用し、manifest listだけを書き直せる場合がある

### Manifest

- data fileまたはdelete fileの集合を記録する不変のAvro file
- 各entryに次の情報を持つ
  - file pathとfile format
  - partition tuple
  - record countとfile size
  - 列ごとのlower／upper bound、null countなどのmetrics
  - `ADDED`、`EXISTING`、`DELETED`のstatus
  - snapshot IDとsequence number
    - 省略された値をmanifest metadataから継承する場合がある
- 1つのmanifestは1つのpartition specだけを使う
- 1つのpartition専用でも1つのsnapshot専用でもなく、複数partitionを含み、snapshot間で再利用され得る

### Data fileとdelete

- data fileは行を保持する不変file
  - Parquetが一般的で、Iceberg specificationはAvroとORCも扱う
- format v2はrow-level deleteのためにposition deleteとequality deleteを定義する
  - position deleteはdata file pathとrow positionで対象を示す
  - equality deleteは指定fieldの値で対象を示す
- format v3はdeletion vectorなどを追加する
- Copy-on-writeでは変更対象を含むdata fileを置換する
- Merge-on-readでは元のdata fileにdeleteを重ね、readerまたはcompactionが適用する

Table format versionと実行engineの対応は別である。
Tableを新しいformat versionへ上げる前に、すべてのreaderとwriterが必要なfeatureを解釈できるか確認する。

## 読み取り

1. Readerがcatalogへtable identifierを渡し、current metadataをloadする
2. `current-snapshot-id`、branch／tag、snapshot ID、時刻から読むsnapshotを決める
   - 時刻指定では、過去にcurrentだったsnapshotを記録する`snapshot-log`を使う
3. Manifest listのpartition summaryから不要なmanifestを除外する
4. Manifestのpartition tupleとcolumn metricsから不要なdata／delete fileを除外する
5. 残ったdata fileを読み、適用対象のdeleteを反映する
6. 元のrow filterを評価して結果を返す

Readerは手順1で得たmetadataを基準にscanを計画する。
その後に別writerがcommitしても、同じreaderが途中で新旧metadataを混ぜなければ、選択済みsnapshotは変わらない。

Manifest pruningとfile pruningは、該当しないfileを安全に除外する。
条件に一致する可能性が残るfileでは、data rowのfilter評価が必要であり、metadata statisticsがrow-level indexを代替するわけではない。

## Commit

Spec: [Optimistic concurrency](https://iceberg.apache.org/spec/#optimistic-concurrency)

1. Writerがcurrent table metadataを読み、base versionを固定する
2. 新しいdata fileまたはdelete fileを一意なpathへ書く
3. 必要なmanifest、manifest list、新しいtable metadata JSONを作る
4. Catalogへ、base metadataがまだcurrentであることを条件に、新metadataへの切替を要求する
5. Compare-and-swapに成功した場合だけ、新しいtable stateがcurrentになる
6. 他writerが先にcommitしていた場合、切替は失敗し、writerは新しいcurrent stateに対して競合を検証する
7. 変更を安全に再適用できる場合はrebaseしてretryし、意味が変わる競合なら失敗を返す

Atomicなのは、table metadataの切替と、そこから到達できるfile集合の論理的な公開である。
事前に書いたfile群を1つのstorage transactionで保存するわけではない。

CAS(compare-and-swap)が失敗するのは、base versionを固定した後に他のwriterが先にcommitした場合である。

![[attachments/iceberg-commit-flow.png|780]]

### 競合の扱い

- Appendは、他writerのappend後にも新しいsnapshotへ再適用できる場合が多い
- Rewriteとcompactionは、置換対象fileがcurrent stateに残っているか検証する
- Deleteとoverwriteの競合検証は、operationとisolation levelに依存する
  - Serializable isolationでは、対象predicateに一致する競合appendと、競合delete／rewriteを検証する
  - Snapshot isolationでは競合appendを許容し、主に対象fileへの競合delete／rewriteを検証する
- Schemaとpartitionの変更は、base version以降に競合するmetadata変更がないか検証する
- 競合したcommitが常に自動mergeされるわけではない

Optimistic concurrencyは「lockを一切使わない」という意味ではない。
Catalog実装はpointer更新のためにRDBMS transactionやHive lockなどを使う場合がある。

Icebergの基本的なatomicity boundaryは1tableである。
REST Catalogや製品がmulti-table commitを追加する場合はあるが、すべてのcatalogとengineに共通する保証ではない。

### 失敗した書き込み

- Commit前に書いたdata fileやmetadata fileは、commit失敗後にどのsnapshotからも参照されないorphan fileになり得る
- Retryで使わないorphan fileは、保持猶予を置いて削除する
- 実行中writerのfileを誤削除しないよう、jobの最大実行時間、storage consistency、file path、cleanup時刻を考慮する

## Schema evolution

Doc: [Evolution](https://iceberg.apache.org/docs/latest/evolution/)

- 各fieldを名前や位置ではなく、table内で再利用しないfield IDにより追跡する
- 次の変更をmetadata operationとして扱う
  - columnまたはnested fieldの追加
  - 削除
  - rename
  - reorder
  - 許可された型の拡大
- 既存data fileを即時に書き直さない
- 削除した列と同じ名前を後で追加しても、新しいfield IDを割り当て、古い値を誤って復活させない
- 型変更は任意ではない
  - `int`から`long`、`float`から`double`、decimal precisionの拡大など、仕様で許可されたpromotionに限る

EngineがSQL DDLとして公開する変更範囲は、Iceberg specificationの表現力より狭い場合がある。

## Partitionとsort orderの進化

Doc: [Partitioning](https://iceberg.apache.org/docs/latest/partitioning/)

- Partition specは、source fieldとtransformの組み合わせで定義する
  - `year(event_time)`
  - `day(event_time)`
  - `bucket(16, customer_id)`
  - `truncate(8, category)`
- Writerがpartition valueを生成し、Readerが元のcolumnへのpredicateをpartition predicateへ変換する
- 利用者が物理partition列をqueryへ重ねて書く必要がないため、hidden partitioningと呼ぶ
- Partition specを変更すると新しいspec IDを作る
  - 既存data fileは古いspecのまま残り、新しいwriteだけが新specを使う
  - Readerはfileごとのspecを使い、複数layoutを同じtableとしてscanする
- Partition evolutionは既存dataを即時に再配置しない
  - 過去fileも新layoutへ揃える場合はrewriteする
- Sort orderもmetadataとして変更できるが、古いfileの並びは自動的に変わらない

Hidden partitioningはpartition設計を不要にしない。
主要query、data volume、cardinality、file sizeに合うtransformを選び、metadata pruningの効果を測る。

## Time travel、rollback、branch

- Time travelは、保持中のsnapshot ID、branch／tag、または時刻を指定して過去のtable stateを読む
- 時刻指定はsnapshotの作成時刻やparent lineageではなく、過去にcurrentだった状態を記録する`snapshot-log`からsnapshotを選ぶ
  - `snapshot-log`はoptionalであり、指定時刻以前のentryがなければ実行できない
- 過去dataの複製を作るのではなく、過去snapshotから参照される不変fileを読む
- Rollbackは、新しいtable metadataをcommitし、current snapshotを保持中の過去snapshotへ切り替える
  - 過去snapshotの内容自体を書き換えない
- Branchとtagは、名前付きrefからsnapshotを保持し、独立した作業や固定した版の参照に使える
- Snapshot expiration後は、そのsnapshotへtime travelできない
  - 他の有効snapshotやrefからも参照されないdata fileは物理削除の対象になる

Time travelはbackupではない。
同じstorage accountの誤削除、暗号鍵の喪失、catalog破損、region障害、攻撃から復旧するには、別の保護境界と復旧手順が必要になる。

## Catalogの選択

Doc: [Iceberg catalog terms](https://iceberg.apache.org/terms/#catalog)

Spec: [File System Tables](https://iceberg.apache.org/spec/#file-system-tables)

| Catalog        | Current stateの管理                                       | 主な用途と制約                                                                                          |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hive Metastore | Table parameterなどからmetadata locationを管理する        | 既存Hadoop ecosystemとの統合。HMS、backing RDBMS、lockの運用が必要                                      |
| JDBC           | RDBMS tableでnamespace、table、metadata pointerを管理する | Atomic transactionと必要なisolationを持つRDBMSが必要                                                    |
| AWS Glue       | Glue Data Catalogでtableを管理する                        | AWS IAM、Glue API、対象engineのGlue integrationを確認する                                               |
| REST Catalog   | 共通REST protocolを介してcatalog serviceへ委譲する        | Engineと言語ごとのcatalog実装を減らし、credential vendingなどを追加できる                               |
| Apache Polaris | Iceberg REST Catalog protocolのオープンソース実装         | Authentication、policy、metastore、storage credential、HAを運用する                                     |
| Nessie         | Gitに似たbranchとcommitでcatalog stateを管理する          | Iceberg table内のsnapshot branchとは別のcatalog-level versioning                                        |
| HadoopCatalog  | Warehouse pathとwell-known version fileでtableを管理する  | Atomic renameを持つfilesystem向け。filesystem commit schemeはobject storageとlocal filesystemではunsafe |

「IcebergはHive Metastoreと違ってRDBMSを使わない」とは限らない。
Table stateの詳細はmetadata fileへ置くが、table名の解決とcommit調整にHive MetastoreやJDBC catalogを選べる。

Iceberg specificationは、HadoopTableOperationsが実装するfilesystem commit schemeをdeprecatedとし、策定中のspec version 4で削除する予定である。
Object storageでは、current metadata pointerをcompare-and-swapできるmetastoreまたはcatalog serviceを使う。

## Engineと製品

Doc: [Multi-engine support](https://iceberg.apache.org/multi-engine-support/)

- Apache Iceberg projectはSpark、Flink、Hive向けintegrationを提供する
- Trino、Prestoなどは各engine側でIceberg connectorを実装する
- Snowflake、BigQuery、Amazon Athena、Oracle Databaseなどの製品もIceberg tableを扱う

「Icebergをサポートする」は、次のすべてを意味する二値の表現ではない。

- readとwrite
- catalog type
- format v1、v2、v3
- append、overwrite、`UPDATE`、`DELETE`、`MERGE`
- Copy-on-writeとMerge-on-read
- position delete、equality delete、deletion vector
- schema／partition evolution
- branch、tag、time travel
- maintenance procedure
- catalog側の認可とstorage credential

採用時は、主writerと全readerの製品versionを固定した互換表を作る。
最も機能の少ない必須readerが解釈できないtable featureは有効にしない。

### Managed productの例

- [Amazon AthenaのIceberg対応](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg.html)
- [Amazon S3 Tables](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-tables.html)
- [Snowflake Iceberg Tables](https://docs.snowflake.com/en/user-guide/tables-iceberg-create)
- [BigQueryのIceberg managed table](https://docs.cloud.google.com/bigquery/docs/biglake-iceberg-tables-in-bigquery)
- [Oracle Autonomous AI DatabaseからのIceberg query](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/query-external-data-apache-iceberg.html)
- [[cloud/oracle/ai/oracle-ai-data-platform|Oracle AI Data Platform]]

Managed tableでは、外部writerを許可する範囲、catalogの所有者、automatic compaction、garbage collection、storage pathの所有権を確認する。
同じlocationを複数の管理サービスへ所有させると、一方が他方のfileをorphanと判断して削除し得る。

## Maintenance

Doc: [Iceberg maintenance](https://iceberg.apache.org/docs/latest/maintenance/)

| 操作                        | 目的                                                               | 主な注意                                           |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Data file rewrite           | small fileをまとめ、配置とsizeを調整する                           | 書込費、commit conflict、古いsnapshotの参照        |
| Delete file rewrite         | 多数のdelete fileをまとめる                                        | Merge-on-readの読取費とretention                   |
| Manifest rewrite            | 小さなmanifestをまとめ、partition配置を改善する                    | planning費とmetadata write                         |
| Snapshot expiration         | 不要なsnapshotと専用fileを削除可能にする                           | Time travel、branch／tag、監査、障害調査の保持期間 |
| Orphan file removal         | どのmetadataからも参照されないfileを削除する                       | 実行中write、異なるURI表記、共有location、dry run  |
| File-level metrics          | Data fileの書込時にlower／upper bound、null countなどを記録する    | Metrics mode、機微情報、既存fileのrewrite要否      |
| Table／partition statistics | Optionalなstatistics fileまたはengine固有のoptimizer統計を生成する | 対応engine、生成owner、形式、鮮度                  |

Maintenanceはtable formatが自動実行する処理ではない。
Engineのprocedure、専用service、scheduler、managed productのいずれが所有するかを1つに決め、実行結果を監視する。

## 導入時の確認

- 1tableを2つ以上のengineから読む必要があるか
- 複数engineからwriteする必要が本当にあるか
- Catalogとstorageのcurrent ownerはどれか
- Readerとwriterが同じformat versionとdelete semanticsを扱えるか
- Partition transformとtarget file sizeが主要queryに合うか
- Snapshot、branch、tag、orphanの保持期間を決めたか
- Compaction、manifest rewrite、statisticsを誰が実行するか
- Time travelとは別にbackupとdisaster recoveryがあるか
- Schema、data quality、owner、classification、lineageをgovernance catalogへ記録するか

単一DWHで要件を満たす小規模なデータまでIcebergへ移すと、catalog、file maintenance、互換性検証の運用が増える。
共有storage、大規模table、複数engine、長い履歴、schema／partition evolutionが必要な範囲から適用する。

## 関連メモ

- [[data/index|データ基盤の構成要素]]
- [[data/apache-hive|Apache Hive]]
- [[data/open-table-formats|オープンテーブルフォーマット]]
- [[cloud/oracle/ai/oracle-ai-data-platform|Oracle AI Data Platform]]

## 参考資料

- [“まるっとわかる” Open Table Format（Apache Iceberg）](https://qiita.com/yushibats/items/cf774e9c4ac3d6036622)
- [Apache Iceberg入門：作られるファイルから理解するメタデータとマニフェスト](https://qiita.com/yushibats/items/4ed861e3a8f34f56b1e1)
- [Apache Iceberg入門：誕生の背景から特徴、アーキテクチャまとめ](https://qiita.com/yushibats/items/b6e4b74006c5133442f7)
- [Icebergとは何かについて理解していきたい](https://qiita.com/ponkomarujp/items/dc9b90c3a2a1cbd6101c)
- [Apache Iceberg REST Catalog specification](https://iceberg.apache.org/rest-catalog-spec/)
- [Apache Polaris](https://polaris.apache.org/)
