---
title: Apache Hive
date: 2026-07-22
modified: 2026-07-22
draft: false
tags:
  - data/platform
aliases: []
description: Apache HiveのSQL-on-Hadoop、Hive Metastore、ディレクトリベースのテーブル管理と、後続のオープンテーブルフォーマットが必要になった背景を整理する。
---

← [[data/index|データ基盤の構成要素]]

## 概要

Doc: [Introduction to Apache Hive](https://hive.apache.org/docs/latest/introduction-to-apache-hive/)

- Apache Hiveは、分散ストレージ上の大規模データをSQLで読み書きし、管理するデータウェアハウスシステム
- Hiveは単一の「ファイル形式」や「テーブル形式」だけを指さない
  - HiveQLとクエリ処理
  - HiveServer2とDriver
  - Hive Metastore
  - テーブル、partition、bucketの配置規則
  - SerDe、Storage Handler、ParquetやORCなどのデータファイル
- 「Hiveテーブル形式」は、Hive Metastoreへ表定義とpartitionを登録し、ディレクトリ内のファイルを表の内容として扱う従来型の構成を指す通称
  - Icebergのような単一のオープン仕様と同一視しない
- Hive Metastoreは現在も、Spark、Trinoなどがテーブルを共有するカタログや、Iceberg catalogの実装として使われる
  - 従来型Hive tableでは、tableとpartitionの定義やlocationを管理する
  - IcebergのHiveCatalogでは、Hive Metastoreのtable entryからcurrent metadata JSONのlocationを解決する
  - Icebergのpartitionとfile所属はIceberg metadataが管理し、通常はHive Metastoreのpartition objectを使わない

## 成立の背景

Paper: [Hive: A Warehousing Solution Over a Map-Reduce Framework](https://www.vldb.org/pvldb/vol2/vldb09-938.pdf)

- 2000年代後半のFacebookでは、ログと分析データの増加に対し、商用RDBMS中心の基盤だけでは容量と日次処理時間を拡張しにくくなった
- Hadoopは、コモディティサーバー群へデータと処理を分散できた
  - HDFSは大容量ファイルのストリーミング処理を重視し、初期のMapReduceは中間結果をファイルへ書きながらバッチ処理した
- Hadoop上の集計にはMapReduceプログラムが必要であり、SQL利用者が直接分析しにくかった
- Hiveは、テーブル、列、partitionとHiveQLを導入し、宣言的なクエリをMapReduceの実行計画へ変換した
  - 2007年前後の社内課題から開発され、2008年にオープンソース化され、2009年にVLDB論文が発表された

Hiveが解いた問題は「HadoopをRDBMSへ置き換えること」ではない。
分散ストレージ上のファイルへ表の見方とSQLの入口を与え、データ処理をMapReduceの実装者以外へ広げることだった。

## 構成要素

Doc: [Hive Metastore 3.0 Administration](https://hive.apache.org/docs/latest/admin/adminmanual-metastore-3-0-administration/)

| 構成要素               | 責任                                                                       | 主な状態                                                 |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| HiveServer2            | JDBC／ODBCなどの接続、session、認証、クエリ受付                            | session、operation                                       |
| Driver／Compiler       | HiveQLのparse、意味解析、最適化、実行計画作成、進捗管理                    | query plan、task                                         |
| Hive Metastore Service | database、table、従来型Hiveのpartition、functionなどのメタデータを提供する | object definition、statistics、authorization record      |
| Metastore RDBMS        | Hive Metastoreの永続状態を保存する                                         | table、column、partition、storage descriptorなど         |
| 実行基盤               | 分散タスクを実行する                                                       | TezのDAG、YARN resource。MapReduceはHive 4.2でdeprecated |
| SerDe／Storage Handler | ファイル内の値とHiveの行、列、型を相互変換する                             | row format、input／output format                         |
| 分散ストレージ         | データファイルを保持する                                                   | HDFS path、object key、ORC／Parquet／Avroなど            |

HiveQLをSpark SQLで実行することと、HiveがSparkを実行バックエンドに使うHive-on-Sparkは別の構成である。
Hive-on-SparkはHive 4で削除されたが、SparkがHive MetastoreやHive互換テーブルを利用する構成は残る。

## クエリの流れ

1. クライアントがHiveServer2へHiveQLを送る
2. DriverとCompilerが構文と型を検査する
3. CompilerがHive Metastoreから、テーブルの列、ファイル形式、場所、partition、統計を取得する
4. Optimizerがpartition pruning、join順、実行方式を決める
5. 実行基盤が対象ファイルを読み、Tezのtaskを実行する
6. HiveServer2が結果または出力テーブルをクライアントへ返す

6段階のうち、実際にファイルを読み書きするのは実行基盤だけで、それ以前の段階はメタデータの取得と計画作成に専念する。

![[attachments/hive-query-flow.png|780]]

初期HiveはHiveQLをMapReduce jobへ変換した。
MapReduceは処理段階ごとにjob起動と中間ファイルを必要とするため、対話的なSQLでは遅延が大きくなりやすかった。
Tezは複数段を1つのDAGとして計画し、job起動と不要な中間書き出しを減らした。

## テーブルとファイル

### Managed tableとexternal table

Doc: [Managed vs. External Tables](https://hive.apache.org/docs/latest/language/managed-vs--external-tables/)

| 種別           | データの所有                                                         | 既定の配置                                       | `DROP TABLE`の一般的な動作   |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------- |
| Managed table  | Hiveがメタデータとデータのライフサイクルを管理する                   | managed warehouse配下                            | メタデータとデータを削除する |
| External table | 外部システムがデータファイルを所有でき、Hiveは表定義と場所を管理する | external warehouse配下、または指定した`LOCATION` | メタデータだけを削除する     |

Hiveのバージョンとtable propertyにより削除動作は変わる。
Hive 4のexternal tableでも`external.table.purge=true`ならデータを削除するため、「externalなら常にファイルが残る」とは限らない。

### Partition

Doc: [LanguageManual DDL](https://hive.apache.org/docs/latest/language/languagemanual-ddl/)

```text
sales/
├── year=2025/
│   ├── month=12/
│   │   ├── part-00000.parquet
│   │   └── part-00001.parquet
│   └── month=11/
└── year=2026/
    └── month=01/
```

- `PARTITIONED BY (year, month)`のように、partition列の値ごとに別ディレクトリを作る
- partition列は通常、データファイル内の列とは別に、パスとHive Metastoreから得る疑似列
- `WHERE year = 2026 AND month = 1`から対象ディレクトリを絞り、不要なファイルを読まない
- 外部処理がディレクトリだけを追加しても、従来構成ではHive Metastoreに自動登録されない
  - `ALTER TABLE ... ADD PARTITION`
  - `MSCK REPAIR TABLE ... ADD PARTITIONS`
  - 対応バージョンで`discover.partitions=true`による同期
- `MSCK REPAIR`はストレージを走査するため、未登録partitionが多い場合は処理時間とメモリを消費する

### Bucket

- bucketは、partition内の行を指定列のhash値で`num_buckets`個のbucket IDへ割り当てる
- writerはbucket IDに対応するファイルへ出力する
  - 追加書き込みやACIDのbase／delta directoryでは、同じbucket IDに対応するファイルが複数存在し得る
- partitionは検索範囲をディレクトリ単位で除外し、bucketはjoinやsamplingなどのファイル配置を調整する
- bucket数と書き手の実装が一致しなければ、期待した配置と最適化を得られない

### File formatとSerDe

- Hive tableは、ORC、Parquet、Avro、textなど複数のファイル形式を扱う
- File formatは1ファイル内の物理表現を定める
- SerDeは、ファイル内の値をHiveの行と列へ変換する
- Hive Metastoreのschema、SerDe、file formatと、実際のファイル内容が一致しなければ、読取エラーまたは誤った値になる

## 後続技術への影響

- SQLと分散実行計画を分けたことで、実行基盤をMapReduceからTezへ発展させながら同じテーブル抽象を維持できた
- Hive Metastoreを独立したmetadata serviceにしたことで、SparkやTrinoなどがHive以外の実行エンジンから同じtable definitionを共有する経路になった
- ディレクトリとpartition objectに依存する管理限界が明確になり、file単位の所属とsnapshotを管理するオープンテーブルフォーマットの開発につながった

## 従来型テーブルの制約

### 表状態の分散

- Hive Metastoreはtableとpartitionの場所を持つが、従来型テーブルの個々のデータファイルはストレージ上の一覧から得る
- 「この時点で表を構成する全ファイル」を表す共通スナップショットがない
- 外部writerがファイルを直接追加、置換、削除すると、Hive Metastore、統計、実体がずれ得る

### 複数ファイルの公開

- 従来型の非transactional tableでは、partitionをまたぐ変更や外部writerの変更を、他のreaderへ表全体の1つのsnapshotとして公開しにくい
- 書き込み中のファイルを一時場所へ置いてrenameする方式は、原子的なrenameを持つHDFSでは使いやすい
- Amazon S3のgeneral purpose bucketはfilesystemのrenameを持たず、Hadoop S3Aはcopyとdeleteで模倣する
  - 処理量がファイル数とデータ量に比例し、rename途中の失敗も扱う必要がある
- 現在のAmazon S3は強いread-after-writeとLIST consistencyを持つため、問題を「S3が常に結果整合だから」と説明しない

### Partitionへの物理依存

- Hiveは、`event_time`と、それから作った`event_date` partition列の関係を自動では知らない
- `event_time`だけをfilterしても`event_date`によるpartition pruningが働かない場合がある
- writerが誤ったpartition値を登録しても、ファイル内の値との一致をHive形式だけでは保証しない
- partition粒度を日次から時間単位へ変更すると、物理配置と既存queryのpartition条件が影響を受ける

### 大量のpartitionとsmall file

- partition、ファイル、ディレクトリが増えると、実データを読む前のメタデータ取得、LIST、file open、task生成が増える
- small fileはストレージ要求とtask schedulingを増やし、列指向formatの圧縮とscan効率も下げる
- Hive MetastoreをRDBMSで動かすことだけが原因ではない
  - partition metadata、ストレージ一覧、実行計画、ファイル読取の各層に負荷が分かれる

これらの制約から、ファイル単位の所属、スナップショット、列統計、コミットをメタデータで追跡する[[data/open-table-formats|オープンテーブルフォーマット]]が発達した。

## Hive ACIDとの違い

Doc: [Hive Transactions](https://hive.apache.org/docs/latest/user/hive-transactions/)

- 「HiveにはACIDがない」は現在のApache Hiveには当てはまらない
- Hiveのfull ACIDは、managed ORC tableへbase／delta directory、Transaction Manager、lock、Compactorを使う行レベル更新を追加する
- Insert-only transactional tableは別のmodeであり、他のfile formatにもtransactional insertを提供するが、`UPDATE`と`DELETE`は扱わない
- Hiveのtransactional tableは、Hiveのversion、file format、table property、compaction運用に依存する
- `BEGIN`、`COMMIT`、`ROLLBACK`で複数statementをまとめる一般的なOLTP transactionではなく、statementごとのauto-commit
- legacy external tableや、複数の異なるengineが独自に更新するtableへ、Hive ACIDが自動的に適用されるわけではない

Icebergなどが生まれた理由は「Hiveに後からtransaction機能が存在しないから」ではない。
共有ストレージ上の表状態とpartitionを、特定のHive ACID実装から分離し、複数エンジンが解釈できるテーブル仕様として扱うためである。

## 現在の位置づけ

Doc: [Hive Iceberg integration](https://hive.apache.org/docs/latest/user/hive-iceberg-integration/)

- Hiveは、現在もSQL engine、HiveServer2、Hive Metastoreとして利用できる
- Hive Metastoreは、従来型Hive tableとIceberg tableの両方にtable entryを提供できる
  - 従来型Hive tableではtableとpartitionの定義やlocationを保持する
  - Iceberg tableではcurrent metadata JSONへのpointerが中心で、partitionとfileの詳細はIceberg metadataへ置く
- Hive engineも対応バージョンではIceberg tableを読み書きできる
- 「HiveかIcebergか」という製品の二者択一ではない
  - Hive engineが従来型Hive tableを扱う構成
  - SparkやTrinoがHive Metastoreをcatalogとして使う構成
  - Hive engineがIceberg tableを扱う構成
  - IcebergがHive Metastore以外のcatalogを使う構成

設計時は`Hive`という名称だけで判断せず、query engine、table format、catalog、storageのどの役割をHiveが担当するかを書く。

## 関連メモ

- [[data/index|データ基盤の構成要素]]
- [[data/open-table-formats|オープンテーブルフォーマット]]
- [[data/apache-iceberg|Apache Iceberg]]

## 参考資料

- [Icebergを理解する前に知っておきたい：Hiveの仕組みと課題をおさらい](https://qiita.com/yushibats/items/423859cc053c4a8fe61a)
- [Hive: A Petabyte Scale Data Warehouse Using Hadoop](https://engineering.fb.com/2009/06/10/web/hive-a-petabyte-scale-data-warehouse-using-hadoop/)
- [HDFS Architecture](https://hadoop.apache.org/docs/current/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html)
- [Overview of major changes in Apache Hive 4](https://hive.apache.org/docs/latest/overview-of-major-changes/)
- [Apache Iceberg reliability](https://iceberg.apache.org/docs/latest/reliability/)
