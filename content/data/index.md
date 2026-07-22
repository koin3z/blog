---
title: データ基盤の構成要素
date: 2026-07-22
modified: 2026-07-22
draft: false
tags:
  - data/platform
aliases: []
description: データウェアハウス、データレイク、レイクハウスを、ストレージ、ファイル形式、テーブル形式、カタログ、実行エンジンの責任境界から整理する。
---

## 概要

- データ基盤は、データを保存するストレージだけでは成立しない
  - 取り込み、ファイルの符号化、テーブル状態の管理、名前解決、計算、提供、ガバナンスを組み合わせる
- オブジェクトストレージとParquetは、データを低コストかつ分析向けに保存する
  - 複数ファイルのうちどれが現在のテーブルに属するか、更新をいつ公開するか、過去の状態をどう保持するかは決めない
- [[data/open-table-formats|オープンテーブルフォーマット]]は、ファイル集合にテーブルとしての状態とコミット規則を加える
- [[data/apache-hive|Apache Hive]]は、Hadoop上のファイルへSQLと共有メタデータを持ち込み、後続のデータ基盤の出発点になった
- [[data/apache-iceberg|Apache Iceberg]]は、ディレクトリではなくメタデータからファイル集合を追跡し、複数エンジンから一貫したスナップショットを扱えるようにする

## 責任の層

Doc: [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)

| 層                                      | 主な責任                                                           | 管理するもの                                               | 代表例                                                                             | 単独では管理しないもの                |
| --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| データソース                            | 業務上の正本やイベントを生成する                                   | トランザクション、業務オブジェクト、イベント               | RDBMS、SaaS、アプリケーションログ、IoT                                             | 分析用の統合モデル                    |
| 取り込み                                | ソースからデータを移送する                                         | バッチ、イベント、変更履歴、再実行位置                     | ETL／ELT、CDC、Kafka、GoldenGate、Debezium                                         | 保存先テーブルの完全な品質            |
| ストレージ                              | バイト列を永続化する                                               | ファイル、オブジェクト、パス、耐久性                       | HDFS、Amazon S3、Azure Data Lake Storage、Google Cloud Storage、OCI Object Storage | スキーマ、現在のテーブル状態、SQL     |
| ファイル形式                            | 1ファイル内の値を符号化する                                        | 列、行グループ、圧縮、ファイル内統計                       | Parquet、ORC、Avro、CSV、JSON                                                      | 複数ファイルの所属、履歴、コミット    |
| テーブル管理（従来型・非transactional） | ディレクトリとメタストア登録からファイル集合を表として見せる       | スキーマ、table／partition location、配置規則              | Hive形式の配置規則                                                                 | 共通snapshot、表全体のatomic commit   |
| テーブル管理（オープン形式）            | コミット済みメタデータからファイル集合を論理テーブルとして管理する | スキーマ、partition、snapshot、追加と削除、commit規則      | Iceberg、Delta Lake、Hudi、Paimon                                                  | SQLの計算資源、組織全体の用語集や権限 |
| カタログ／メタストア                    | 名前からテーブルを発見し、現在のメタデータへ解決する               | カタログ、名前空間、テーブル識別子、メタデータ位置         | Hive Metastore、AWS Glue Data Catalog、Iceberg REST Catalog、Apache Polaris        | データ行そのもの                      |
| 実行エンジン                            | 読み書きと計算を実行する                                           | クエリ計画、タスク、メモリ、CPU                            | Hive、Spark、Flink、Trino、Presto、Snowflake、BigQuery                             | 他エンジンの実装差の吸収              |
| 提供                                    | 利用者やアプリケーションへ結果を返す                               | SQLエンドポイント、BIモデル、特徴量、検索インデックス、API | DWH、データマート、BI、ML、RAG                                                     | 上流データの正しさ                    |
| ガバナンス                              | データの意味、責任者、利用条件を管理する                           | 用語、所有者、分類、リネージ、品質、ポリシー、監査         | データカタログ、IAM、マスキング、品質管理                                          | ストレージ上の原子的なテーブル更新    |

> [!note] 「カタログ」が指す範囲
>
> テーブルカタログは、名前解決と現在のテーブルメタデータへの到達を担う。
> 製品によっては、所有者、用語集、リネージ、権限、資格情報の払い出しまで同じ「カタログ」に含める。
> Icebergのカタログ要件と、組織全体のデータガバナンスを同一視しない。

Hive MetastoreをIceberg catalogとして使う場合、Hive Metastoreは主にtable名からcurrent metadata JSONのlocationを解決する。
Icebergのpartitionとfile所属はIceberg metadataが管理し、従来型Hive tableのように各partitionをHive Metastoreのpartition objectへ登録しない。

## 成立の背景

### データウェアハウス

- 業務データベースは、注文や決済などの短いトランザクションを正しく更新するOLTPを優先する
- データウェアハウス（DWH）は、複数の業務システムから履歴を集め、分析用のスキーマ、統計、索引、実行計画で大規模集計を処理する
- データマートは、DWHや他の基盤から対象部門、指標、用途に必要なデータを切り出す
- 従来のDWHは、ストレージ、テーブル管理、実行エンジンが1製品内で密接に連携する構成が多かった
  - 一貫性と性能を管理しやすい一方、非構造化データ、独自の計算エンジン、データ移送量が増えるとコピーとコストが増えやすい

### HadoopとHive

Paper: [Hive: A Warehousing Solution Over a Map-Reduce Framework](https://www.vldb.org/pvldb/vol2/vldb09-938.pdf)

- Hadoopは、HDFSへデータを分散保存し、MapReduceでサーバー群へ処理を分配した
- 当初の分析では、処理ごとにMapReduceプログラムを実装する必要があった
- Hiveは、HiveQLをMapReduceなどの実行計画へ変換し、ファイルへ表構造を与えるHive Metastoreを導入した
  - SQL利用者と分散処理の間をつなぎ、SparkやPrestoなどが同じメタストアを参照する基盤にもなった
- 従来型の非transactional native Hive tableは、テーブルやパーティションを主にストレージ上のディレクトリへ対応づける
  - 大量のパーティション、複数ライター、複数パーティションの一括変更、オブジェクトストレージ上の更新で管理負荷が表面化した

### データレイク

- データレイクは、構造化データに限らず、ログ、画像、音声、文書などをHDFSやオブジェクトストレージへ保持する
- 保存時にすべての利用目的へ合わせて変換せず、読み取り時に利用側が構造を解釈するschema-on-readを取りやすい
- ストレージと計算を分離すると、同じデータへ複数の実行エンジンを接続できる
- ファイルだけを共有して各エンジンが独自に更新すると、読み手が更新途中を観測したり、メタデータと実体がずれたりする
  - エンジン別のコピーで回避すると、鮮度、保存費、権限、リネージ、再現性をコピーごとに管理する必要がある

### レイクハウス

Paper: [Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics](https://cs.stanford.edu/~matei/papers/2021/cidr_lakehouse.pdf)

- レイクハウスは、直接参照できる低コストなストレージへ、DWHが持つトランザクション、履歴、監査、最適化などの管理機能を組み合わせるアーキテクチャ
- オープンテーブルフォーマットは、レイクハウスを構成する代表的な方法
  - レイクハウスそのものの定義ではなく、実行エンジン、カタログ、セキュリティ、運用を別途組み合わせる
- 「1つのデータを複数エンジンで使う」構成でも、各エンジンの読み取りと書き込みの対応範囲が同じとは限らない
  - 形式バージョン、DDL、`UPDATE`／`DELETE`／`MERGE`、削除ファイル、カタログ、コミット、認可の対応を個別に確認する

## アーキテクチャの比較

| 観点             | データウェアハウス                  | データレイク                           | レイクハウス                                             |
| ---------------- | ----------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| 主な保存対象     | 分析用に整形した構造化データ        | rawからcuratedまでの多様なデータ       | 分析テーブルとファイル資産                               |
| ストレージ       | 製品管理のストレージが中心          | HDFSまたはオブジェクトストレージ       | オブジェクトストレージと管理対象ストレージ               |
| スキーマ         | schema-on-writeが中心               | schema-on-readを取りやすい             | 書き込み契約と読み取り時解釈を層ごとに使い分ける         |
| テーブル状態     | DWHエンジンが管理                   | ファイル配置や外部メタストアに依存     | テーブル形式とカタログが管理                             |
| トランザクション | 製品のDBMS機能                      | 単純なファイル共有では限定的           | テーブル形式または管理サービスが提供                     |
| 主な実行エンジン | 製品のSQLエンジン                   | Spark、Flink、Trinoなど                | SQL、バッチ、ストリーム、MLの複数エンジン                |
| 強み             | SQL、BI、同時実行、統計、運用の統合 | 保存コスト、形式の自由度、直接アクセス | 共有ストレージとテーブル管理の両立                       |
| 設計上の負担     | 製品への移送、容量、ロックイン      | 品質、発見、整合性、small file         | カタログ整合、互換性、compaction、履歴保持、権限の重なり |

この分類は製品を排他的に分けるものではない。
現在のDWH製品は外部Icebergテーブルを扱い、レイクハウス製品は管理型SQL Warehouseを含むため、製品名ではなくデータごとの責任境界を確認する。

## データ処理の用語

| 用語                   | 意味                                                       | 設計時に固定する条件                                     |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| OLTP                   | 短い業務トランザクションを低遅延で処理する方式             | 正本、整合性、ロック、復旧                               |
| OLAP                   | 多数行の走査、集計、結合を中心とする分析処理               | 列指向化、パーティション、並列度、同時実行               |
| ETL                    | 取り出したデータを基盤の外または途中で変換してから読み込む | 変換場所、再実行、失敗時の中間状態                       |
| ELT                    | 先に基盤へ読み込み、基盤内の計算資源で変換する             | rawデータの権限、計算費、変換履歴                        |
| CDC                    | ソースの挿入、更新、削除を変更履歴として捕捉する           | 順序、重複排除、削除表現、再開位置、schema change        |
| バッチ                 | 有界なデータ集合を一定間隔で処理する                       | 対象期間、締め時刻、再実行単位                           |
| ストリーミング         | 継続的なイベントを到着に合わせて処理する                   | event time、watermark、順序、遅延、exactly-onceの境界    |
| パーティション         | 値や変換規則でデータを物理グループへ分ける                 | 主要filter、粒度、偏り、進化方法                         |
| スナップショット       | ある時点でテーブルを構成するファイルとメタデータの状態     | 保持期間、参照元、削除条件                               |
| Time travel            | 保持中の過去スナップショットを読む機能                     | 保持期間とファイル削除に依存し、バックアップを代替しない |
| Compaction             | small fileや差分ファイルを大きなファイルへ再編する         | 実行頻度、読取性能、書込費、競合、履歴保持               |
| Medallion architecture | Bronze、Silver、Goldで品質と用途の段階を分ける設計         | 各層の品質契約、所有者、保持期間、公開条件               |

Bronze、Silver、Goldは論理的な品質段階であり、Icebergなどのテーブル形式が意味を強制する名称ではない。
フォルダ名だけで分けず、各段階の入力条件、品質検査、更新SLA、権限、下流契約を定義する。

## 代表的な製品構成

以下は2026-07-22時点の対応例である。
同じ製品でも、管理tableと外部tableではcommit ownerが異なる。
リージョン、製品version、table format versionごとにread／writeの対応を確認する。

| 構成                        | 物理ストレージ                                                                          | テーブル管理方式                                                                                                                           | Catalog／commit owner                                                                                                                                                                 | 読み書き・提供                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Apache OSS                  | HDFSまたは各社object storage                                                            | Apache Iceberg                                                                                                                             | Hive Metastore、JDBC、REST Catalog、Apache Polarisなど                                                                                                                                | Spark、Flink、Hive、Trinoなど。機能範囲はengineごとに異なる                       |
| AWS：一般bucket             | Amazon S3 general purpose bucket                                                        | Apache Iceberg                                                                                                                             | AWS Glue Data Catalogなど                                                                                                                                                             | EMR／Spark、Athenaなど。RedshiftはGlue上のIcebergをqueryする                      |
| AWS：S3 Tables              | [S3 table bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-tables.html) | S3 TablesがIceberg tableとmaintenanceを管理                                                                                                | S3 Tables catalog。[Glue Data Catalogへfederation](https://docs.aws.amazon.com/glue/latest/dg/glue-federation-s3tables.html)できる                                                    | 対応するAWS analytics serviceとIceberg client                                     |
| Google Cloud：BigQuery管理  | Cloud Storage                                                                           | [Apache Iceberg managed tables](https://docs.cloud.google.com/bigquery/docs/biglake-iceberg-tables-in-bigquery)                            | BigQueryがfile、metadata、optimization、commitを管理                                                                                                                                  | BigQueryはread／write。外部engineから管理fileを直接変更しない                     |
| Google Cloud：複数engine    | Cloud Storage                                                                           | Apache Iceberg                                                                                                                             | [Lakehouse runtime catalog](https://docs.cloud.google.com/lakehouse/docs/lakehouse-iceberg-rest-catalog)のIceberg REST endpoint                                                       | SparkなどのREST Catalog clientとBigQuery                                          |
| Snowflake：Snowflake管理    | Snowflake-managed storageまたはcustomer-managed external volume                         | [Snowflake Iceberg Tables](https://docs.snowflake.com/en/user-guide/tables-iceberg)                                                        | Snowflake catalogがtable lifecycleとcommitを管理                                                                                                                                      | Snowflake。外部engineの経路はHorizon Iceberg REST Catalogの対応範囲を確認する     |
| Snowflake：external catalog | Customer-managed cloud storage                                                          | 既存のApache Iceberg table                                                                                                                 | Iceberg REST、AWS Glue、Snowflake Open Catalogなど外部catalogがcurrent metadataを管理                                                                                                 | Snowflakeのread／write可否はcatalog方式ごとに確認する                             |
| Microsoft Fabric            | [OneLake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)            | Delta Parquet、Apache Iceberg。metadata virtualizationで相互参照する                                                                       | 書込workloadとformat integrationがcommitを担う。OneLake catalogは発見とgovernanceを担う                                                                                               | Fabric Lakehouse／Spark、Warehouse／T-SQL、Power BI Direct Lake                   |
| Databricks：managed table   | 各社cloud storage                                                                       | Delta Lakeまたは[Apache Iceberg managed table](https://docs.databricks.com/aws/en/iceberg)                                                 | Unity Catalog                                                                                                                                                                         | Databricks Runtime、SQL Warehouse、外部Iceberg REST clientからread／write         |
| Databricks：互換経路        | 各社cloud storage                                                                       | Foreign Iceberg table、または[Delta UniForm](https://docs.databricks.com/aws/en/delta/uniform)が生成するIceberg metadata                   | External catalog、またはsource Delta tableのUnity Catalog                                                                                                                             | Foreign IcebergとDelta UniFormのIceberg viewはread-only                           |
| Oracle：Workbench管理       | OCI Object Storageなど                                                                  | [Delta Lake](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/tables.html)。Delta UniformでIceberg／Hudi互換metadataを生成する | Standard catalogがmetadata lifecycleを管理し、Workbench／SparkがDelta commitを実行する                                                                                                | [[cloud/oracle/ai/oracle-ai-data-platform\|Oracle AI Data Platform]]のSparkなど   |
| Oracle：外部参照            | OCI Object Storageまたは外部source                                                      | 外部Iceberg／Delta table                                                                                                                   | 外部sourceがmetadata lifecycleを管理し、[Master Catalog](https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/manage-master-catalog.html)は同期したexternal catalogを保持する | Oracle AI Data Platform、Autonomous AI Lakehouseなど。write ownerを個別に確認する |

## 設計の入口

1. ソースの正本と、分析側で許容する鮮度を決める
2. データ量、形式、保持期間、リージョンからストレージを決める
3. 主な読み取り条件と更新方式から、ファイルサイズ、パーティション、テーブル形式を決める
4. 書き込みを担当するエンジンとカタログを決め、同時更新の境界を1つにする
5. 他のエンジンは、形式バージョンと必要な読取／書込機能を満たす場合だけ接続する
6. スナップショット失効、orphan file削除、compaction、統計更新を運用として組み込む
7. テーブルの所有者、データ分類、品質、利用権限、監査、復旧を形式の外側で定義する

「オープン形式を採用すればロックインがなくなる」とは限らない。
SQL方言、カタログAPI、認可、メンテナンス手順、独自機能、データ転送料まで含めて移植可能性を評価する。

## 関連メモ

- [[data/apache-hive|Apache Hive]]
- [[data/open-table-formats|オープンテーブルフォーマット]]
- [[data/apache-iceberg|Apache Iceberg]]
- [[cloud/oracle/ai/oracle-ai-data-platform|Oracle AI Data Platform]]
- [[cloud/oracle/ai/mysql-heatwave-ai|MySQL HeatWave AI]]
- [[cloud/oracle/database/services/oci-autonomous-ai-database|OCI Autonomous AI Database]]

## 参考資料

- [“まるっとわかる” Open Table Format（Apache Iceberg）](https://qiita.com/yushibats/items/cf774e9c4ac3d6036622)
- [Icebergを理解する前に知っておきたい：Hiveの仕組みと課題をおさらい](https://qiita.com/yushibats/items/423859cc053c4a8fe61a)
- [Icebergとは何かについて理解していきたい](https://qiita.com/ponkomarujp/items/dc9b90c3a2a1cbd6101c)
- [Apache Parquet documentation](https://parquet.apache.org/docs/)
- [Introduction to Apache Hive](https://hive.apache.org/docs/latest/introduction-to-apache-hive/)
- [Apache Iceberg specification](https://iceberg.apache.org/spec/)
